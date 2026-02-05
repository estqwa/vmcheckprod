Stage 2 — ENT Rules (Canonical)
1. Product Rules

Stage 2 — это система управления подготовкой, не тесты ради результата.

Главный сигнал — ошибки и повторяемость.

Core-logic — источник правды, AI‑layer только анализирует и объясняет.

Пользователь видит результаты попытки (балл, ошибки по темам/вопросам) и рекомендации, но не видит внутренние формулы, коэффициенты, веса и метрики адаптации (topic_score, format_score, action_penalty и т. п.).

2. Attempt Rules

Максимум 120 вопросов на одну попытку.

Общий лимит времени: 240 минут.

Subject timers: отдельные таймеры для каждого предмета.

Допустимые форматы: single_choice, multi_choice, matching, context.

Ответы после таймаута: не принимаются, логируются как invalid_action.

Time-per-question exceeded: q_score = 0, фиксируется TimeExceeded.

Negative cumulative score: AttemptScore нормализуется к 0.

3. Scoring Rules

Partial и negative scoring применяются на уровне вопроса.

Weight и difficulty_level учитываются при подсчёте финального балла.

Aggregated AttemptScore = сумма всех final_i.

Минимальный балл вопроса: 0.

Per-question Scoring

single_choice: 1 за правильный, 0 за неправильный.

multi_choice: (correct_selected / total_correct) − (incorrect_selected / total_incorrect), min 0.

matching: correct_pairs / total_pairs, min 0.

context: correct_subanswers / total_subanswers, min 0.

Penalty: применяется до умножения на weight и difficulty_multiplier.

4. Adaptation & AI Rules

Topic×format матрица строит адаптацию.

Difficulty progression: слабые темы → easy/medium, улучшение → рост сложности, повтор ошибок → откат сложности.

AI‑signals используют для рекомендаций и диагностики.

Incomplete attempts: повторная попытка агрегирует persistence_signal.

AI‑layer не меняет core-логику, только анализирует и объясняет.

5. Edge Cases

Subject timeout: предмет блокируется, ответы после timeout → rejected, Attempt продолжается по другим предметам.

Attempt timeout: Attempt завершается, unanswered → q_score = 0, AI‑signals сохраняются с incomplete_attempt=true.

Answer change after timeout: не принимается, логируется как invalid_action.

High skip/change rate: усиливает темы/форматы через action_penalty.

6. Logging Rules

UserActionLog: фиксирует все действия skip/change/navigation.

QuestionTimeLog: фиксирует время на вопрос для диагностики спешки vs непонимания.

Audit-log: хранит версии входных данных и причины рекомендаций AI.

7. Recommendation Rules

Типы: topic_repeat | format_review | combined.

Приоритет: high | medium | low.

next_review_at указывает время следующей повторной проверки.

AI audit-log обязателен для каждой рекомендации.
