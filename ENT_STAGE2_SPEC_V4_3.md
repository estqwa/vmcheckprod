# Stage 2 — ENT Diagnostic & Mastery (ENT‑Ready Canonical Spec v4.3)

## Product DNA (не менять)
- Stage 2 — система управления подготовкой, не «тесты ради результата».
- Главный сигнал — **ошибки и повторяемость**.
- Core‑logic — источник правды.
- AI‑layer только анализирует и объясняет, **не управляет адаптацией**.

---

## Architecture (ENT‑Ready)
- 5 предметов: 3 обязательных + 2 профильных.
- ≤120 вопросов на попытку.
- общий лимит 240 минут + subject‑таймеры.
- форматы: single_choice, multi_choice, matching, context.
- ошибки отслеживаются по теме, формату и difficulty_level.
- difficulty_level и weight учитываются в scoring и адаптации.
- адаптация строится по матрице topic×format.
- AI‑layer аналитический, с audit‑логом.

---

## Backend (Core + AI)

### Core Entities
**Контент**
- EntSubject
- EntTopic
- EntSubtopic
- EntQuestion
  - format_type
  - difficulty_level
  - weight
  - max_choices
  - context_block_id

**Процесс**
- EntAttempt
- EntAttemptItem
- EntAnswer
- SubjectTimeLog
- QuestionTimeLog
- UserActionLog

**Диагностика**
- EntErrorEvent
- EntTopicProfile
- EntFormatProfile

### Core Services
1. **AttemptService**
   - старт/finish попытки
   - фиксирует subject set
   - общий лимит и subject timers
   - блокировка предмета при subject timeout
   - auto‑finish при attempt timeout
2. **ScoringService**
   - partial + negative
   - difficulty_level + weight
   - итоговый AttemptScoreAggregator
3. **DiagnosticsService**
   - ErrorEvents
   - TopicProfile + FormatProfile
4. **AdaptationService**
   - topic×format матрица
   - баланс форматов
   - difficulty progression
5. **RecommendationService**
   - type, priority, next_review_at
6. **ReportingService**

---

## API (trial‑ready)

### Public API
- `POST /api/ent/attempts/start`
- `POST /api/ent/attempts/{id}/answer`
- `POST /api/ent/attempts/{id}/finish`
- `GET /api/ent/attempts/{id}/result`
- `POST /api/ent/attempts/{id}/action`
- `GET /api/ent/profile`
- `GET /api/ent/recommendations`
- `GET /api/ent/reports/daily`
- `GET /api/ent/reports/weekly`

### Internal AI API
- `POST /internal/ent/ai/analyze-attempt`

---

## Data Model (Core vs Derived)

### Core tables
- ent_subjects
- ent_topics
- ent_subtopics
- ent_questions
- ent_attempts
  - status: active|finished|timeout|aborted
- ent_attempt_items
- ent_answers
- subject_time_log
- question_time_log
- user_action_log
- ent_error_events
- ent_topic_profiles
- ent_format_profiles

### Derived tables
- ent_ai_signals
- ent_recommendations
- ent_reports
- ent_ai_audit_log

---

## AI‑Integration

### AI‑signals (структурированный формат)
```json
{
  "question_id": 123,
  "topic_id": 45,
  "format_type": "multi_choice",
  "difficulty_level": "hard",
  "error_type": "conceptual|mechanical|careless",
  "root_cause": "непонято правило вероятностей",
  "persistence_signal": "high|medium|low",
  "recommendation": "разобрать правило и решить 10 multi_choice задач"
}
```

### AI audit log
- входные данные (ошибки, темы, история, UserActionLog, QuestionTimeLog)
- параметры модели
- причина рекомендаций
- attempt_id

### AI signals aggregation (incomplete attempts)
- сигналы помечаются `incomplete_attempt=true`
- при новой попытке того же вопроса сигналы агрегируются:
  - если ошибка повторилась → повышается persistence_signal
  - если ошибка исправлена → снижается persistence_signal
  - без изменений → сигнал сохраняется

---

## User Flow
1. Пользователь выбирает 2 профильных предмета.
2. Старт Attempt: subject timers + общий лимит.
3. Ответы с partial/negative scoring.
4. Ошибки фиксируются (topic + format + difficulty).
5. AI‑signals → рекомендации.
6. Повторные попытки усиливают слабые темы/форматы.
7. Тема/формат закрываются при устойчивом улучшении.

---

## Event Flow (sync/async)

### StartAttempt (sync)
- Validate user
- AdaptationService подбирает вопросы
- Проверка лимитов 120/240
- Создание Attempt + Items

### SubmitAnswer (sync)
- ScoringService
- Answer + ErrorEvent
- QuestionTimeLog

### FinishAttempt (sync + async)
- Sync: итоговый AttemptScore + profiles
- Async: AI_ANALYZE_ATTEMPT

### Timeouts
- Subject timeout → предмет блокируется
- Attempt timeout → попытка закрывается

---

## Adaptation Algorithm (topic×format + difficulty)

### Topic score
```
topic_score =
  w1*error_count
+ w2*repeat_count
+ w3*ai_persistence
- w4*topic_stability
 + action_penalty
```

### Format score
```
format_score =
  f1*format_error_count
+ f2*format_repeat_count
+ f3*ai_persistence
- f4*format_stability
 + action_penalty
```

### Difficulty progression
- слабые темы → easy/medium
- улучшение → рост сложности
- повтор ошибок → откат сложности

### Deterministic selection
- seed = attempt_id + user_id (reproducible selection)

### Баланс форматов
- min/max quota на single_choice, multi_choice, matching, context

---

## Scoring (explicit Aggregated Attempt Score)

### Per‑question score

**single_choice**
```
q_score = 1 if correct else 0
q_score_after_negative = max(0, q_score - penalty)
final = q_score_after_negative * weight * difficulty_multiplier(difficulty_level)
```

**multi_choice**
```
q_score = (correct_selected / total_correct)
        - (incorrect_selected / total_incorrect)
if q_score < 0 → q_score = 0
q_score_after_negative = max(0, q_score - penalty)
final = q_score_after_negative * weight * difficulty_multiplier(difficulty_level)
```

**matching**
```
q_score = correct_pairs / total_pairs
q_score_after_negative = max(0, q_score - penalty)
final = q_score_after_negative * weight * difficulty_multiplier(difficulty_level)
```

**context**
```
q_score = correct_subanswers / total_subanswers
q_score_after_negative = max(0, q_score - penalty)
final = q_score_after_negative * weight * difficulty_multiplier(difficulty_level)
```
*(если отвечены не все подзадания — сохраняется частичный score, не обнуляется)*

### Difficulty multiplier
```
final = q_score_after_negative * weight * difficulty_multiplier(difficulty_level)
```
*(например: easy=0.8, medium=1.0, hard=1.2; значения настраиваемые)*

### Negative score (per‑question)
- штраф применяется к `q_score` до умножения на weight и difficulty_multiplier
- q_score_after_negative = max(0, q_score - penalty)

### Aggregated AttemptScore
```
AttemptScore = Σ(final_i)
AttemptScore >= 0 (нормализуется к 0 только после суммирования всех final_i)
```

---

## Recommendations
- recommendation_type: topic_repeat | format_review | combined
- priority: high | medium | low
- next_review_at
- audit_reason

---

## Timeouts / Edge cases

### Subject timeout
- предмет блокируется
- ответы после timeout → rejected
- Attempt продолжается по другим предметам

### Attempt timeout
- Attempt завершается
- unanswered → q_score = 0
- AI‑signals сохраняются с incomplete_attempt=true

### Time‑per‑question exceeded
- q_score = 0
- фиксируется TimeExceeded в QuestionTimeLog

### Answer change after timeout
- не принимается
- логируется как invalid_action

### Negative cumulative score
- AttemptScore нормализуется к 0

---

## Logging

### UserActionLog (skip/change/navigation)
- core‑logic фиксирует все действия
- AI‑analysis получает контекст поведения
- AdaptationService усиливает темы/форматы при высоком skip/change rate:
  ```
  action_penalty = a1*skip_rate + a2*change_rate
  skip_rate/change_rate = доля вопросов, пропущенных/изменённых
  topic_score += action_penalty
  format_score += action_penalty
  ```

### QuestionTimeLog
- хранит фактическое время на вопрос
- используется AI‑layer для диагностики (например, спешка vs непонимание)
- пример интерпретации:
  - время ≪ среднее → «спешка»
  - время ≫ среднее → «затруднение/непонимание»

---

## AI Signals (post‑processing)
- signals для incomplete attempts пересматриваются после повторной попытки
- пример агрегирования:
  - persistence_signal=medium и ошибка повторилась → high
  - persistence_signal=medium и ошибка исчезла → low
  - persistence_signal=medium и без изменений → medium
- audit‑log хранит версию входных данных и итоговое решение
