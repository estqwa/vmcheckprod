package entity

import (
	"log"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// User представляет пользователя в системе
type User struct {
	ID                  uint       `gorm:"primaryKey" json:"id"`
	Username            string     `gorm:"size:50;not null;uniqueIndex" json:"username"`
	Email               string     `gorm:"size:100;not null;uniqueIndex" json:"email"`
	Password            string     `gorm:"size:100;not null" json:"-"`
	PasswordAuthEnabled bool       `gorm:"not null;default:true" json:"-"`
	ProfilePicture      string     `gorm:"size:255;not null;default:''" json:"profile_picture"`
	FirstName           string     `gorm:"size:100;not null;default:''" json:"first_name"`
	LastName            string     `gorm:"size:100;not null;default:''" json:"last_name"`
	BirthDate           *time.Time `gorm:"type:date" json:"birth_date,omitempty"`
	Gender              string     `gorm:"size:20;not null;default:''" json:"gender"` // male, female, other, prefer_not_to_say
	GamesPlayed         int64      `gorm:"not null;default:0" json:"games_played"`
	TotalScore          int64      `gorm:"not null;default:0" json:"total_score"`
	HighestScore        int64      `gorm:"not null;default:0" json:"highest_score"`
	WinsCount           int64      `gorm:"not null;default:0;index:idx_users_leaderboard" json:"wins_count"`
	TotalPrizeWon       int64      `gorm:"not null;default:0;index:idx_users_leaderboard" json:"total_prize_won"`
	Language            string     `gorm:"size:5;not null;default:'ru'" json:"language"` // "ru" или "kk"
	Role                string     `gorm:"size:20;not null;default:'user'" json:"-"`     // "user" или "admin"

	EmailVerifiedAt    *time.Time `gorm:"type:timestamp" json:"email_verified_at,omitempty"`
	ProfileCompletedAt *time.Time `gorm:"type:timestamp" json:"profile_completed_at,omitempty"`
	DeletedAt          *time.Time `gorm:"type:timestamp" json:"deleted_at,omitempty"`
	DeletionReason     string     `gorm:"size:100;default:''" json:"deletion_reason,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// IsProfileComplete возвращает true если профиль пользователя заполнен (не legacy)
func (u *User) IsProfileComplete() bool {
	if u.ProfileCompletedAt != nil {
		return true
	}

	return strings.TrimSpace(u.FirstName) != "" &&
		strings.TrimSpace(u.LastName) != "" &&
		u.BirthDate != nil &&
		strings.TrimSpace(u.Gender) != ""
}

// TableName определяет имя таблицы для GORM
func (User) TableName() string {
	return "users"
}

// BeforeSave хеширует пароль перед сохранением, только если он не является bcrypt-хешем
func (u *User) BeforeSave(tx *gorm.DB) error {
	// Хешируем пароль только если он:
	// 1. Не пустой
	// 2. Не является уже bcrypt-хешем (начинается с "$2a$", "$2b$" или "$2y$")
	if len(u.Password) > 0 && !strings.HasPrefix(u.Password, "$2a$") &&
		!strings.HasPrefix(u.Password, "$2b$") && !strings.HasPrefix(u.Password, "$2y$") {
		// Используем стандартное значение cost factor для bcrypt
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(u.Password), bcrypt.DefaultCost)
		if err != nil {
			log.Printf("[User.BeforeSave] Ошибка при хешировании пароля для email=%s: %v", u.Email, err)
			return err
		}
		u.Password = string(hashedPassword)
	}
	return nil
}

// CheckPassword проверяет, соответствует ли переданный пароль хешу
func (u *User) CheckPassword(password string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(password))
	return err == nil
}
