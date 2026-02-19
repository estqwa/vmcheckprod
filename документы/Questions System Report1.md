# Система вопросов — Полный отчёт

**Дата:** 2026-02-07  
**Версия:** Текущая (trivia-api)

---

## 📊 Краткий итог

| Параметр | Текущее значение | Где задаётся |
|----------|------------------|--------------|
| Макс. вопросов в викторине | **10** | `types.go:15` (константа `DefaultMaxQuizQuestions`) |
| Уровни сложности | **НЕ РЕАЛИЗОВАНЫ** | Поле `difficulty` отсутствует |
| Авто-добавление вопросов | **Да** | `question_manager.go:41-137` |
| Время на ответ (дефолт) | **10 сек** | `entity/question.go:54` |
| Очки за вопрос (дефолт) | **10** | `entity/question.go:55` |
| Победитель = | **Все ответы правильные + не выбыл** | `result_repo.go:189-191` |

---qweqw

## 1. Структура вопроса (entity/question.go)

```go
type Question struct {
    ID            uint        `gorm:"primaryKey" json:"id"`
    QuizID        uint        `gorm:"not null;index" json:"quiz_id"`
    Text          string      `gorm:"size:500;not null" json:"text"`
    Options       StringArray `gorm:"type:jsonb;not null" json:"options"`
    TextKK        string      // Казахский текст (опционально)
    OptionsKK     StringArray // Казахские варианты (опционально)
    CorrectOption int         `gorm:"not null" json:"-"` // Скрыто от клиента!
    TimeLimitSec  int         `gorm:"not null;default:10" json:"time_limit_sec"`
    PointValue    int         `gorm:"not null;default:10" json:"point_value"`
    CreatedAt     time.Time
    UpdatedAt     time.Time
}
```

### Важные методы:
- `IsCorrect(selectedOption int) bool` — проверка правильности
- `CalculatePoints(isCorrect bool, responseTimeMs int64) int` — **всегда возвращает 1 или 0** (PointValue не используется!)
- `GetLocalizedText(lang string)` / `GetLocalizedOptions(lang string)` — i18n

> ⚠️ **ВАЖНО:** Поле `difficulty` **НЕ СУЩЕСТВУЕТ** в entity Question!

---

## 2. Схема БД (migrations/000001_init_schema.up.sql)

```sql
CREATE TABLE questions (
    id SERIAL PRIMARY KEY,
    quiz_id BIGINT NOT NULL,
    text VARCHAR(500) NOT NULL,
    options JSONB NOT NULL,
    correct_option BIGINT NOT NULL,
    time_limit_sec BIGINT NOT NULL DEFAULT 10,
    point_value BIGINT NOT NULL DEFAULT 10,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (quiz_id) REFERENCES quizzes (id) ON DELETE CASCADE
);

-- Миграция 000016: добавлены text_kk и options_kk
```

---

## 3. Добавление вопросов админом (quiz_handler.go:110-157)

### API Endpoint: `POST /api/admin/quizzes/:id/questions`

```json
{
  "questions": [
    {
      "text": "Вопрос на русском",
      "text_kk": "Қазақша сұрақ",       // опционально
      "options": ["A", "B", "C", "D"],
      "options_kk": ["А", "Б", "В", "Г"], // опционально
      "correct_option": 0,                // 0-indexed!
      "time_limit_sec": 10,               // 5-60 сек
      "point_value": 10                   // 1-100
    }
  ]
}
```

### Валидация:
- `text`: min=3, max=500
- `options`: min=2, max=5 вариантов
- `correct_option`: min=0 (проверяется что < len(options))
- `time_limit_sec`: min=5, max=60
- `point_value`: min=1, max=100

### Ограничение количества:
```go
// quiz_service.go:108
maxQuestions := s.config.MaxQuestionsPerQuiz // = 10 по умолчанию
if totalQuestions > maxQuestions {
    return fmt.Errorf("максимальное количество вопросов – %d", maxQuestions)
}
```

---

## 4. Авто-заполнение вопросов (question_manager.go:41-137)

### Когда срабатывает:
```go
// types.go:55
AutoFillThreshold: 2, // За 2 минуты до начала викторины
```

### Логика `AutoFillQuizQuestions`:
1. Получить викторину с существующими вопросами
2. Если `len(questions) >= MaxQuestionsPerQuiz` → ничего не делать
3. `neededQuestions = MaxQuestionsPerQuiz - currentCount`
4. Получить случайные вопросы из БД: `GetRandomQuestions(neededQuestions * 3)`
5. Отфильтровать уже существующие в викторине
6. Создать копии выбранных вопросов с `QuizID = текущей викторины`
7. `CreateBatch()` + обновить `quiz.QuestionCount`

### Метод `GetRandomQuestions` (question_repo.go:63-101):
```sql
SELECT * FROM questions 
TABLESAMPLE SYSTEM_ROWS(?)  -- Оптимизация для больших таблиц
ORDER BY RANDOM()
LIMIT ?
```
**Fallback:** `ORDER BY RANDOM()` если TABLESAMPLE не работает.

> 🔴 **ПРОБЛЕМА:** Вопросы выбираются **ПОЛНОСТЬЮ СЛУЧАЙНО** без учёта сложности!

---

## 5. Отправка вопросов по WebSocket (question_manager.go:139-391)

### Поток `RunQuizQuestions`:

1. **Для каждого вопроса:**
   - `SetCurrentQuestion(question, i+1)`
   - `time.Sleep(QuestionDelayMs)` — 500ms по умолчанию
   - Записать `startTimeMs` в Redis: `question:{id}:start_time`
   - Отправить событие `quiz:question`:

```json
{
  "type": "quiz:question",
  "data": {
    "question_id": 123,
    "quiz_id": 1,
    "number": 1,
    "text": "Какая столица Казахстана?",
    "text_kk": "Қазақстанның астанасы қандай?",
    "options": [{"index": 0, "text": "Алматы"}, ...],
    "options_kk": [{"index": 0, "text": "Алматы"}, ...],
    "time_limit": 10,
    "total_questions": 10,
    "start_time": 1707312000000,
    "server_timestamp": 1707312000000
  }
}
```

2. **Таймер вопроса:**
   - Каждую секунду → `quiz:timer` с `remaining_seconds`
   - По истечении времени → проверка не ответивших

3. **Проверка не ответивших:**
   - Получить всех участников из Redis Set `quiz:{id}:participants`
   - Для каждого проверить ключ `quiz:{id}:user:{uid}:question:{qid}`
   - Если нет → создать `UserAnswer` с `elimination_reason: "no_answer_timeout"`
   - Установить ключ `quiz:{id}:eliminated:{uid}`
   - Отправить `quiz:elimination`

4. **После проверки:**
   - `time.Sleep(AnswerRevealDelayMs)` — 200ms
   - Отправить `quiz:answer_reveal` с `correct_option`

5. **Рекламный блок (если настроен):**
   - Проверить `QuizAdSlotRepo.GetByQuizAndQuestionAfter(quizID, questionNumber)`
   - Отправить `quiz:ad_break` → ждать `duration_sec` → `quiz:ad_break_end`

6. **Между вопросами:**
   - `time.Sleep(InterQuestionDelayMs)` — 500ms

---

## 6. Обработка ответов (answer_processor.go:32-200)

### Событие от клиента: `user:answer`
```json
{
  "type": "user:answer",
  "data": {
    "question_id": 123,
    "selected_option": 2,
    "timestamp": 1707312005000
  }
}
```

### Логика `ProcessAnswer`:

1. **Проверка выбывания:**
   ```go
   eliminationKey := fmt.Sprintf("quiz:%d:eliminated:%d", quizID, userID)
   isEliminated, _ := CacheRepo.Exists(eliminationKey)
   if isEliminated {
       return error // Уже выбыл
   }
   ```

2. **Расчёт времени ответа:**
   ```go
   responseTimeMs = serverReceiveTimeMs - questionStartTimeMs
   timeLimitMs = question.TimeLimitSec * 1000
   isTimeLimitExceeded = responseTimeMs > timeLimitMs
   ```

3. **Проверка правильности:**
   ```go
   isCorrect := question.IsCorrect(selectedOption)
   score := question.CalculatePoints(isCorrect, responseTimeMs) // = 1 или 0
   ```

4. **Определение выбывания:**
   ```go
   userShouldBeEliminated := !isCorrect || isTimeLimitExceeded
   eliminationReason := "incorrect_answer" | "time_exceeded"
   ```

5. **Сохранение в БД:**
   ```go
   userAnswer := &entity.UserAnswer{
       UserID:            userID,
       QuizID:            quizID,
       QuestionID:        questionID,
       SelectedOption:    selectedOption,
       IsCorrect:         isCorrect,
       ResponseTimeMs:    responseTimeMs,
       Score:             score,
       IsEliminated:      userShouldBeEliminated,
       EliminationReason: eliminationReason,
   }
   ResultRepo.SaveUserAnswer(userAnswer)
   ```

6. **Установка флагов в Redis:**
   - `quiz:{id}:eliminated:{uid}` = "1" (если выбыл)
   - `quiz:{id}:user:{uid}:question:{qid}` = "1" (ответил)

7. **Отправка результата клиенту:** `quiz:answer_result`
   ```json
   {
     "question_id": 123,
     "correct_option": 0,
     "your_answer": 2,
     "is_correct": false,
     "points_earned": 0,
     "time_taken_ms": 5432,
     "is_eliminated": true,
     "elimination_reason": "incorrect_answer"
   }
   ```

---

## 7. Определение победителей (result_repo.go:181-238)

### Кто победитель?
```go
// result_repo.go:189-191
WHERE quiz_id = ? 
  AND correct_answers = ?      // = количество вопросов в викторине
  AND is_eliminated = false
```

**Победитель = тот, кто:**
1. Ответил правильно на ВСЕ вопросы
2. НЕ выбыл (is_eliminated = false)

### Распределение приза:
```go
prizePerWinner = totalPrizeFund / winnerCount // Целочисленное деление
```

---

## 8. Конфигурация (types.go:19-61)

```go
type Config struct {
    AnnouncementMinutes  int           // 30 мин — анонс перед стартом
    WaitingRoomMinutes   int           // 5 мин — открытие лобби
    CountdownSeconds     int           // 60 сек — обратный отсчёт
    QuestionDelayMs      int           // 500 мс — задержка перед вопросом
    AnswerRevealDelayMs  int           // 200 мс — перед показом ответа
    InterQuestionDelayMs int           // 500 мс — между вопросами
    RetryInterval        time.Duration // 500 мс — интервал ретраев WS
    AutoFillThreshold    int           // 2 мин — порог автозаполнения
    MaxQuestionsPerQuiz  int           // 10 — макс. вопросов
    MaxResponseTimeMs    int64         // 30000 мс — макс. время ответа
    EliminationTimeMs    int64         // 10000 мс — порог выбывания
    MaxRetries           int           // 3 — попытки отправки WS
    TotalPrizeFund       int           // 1000000 — призовой фонд
}
```

---

## 9. Что ОТСУТСТВУЕТ для адаптивной сложности

| Функционал | Статус |
|------------|--------|
| Поле `difficulty` в Question | ❌ Нет |
| Уровни сложности (1-5) | ❌ Нет |
| `GetRandomQuestionsByDifficulty()` | ❌ Нет |
| Отслеживание % прошедших вопрос | ❌ Нет |
| Динамический выбор следующего вопроса | ❌ Нет |
| Target pass rate для вопросов | ❌ Нет |

---

## 10. Резюме для внедрения адаптивной сложности

### Что нужно добавить:

1. **Миграция:**
   ```sql
   ALTER TABLE questions ADD COLUMN difficulty INT NOT NULL DEFAULT 3;
   -- 1=very_easy, 2=easy, 3=medium, 4=hard, 5=very_hard
   ```

2. **Entity Question:**
   ```go
   Difficulty int `gorm:"not null;default:3" json:"difficulty"`
   ```

3. **Repository:**
   ```go
   GetRandomQuestionsByDifficulty(difficulty int, limit int) ([]Question, error)
   ```

4. **Адаптивный алгоритм в QuestionManager:**
   - После каждого вопроса считать `passRate = прошло / было`
   - Сравнивать с `targetPassRate` для этого номера вопроса
   - Выбирать следующий вопрос нужной сложности

5. **Математика целевых pass rate:**
   - Если хотим 0.5% на финале при 100% на старте
   - 10 вопросов → коэффициент: `0.005^(1/10) ≈ 0.562` на каждый вопрос
   - Или фиксированная таблица как у тебя выше

---

Этот отчёт полностью описывает текущую систему вопросов. Готов обсудить математику и архитектуру адаптивной сложности.
