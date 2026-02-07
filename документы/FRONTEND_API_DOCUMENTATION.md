# Trivia API — Документация для Frontend разработчика

> **Этот документ создан на основе анализа исходного кода backend**  
> Версия: 2026-01-22

---

## Оглавление

1. [Общая информация](#общая-информация)
2. [Аутентификация](#аутентификация)
3. [HTTP API Endpoints](#http-api-endpoints)
4. [WebSocket соединение](#websocket-соединение)
5. [Структуры данных](#структуры-данных)
6. [Коды ошибок](#коды-ошибок)

---

## Общая информация

### Base URL
```
Production: https://api.trivia-app.com
Local: http://localhost:8080
```

### CORS
Разрешённые origins:
- `https://triviafront.vercel.app`
- `https://triviafrontadmin.vercel.app`
- `http://localhost:5173`
- `http://localhost:8000`
- `http://localhost:3000`

### Заголовки
```
Content-Type: application/json
Authorization: Bearer {accessToken}  // Опционально, токен также берётся из cookie
X-CSRF-Token: {csrfToken}            // Для мутирующих запросов (POST, PUT, DELETE)
```

### Cookies (автоматически устанавливаются сервером)
| Cookie Name | Тип | Описание |
|-------------|-----|----------|
| `access_token` | HttpOnly | Access JWT токен |
| `refresh_token` | HttpOnly | Refresh токен |
| `__Host-csrf-secret` | HttpOnly | CSRF секрет для валидации |

---

## Аутентификация

### Схема работы

1. **Регистрация/Логин** → Сервер устанавливает 3 cookie + возвращает `csrfToken` в JSON
2. **Сохранить `csrfToken`** в памяти (localStorage/state)
3. **Для защищённых мутирующих запросов** → Отправлять `X-CSRF-Token` в заголовке
4. **При истечении access токена** → Вызвать `/api/auth/refresh` с `X-CSRF-Token`
5. **WebSocket** → Получить ticket через `/api/auth/ws-ticket`, подключиться с `?ticket={ticket}`

### Администратор
- В текущей версии: пользователь с `id = 1` является администратором
- Админские эндпоинты требуют `RequireAuth + AdminOnly + RequireCSRF`

---

## HTTP API Endpoints

### 🔐 Аутентификация (`/api/auth`)

#### POST `/api/auth/register`
Регистрация нового пользователя.

**Авторизация:** Не требуется

**Request Body:**
```json
{
  "username": "string, min=3, max=50, required",
  "email": "string, email format, required",
  "password": "string, min=6, max=50, required"
}
```

**Response 201:**
```json
{
  "user": {
    "id": 1,
    "username": "player1",
    "email": "player@example.com",
    "profile_picture": "",
    "games_played": 0,
    "total_score": 0,
    "highest_score": 0,
    "wins_count": 0,
    "total_prize_won": 0,
    "created_at": "2026-01-22T15:00:00Z",
    "updated_at": "2026-01-22T15:00:00Z"
  },
  "accessToken": "eyJhbGciOiJSUzI1NiJ9...",
  "csrfToken": "abc123hash...",
  "userId": 1,
  "expiresIn": 86400,
  "tokenType": "Bearer"
}
```

**Cookies:** `access_token`, `refresh_token`, `__Host-csrf-secret` устанавливаются автоматически

---

#### POST `/api/auth/login`
Вход в систему.

**Авторизация:** Не требуется

**Request Body:**
```json
{
  "email": "string, email format, required",
  "password": "string, required",
  "device_id": "string, optional"
}
```

**Response 200:**
```json
{
  "user": { /* UserObject */ },
  "accessToken": "eyJhbGciOiJSUzI1NiJ9...",
  "csrfToken": "abc123hash...",
  "userId": 1,
  "expiresIn": 86400,
  "tokenType": "Bearer"
}
```

---

#### POST `/api/auth/refresh`
Обновление токенов.

**Авторизация:** Cookies (refresh_token, __Host-csrf-secret)  
**Заголовок:** `X-CSRF-Token: {csrfToken}`

**Response 200:**
```json
{
  "accessToken": "new_access_token",
  "csrfToken": "new_csrf_hash",
  "userId": 1,
  "expiresIn": 86400,
  "tokenType": "Bearer"
}
```

---

#### POST `/api/auth/check-refresh`
Проверка валидности refresh токена.

**Авторизация:** Cookies (refresh_token) или Request Body

**Response 200:**
```json
{
  "valid": true
}
```

---

#### POST `/api/auth/token-info`
Информация о сроке токенов.

**Авторизация:** Cookies (refresh_token) или Request Body

**Response 200:**
```json
{
  "access_token_expires": "2026-01-23T15:00:00Z",
  "refresh_token_expires": "2026-02-21T15:00:00Z",
  "access_token_valid_for": 86400,
  "refresh_token_valid_for": 2592000
}
```

---

#### GET `/api/auth/csrf`
Получить CSRF токен (хеш).

**Авторизация:** RequireAuth (cookie или Bearer)

**Response 200:**
```json
{
  "csrf_token": "hashed_csrf_secret"
}
```

---

#### POST `/api/auth/logout`
Выход из системы.

**Авторизация:** RequireAuth + RequireCSRF

**Response 200:**
```json
{
  "message": "Successfully logged out"
}
```

---

#### POST `/api/auth/logout-all`
Выход со всех устройств.

**Авторизация:** RequireAuth + RequireCSRF

**Response 200:**
```json
{
  "message": "Выход из всех сессий выполнен успешно"
}
```

---

#### GET `/api/auth/sessions`
Получить список активных сессий.

**Авторизация:** RequireAuth + RequireCSRF

**Response 200:**
```json
{
  "sessions": [
    {
      "id": 1,
      "device_id": "Chrome/Windows",
      "ip_address": "192.168.1.1",
      "user_agent": "Mozilla/5.0...",
      "created_at": "2026-01-22T10:00:00Z",
      "expires_at": "2026-02-21T10:00:00Z"
    }
  ],
  "count": 1
}
```

---

#### POST `/api/auth/revoke-session`
Отозвать конкретную сессию.

**Авторизация:** RequireAuth + RequireCSRF

**Request Body:**
```json
{
  "session_id": 123
}
```

**Query Params:** `?reason=user_revoked` (optional)

**Response 200:**
```json
{
  "message": "Сессия успешно завершена",
  "session_id": 123
}
```

---

#### POST `/api/auth/change-password`
Изменение пароля.

**Авторизация:** RequireAuth + RequireCSRF

**Request Body:**
```json
{
  "old_password": "string, required",
  "new_password": "string, min=6, required"
}
```

**Response 200:**
```json
{
  "message": "password changed successfully"
}
```

---

#### POST `/api/auth/ws-ticket`
Получить одноразовый тикет для WebSocket.

**Авторизация:** RequireAuth + RequireCSRF

**Response 200:**
```json
{
  "success": true,
  "data": {
    "ticket": "eyJhbGciOiJSUzI1NiJ9..."
  }
}
```

> ⚠️ **Тикет действителен 60 секунд!**

---

### 👤 Пользователи (`/api/users`)

#### GET `/api/users/me`
Получить профиль текущего пользователя.

**Авторизация:** RequireAuth

**Response 200:**
```json
{
  "id": 1,
  "username": "player1",
  "email": "player@example.com",
  "profile_picture": "",
  "games_played": 5,
  "total_score": 42,
  "highest_score": 12
}
```

---

#### PUT `/api/users/me`
Обновить профиль.

**Авторизация:** RequireAuth + RequireCSRF

**Request Body:**
```json
{
  "username": "string, min=3, max=50, optional",
  "profile_picture": "string, max=255, optional"
}
```

**Response 200:**
```json
{
  "message": "Profile updated successfully"
}
```

---

#### PUT `/api/users/me/language`
Изменить язык интерфейса.

**Авторизация:** RequireAuth + RequireCSRF

**Request Body:**
```json
{
  "language": "ru"  // "ru" или "kk"
}
```

**Response 200:**
```json
{
  "message": "Language updated successfully"
}
```

> ℹ️ **Язык сохраняется в БД и синхронизируется между устройствами**

---

#### GET `/api/users/me/results`
История игр текущего пользователя.

**Авторизация:** RequireAuth

**Query Params:**
- `page` — номер страницы (default: 1)
- `page_size` — размер страницы (default: 20)

**Response 200:**
```json
{
  "results": [
    {
      "id": 1,
      "user_id": 5,
      "quiz_id": 10,
      "score": 8,
      "rank": 3,
      "is_winner": true,
      "prize_amount": 50000,
      "is_eliminated": false,
      "eliminated_on_question": null,
      "elimination_reason": "",
      "created_at": "2026-02-01T20:30:00Z"
    }
  ],
  "total": 15,
  "page": 1,
  "page_size": 20
}
```

---

### 🏆 Лидерборд (`/api/leaderboard`)

#### GET `/api/leaderboard`
Получить лидерборд.

**Авторизация:** Не требуется

**Query Params:**
- `page` — номер страницы (default: 1)
- `page_size` — размер страницы (default: 10, max: 100)

**Response 200:**
```json
{
  "users": [
    {
      "rank": 1,
      "user_id": 5,
      "username": "champion",
      "profile_picture": "https://...",
      "wins_count": 10,
      "total_prize_won": 50000
    }
  ],
  "total": 150,
  "page": 1,
  "per_page": 10
}
```

---

### 🎯 Викторины (`/api/quizzes`)

#### GET `/api/quizzes`
Список викторин с пагинацией и фильтрацией.

**Авторизация:** Не требуется

**Query Params:**
- `page` — номер страницы (default: 1)
- `page_size` — размер страницы (default: 50)
- `status` — фильтр по статусу: `scheduled`, `in_progress`, `completed`, `cancelled`
- `search` — поиск по title/description (ILIKE)
- `date_from` — минимальная дата scheduled_time (RFC3339)
- `date_to` — максимальная дата scheduled_time (RFC3339)

> При использовании фильтров ответ содержит `total` для пагинации

**Response 200:**
```json
[
  {
    "id": 1,
    "title": "Вечерняя викторина",
    "description": "Проверь свои знания!",
    "scheduled_time": "2026-01-22T20:00:00Z",
    "status": "scheduled",
    "question_count": 10,
    "prize_fund": 1000000,
    "created_at": "2026-01-20T10:00:00Z",
    "updated_at": "2026-01-20T10:00:00Z"
  }
]
```

---

#### GET `/api/quizzes/active`
Получить активную викторину.

**Авторизация:** Не требуется

**Response 200:** QuizResponse или 404

---

#### GET `/api/quizzes/scheduled`
Получить запланированные викторины.

**Авторизация:** Не требуется

**Response 200:** Array of QuizResponse

---

#### GET `/api/quizzes/:id`
Получить викторину по ID.

**Авторизация:** Не требуется

**Response 200:** QuizResponse

---

#### GET `/api/quizzes/:id/with-questions`
Получить викторину с вопросами.

**Авторизация:** Не требуется

> ⚠️ `correct_option` скрыт для незавершённых викторин!

**Response 200:**
```json
{
  "id": 1,
  "title": "Викторина",
  "status": "in_progress",
  "questions": [
    {
      "id": 101,
      "quiz_id": 1,
      "text": "Какой язык самый популярный?",
      "options": [
        {"id": 0, "text": "Python"},
        {"id": 1, "text": "JavaScript"},
        {"id": 2, "text": "Go"}
      ],
      "time_limit_sec": 15,
      "point_value": 1,
      "created_at": "...",
      "updated_at": "..."
    }
  ]
}
```

---

#### GET `/api/quizzes/:id/results`
Получить результаты викторины с пагинацией.

**Авторизация:** Не требуется

**Query Params:** `page`, `page_size`

**Response 200:**
```json
{
  "results": [
    {
      "id": 1,
      "user_id": 5,
      "quiz_id": 1,
      "username": "player1",
      "profile_picture": "",
      "score": 8,
      "correct_answers": 8,
      "total_questions": 10,
      "rank": 1,
      "is_winner": true,
      "prize_fund": 5000,
      "is_eliminated": false,
      "completed_at": "2026-01-22T20:30:00Z"
    }
  ],
  "total": 50,
  "page": 1,
  "per_page": 10
}
```

---

#### GET `/api/quizzes/:id/my-result`
Получить свой результат в викторине.

**Авторизация:** RequireAuth

**Response 200:** ResultResponse

---

### 🛡️ Админ-эндпоинты

#### POST `/api/quizzes`
Создать викторину.

**Авторизация:** RequireAuth + AdminOnly + RequireCSRF

**Request Body:**
```json
{
  "title": "string, min=3, max=100, required",
  "description": "string, max=500, optional",
  "scheduled_time": "2026-01-25T20:00:00Z",
  "prize_fund": 1000000
}
```

| Поле | Тип | Описание |
|------|-----|----------|
| `title` | string | Название викторины (3-100 символов) |
| `description` | string | Описание (опционально) |
| `scheduled_time` | string | Время начала (ISO 8601) |
| `prize_fund` | number | Призовой фонд (опционально, default: 1000000) |

---

#### POST `/api/quizzes/:id/questions`
Добавить вопросы к викторине.

**Авторизация:** RequireAuth + AdminOnly + RequireCSRF

**Request Body:**
```json
{
  "questions": [
    {
      "text": "Вопрос?",
      "options": ["Вариант A", "Вариант B", "Вариант C", "Вариант D"],
      "correct_option": 1,
      "time_limit_sec": 15,
      "point_value": 1,
      "difficulty": 3
    }
  ]
}
```

| Поле | Тип | Описание |
|------|-----|----------|
| `text` | string | Текст вопроса |
| `options` | string[] | Варианты ответа (мин. 2) |
| `correct_option` | number | Индекс правильного ответа (0-based) |
| `time_limit_sec` | number | Время на ответ (5-60 сек) |
| `point_value` | number | Очки за вопрос |
| `difficulty` | number | Уровень сложности (1=очень легко, 5=очень сложно) |

---

#### PUT `/api/quizzes/:id/schedule`
Запланировать викторину.

**Авторизация:** RequireAuth + AdminOnly + RequireCSRF

**Request Body:**
```json
{
  "scheduled_time": "2026-01-25T20:00:00Z"
}
```

---

#### PUT `/api/quizzes/:id/cancel`
Отменить викторину.

**Авторизация:** RequireAuth + AdminOnly + RequireCSRF

---

#### POST `/api/quizzes/:id/duplicate`
Дублировать викторину.

**Авторизация:** RequireAuth + AdminOnly + RequireCSRF

**Request Body:**
```json
{
  "scheduled_time": "2026-01-30T20:00:00Z"
}
```

> ℹ️ **При дублировании `prize_fund` копируется из оригинальной викторины**

---

#### GET `/api/quizzes/:id/results/export`
Экспортировать результаты викторины в CSV или Excel.

**Авторизация:** RequireAuth + AdminOnly + RequireCSRF

**Query Params:**
- `format` — формат экспорта: `csv` (default) или `xlsx`

**Response:**
- **CSV:** `text/csv` — файл `quiz_{id}_results.csv`
- **XLSX:** `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

> Экспорт включает: username, email, score, rank, is_winner, prize_amount, eliminated_on_question, elimination_reason

---

#### GET `/api/quizzes/:id/statistics`
Расширенная статистика викторины.

**Авторизация:** RequireAuth + AdminOnly + RequireCSRF

**Response 200:**
```json
{
  "quiz_id": 1,
  "total_participants": 150,
  "total_winners": 12,
  "total_eliminated": 138,
  "avg_response_time_ms": 4250.5,
  "avg_correct_answers": 3.2,
  "eliminations_by_question": [
    {
      "question_number": 1,
      "question_id": 101,
      "eliminated_count": 15,
      "by_timeout": 5,
      "by_wrong_answer": 10,
      "avg_response_ms": 12500.0
    }
  ],
  "elimination_reasons": {
    "timeout": 45,
    "wrong_answer": 80,
    "disconnected": 10,
    "other": 3
  }
}
```

---

#### GET `/api/quizzes/:id/winners`
Получить список всех победителей викторины (без пагинации).

**Авторизация:** RequireAuth + AdminOnly + RequireCSRF

**Response 200:**
```json
{
  "winners": [
    {
      "id": 1,
      "user_id": 42,
      "quiz_id": 1,
      "username": "winner1",
      "profile_picture": "/avatars/42.jpg",
      "score": 100,
      "correct_answers": 10,
      "total_questions": 10,
      "rank": 1,
      "is_winner": true,
      "prize_fund": 50000,
      "is_eliminated": false,
      "completed_at": "2026-01-22T20:30:00Z"
    }
  ],
  "total": 12
}
```

> ℹ️ **Используйте этот endpoint вместо /results с фильтрацией — возвращает ВСЕХ победителей без лимита**

---

#### POST `/api/auth/admin/reset-auth`
Сбросить инвалидацию токенов пользователя.

**Авторизация:** RequireAuth + AdminOnly + RequireCSRF

**Request Body:**
```json
{
  "user_id": 123
}
```

---

#### POST `/api/auth/admin/reset-password`
Сбросить пароль пользователя.

**Авторизация:** RequireAuth + AdminOnly + RequireCSRF

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "newPassword123"
}
```

---

### 📦 Пул вопросов для адаптивной системы (`/api/admin/question-pool`)

#### POST `/api/admin/question-pool`
Массовая загрузка вопросов в общий пул для адаптивной системы сложности.

**Авторизация:** RequireAuth + AdminOnly + RequireCSRF

**Request Body:**
```json
{
  "questions": [
    {
      "text": "Какой город является столицей Казахстана?",
      "options": ["Алматы", "Астана", "Караганда", "Шымкент"],
      "correct_option": 1,
      "difficulty": 1,
      "time_limit_sec": 10,
      "point_value": 1
    }
  ]
}
```

| Поле | Тип | Описание |
|------|-----|----------|
| `text` | string | Текст вопроса (обязательно) |
| `options` | string[] | Варианты ответа (мин. 2, обязательно) |
| `correct_option` | number | Индекс правильного ответа (обязательно) |
| `difficulty` | number | **Обязательно**: 1=очень легко, 2=легко, 3=средне, 4=сложно, 5=очень сложно |
| `time_limit_sec` | number | Время на ответ (опционально, дефолт: 10 сек) |
| `point_value` | number | Очки за вопрос (опционально, дефолт: 1) |

**Response 201:**
```json
{
  "message": "uploaded 50 questions",
  "count": 50
}
```

> ℹ️ **Эти вопросы используются адаптивной системой** — вопросы выбираются динамически во время викторины на основе сложности и текущего pass rate.

---

### 📺 Рекламные материалы (`/api/admin/ads`)

#### POST `/api/admin/ads`
Загрузить рекламный материал.

**Авторизация:** RequireAuth + AdminOnly + RequireCSRF

**Request:** `multipart/form-data`
| Поле | Тип | Описание |
|------|-----|----------|
| `file` | File | Изображение (.jpg, .png, .webp, .gif) или видео (.mp4, .webm) |
| `title` | string | Название рекламы |
| `media_type` | string | `"image"` или `"video"` |
| `duration_sec` | number | Длительность показа (3-30 сек) |

**Response 201:**
```json
{
  "id": 1,
  "title": "Реклама продукта",
  "media_type": "video",
  "url": "/uploads/ads/ad_1737564123.mp4",
  "duration_sec": 10,
  "file_size_bytes": 2048576,
  "created_at": "2026-01-27T10:00:00Z"
}
```

---

#### GET `/api/admin/ads`
Список всех рекламных материалов.

**Авторизация:** RequireAuth + AdminOnly

**Response 200:**
```json
{
  "items": [
    {
      "id": 1,
      "title": "Реклама 1",
      "media_type": "video",
      "url": "/uploads/ads/ad_1.mp4",
      "duration_sec": 10,
      "file_size_bytes": 2048576,
      "created_at": "2026-01-27T10:00:00Z"
    }
  ]
}
```

---

#### DELETE `/api/admin/ads/:id`
Удалить рекламный материал.

**Авторизация:** RequireAuth + AdminOnly + RequireCSRF

> ⚠️ Нельзя удалить рекламу, которая используется в слотах!

---

### 📺 Рекламные слоты викторины (`/api/quizzes/:id/ad-slots`)

#### POST `/api/quizzes/:id/ad-slots`
Создать рекламный слот для викторины.

**Авторизация:** RequireAuth + AdminOnly + RequireCSRF

**Request Body:**
```json
{
  "question_after": 3,
  "ad_asset_id": 1,
  "is_active": true
}
```

- `question_after` — после какого вопроса показать рекламу (1-N)

---

#### GET `/api/quizzes/:id/ad-slots`
Список слотов викторины.

**Авторизация:** RequireAuth + AdminOnly

**Response 200:**
```json
{
  "items": [
    {
      "id": 1,
      "quiz_id": 5,
      "question_after": 3,
      "ad_asset_id": 1,
      "is_active": true,
      "ad_asset": {
        "id": 1,
        "title": "Реклама продукта",
        "media_type": "video",
        "url": "/uploads/ads/ad_1.mp4",
        "duration_sec": 10
      }
    }
  ]
}
```

---

#### PUT `/api/quizzes/:id/ad-slots/:slotId`
Обновить слот (вкл/выкл).

**Авторизация:** RequireAuth + AdminOnly + RequireCSRF

**Request Body:**
```json
{
  "is_active": false
}
```

---

#### DELETE `/api/quizzes/:id/ad-slots/:slotId`
Удалить слот.

**Авторизация:** RequireAuth + AdminOnly + RequireCSRF

---

### 📊 WebSocket мониторинг (`/admin/ws`)

Эндпоинты для мониторинга состояния WebSocket сервера.

**Авторизация:** RequireAuth + AdminOnly

#### GET `/admin/ws/metrics`
Базовые метрики WebSocket.

**Response 200:**
```json
{
  "total_connections": 1000,
  "active_connections": 42,
  "messages_sent": 5000,
  "messages_received": 3000,
  "connection_errors": 5,
  "inactive_clients_removed": 10,
  "uptime_seconds": 86400,
  "last_cleanup": "2026-02-01T12:00:00Z",
  "generated_at": "2026-02-01T15:00:00Z"
}
```

---

#### GET `/admin/ws/metrics/detailed`
Детальные метрики включая шарды.

**Response 200:**
```json
{
  "...базовые метрики...",
  "shard_count": 4,
  "avg_connections_per_shard": 10.5,
  "hot_shards": [2],
  "shard_distribution": {"0": 10, "1": 12, "2": 18, "3": 8},
  "shard_metrics": [
    {
      "shard_id": 0,
      "active_connections": 10,
      "messages_sent": 1200,
      "load_percentage": 50.0,
      "max_clients": 20
    }
  ]
}
```

---

#### GET `/admin/ws/metrics/prometheus`
Метрики в формате Prometheus для интеграции с системами мониторинга.

**Content-Type:** `text/plain`

**Response 200:**
```
# HELP websocket_active_connections Current number of active connections
# TYPE websocket_active_connections gauge
websocket_active_connections 42 1706788800000
```

---

#### GET `/admin/ws/health`
Health check WebSocket сервера.

**Response 200:**
```json
{
  "status": "healthy",
  "active_connections": 42,
  "timestamp": "2026-02-01T15:00:00Z"
}
```

---

#### GET `/admin/ws/alerts`
Системные алерты (горячие шарды, переполнение буферов).

**Response 200:**
```json
{
  "status": "healthy",
  "alerts": [],
  "alerts_count": 0,
  "hub_type": "ShardedHub",
  "check_time": "2026-02-01T15:00:00Z"
}
```

---

## WebSocket соединение

### Подключение

```
URL: ws://localhost:8080/ws?ticket={ticket}
     wss://api.trivia-app.com/ws?ticket={ticket}
```

**Шаг 1.** Получить ticket:
```http
POST /api/auth/ws-ticket
X-CSRF-Token: {csrfToken}
```

**Шаг 2.** Подключиться:
```javascript
const ws = new WebSocket(`wss://api.example.com/ws?ticket=${ticket}`);
```

### Формат сообщений

Все сообщения имеют формат:
```json
{
  "type": "event_type",
  "data": { /* payload */ }
}
```

---

### События от клиента (Client → Server)

#### `user:ready`
Сообщение о готовности к викторине.

```json
{
  "type": "user:ready",
  "data": {
    "quiz_id": 1
  }
}
```

**Важно:** После отправки клиент подписывается на события викторины.

---

#### `user:answer`
Отправка ответа на вопрос.

```json
{
  "type": "user:answer",
  "data": {
    "question_id": 101,
    "selected_option": 2,
    "timestamp": 1737564123456
  }
}
```

- `selected_option` — индекс выбранного варианта (0-based)
- `timestamp` — время отправки в миллисекундах (Unix epoch)

---

#### `user:heartbeat`
Проверка соединения (heartbeat/ping).

```json
{
  "type": "user:heartbeat",
  "data": {}
}
```

---

#### `user:resync`
Запрос текущего состояния викторины (для восстановления после reconnect).

```json
{
  "type": "user:resync",
  "data": {
    "quiz_id": 1
  }
}
```

> 💡 **Используйте после reconnect** чтобы получить текущий вопрос, таймер и статус пользователя.

---

### События от сервера (Server → Client)

#### `quiz:start`
Викторина началась.

```json
{
  "type": "quiz:start",
  "data": {
    "quiz_id": 1,
    "title": "Вечерняя викторина",
    "question_count": 10
  }
}
```

---

#### `quiz:question`
Новый вопрос.

```json
{
  "type": "quiz:question",
  "data": {
    "question_id": 101,
    "quiz_id": 1,
    "number": 1,
    "text": "Какой язык программирования создал Брендан Айк?",
    "text_kk": "Брендан Айк қай программалау тілін жасады?",
    "options": [
      {"id": 0, "text": "Python"},
      {"id": 1, "text": "JavaScript"},
      {"id": 2, "text": "Java"},
      {"id": 3, "text": "C++"}
    ],
    "options_kk": [
      {"id": 0, "text": "Python"},
      {"id": 1, "text": "JavaScript"},
      {"id": 2, "text": "Java"},
      {"id": 3, "text": "C++"}
    ],
    "time_limit": 15,
    "total_questions": 10,
    "start_time": 1737564120000,
    "server_timestamp": 1737564120000
  }
}
```

- `start_time` — время старта вопроса (ms)
- `time_limit` — лимит времени в секундах
- `text_kk` — казахский текст вопроса (опционально, может быть пустым)
- `options_kk` — казахские варианты ответа (опционально, может быть пустым)

> ℹ️ **Фронтенд выбирает язык** на основе cookie `NEXT_LOCALE`. Если `text_kk`/`options_kk` пусты — используется fallback на русский.

---

#### `quiz:timer`
Обновление таймера (каждую секунду).

```json
{
  "type": "quiz:timer",
  "data": {
    "question_id": 101,
    "remaining_seconds": 10,
    "server_timestamp": 1737564125000
  }
}
```

---

#### `quiz:answer_reveal`
Раскрытие правильного ответа.

```json
{
  "type": "quiz:answer_reveal",
  "data": {
    "question_id": 101,
    "correct_option": 1
  }
}
```

---

#### `quiz:ad_break`
Начало рекламного блока (отправляется после `quiz:answer_reveal`, если настроен слот).

```json
{
  "type": "quiz:ad_break",
  "data": {
    "quiz_id": 1,
    "media_type": "video",
    "media_url": "/uploads/ads/ad_1737564120.mp4",
    "duration_sec": 10
  }
}
```

- `media_type` — тип медиа: `"image"` или `"video"`
- `media_url` — относительный URL (добавить `API_URL` для полного пути)
- `duration_sec` — длительность показа в секундах (3-30)

**Frontend должен:**
1. Показать полноэкранный оверлей с медиа
2. Запустить таймер обратного отсчёта
3. Заблокировать UI до окончания

---

#### `quiz:ad_break_end`
Окончание рекламного блока.

```json
{
  "type": "quiz:ad_break_end",
  "data": {
    "quiz_id": 1
  }
}
```

**Frontend должен:**
1. Скрыть рекламный оверлей
2. Вернуться к обычному UI игры

---

#### `quiz:answer_result`
Личный результат ответа (отправляется только отвечавшему игроку).

```json
{
  "type": "quiz:answer_result",
  "data": {
    "question_id": 101,
    "correct_option": 1,
    "your_answer": 1,
    "is_correct": true,
    "points_earned": 1,
    "time_taken_ms": 3500,
    "is_eliminated": false,
    "elimination_reason": "",
    "time_limit_exceeded": false
  }
}
```

**Причины выбывания (`elimination_reason`):**
- `incorrect_answer` — неправильный ответ
- `time_exceeded` — ответ после истечения времени
- `no_answer_timeout` — не ответил вовремя
- `already_eliminated` — уже выбыл ранее

---

#### `quiz:elimination`
Уведомление о выбывании.

```json
{
  "type": "quiz:elimination",
  "data": {
    "quiz_id": 1,
    "user_id": 123,
    "reason": "incorrect_answer",
    "message": "Вы выбыли из викторины и можете только наблюдать"
  }
}
```

---

#### `quiz:user_ready`
Другой пользователь готов (broadcast). Содержит текущее количество подключённых игроков.

```json
{
  "type": "quiz:user_ready",
  "data": {
    "user_id": 456,
    "quiz_id": 1,
    "status": "ready",
    "player_count": 42
  }
}
```

| Поле | Тип | Описание |
|------|-----|----------|
| `user_id` | number | ID пользователя, который присоединился |
| `quiz_id` | number | ID викторины |
| `status` | string | Статус готовности (всегда "ready") |
| `player_count` | number | Текущее количество подключённых игроков онлайн |

---

#### `quiz:player_count`
Обновление количества игроков онлайн (отправляется при подключении/отключении игроков).

```json
{
  "type": "quiz:player_count",
  "data": {
    "quiz_id": 1,
    "player_count": 41
  }
}
```

| Поле | Тип | Описание |
|------|-----|----------|
| `quiz_id` | number | ID викторины |
| `player_count` | number | Текущее количество подключённых игроков онлайн |

---

#### `quiz:finish`
Викторина завершена.

```json
{
  "type": "quiz:finish",
  "data": {
    "quiz_id": 1,
    "title": "Вечерняя викторина",
    "message": "Викторина завершена! Подсчет результатов...",
    "status": "completed",
    "ended_at": "2026-01-22T20:30:00Z"
  }
}
```

---

#### `quiz:results_available`
Результаты готовы для просмотра.

```json
{
  "type": "quiz:results_available",
  "data": {
    "quiz_id": 1
  }
}
```

---

#### `quiz:state`
Текущее состояние викторины (ответ на `user:resync`).

```json
{
  "type": "quiz:state",
  "data": {
    "quiz_id": 1,
    "status": "in_progress",
    "current_question": {
      "question_id": 101,
      "number": 3,
      "total_questions": 10,
      "text": "Какой язык создал Брендан Айк?",
      "options": [
        {"id": 0, "text": "Python"},
        {"id": 1, "text": "JavaScript"},
        {"id": 2, "text": "Go"},
        {"id": 3, "text": "Rust"}
      ],
      "time_limit": 15
    },
    "time_remaining": 8,
    "is_eliminated": false,
    "elimination_reason": "",
    "score": 2,
    "correct_count": 2
  }
}
```

**Поля:**
- `status` — `"waiting"`, `"in_progress"`, `"completed"`
- `current_question` — текущий вопрос (null если нет активного)
- `time_remaining` — секунд до конца ответа
- `is_eliminated` — выбыл ли пользователь
- `score`, `correct_count` — накопленные очки

> 💡 **Используйте для восстановления UI после refresh или reconnect.**

---

#### `server:heartbeat`
Ответ на heartbeat.

```json
{
  "type": "server:heartbeat",
  "data": {
    "timestamp": 1737564130000
  }
}
```

---

#### `server:error`
Ошибка обработки сообщения.

```json
{
  "type": "server:error",
  "data": {
    "code": "invalid_format",
    "message": "Failed to parse user:answer event"
  }
}
```

**Коды ошибок:**
- `invalid_message_format` — неверный JSON
- `unknown_message_type` — неизвестный тип сообщения
- `invalid_format` — неверный формат данных
- `subscribe_error` — ошибка подписки на викторину
- `ready_error` — ошибка обработки готовности
- `answer_error` — ошибка обработки ответа
- `internal_error` — внутренняя ошибка

---

#### `TOKEN_EXPIRE_SOON`
Предупреждение об истечении токена.

```json
{
  "type": "TOKEN_EXPIRE_SOON",
  "data": {
    "expires_in": 300,
    "unit": "seconds"
  }
}
```

---

#### `TOKEN_EXPIRED`
Токен истёк.

```json
{
  "type": "TOKEN_EXPIRED",
  "data": {
    "message": "Срок действия токена истек. Необходимо выполнить повторный вход."
  }
}
```

---

#### Сессионные события (через WebSocket Hub)

```json
{
  "event": "session_revoked",
  "session_id": 123,
  "timestamp": "2026-01-22T15:30:00Z",
  "reason": "user_revoked",
  "user_id": 1
}
```

```json
{
  "event": "logout_all_devices",
  "user_id": 1,
  "timestamp": "2026-01-22T15:30:00Z",
  "reason": "user_logout_all"
}
```

---

## Структуры данных

### Quiz Status
| Статус | Описание |
|--------|----------|
| `scheduled` | Запланирована |
| `in_progress` | Идёт |
| `completed` | Завершена |
| `cancelled` | Отменена |

### User Object
```typescript
interface User {
  id: number;
  username: string;
  email: string;
  profile_picture: string;
  games_played: number;
  total_score: number;
  highest_score: number;
  wins_count: number;
  total_prize_won: number;
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
}
```

### Quiz Object
```typescript
interface Quiz {
  id: number;
  title: string;
  description?: string;
  scheduled_time: string; // ISO 8601
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  question_count: number;
  prize_fund: number;      // Призовой фонд викторины
  questions?: Question[]; // Только при запросе with-questions
  created_at: string;
  updated_at: string;
}
```

> **Призовой фонд:** Сумма, которая делится поровну между всеми победителями. Победитель = ответил правильно на **ВСЕ** вопросы и не выбыл.

### Question Object
```typescript
interface Question {
  id: number;
  quiz_id: number;
  text: string;
  options: QuestionOption[];
  time_limit_sec: number;
  point_value: number;
  created_at: string;
  updated_at: string;
}

interface QuestionOption {
  id: number;   // 0-based index
  text: string;
}
```

### Result Object
```typescript
interface Result {
  id: number;
  user_id: number;
  quiz_id: number;
  username: string;
  profile_picture?: string;
  score: number;
  correct_answers: number;
  total_questions: number;
  rank: number;
  is_winner: boolean;
  prize_fund: number;
  is_eliminated: boolean;
  completed_at: string; // ISO 8601
}
```

### Session Object
```typescript
interface Session {
  id: number;
  device_id: string;
  ip_address: string;
  user_agent: string;
  created_at: string;
  expires_at: string;
}
```

---

## Коды ошибок

### HTTP Error Response
```json
{
  "error": "Описание ошибки",
  "error_type": "error_code"
}
```

### Типы ошибок аутентификации
| error_type | HTTP | Описание |
|------------|------|----------|
| `token_missing` | 401 | Токен отсутствует |
| `token_format` | 401 | Неверный формат токена |
| `token_invalid` | 401 | Невалидный токен |
| `token_expired` | 401 | Токен истёк |
| `csrf_token_missing` | 403 | CSRF токен отсутствует |
| `csrf_token_invalid` | 403 | Невалидный CSRF токен |
| `csrf_secret_cookie_invalid` | 403 | Проблема с CSRF cookie |
| `csrf_secret_mismatch` | 403 | CSRF секреты не совпадают |
| `unauthorized` | 401 | Ошибка аутентификации |
| `forbidden` | 403 | Доступ запрещён |
| `invalid_credentials` | 401 | Неверные учётные данные |
| `too_many_sessions` | 409 | Превышен лимит сессий |
| `session_not_found` | 404 | Сессия не найдена |
| `internal_server_error` | 500 | Внутренняя ошибка |

### Типы ошибок викторин
| error_type | HTTP | Описание |
|------------|------|----------|
| `not_found` | 404 | Викторина не найдена |
| `conflict` | 409 | Конфликт (уже существует) |
| `validation_error` | 422 | Ошибка валидации |

---

## Рекомендации по реализации

### 1. Хранение токенов
- `csrfToken` — хранить в памяти (React state, Vue reactive, etc.)
- Cookies устанавливаются автоматически (`credentials: 'include'`)

### 2. Обновление токенов
```javascript
// При получении 401 с error_type: token_expired
async function refreshTokens() {
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'X-CSRF-Token': storedCsrfToken
    }
  });
  const data = await response.json();
  storedCsrfToken = data.csrfToken; // Обновить!
}
```

### 3. WebSocket reconnect
```javascript
let ws;
let reconnectAttempts = 0;

async function connect() {
  const ticket = await getWsTicket();
  ws = new WebSocket(`wss://api.example.com/ws?ticket=${ticket}`);
  
  ws.onclose = () => {
    if (reconnectAttempts < 5) {
      setTimeout(connect, 1000 * Math.pow(2, reconnectAttempts));
      reconnectAttempts++;
    }
  };
  
  ws.onopen = () => reconnectAttempts = 0;
}
```

### 4. Обработка событий викторины
```javascript
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  
  switch (msg.type) {
    case 'quiz:start':
      // Показать UI викторины
      break;
    case 'quiz:question':
      // Показать вопрос, запустить таймер
      break;
    case 'quiz:timer':
      // Обновить отображение таймера
      break;
    case 'quiz:answer_result':
      // Показать результат ответа
      if (msg.data.is_eliminated) {
        // Перейти в режим наблюдателя
      }
      break;
    case 'quiz:answer_reveal':
      // Показать правильный ответ
      break;
    case 'quiz:elimination':
      // Показать уведомление о выбывании
      break;
    case 'quiz:finish':
      // Показать сообщение о завершении
      break;
    case 'quiz:results_available':
      // Загрузить и показать результаты
      break;
    case 'quiz:state':
      // Resync после переподключения - содержит полное состояние
      // msg.data: { quiz_id, status, current_question, time_remaining,
      //             is_eliminated, elimination_reason, score, correct_count, player_count }
      break;
    case 'quiz:player_count':
      // Обновление количества активных игроков
      // msg.data: { quiz_id, player_count }
      break;
    case 'quiz:user_ready':
      // Игрок готов, содержит обновлённый player_count
      // msg.data: { user_id, player_count }
      break;
    case 'server:error':
      // Обработать ошибку
      console.error(msg.data.code, msg.data.message);
      break;
  }
};
```

### 5. Resync после переподключения (user:resync)
При переподключении к WebSocket, клиент может запросить текущее состояние викторины:

```javascript
// Отправка запроса на resync
ws.send(JSON.stringify({
  type: 'user:resync',
  data: { quiz_id: 123 }
}));

// Ответ приходит как quiz:state с полным состоянием:
// {
//   "type": "quiz:state",
//   "data": {
//     "quiz_id": 123,
//     "status": "in_progress",
//     "current_question": { ... },   // текущий вопрос, если есть
//     "time_remaining": 8,           // секунд до конца вопроса
//     "is_eliminated": false,
//     "elimination_reason": "",
//     "score": 5,
//     "correct_count": 5,
//     "player_count": 42             // количество активных игроков
//   }
// }
```

---

## Frontend Data-Fetching (TanStack Query)

> **Добавлено 2026-01-29** — Frontend использует TanStack Query v5 для кеширования и синхронизации данных.

### Основные Query Keys

| Key | Описание | Автоматическое обновление |
|-----|----------|---------------------------|
| `['user', 'me']` | Данные текущего пользователя | При `quiz:finish`, `quiz:results_available` |
| `['leaderboard', page]` | Данные лидерборда | При `quiz:results_available` |

### Инвалидация после викторины

При получении WebSocket событий `quiz:finish` или `quiz:results_available` автоматически инвалидируются:

```javascript
// QuizWebSocketProvider.tsx
case 'quiz:finish':
case 'quiz:results_available':
    queryClient.invalidateQueries({ queryKey: ['user', 'me'] })
    queryClient.invalidateQueries({ queryKey: ['leaderboard'] })
    break;
```

Это обновляет все 4 поля статистики пользователя:
- `games_played` — количество сыгранных игр
- `wins_count` — количество побед
- `total_score` — общий счёт
- `total_prize_won` — выигранные призы

### Файлы

| Файл | Описание |
|------|----------|
| `src/providers/QueryProvider.tsx` | QueryClientProvider со SSR настройками |
| `src/lib/hooks/useUserQuery.ts` | Хуки для user данных и инвалидации |
| `src/providers/AuthProvider.tsx` | Использует useQuery вместо useState |

---

## Адаптивная система сложности (Admin Realtime)

> **Добавлено 2026-02-07** — WebSocket событие для realtime мониторинга адаптивной системы сложности.

### Событие `adaptive:question_stats`

Отправляется после завершения каждого вопроса (после обработки всех ответов и выбытий).

**Данные:**
```json
{
  "type": "adaptive:question_stats",
  "data": {
    "quiz_id": 123,
    "question_number": 5,
    "difficulty_used": 3,
    "target_pass_rate": 0.75,
    "actual_pass_rate": 0.68,
    "total_answers": 50,
    "passed_count": 34,
    "remaining_players": 42,
    "timestamp": "2026-02-07T15:30:00Z"
  }
}
```

| Поле | Тип | Описание |
|------|-----|----------|
| `quiz_id` | number | ID викторины |
| `question_number` | number | Номер вопроса (1-indexed) |
| `difficulty_used` | number | Сложность вопроса (1-5) |
| `target_pass_rate` | number | Целевой процент прохождения (0-1) |
| `actual_pass_rate` | number | Фактический процент прохождения (0-1) |
| `total_answers` | number | Всего ответов на вопрос |
| `passed_count` | number | Количество прошедших вопрос |
| `remaining_players` | number | Оставшихся игроков в викторине |

### Админ-страница Live мониторинга

**URL:** `/admin/quiz-live/{id}`

Страница для realtime наблюдения за ходом викторины с отображением метрик адаптивной системы.

---

## Changelog

- **2026-02-07**: Добавлена секция Адаптивная система сложности (событие `adaptive:question_stats`, админ-страница `/admin/quiz-live`)
- **2026-01-29**: Добавлена секция Frontend Data-Fetching (TanStack Query v5 интеграция)
- **2026-01-29**: Добавлены события `quiz:state`, `quiz:player_count`, `quiz:user_ready`, документация user:resync
- **2026-01-22**: Первоначальная версия документации, созданная на основе анализа кода

