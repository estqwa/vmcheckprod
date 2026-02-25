package repository

import "github.com/yourusername/trivia-api/internal/domain/entity"

// UserLegalAcceptanceRepository интерфейс для работы с согласиями пользователей
type UserLegalAcceptanceRepository interface {
	// Create сохраняет новое согласие пользователя
	Create(acceptance *entity.UserLegalAcceptance) error

	// GetLatestByUserID возвращает последнее согласие пользователя
	GetLatestByUserID(userID uint) (*entity.UserLegalAcceptance, error)

	// GetAllByUserID возвращает все согласия пользователя (история)
	GetAllByUserID(userID uint) ([]*entity.UserLegalAcceptance, error)

	// DeleteByUserID removes legal acceptance records for anonymization flows.
	DeleteByUserID(userID uint) error
}
