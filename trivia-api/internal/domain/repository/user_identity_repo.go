package repository

import "github.com/yourusername/trivia-api/internal/domain/entity"

// UserIdentityRepository stores external provider links for users.
type UserIdentityRepository interface {
	Create(identity *entity.UserIdentity) error
	GetByProviderSub(provider, providerSub string) (*entity.UserIdentity, error)
	GetByUserAndProvider(userID uint, provider string) (*entity.UserIdentity, error)
	DeleteByUserID(userID uint) error
}
