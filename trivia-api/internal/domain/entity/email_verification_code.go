package entity

import "time"

// EmailVerificationCode stores hashed verification codes for email confirmation.
type EmailVerificationCode struct {
	ID           uint       `gorm:"primaryKey" json:"id"`
	UserID       uint       `gorm:"not null;index" json:"user_id"`
	Email        string     `gorm:"size:100;not null" json:"email"`
	CodeHash     string     `gorm:"size:64;not null" json:"-"`
	CodeSalt     string     `gorm:"size:64;not null" json:"-"`
	ExpiresAt    time.Time  `gorm:"not null;index" json:"expires_at"`
	AttemptCount int        `gorm:"not null;default:0" json:"attempt_count"`
	MaxAttempts  int        `gorm:"not null;default:5" json:"max_attempts"`
	LastSentAt   time.Time  `gorm:"not null;default:CURRENT_TIMESTAMP" json:"last_sent_at"`
	ConsumedAt   *time.Time `gorm:"index" json:"consumed_at,omitempty"`
	CreatedAt    time.Time  `gorm:"not null;default:CURRENT_TIMESTAMP" json:"created_at"`
}

func (EmailVerificationCode) TableName() string {
	return "email_verification_codes"
}

func (e *EmailVerificationCode) IsConsumed() bool {
	return e.ConsumedAt != nil
}

func (e *EmailVerificationCode) IsExpired(now time.Time) bool {
	return now.After(e.ExpiresAt)
}
