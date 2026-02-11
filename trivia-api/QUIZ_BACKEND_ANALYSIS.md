# QUIZ Backend Audit (trivia-api)

Дата аудита: 2026-02-11
Область: полный контур викторины (HTTP, WebSocket, scheduler, question flow, answer flow, results, prizes, pool, Redis, Postgres)

## 1) Что проверено

Проверены модули:
- `internal/service/quizmanager/scheduler.go`
- `internal/service/quizmanager/question_manager.go`
- `internal/service/quizmanager/answer_processor.go`
- `internal/service/quizmanager/adaptive_selector.go`
- `internal/service/quizmanager/difficulty_config.go`
- `internal/service/quiz_manager.go`
- `internal/service/quiz_service.go`
- `internal/service/result_service.go`
- `internal/repository/postgres/quiz_repo.go`
- `internal/repository/postgres/question_repo.go`
- `internal/repository/postgres/result_repo.go`
- `internal/repository/redis/cache_repo.go`
- `internal/handler/quiz_handler.go`
- `internal/handler/ws_handler.go`
- `internal/websocket/manager.go`
- `internal/websocket/shard.go`
- `migrations/000021_unique_quiz_in_progress.up.sql`

## 2) Как система работает сейчас (простыми словами)

### Создание и планирование
- Админ создает викторину через `CreateQuiz`.
- При создании она ставится в `scheduled`.
- Планирование выполняет `Scheduler.ScheduleQuiz`: проверяет время, проверяет достаточность вопросов (quiz + pool), ставит таймеры анонса/лобби/отсчета/старта.

### Запуск
- На старте `Scheduler.triggerQuizStart` делает атомарный переход `scheduled -> in_progress` через `AtomicStartQuiz`.
- Отправляет `quiz:start` в WebSocket.
- `QuizManager` поднимает `ActiveQuizState` и запускает цикл вопросов.

### Вопросы и адаптивность
- `QuestionManager.RunQuizQuestions` идет по циклу (по конфигу, обычно 10).
- Каждый вопрос выбирается адаптивно (`AdaptiveSelector`):
  - сначала вопросы конкретной викторины,
  - потом из pool,
  - если нет точной сложности, fallback по соседним сложностям.
- После вопроса: reveal, статистика, выбывание по неответу, реклама (если есть слот).

### Ответы и выбывание
- `AnswerProcessor.ProcessAnswer`:
  - проверяет, не выбыл ли пользователь,
  - считает время ответа,
  - определяет correct/incorrect,
  - пишет `user_answers` в БД,
  - ставит Redis-флаги,
  - шлет персональный `quiz:answer_result`.
- Выбывание по неответу делает `processNoAnswerEliminations`.

### Завершение, результаты, призы
- `finishQuiz` завершает викторину и запускает подсчет:
  - индивидуальные результаты,
  - ранги,
  - победители,
  - распределение призов.
- Победитель: `correct_answers == totalQuestions` и `is_eliminated = false`.

## 3) Что уже сделано правильно (подтверждено)

- Есть защита от двойного одновременного старта через partial unique index (`000021`) + `AtomicStartQuiz`.
- В `QuestionManager` добавлен batch-подход для Redis (`ExistsBatch`) и fallback при ошибках pipeline.
- Если викторина закончилась раньше из-за нехватки вопросов, `question_count` пытаются обновлять на фактическое число заданных вопросов.
- `ResultService` берет `total_questions` через единый helper `getTotalQuestions`.

## 4) Найденные проблемы (актуальные)

### HIGH-1: `question_count` может откатиться обратно на старое значение в финале
Файл: `internal/service/quiz_manager.go`

Что происходит:
- `QuestionManager` при раннем завершении обновляет `question_count` точечно через `UpdateQuestionCount`.
- Но в `finishQuiz` вызывается `quizRepo.Update(quiz)` на старом объекте `quiz` из памяти.
- Это full-save и может перезаписать в БД свежий `question_count` назад (например, снова в 10).

Последствие:
- Победители и призы снова считаются как будто вопросов было 10, даже если реально было меньше.

Рекомендация:
- В `finishQuiz` не делать full `Update(quiz)`.
- Делать точечное обновление только статуса (`UpdateStatus`) и не трогать `question_count`.

---

### MEDIUM-1: можно получить очко за правильный, но просроченный ответ
Файлы:
- `internal/service/quizmanager/answer_processor.go`
- `internal/domain/entity/question.go`

Что происходит:
- В `ProcessAnswer` игрок с `time_exceeded` считается выбывшим.
- Но очки считаются через `CalculatePoints(isCorrect, responseTimeMs)`, где сейчас за любой `isCorrect=true` дается `1`.

Последствие:
- Логика выбывания говорит "не прошел", а очки все равно начисляются.

Рекомендация:
- Передавать в расчет очков условие "правильный и в пределах времени".
- Либо в `ProcessAnswer` принудительно обнулять score при `isTimeLimitExceeded=true`.

---

### MEDIUM-2: отмена викторины шлется всем клиентам, а не только подписанным на этот quiz
Файл: `internal/service/quizmanager/scheduler.go`

Что происходит:
- `CancelQuiz` использует `WSManager.BroadcastEvent("quiz:cancelled", ...)`.
- Это глобальная рассылка.

Последствие:
- Лишний шум по WS и вероятность нежелательных реакций на фронте.

Рекомендация:
- Использовать `BroadcastEventToQuiz(quizID, ...)` для точечной отправки.

---

### MEDIUM-3: ответ может быть принят от пользователя, который не был зарегистрирован как участник
Файлы:
- `internal/service/quizmanager/answer_processor.go`
- `internal/service/quiz_manager.go`

Что происходит:
- Участник для финального подсчета берется из Redis Set `quiz:{id}:participants` (заполняется на `user:ready`).
- `ProcessAnswer` сам по себе не проверяет, что пользователь есть в participants Set.

Последствие:
- Теоретически пользователь может отправить ответ без `ready`.
- Его `user_answers` сохранится, но в финальном массовом проходе может не попасть в расчет результатов как участник.

Рекомендация:
- На входе `ProcessAnswer` проверять членство в participants Set.
- Или автоматически добавлять в participants при первом валидном ответе.

---

### LOW-1: countdown использует `scheduled_time` из старого snapshot в рамках одной sequence
Файл: `internal/service/quizmanager/scheduler.go`

Что происходит:
- В `runQuizSequence` время этапов рассчитывается один раз из объекта `quiz`.
- `refreshQuiz` есть для announcement/waiting/start, но countdown-loop опирается на переданный объект.

Последствие:
- Обычно не критично (перепланирование делает новый `ScheduleQuiz` и старый timer cancel), но дизайн не идеален.

Рекомендация:
- Либо фиксировать, что любое изменение времени делается только через `ScheduleQuiz`.
- Либо перед countdown тоже использовать refresh и перерасчет.

---

### LOW-2: путаница имен в `GetPoolStats`
Файл: `internal/service/quiz_service.go`

Что происходит:
- Возвращаемое имя `usedCount` в сигнатуре сервиса фактически несет `available`.
- В handler это компенсировано, но название вводит в заблуждение.

Рекомендация:
- Переименовать переменные в сервисе в `availableCount`.

## 5) Вердикт по общей логике

Общая архитектура и основной сценарий викторины в целом рабочие и уже близки к production-паттерну:
- atomic старт,
- раздельные модули,
- Redis для realtime,
- транзакционный расчет призов.

Но сейчас еще есть минимум 1 критичный риск (`HIGH-1`) и несколько средних, которые могут давать "странные" результаты в реальных сессиях.

## 6) Что исправлять в первую очередь

1. Исправить `HIGH-1` (убрать full `Update(quiz)` в `finishQuiz`, перейти на точечный `UpdateStatus`).
2. Исправить `MEDIUM-1` (обнуление score при `time_exceeded`).
3. Исправить `MEDIUM-2` (cancel только в конкретный quiz channel).
4. Исправить `MEDIUM-3` (валидировать участника перед приемом ответа).

После этих четырех правок контур "вопросы -> выбывание -> результаты -> призы" станет значительно стабильнее и предсказуемее.
