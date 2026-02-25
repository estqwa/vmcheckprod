package repository

import (
	"github.com/yourusername/trivia-api/internal/domain/entity"
)

// RefreshTokenRepository интерфейс для работы с refresh-токенами
type RefreshTokenRepository interface {
	// CreateToken создает новый refresh-токен и возвращает его ID
	CreateToken(refreshToken *entity.RefreshToken) (uint, error)

	// GetTokenByHash находит refresh-токен по SHA-256 hash значению
	GetTokenByHash(tokenHash string) (*entity.RefreshToken, error)

	// GetTokenByID находит refresh-токен по его ID
	GetTokenByID(id uint) (*entity.RefreshToken, error)

	// CheckTokenByHash проверяет действительность refresh-токена по hash
	CheckTokenByHash(tokenHash string) (bool, error)

	// MarkTokenAsExpiredByHash помечает токен как истекший по hash
	MarkTokenAsExpiredByHash(tokenHash string) error

	// MarkTokenAsExpiredByID помечает токен как истекший по его ID
	MarkTokenAsExpiredByID(id uint) error

	// DeleteTokenByHash физически удаляет токен по hash (используется в критических ситуациях)
	DeleteTokenByHash(tokenHash string) error

	// MarkAllAsExpiredForUser помечает все токены пользователя как истекшие
	MarkAllAsExpiredForUser(userID uint) error

	// CleanupExpiredTokens удаляет все просроченные и истекшие токены
	CleanupExpiredTokens() (int64, error)

	// GetActiveTokensForUser получает все активные токены пользователя
	GetActiveTokensForUser(userID uint) ([]*entity.RefreshToken, error)

	// CountTokensForUser подсчитывает количество активных токенов пользователя
	CountTokensForUser(userID uint) (int, error)

	// MarkOldestAsExpiredForUser помечает самые старые токены пользователя как истекшие, оставляя только limit токенов
	MarkOldestAsExpiredForUser(userID uint, limit int) error
}
