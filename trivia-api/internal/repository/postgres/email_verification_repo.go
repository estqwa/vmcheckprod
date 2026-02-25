package postgres

import (
	"errors"
	"fmt"
	"time"

	"github.com/yourusername/trivia-api/internal/domain/entity"
	apperrors "github.com/yourusername/trivia-api/internal/pkg/errors"
	"gorm.io/gorm"
)

type EmailVerificationRepo struct {
	db *gorm.DB
}

func NewEmailVerificationRepo(db *gorm.DB) *EmailVerificationRepo {
	return &EmailVerificationRepo{db: db}
}

func (r *EmailVerificationRepo) Create(code *entity.EmailVerificationCode) error {
	return r.db.Create(code).Error
}

func (r *EmailVerificationRepo) GetLatestActiveByUserID(userID uint) (*entity.EmailVerificationCode, error) {
	var code entity.EmailVerificationCode
	err := r.db.
		Where("user_id = ? AND consumed_at IS NULL", userID).
		Order("created_at DESC").
		First(&code).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.ErrNotFound
		}
		return nil, fmt.Errorf("failed to get latest active verification code: %w", err)
	}
	return &code, nil
}

func (r *EmailVerificationRepo) IncrementAttempts(id uint) error {
	return r.db.Model(&entity.EmailVerificationCode{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{
			"attempt_count": gorm.Expr("attempt_count + 1"),
		}).Error
}

func (r *EmailVerificationRepo) MarkConsumed(id uint) error {
	now := time.Now()
	return r.db.Model(&entity.EmailVerificationCode{}).
		Where("id = ?", id).
		Update("consumed_at", now).Error
}

func (r *EmailVerificationRepo) DeleteByUserID(userID uint) error {
	return r.db.Where("user_id = ?", userID).Delete(&entity.EmailVerificationCode{}).Error
}
