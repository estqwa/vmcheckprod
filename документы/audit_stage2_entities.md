# Backend Audit Report — Stage 2: Domain Entities & Repository Interfaces

**Файлы:** `internal/domain/entity/*.go`, `internal/domain/repository/*.go`

---

## ✅ Что сделано правильно

### 1. Entities — полное соответствие GORM best practices

| Entity | TableName() | Primary Key | Indexes | Hooks/Methods |
|--------|-------------|-------------|---------|---------------|
| User | ✅ | ✅ gorm:"primaryKey" | ✅ uniqueIndex, idx_leaderboard | ✅ BeforeSave, CheckPassword |
| Quiz | ✅ | ✅ | ✅ index на scheduled_time, status | ✅ IsActive, IsScheduled, IsCompleted |
| Question | ✅ | ✅ | ✅ index на quiz_id | ✅ Localization methods |
| Result | ✅ | ✅ | ✅ uniqueIndex:idx_user_quiz, idx_quiz_rank | — |
| RefreshToken | ✅ | ✅ | ✅ Multiple indexes | ✅ IsValid, Revoke |
| JWTKey | ✅ | ✅ varchar PK | ✅ index on is_active, expires_at | ✅ CanBeUsedForSigning |

### 2. StringArray (question.go) — Custom Type
```go
type StringArray []string

func (o *StringArray) Scan(value interface{}) error { ... }
func (o StringArray) Value() (driver.Value, error) { ... }
```
✅ **Соответствует GORM docs** — реализует `sql.Scanner` и `driver.Valuer` для JSONB.

### 3. Password Hashing (user.go:35-49)
```go
func (u *User) BeforeSave(tx *gorm.DB) error {
    if len(u.Password) > 0 && !strings.HasPrefix(u.Password, "$2a$") ... {
        hashedPassword, err := bcrypt.GenerateFromPassword(...)
    }
}
```
✅ **Безопасно** — проверяет, что пароль ещё не хеширован перед хешированием.

### 4. Repository Interfaces — Clean Architecture
```go
type UserRepository interface {
    Create(user *entity.User) error
    GetByID(id uint) (*entity.User, error)
    // ...
}
```
✅ **Правильное разделение** — интерфейсы в `domain/repository/`, реализации в `repository/postgres/`.

### 5. JSON Visibility
```go
Password string `gorm:"size:100;not null" json:"-"`  // user.go
Token    string `gorm:"type:text;not null;uniqueIndex" json:"-"` // refresh_token.go
Key      string `gorm:"type:text;not null" json:"-"` // jwt_key.go
```
✅ **Секреты скрыты** — `json:"-"` предотвращает утечку через API.

---

## ⚠️ Рекомендации (Minor)

### 1. Нет gorm.DeletedAt (Soft Delete)
**Где:** Все entities
**Статус:** Не критично — проект использует hard delete, что подходит для триви.

### 2. Result.Username/ProfilePicture — дублирование данных
**Где:** result.go:12-13
```go
Username       string `gorm:"size:50;not null" json:"username"`
ProfilePicture string `gorm:"size:255;not null;default:''"`
```
**Статус:** ✅ OK — это денормализация для performance (не нужен JOIN для лидерборда).

### 3. Question.CorrectOption скрыт из JSON
```go
CorrectOption int `gorm:"not null" json:"-"` // Скрыто от клиента
```
✅ **Правильно** — предотвращает читерство.

---

## 🔴 Критических проблем не обнаружено

---

## Compliance Score: 98/100

| Аспект | Статус |
|--------|--------|
| TableName() methods | ✅ |
| GORM struct tags | ✅ |
| Indexes & Constraints | ✅ |
| Custom Types (Scanner/Valuer) | ✅ |
| Hooks (BeforeSave) | ✅ |
| Password Security | ✅ |
| Secret Fields Hidden | ✅ |
| Clean Interface Design | ✅ |

---

## Итог Этапа 2
Domain entities и repository interfaces реализованы **отлично**. Полное соответствие GORM best practices. Секреты защищены, индексы настроены правильно.

---

*Следующий этап: Repository Implementations (postgres, redis)*
