# Документ по бизнес-логике викторины (backend `trivia-api`)

Актуально на: `2026-02-10`

Этот документ описывает, какие функции в проекте отвечают за викторину, как они работают, и в какой последовательности идет процесс игры.

## 1. Границы логики викторины

В документ включены:
- запуск и планирование викторины;
- выбор вопросов (в том числе адаптивная сложность);
- прием и проверка ответов;
- выбывание игроков;
- подсчет результатов, рангов и призов;
- админские действия по вопросам/пулу;
- WebSocket-события викторины;
- ключевые SQL/Redis механики, которые влияют на поведение игры.

## 2. Карта функций: что делает и как работает

### 2.1. Оркестратор игры (`QuizManager`)

Файл: `internal/service/quiz_manager.go`

| Функция | За что отвечает | Как работает |
|---|---|---|
| `NewQuizManager()` | Сборка всех компонентов викторины | Создает `Scheduler`, `QuestionManager`, `AnswerProcessor`, хранит `activeQuizState`, запускает `handleEvents()`. |
| `handleEvents()` | Центр событий викторины | Слушает канал старта из `Scheduler` и канал завершения вопросов из `QuestionManager`. |
| `ScheduleQuiz()` | Планирование квиза | Делегирует в `Scheduler.ScheduleQuiz()`. |
| `CancelQuiz()` | Отмена квиза | Делегирует в `Scheduler.CancelQuiz()`. |
| `handleQuizStart()` | Старт активной игры | Загружает квиз, создает `ActiveQuizState`, запускает `QuestionManager.RunQuizQuestions()`. |
| `finishQuiz()` | Финал квиза | Ставит статус `completed`, отправляет `quiz:finish`, считает персональные результаты участникам из Redis Set `quiz:{id}:participants`, затем вызывает распределение призов. |
| `ProcessAnswer()` | Входная точка ответа игрока | Проверяет, что ответ на текущий вопрос, берет время старта вопроса, делегирует в `AnswerProcessor.ProcessAnswer()`. |
| `HandleReadyEvent()` | Готовность игрока | Делегирует в `AnswerProcessor.HandleReadyEvent()`. |
| `GetActiveQuiz()` | Текущий активный квиз | Возвращает квиз из `activeQuizState`. |
| `GetCurrentState()` | Resync после reconnect | Возвращает текущее состояние (вопрос, таймер, выбыл/не выбыл, очки). |
| `getTotalQuestions()` | Вспомогательный расчет числа вопросов | Берет `quiz.QuestionCount`, иначе дефолт `10`. |
| `Shutdown()` | Корректная остановка | Отменяет внутренний контекст менеджера. |

### 2.2. Планировщик этапов (`Scheduler`)

Файл: `internal/service/quizmanager/scheduler.go`

| Функция | За что отвечает | Как работает |
|---|---|---|
| `NewScheduler()` | Инициализация планировщика | Создает карту отмены таймеров и канал старта квизов. |
| `GetQuizStartChannel()` | Канал старта | Отдает read-only канал ID квизов для `QuizManager`. |
| `ScheduleQuiz()` | Полное планирование | Проверяет, что время в будущем, загружает квиз, проверяет наличие вопросов/пула, сохраняет статус `scheduled`, запускает `runQuizSequence()`. |
| `CancelQuiz()` | Отмена запланированного | Проверяет статус, отменяет контекст таймеров, ставит статус `cancelled`, шлет `quiz:cancelled`. |
| `hasPoolQuestions()` | Проверка доступности пула | Ищет хотя бы 1 вопрос в пуле по сложностям 1..5. |
| `runQuizSequence()` | Последовательность до старта | По времени вызывает этапы: анонс, зал ожидания, отсчет, старт. |
| `triggerAnnouncement()` | Событие анонса | Шлет `quiz:announcement`. |
| `triggerWaitingRoom()` | Событие зала ожидания | Шлет `quiz:waiting_room`. |
| `triggerCountdown()` | Событие обратного отсчета | Каждую секунду шлет `quiz:countdown`, по нулю запускает старт. |
| `triggerQuizStart()` | Фактический старт | Обновляет статус на `in_progress`, шлет `quiz:start`, отправляет ID квиза в канал старта. |

### 2.3. Состояние активной игры (`ActiveQuizState`)

Файл: `internal/service/quizmanager/types.go`

| Функция | За что отвечает | Как работает |
|---|---|---|
| `NewActiveQuizState()` | Создание runtime-состояния | Инициализирует состояние активного квиза. |
| `SetCurrentQuestion()` | Текущий вопрос | Сохраняет вопрос и его номер под lock. |
| `GetCurrentQuestion()` | Чтение текущего вопроса | Возвращает вопрос и номер под read lock. |
| `SetCurrentQuestionStartTime()` | Время старта вопроса | Сохраняет `start_time` в мс. |
| `GetCurrentQuestionStartTime()` | Чтение старта вопроса | Возвращает время старта из состояния. |
| `ClearCurrentQuestion()` | Очистка state | Сбрасывает вопрос/номер/время старта. |

### 2.4. Адаптивная сложность и выбор вопроса

Файлы: `internal/service/quizmanager/difficulty_config.go`, `internal/service/quizmanager/adaptive_selector.go`

| Функция | За что отвечает | Как работает |
|---|---|---|
| `DefaultDifficultyConfig()` | Профиль сложности | Целевые pass-rate и базовая сложность по вопросам 1..10. |
| `GetTargetPassRate()` | Целевой pass-rate вопроса | Возвращает target для номера вопроса. |
| `GetBaseDifficulty()` | Базовая сложность вопроса | Возвращает базовый уровень 1..5. |
| `CalculateAdjustedDifficulty()` | Коррекция сложности | На основе фактического pass-rate прошлого вопроса делает следующий вопрос проще/сложнее. |
| `NewAdaptiveQuestionSelector()` | Инициализация селектора | Создает селектор с конфигом сложности и зависимостями. |
| `SelectNextQuestion()` | Главный выбор следующего вопроса | Считает фактический pass-rate, получает target difficulty, ищет вопрос по гибридной схеме (квиз -> пул -> fallback). |
| `getActualPassRate()` | Фактическая проходимость | Берет из Redis ключи `quiz:{id}:q{n}:total/passed`. |
| `findQuestionByDifficultyHybrid()` | Поиск в квизе и пуле | Сначала `GetQuizQuestionByDifficulty`, если нет — `GetPoolQuestionByDifficulty`. |
| `findQuestionWithFallbackHybrid()` | Fallback по сложностям | При `FallbackToHigher=true` ищет target..max, потом ниже. |
| `RecordQuestionResult()` | Запись статистики адаптации | Инкрементит Redis-ключи `total` и `passed`. |
| `GetDifficultyStats()` | Сколько вопросов доступно по сложности | Считает неиспользованные вопросы по уровням сложности. |

### 2.5. Подача вопросов, таймеры, no-answer вылеты

Файл: `internal/service/quizmanager/question_manager.go`

| Функция | За что отвечает | Как работает |
|---|---|---|
| `NewQuestionManager()` | Инициализация управления вопросами | Создает `AdaptiveQuestionSelector` и канал `questionDoneCh`. |
| `QuestionDone()` | Канал завершения | Сигнал для `QuizManager`, что вопросы закончились. |
| `RunQuizQuestions()` | Главный цикл вопросов | Для `MaxQuestionsPerQuiz` выбирает вопрос адаптивно, шлет `quiz:question`, запускает таймер, обрабатывает no-answer, шлет reveal и рекламу. |
| `runQuestionTimer()` | Тикер вопроса | Каждую секунду шлет `quiz:timer` до конца времени. |
| `processNoAnswerEliminations()` | Вылет по неответу | Берет участников из Redis Set `quiz:{id}:participants`, если нет флага ответа — сохраняет `UserAnswer` с `no_answer_timeout`, ставит eliminated-ключ, шлет `quiz:elimination`. |
| `processAdBreak()` | Рекламный блок между вопросами | Ищет активный слот через `GetByQuizAndQuestionAfter`, шлет `quiz:ad_break`, ждет длительность ролика, шлет `quiz:ad_break_end`. |
| `sendAdaptiveQuestionStats()` | Реалтайм статистика адаптации | Шлет `adaptive:question_stats` по фактическому pass-rate. |
| `sendEventWithRetry()` | Надежная отправка событий | Пытается отправить событие в квиз с ретраями. |
| `sendEliminationNotification()` | Уведомление о вылете | Персонально отправляет `quiz:elimination`. |

### 2.6. Обработка ответов и моментальные вылеты

Файл: `internal/service/quizmanager/answer_processor.go`

| Функция | За что отвечает | Как работает |
|---|---|---|
| `NewAnswerProcessor()` | Инициализация обработки ответов | Создает объект с зависимостями. |
| `ProcessAnswer()` | Главная проверка ответа | Проверяет выбывание, считает время ответа, определяет корректность, сохраняет `user_answers`, ставит флаги в Redis, шлет `quiz:answer_result`, при вылете шлет `quiz:elimination`. |
| `HandleReadyEvent()` | Регистрация игрока как участника | Ставит ready-ключ и добавляет игрока в Redis Set `quiz:{id}:participants` (TTL 24ч), шлет `quiz:user_ready`. |
| `GetUserQuizStatus()` | Статус игрока для resync | Возвращает выбыл/причину/очки/число верных по Redis+БД. |
| `recordAdaptiveStats()` | Статистика адаптации по ответу | Инкрементит Redis `total/passed`. |
| `sendEliminationNotification()` | Персональное событие вылета | Отправляет `quiz:elimination` игроку. |

Ключевые правила внутри `ProcessAnswer()`:
- правильность: `question.IsCorrect(selectedOption)`;
- время ответа: серверное время получения минус `question_start_time`;
- вылет: если ответ неверный (`incorrect_answer`) или превышен лимит времени (`time_exceeded`);
- если игрок уже выбыл, ответ не принимается (`already_eliminated`);
- защита от повторного ответа: уникальный индекс БД на `(user_id, quiz_id, question_id)`.

### 2.7. Результаты, ранги, победители, призы

Файл: `internal/service/result_service.go`

| Функция | За что отвечает | Как работает |
|---|---|---|
| `NewResultService()` | Инициализация сервиса результатов | Сохраняет репозитории, wsManager, config. |
| `CalculateQuizResult()` | Итог по игроку | Считает очки и верные ответы на основе `user_answers`, сохраняет `results`, обновляет `users.total_score/highest_score/games_played`. |
| `DetermineWinnersAndAllocatePrizes()` | Финализация призов | В транзакции пересчитывает ранги, находит победителей, делит фонд поровну, обновляет `results` и `users` (`wins_count`, `total_prize_won`), шлет `quiz:results_available`. |
| `GetQuizResults()` | Пагинированные результаты квиза | Берет отсортированные по рангу результаты. |
| `GetQuizResultsAll()` | Все результаты квиза | Для полного экспорта без пагинации. |
| `GetUserResult()` | Результат конкретного игрока | Отдает запись `results` по `(user_id, quiz_id)`. |
| `GetUserResults()` | История игрока | Пагинация по всем квизам пользователя. |
| `GetQuizWinners()` | Победители квиза | Отдает `results` с `is_winner=true`. |
| `CalculateQuizStatistics()` | Расширенная аналитика | Считает участников, выбытия, причины, pass-rate по вопросам, распределение сложности, и т.д. |
| `getTotalQuestions()` | Определение реального числа вопросов | Fallback: `quiz.Questions` -> `user_answers` (уникальные question_id) -> `quiz.QuestionCount`. |

### 2.8. Админские операции по квизу и пулу вопросов

Файл: `internal/service/quiz_service.go`

| Функция | За что отвечает | Как работает |
|---|---|---|
| `CreateQuiz()` | Создание квиза | Создает квиз со статусом `scheduled`, проверяет время, выставляет призовой фонд. |
| `AddQuestions()` | Ручное добавление вопросов в квиз | Разрешено только для `scheduled`, проверяет максимум вопросов, привязывает `quiz_id`, обновляет `QuestionCount`. |
| `DuplicateQuiz()` | Дублирование квиза | Копирует квиз и все его вопросы в транзакции, включая `difficulty`, `text_kk`, `options_kk`. |
| `BulkUploadQuestionPool()` | Массовая загрузка пула | Добавляет вопросы в общий пул (`quiz_id = NULL`) с валидацией сложности и `correct_option`. |
| `GetPoolStats()` | Статистика пула | Отдает общее/доступное и разбивку по сложности. |
| `ResetPoolUsed()` | Сброс «использованности» пула | Ставит `is_used=false` для использованных pool-вопросов. |
| `ScheduleQuiz()` | Обновление времени в БД | Меняет `scheduled_time`, при необходимости переводит из `completed` в `scheduled`. |
| `DeleteQuiz()` | Удаление квиза | Нельзя удалить активный (`in_progress`) квиз. |

### 2.9. API-обертка викторины (HTTP + WebSocket)

Файлы: `internal/handler/quiz_handler.go`, `internal/handler/ws_handler.go`

Функции HTTP, которые напрямую включают бизнес-логику викторины:
- `CreateQuiz()`
- `AddQuestions()`
- `ScheduleQuiz()`
- `CancelQuiz()`
- `DuplicateQuiz()`
- `BulkUploadQuestionPool()`
- `GetPoolStats()`
- `ResetPoolUsed()`
- `GetQuizResults()`
- `GetQuizWinners()`
- `GetQuizStatistics()`
- `ExportQuizResults()` (CSV/XLSX)

Функции WebSocket:
- `registerMessageHandlers()`:
- событие `user:ready` -> подписка игрока на квиз + `QuizManager.HandleReadyEvent()`;
- событие `user:answer` -> `QuizManager.ProcessAnswer()`;
- событие `user:resync` -> `QuizManager.GetCurrentState()` и ответ `quiz:state`;
- событие `user:heartbeat` -> ответ `server:heartbeat`.

### 2.10. SQL/репозитории, которые задают фактические правила

Файлы: `internal/repository/postgres/question_repo.go`, `internal/repository/postgres/result_repo.go`, `internal/repository/postgres/quiz_repo.go`, `internal/repository/postgres/quiz_ad_slot_repo.go`, `internal/repository/redis/cache_repo.go`

Ключевые функции:
- `QuestionRepo.GetQuizQuestionByDifficulty()` и `QuestionRepo.GetPoolQuestionByDifficulty()`:
- фактический выбор вопроса по сложности и источнику (квиз/пул).
- `QuestionRepo.MarkAsUsed()`:
- помечает выбранные вопросы как использованные.
- `ResultRepo.SaveUserAnswer()`:
- фиксирует ответ игрока в БД.
- `ResultRepo.CalculateRanks()`:
- SQL `RANK() OVER (ORDER BY score DESC, correct_answers DESC)`.
- `ResultRepo.FindAndUpdateWinners()`:
- победители = `correct_answers == totalQuestions AND is_eliminated = false`, деление фонда поровну, обновление `is_winner/prize_fund`.
- `CacheRepo.SAdd()/SMembers()/Exists()/Increment()`:
- готовность и участники, флаги выбывания, факт ответа, адаптивная статистика.

## 3. Последовательность работы системы (от и до)

1. Админ создает викторину: `QuizHandler.CreateQuiz()` -> `QuizService.CreateQuiz()`.
2. Квиз сразу ставится в расписание: `QuizManager.ScheduleQuiz()` -> `Scheduler.ScheduleQuiz()`.
3. Админ может добавить «свои» вопросы: `QuizService.AddQuestions()` (только пока статус `scheduled`).
4. Если своих вопросов недостаточно/нет, система может брать вопросы из пула (`quiz_id IS NULL`) через адаптивный селектор.
5. До старта `Scheduler.runQuizSequence()` шлет этапы:
6. `quiz:announcement` -> `quiz:waiting_room` -> `quiz:countdown` -> `quiz:start`.
7. Игрок отправляет `user:ready` (WS) -> `AnswerProcessor.HandleReadyEvent()`:
8. игрок добавляется в Redis Set `quiz:{id}:participants` (важно для вылетов и финального подсчета).
9. После `quiz:start` `QuizManager.handleQuizStart()` запускает `QuestionManager.RunQuizQuestions()`.
10. На каждый вопрос:
11. выбирается сложность и конкретный вопрос (`AdaptiveQuestionSelector.SelectNextQuestion()`),
12. шлется `quiz:question`,
13. запускается таймер и каждую секунду идет `quiz:timer`,
14. ответы обрабатываются `AnswerProcessor.ProcessAnswer()`.
15. По окончании таймера вопроса:
16. `processNoAnswerEliminations()` выбивает тех, кто не ответил (`no_answer_timeout`),
17. шлется `adaptive:question_stats`,
18. шлется `quiz:answer_reveal`.
19. Если настроен рекламный слот после этого вопроса:
20. шлется `quiz:ad_break`, ожидание длительности рекламы, затем `quiz:ad_break_end`.
21. После цикла вопросов `QuestionManager` шлет сигнал `QuestionDone()`.
22. `QuizManager.finishQuiz()`:
23. ставит `completed`,
24. шлет `quiz:finish`,
25. считает результаты каждому участнику из `quiz:{id}:participants` через `ResultService.CalculateQuizResult()`,
26. вызывает `ResultService.DetermineWinnersAndAllocatePrizes()`.
27. В финализации:
28. пересчитываются ранги,
29. выбираются победители,
30. делится призовой фонд,
31. обновляется таблица `users` (победы и сумма призов),
32. шлется `quiz:results_available`.

## 4. Причины выбывания игрока

| Причина | Где формируется | Условие |
|---|---|---|
| `incorrect_answer` | `AnswerProcessor.ProcessAnswer()` | Выбран неправильный вариант. |
| `time_exceeded` | `AnswerProcessor.ProcessAnswer()` | Ответ пришел после лимита времени вопроса. |
| `no_answer_timeout` | `QuestionManager.processNoAnswerEliminations()` | Игрок из `participants` не дал ответ в отведенное время. |
| `already_eliminated` | `AnswerProcessor.ProcessAnswer()` | Игрок уже ранее выбыл и снова отправил ответ. |
| `disconnected` | Сейчас явно не ставится в основном runtime-потоке | В статистике/переводах поддерживается как категория, но прямой установки причины в текущем рабочем потоке нет. |

## 5. Как распределяются призы

Основной алгоритм:
1. Берется призовой фонд квиза: `quiz.PrizeFund` (если 0 -> fallback на дефолт из конфигурации).
2. Определяется число вопросов для этой игры (через `quiz.Questions` / `user_answers` / `quiz.QuestionCount`).
3. Победителями считаются игроки, у кого:
4. `correct_answers == totalQuestions`,
5. `is_eliminated = false`.
6. Приз на победителя = `totalPrizeFund / winnersCount` (целочисленное деление).
7. В `results` выставляются `is_winner=true` и `prize_fund=prizePerWinner`.
8. В `users` увеличиваются `wins_count` и `total_prize_won`.

Ключевые функции:
- `ResultService.DetermineWinnersAndAllocatePrizes()`
- `ResultRepo.CalculateRanks()`
- `ResultRepo.FindAndUpdateWinners()`

## 6. Важные особенности текущей реализации

1. Цикл вопросов идет по `Config.MaxQuestionsPerQuiz` (по умолчанию `10`), а не по `quiz.QuestionCount`.
2. В `quiz:start` может уходить `question_count` из `quiz.QuestionCount`, и это число может не совпасть с фактически заданными вопросами цикла.
3. Поля `Config.MaxResponseTimeMs` и `Config.EliminationTimeMs` есть, но в текущей логике проверки ответа не используются.
4. `Question.IsValidOption()` существует, но в `ProcessAnswer()` явно не вызывается.
5. Если ответ правильный, но поздний, текущая формула очков (`Question.CalculatePoints`) все равно дает `1` очко, хотя игрок вылетает по `time_exceeded`.
6. `Question.PointValue` в реальном начислении сейчас не используется (начисление фиксированное: 1/0).
7. После квиза флаги участников/вылетов хранятся в Redis по TTL, а не удаляются сразу целиком в одном месте.
8. Пометка `is_used=true` ставится на все вопросы, которые были заданы (в том числе quiz-specific), не только на pool-вопросы.
9. Причина `disconnected` учитывается в аналитике, но авто-вылет с такой причиной в текущем игровом потоке не найден.

## 7. Быстрый индекс ключевых файлов

- `internal/service/quiz_manager.go`
- `internal/service/quizmanager/scheduler.go`
- `internal/service/quizmanager/question_manager.go`
- `internal/service/quizmanager/answer_processor.go`
- `internal/service/quizmanager/adaptive_selector.go`
- `internal/service/quizmanager/difficulty_config.go`
- `internal/service/quiz_service.go`
- `internal/service/result_service.go`
- `internal/repository/postgres/question_repo.go`
- `internal/repository/postgres/result_repo.go`
- `internal/handler/quiz_handler.go`
- `internal/handler/ws_handler.go`

