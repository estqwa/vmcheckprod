package repository

import "github.com/yourusername/trivia-api/internal/domain/entity"

// EmailVerificationRepository persists verification code attempts.
type EmailVerificationRepository interface {
	Create(code *entity.EmailVerificationCode) error
	GetLatestActiveByUserID(userID uint) (*entity.EmailVerificationCode, error)
	IncrementAttempts(id uint) error
	MarkConsumed(id uint) error
	DeleteByUserID(userID uint) error
}
