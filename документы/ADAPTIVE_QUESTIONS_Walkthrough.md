# Walkthrough: Адаптивная система сложности вопросов

## Цель
Реализовать динамическую систему сложности вопросов, целящуюся на ~0.5% финалистов через адаптивный выбор вопросов в real-time.

## Созданные/изменённые файлы

### Миграции
| Файл | Описание |
|------|----------|
| [000018_add_difficulty_to_questions.up.sql](file:///c:/project/vmdeploy/trivia-api/migrations/000018_add_difficulty_to_questions.up.sql) | Добавляет `difficulty` (1-5) и `is_used` (BOOL) к questions + индексы |
| [000018_add_difficulty_to_questions.down.sql](file:///c:/project/vmdeploy/trivia-api/migrations/000018_add_difficulty_to_questions.down.sql) | Откат миграции |

### Domain Layer
| Файл | Изменения |
|------|-----------|
| [question.go](file:///c:/project/vmdeploy/trivia-api/internal/domain/entity/question.go) | Добавлены поля `Difficulty`, `IsUsed` |
| [question_repo.go](file:///c:/project/vmdeploy/trivia-api/internal/domain/repository/question_repo.go) | Новые методы в интерфейсе |

### Repository Layer
| Файл | Изменения |
|------|-----------|
| [question_repo.go](file:///c:/project/vmdeploy/trivia-api/internal/repository/postgres/question_repo.go) | Реализация `GetRandomByDifficulty`, `MarkAsUsed`, `CountByDifficulty` |

### Service Layer — Новые файлы
| Файл | Описание |
|------|----------|
| [difficulty_config.go](file:///c:/project/vmdeploy/trivia-api/internal/service/quizmanager/difficulty_config.go) | Конфигурация target pass rates и difficulty mapping |
| [adaptive_selector.go](file:///c:/project/vmdeploy/trivia-api/internal/service/quizmanager/adaptive_selector.go) | Основная логика адаптивного выбора вопросов |

### Service Layer — Изменённые файлы
| Файл | Изменения |
|------|-----------|
| [question_manager.go](file:///c:/project/vmdeploy/trivia-api/internal/service/quizmanager/question_manager.go) | Интеграция `AdaptiveQuestionSelector`, переписан `RunQuizQuestions` для динамического выбора |
| [answer_processor.go](file:///c:/project/vmdeploy/trivia-api/internal/service/quizmanager/answer_processor.go) | Добавлена запись статистики в Redis через `recordAdaptiveStats` |

### Тесты
| Файл | Изменения |
|------|-----------|
| [quiz_service_test.go](file:///c:/project/vmdeploy/trivia-api/internal/service/quiz_service_test.go) | Добавлены mock-методы для новых repository операций |

## Верификация

```
✅ go build ./cmd/api — успешно
✅ go test ./... -short — все тесты проходят
```

## Как это работает

1. **Перед каждым вопросом** — AdaptiveSelector анализирует pass rate предыдущего вопроса
2. **Расчёт сложности** — если pass rate выше target → повышаем сложность, ниже → понижаем
3. **Fallback вверх** — если нет вопросов нужной сложности, ищем более сложные (не легче!)
4. **Запись статистики** — каждый ответ увеличивает `quiz:{id}:q{N}:total/passed` в Redis
5. **Пометка использованных** — после викторины все вопросы помечаются `is_used=true`

## Следующие шаги

1. **API загрузки вопросов** — `POST /api/admin/question-pool` для массовой загрузки с указанием difficulty
2. **Конфигурация** — вынести DifficultyConfig в config.yaml (опционально)
3. **Мониторинг** — добавить метрики для отслеживания распределения сложности
