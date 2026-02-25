package postgres

import (
	"errors"
	"fmt"

	"github.com/yourusername/trivia-api/internal/domain/entity"
	apperrors "github.com/yourusername/trivia-api/internal/pkg/errors"
	"gorm.io/gorm"
)

type UserIdentityRepo struct {
	db *gorm.DB
}

func NewUserIdentityRepo(db *gorm.DB) *UserIdentityRepo {
	return &UserIdentityRepo{db: db}
}

func (r *UserIdentityRepo) Create(identity *entity.UserIdentity) error {
	return r.db.Create(identity).Error
}

func (r *UserIdentityRepo) GetByProviderSub(provider, providerSub string) (*entity.UserIdentity, error) {
	var identity entity.UserIdentity
	err := r.db.
		Where("provider = ? AND provider_sub = ?", provider, providerSub).
		First(&identity).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.ErrNotFound
		}
		return nil, fmt.Errorf("failed to get identity by provider_sub: %w", err)
	}
	return &identity, nil
}

func (r *UserIdentityRepo) GetByUserAndProvider(userID uint, provider string) (*entity.UserIdentity, error) {
	var identity entity.UserIdentity
	err := r.db.
		Where("user_id = ? AND provider = ?", userID, provider).
		First(&identity).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.ErrNotFound
		}
		return nil, fmt.Errorf("failed to get identity by user/provider: %w", err)
	}
	return &identity, nil
}

func (r *UserIdentityRepo) DeleteByUserID(userID uint) error {
	return r.db.Where("user_id = ?", userID).Delete(&entity.UserIdentity{}).Error
}
