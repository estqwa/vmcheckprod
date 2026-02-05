# Stage 2 — ENT Diagnostic & Mastery
## 📋 Детальный Roadmap разработки

> **Источники**: ENT_STAGE2_SPEC_V4_3.md, ENT_STAGE2_Rules.md, ent_reference.md  
> **Дата**: 2026-02-05

---

## 🎯 Общее описание

**Stage 2** — система тренировочного тестирования ЕНТ с AI-анализом ошибок.

### Ключевые отличия от Stage 1 (Trivia)

| Параметр | Stage 1 | Stage 2 |
|----------|---------|---------|
| Режим | Real-time для всех | Индивидуальный |
| Выбывание | Да | Нет |
| Вопросов | 10-15 | до 120 |
| Время | 10-15 сек/вопрос | 240 мин общий |
| Scoring | 1 балл | Partial + negative |
| AI | Нет | Анализ + рекомендации |

---

## 🔒 Обязательные требования (чеклист)

### Продуктовые правила
- [ ] Пользователь видит **результаты попытки** (балл, ошибки по темам/вопросам) и **рекомендации**
- [ ] Пользователь **НЕ видит** внутренние формулы, коэффициенты, веса и метрики адаптации (topic_score, format_score, action_penalty и т.п.)
- [ ] AI только анализирует, **не управляет** адаптацией
- [ ] Core-logic — источник правды

### Попытка (Attempt)
- [ ] 5 предметов = 3 обязательных + 2 профильных
- [ ] ≤120 вопросов
- [ ] 240 минут общий лимит + subject-таймеры
- [ ] Форматы: single_choice, multi_choice, matching, context

### Таймауты
- [ ] Subject timeout → предмет блокируется, ответы отклоняются
- [ ] Attempt timeout → unanswered получают q_score=0, AI-signals с incomplete_attempt=true
- [ ] Time-per-question exceeded → q_score=0, лог TimeExceeded
- [ ] Ответ после таймаута → логируется как invalid_action

### Scoring
- [ ] Penalty применяется ДО умножения на weight и difficulty
- [ ] Минимальный балл вопроса: 0
- [ ] AttemptScore = сумма всех final_i, нормализуется к 0

### Адаптация
- [ ] seed = attempt_id + user_id (детерминированный выбор)
- [ ] min/max квоты на форматы
- [ ] action_penalty = a1×skip_rate + a2×change_rate

### AI-сигналы
- [ ] Агрегация **только** для incomplete_attempt=true
- [ ] Ошибка повторилась → persistence↑
- [ ] Ошибка исправлена → persistence↓
- [ ] Без изменений → сигнал **сохраняется** (не меняется!)

---

## 📅 Этапы разработки

```
Этап 1: База данных           ██████████  3 дня
Этап 2: Entities + Repos      ████████    2 дня
Этап 3: Core Services         ████████████████  5 дней
Этап 4: Advanced Services     ████████████  4 дня
Этап 5: AI Layer              ████████████  4 дня
Этап 6: API + Тесты           ████████████████  5 дней
                              ─────────────────────
                              Итого: ~23 рабочих дня
```

---

## Этап 1: База данных (3 дня)

### Цель
Создать все таблицы для ENT системы.

### Файлы

| Файл | Описание |
|------|----------|
| `migrations/000018_create_ent_subjects.up.sql` | Предметы, топики, подтопики |
| `migrations/000018_create_ent_subjects.down.sql` | Откат |
| `migrations/000019_create_ent_questions.up.sql` | Вопросы с format_type, difficulty, weight |
| `migrations/000019_create_ent_questions.down.sql` | Откат |
| `migrations/000020_create_ent_attempts.up.sql` | Попытки, items, статусы предметов |
| `migrations/000020_create_ent_attempts.down.sql` | Откат |
| `migrations/000021_create_ent_answers.up.sql` | Ответы, логи времени, логи действий |
| `migrations/000021_create_ent_answers.down.sql` | Откат |
| `migrations/000022_create_ent_diagnostics.up.sql` | Ошибки, профили по темам/форматам |
| `migrations/000022_create_ent_diagnostics.down.sql` | Откат |
| `migrations/000023_create_ent_ai_layer.up.sql` | AI сигналы, рекомендации, аудит-лог |
| `migrations/000023_create_ent_ai_layer.down.sql` | Откат |

### Таблицы

**Контент:**
- `ent_subjects` — 5 предметов (3 обязательных + профильные)
- `ent_topics` — темы внутри предмета
- `ent_subtopics` — подтемы
- `ent_questions` — вопросы с полями:
  - `format_type`: single_choice, multi_choice, matching, context
  - `difficulty_level`: easy, medium, hard
  - `weight`: вес вопроса (1.0 по умолчанию)
  - `options`: JSONB с вариантами ответа
  - `correct_answers`: JSONB с правильными ответами
  - `matching_pairs`: JSONB для matching
  - `context_block_id`: для группировки context-вопросов

**Процесс:**
- `ent_attempts` — попытки пользователя
  - `status`: active | finished | timeout | aborted
  - `adaptation_seed`: attempt_id + user_id (без хэша)
  - `subject_ids`: JSONB [1,2,3,4,5]
- `ent_attempt_items` — вопросы в попытке
- `ent_attempt_subject_state` — статус предметов (**новая таблица**)
  - `is_blocked`: заблокирован ли предмет после таймаута
  - `blocked_at`: когда заблокирован
- `ent_answers` — ответы
- `question_time_log` — время на вопрос
  - `is_time_exceeded`: флаг TimeExceeded
- `user_action_log` — действия пользователя
  - action_type: skip, change_answer, navigate_back, navigate_forward, flag_question, **invalid_action**

**Диагностика:**
- `ent_error_events` — события ошибок
- `ent_topic_profiles` — профиль по темам
  - `ai_persistence_score`: агрегированный persistence
- `ent_format_profiles` — профиль по форматам

**AI Layer:**
- `ent_ai_signals` — сигналы от AI
  - `is_incomplete_attempt`: флаг для агрегации
- `ent_recommendations` — рекомендации
  - `audit_reason`: обязательная причина (по Rules §7)
- `ent_ai_audit_log` — лог AI
- `ent_reports` — отчёты

### Критерии готовности
- [ ] Все миграции применяются без ошибок
- [ ] Down-миграции корректно откатывают
- [ ] Индексы созданы для частых запросов

---

## Этап 2: Entities + Repositories (2 дня)

### Цель
Создать Go-структуры и интерфейсы репозиториев.

### Файлы

**Entities** (`internal/domain/entity/ent/`):

| Файл | Структура | Описание |
|------|-----------|----------|
| `subject.go` | `EntSubject` | Предмет ЕНТ |
| `topic.go` | `EntTopic`, `EntSubtopic` | Тема, подтема |
| `question.go` | `EntQuestion` | Вопрос с format_type |
| `attempt.go` | `EntAttempt`, `EntAttemptItem`, `EntAttemptSubjectState` | Попытка |
| `answer.go` | `EntAnswer` | Ответ пользователя |
| `logs.go` | `QuestionTimeLog`, `UserActionLog` | Логи |
| `profiles.go` | `EntTopicProfile`, `EntFormatProfile` | Профили |
| `error_event.go` | `EntErrorEvent` | Событие ошибки |
| `ai.go` | `EntAISignal`, `EntRecommendation`, `EntAIAuditLog` | AI сущности |
| `report.go` | `EntReport` | Отчёт |

**Repository Interfaces** (`internal/domain/repository/ent/`):

| Файл | Интерфейс | Ключевые методы |
|------|-----------|-----------------|
| `subject_repository.go` | `EntSubjectRepository` | FindMandatory, FindAll |
| `question_repository.go` | `EntQuestionRepository` | FindBySubjectAndFormat, FindForAdaptation |
| `attempt_repository.go` | `EntAttemptRepository` | Create, FindActive, UpdateStatus |
| `subject_state_repository.go` | `EntSubjectStateRepository` | FindByAttempt, BlockSubject |
| `answer_repository.go` | `EntAnswerRepository` | Create, FindByAttempt |
| `action_log_repository.go` | `EntActionLogRepository` | Create, CountSkips, CountChanges |
| `profile_repository.go` | `EntProfileRepository` | GetTopicProfile, UpdatePersistence |
| `ai_repository.go` | `EntAIRepository` | CreateSignal, FindIncompleteSignals |

**Repository Implementations** (`internal/repository/postgres/ent/`):
- Аналогичные файлы с реализацией через GORM

### Критерии готовности
- [ ] Все структуры имеют корректные GORM-теги
- [ ] Интерфейсы покрывают все нужные операции
- [ ] Компиляция без ошибок

---

## Этап 3: Core Services (5 дней)

### Цель
Реализовать основную бизнес-логику.

### Файлы (`internal/service/ent/`)

#### 3.1 AttemptService (2 дня)

**Файл**: `attempt_service.go`

**Методы**:

```go
// StartAttempt — начало попытки
// - Валидация: ровно 2 профильных предмета
// - Автоматически добавляет 3 обязательных
// - Генерирует seed = attempt_id + user_id (конкатенация, НЕ хэш)
// - Создаёт статусы для каждого предмета
func StartAttempt(userID uint, profileSubjectIDs []uint) (*EntAttempt, error)

// SubmitAnswer — отправка ответа
// - Проверяет: не заблокирован ли предмет
// - Проверяет: не истёк ли attempt
// - Проверяет: не превышено ли время на вопрос
// - Логирует TimeExceeded если надо → q_score=0
// - Логирует invalid_action если ответ после таймаута
func SubmitAnswer(attemptID, questionID uint, answer Request) (*Result, error)

// HandleSubjectTimeout — блокировка предмета
// - Устанавливает is_blocked=true
// - После этого: ответы НЕ сохраняются в ent_answers (rejected)
// - Логируется invalid_action
// - Attempt продолжается по другим предметам
func HandleSubjectTimeout(attemptID, subjectID uint) error

// HandleAttemptTimeout — завершение по таймауту
// - Все unanswered → q_score=0
// - Статус → timeout
// - AI анализ с incomplete_attempt=true
func HandleAttemptTimeout(ctx context.Context, attemptID uint) error {
    // AI signals saved with incomplete_attempt=true (SPEC §Timeouts)
    // ВАЖНО: AnalyzeAttempt ГАРАНТИРУЕТ что ВСЕ сигналы внутри попытки
    // сохраняются с is_incomplete_attempt=true
    s.aiService.AnalyzeAttempt(ctx, attemptID, true /* isIncomplete */)
    
    return nil
}

// В AIService.AnalyzeAttempt:
// func (s *AIService) AnalyzeAttempt(attemptID uint, isIncomplete bool) {
//     signals := s.generateSignals(attemptID)
//     for _, signal := range signals {
//         signal.IsIncompleteAttempt = isIncomplete  // <-- ВСЕМ сигналам
//         s.repo.Create(signal)
//     }
// }
// FinishAttempt — нормальное завершение
// - Подсчёт итогового AttemptScore
// - Обновление профилей
// - Запуск AI анализа
// - ВОЗВРАЩАЕТ: total_score + список ошибок по темам/вопросам
// - НЕ возвращает: topic_score, format_score, action_penalty, веса/формулы
func FinishAttempt(attemptID uint) (*AttemptResult, error)

// AttemptResult — результат, видимый пользователю
type AttemptResult struct {
    AttemptID      uint            `json:"attempt_id"`
    TotalScore     float64         `json:"total_score"`
    TotalQuestions int             `json:"total_questions"`
    CorrectCount   int             `json:"correct_count"`
    ErrorsByTopic  []TopicErrors   `json:"errors_by_topic"`
    // НЕТ: topic_score, format_score, action_penalty, weights
}
```

#### 3.2 ScoringService (1 день)

**Файл**: `scoring_service.go`

**Формулы** (точно по спецификации):

```go
// Single Choice
// q_score = 1 если правильно, иначе 0
// final = max(0, q_score - penalty) × weight × difficulty_multiplier

// Multi Choice  
// q_score = (correct_selected / total_correct) - (incorrect_selected / total_incorrect)
// q_score = max(0, q_score)
// final = max(0, q_score - penalty) × weight × difficulty_multiplier

// Matching
// q_score = correct_pairs / total_pairs
// final = max(0, q_score - penalty) × weight × difficulty_multiplier

// Context
// q_score = correct_subanswers / total_subanswers
// final = max(0, q_score - penalty) × weight × difficulty_multiplier

// difficulty_multiplier: easy=0.8, medium=1.0, hard=1.2
```

**Методы**:
- `ScoreSingleChoice(answer, question) float64`
- `ScoreMultiChoice(answer, question) float64`
- `ScoreMatching(answer, question) float64`
- `ScoreContext(answer, question) float64`
- `AggregateAttemptScore(attemptID) float64` — сумма, нормализация к 0

#### 3.3 DiagnosticsService (2 дня)

**Файл**: `diagnostics_service.go`

**Методы**:
- `RecordError(...)` — создание EntErrorEvent
- `UpdateTopicProfile(...)` — обновление профиля темы
- `UpdateFormatProfile(...)` — обновление профиля формата
- `GetUserDiagnostics(userID)` — диагностика для отчётов

### Критерии готовности
- [ ] Scoring формулы точно соответствуют спецификации
- [ ] Timeout-логика полностью реализована
- [ ] invalid_action логируется при ответе после таймаута
- [ ] Unit-тесты для scoring

---

## Этап 4: Advanced Services (4 дня)

### Файлы (`internal/service/ent/`)

#### 4.1 AdaptationService (2 дня)

**Файл**: `adaptation_service.go`

**Ключевые компоненты**:

1. **Детерминированный выбор** (SPEC §Adaptation):
```go
// seed = attempt_id + user_id (НЕ хэш, просто конкатенация для воспроизводимости)
// Пример: attemptID=100, userID=5 → seed = "100_5"
func generateSeed(attemptID, userID uint) string {
    return fmt.Sprintf("%d_%d", attemptID, userID)
}
```

2. **Квоты форматов** (SPEC §Adaptation: min/max):
```go
type FormatQuota struct {
    FormatType string
    MinPercent int  // минимум % вопросов этого формата
    MaxPercent int  // максимум % вопросов этого формата
}

var Quotas = []FormatQuota{
    {"single_choice", 30, 60},
    {"multi_choice", 20, 40},
    {"matching", 10, 25},
    {"context", 10, 25},
}

// checkFormatQuotas проверяет И min И max
func (s *AdaptationService) checkFormatQuotas(counts map[string]int, total int) bool {
    for _, q := range Quotas {
        currentPercent := float64(counts[q.FormatType]) / float64(total) * 100
        if currentPercent < float64(q.MinPercent) {
            return false  // min не достигнут
        }
        if currentPercent > float64(q.MaxPercent) {
            return false  // max превышен
        }
    }
    return true
}

// При выборе вопросов: сначала заполняем min-квоты, потом добираем до total
```

3. **Расчёт topic_score**:
```go
// topic_score = w1×error_count + w2×repeat_count + w3×ai_persistence 
//             - w4×stability + action_penalty
```

4. **Расчёт action_penalty** (SPEC §Logging):
```go
// action_penalty = a1×skip_rate + a2×change_rate
// 
// ВАЖНО: denominator = общее количество вопросов в попытке (ent_attempt_items),
// а НЕ количество отвеченных. Это даёт честную оценку skip/change rate.
//
// skip_rate = кол-во skip / len(attempt_items)
// change_rate = кол-во change_answer / len(attempt_items)
func (s *AdaptationService) calculateActionPenalty(attemptID uint) float64 {
    actions := s.actionLogRepo.FindByAttempt(attemptID)
    totalItems := s.attemptItemRepo.CountByAttempt(attemptID)  // ВСЕ вопросы попытки
    
    skipCount := countByType(actions, "skip")
    changeCount := countByType(actions, "change_answer")
    
    const a1, a2 = 0.3, 0.2
    return a1*float64(skipCount)/float64(totalItems) + a2*float64(changeCount)/float64(totalItems)
}
```

5. **Difficulty progression**:
- Слабые темы → easy/medium вопросы
- Улучшение → harder вопросы
- Повтор ошибок → откат сложности

**Методы**:
- `SelectQuestions(userID, attemptID, subjectIDs, limit)` — выбор вопросов
- `CalculateTopicScore(profile, actionPenalty)` — скор темы
- `CalculateFormatScore(profile, actionPenalty)` — скор формата

#### 4.2 RecommendationService (1 день)

**Файл**: `recommendation_service.go`

**Типы рекомендаций**:
- `topic_repeat` — повторить тему
- `format_review` — повторить формат
- `combined` — тема + формат

**Приоритеты**: high, medium, low

**Методы**:
- `GenerateRecommendations(userID, attemptID)` — создание рекомендаций
- `GetActiveRecommendations(userID)` — список активных
- `MarkCompleted(recommendationID)` — отметить выполненной

> ⚠️ **Обязательно**: каждая рекомендация должна иметь `audit_reason`

#### 4.3 ReportingService (1 день)

**Файл**: `reporting_service.go`

**Типы отчётов**:
- `daily` — ежедневный
- `weekly` — еженедельный
- `attempt` — по попытке

### Критерии готовности
- [ ] Квоты форматов соблюдаются при выборе
- [ ] Детерминированный выбор воспроизводим
- [ ] action_penalty рассчитывается корректно
- [ ] Рекомендации имеют audit_reason

---

## Этап 5: AI Layer (4 дня)

### Файлы

#### 5.1 AIService (3 дня)

**Файл**: `internal/service/ent/ai_service.go`

**Конфигурация** (`config/config.yaml`):
```yaml
ai:
  provider: "google"  # или другой
  model: "gemini-1.5-flash"
  temperature: 0.3
  max_tokens: 2000
```

**Ключевая логика — агрегация сигналов**:

```go
// AggregateSignals — агрегация для incomplete attempts
func (s *AIService) AggregateSignals(userID, questionID uint, hasError bool) {
    prevSignal := s.repo.FindByUserAndQuestion(userID, questionID)
    
    // Только если предыдущий сигнал от incomplete attempt!
    if prevSignal == nil || !prevSignal.IsIncompleteAttempt {
        return
    }
    
    prevHadError := prevSignal.ErrorType != ""
    
    if prevHadError && hasError {
        // Ошибка повторилась → persistence↑
        prevSignal.PersistenceSignal = increase(prevSignal.PersistenceSignal)
    } else if prevHadError && !hasError {
        // Ошибка исправлена → persistence↓
        prevSignal.PersistenceSignal = decrease(prevSignal.PersistenceSignal)
    }
    // Если статус не изменился — сигнал НЕ меняется!
    
    s.repo.Update(prevSignal)
}
```

**Методы**:
- `AnalyzeAttempt(attemptID, isIncomplete)` — анализ попытки
- `AggregateSignals(userID, questionID, hasError)` — агрегация
- `GenerateSignal(error, context) EntAISignal` — создание сигнала

#### 5.2 AI Audit Log

**Обязательно по Rules §6**:
- Входные данные (ошибки, темы, история)
- Параметры модели
- Причина рекомендации
- attempt_id

### Критерии готовности
- [ ] Агрегация только для is_incomplete_attempt=true
- [ ] "Без изменений" не модифицирует сигнал
- [ ] Audit log создаётся для каждого анализа

---

## Этап 6: API + Тесты (5 дней)

### 6.1 API Handler (2 дня)

**Файл**: `internal/handler/ent_handler.go`

**Public API** (из спецификации):

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| POST | `/api/ent/attempts/start` | Начать попытку |
| POST | `/api/ent/attempts/{id}/answer` | Отправить ответ |
| POST | `/api/ent/attempts/{id}/finish` | Завершить попытку (возвращает результат) |
| GET | `/api/ent/attempts/{id}/result` | Получить результат попытки (повторно) |
| POST | `/api/ent/attempts/{id}/action` | Логировать действие |
| GET | `/api/ent/profile` | Профиль пользователя |
| GET | `/api/ent/recommendations` | Рекомендации |
| GET | `/api/ent/reports/daily` | Дневной отчёт |
| GET | `/api/ent/reports/weekly` | Недельный отчёт |

**Internal API**:

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| POST | `/internal/ent/ai/analyze-attempt` | AI анализ |

### ⚠️ Ограничения API (Rules §1 — обновлено)

> **«Пользователь видит результаты попытки (балл, ошибки по темам/вопросам) и рекомендации, но не видит внутренние формулы, коэффициенты, веса и метрики адаптации»**

**Что МОЖНО показывать**:
- `total_score` — итоговый балл
- Ошибки по темам/вопросам (topic_name, question_id, is_correct)
- Рекомендации (заголовок, описание, приоритет, next_review_at)

**Что НЕЛЬЗЯ показывать**:
- topic_score, format_score
- stability_score, ai_persistence_score
- action_penalty
- Формулы, веса (w1, w2, a1, a2), множители
- difficulty_multiplier, weight (только для internal)

### 6.2 Тесты (3 дня)

**Unit-тесты** (`internal/service/ent/*_test.go`):
- [ ] ScoringService: все 4 формулы
- [ ] AdaptationService: квоты форматов
- [ ] AdaptationService: детерминированный seed
- [ ] AttemptService: блокировка предмета
- [ ] AttemptService: отклонение после таймаута
- [ ] AIService: агрегация только для incomplete
- [ ] AIService: "без изменений" сохраняет сигнал
- [ ] **API: ответы содержат score и ошибки, НЕ содержат internal-метрики**

**Integration-тесты**:
- [ ] Полный flow попытки с таймаутами
- [ ] Агрегация сигналов между попытками
- [ ] Баланс форматов на 120 вопросах

### Критерии готовности
- [ ] API соответствует спецификации
- [ ] Внутренние расчёты скрыты от пользователя
- [ ] Тесты проходят

---

## 📁 Итоговая структура файлов

```
trivia-api/
├── config/
│   └── config.yaml                     [MODIFY] добавить секцию ai
├── migrations/
│   ├── 000018_create_ent_subjects.up.sql    [NEW]
│   ├── 000018_create_ent_subjects.down.sql  [NEW]
│   ├── 000019_create_ent_questions.up.sql   [NEW]
│   ├── 000019_create_ent_questions.down.sql [NEW]
│   ├── 000020_create_ent_attempts.up.sql    [NEW]
│   ├── 000020_create_ent_attempts.down.sql  [NEW]
│   ├── 000021_create_ent_answers.up.sql     [NEW]
│   ├── 000021_create_ent_answers.down.sql   [NEW]
│   ├── 000022_create_ent_diagnostics.up.sql [NEW]
│   ├── 000022_create_ent_diagnostics.down.sql [NEW]
│   ├── 000023_create_ent_ai_layer.up.sql    [NEW]
│   └── 000023_create_ent_ai_layer.down.sql  [NEW]
├── internal/
│   ├── domain/
│   │   ├── entity/ent/                 [NEW] 10 файлов
│   │   └── repository/ent/             [NEW] 8 интерфейсов
│   ├── repository/postgres/ent/        [NEW] 8 реализаций
│   ├── service/ent/                    [NEW]
│   │   ├── attempt_service.go
│   │   ├── attempt_service_test.go
│   │   ├── scoring_service.go
│   │   ├── scoring_service_test.go
│   │   ├── diagnostics_service.go
│   │   ├── adaptation_service.go
│   │   ├── adaptation_service_test.go
│   │   ├── recommendation_service.go
│   │   ├── reporting_service.go
│   │   ├── ai_service.go
│   │   └── ai_service_test.go
│   └── handler/
│       └── ent_handler.go              [NEW]
└── cmd/api/
    └── main.go                         [MODIFY] DI для ENT сервисов
```

---

## 📊 Сводка

| Метрика | Значение |
|---------|----------|
| Новых миграций | 12 файлов (6 up + 6 down) |
| Новых таблиц | 15 |
| Новых entities | 12 |
| Новых services | 6 |
| Новых API endpoints | 9 |
| Примерный срок | 23 рабочих дня (~5 недель) |

---

## ✅ Definition of Done

Проект готов когда:

1. ✅ Все миграции применяются и откатываются
2. ✅ 5 предметов валидируются (3+2)
3. ✅ Таймауты работают корректно
4. ✅ Scoring точно по формулам
5. ✅ AI агрегация только для incomplete
6. ✅ API скрывает внутренние расчёты
7. ✅ Все unit-тесты проходят
