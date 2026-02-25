package postgres

import (
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/yourusername/trivia-api/internal/domain/entity"
	apperrors "github.com/yourusername/trivia-api/internal/pkg/errors"
	"gorm.io/gorm"
)

// RefreshTokenRepo реализует интерфейс RefreshTokenRepository с использованием PostgreSQL и GORM
type RefreshTokenRepo struct {
	db *gorm.DB
}

// NewRefreshTokenRepo создает новый экземпляр RefreshTokenRepo и возвращает ошибку при проблемах
func NewRefreshTokenRepo(gormDB *gorm.DB) (*RefreshTokenRepo, error) {
	if gormDB == nil {
		return nil, fmt.Errorf("GORM DB instance is required for RefreshTokenRepo")
	}
	return &RefreshTokenRepo{db: gormDB}, nil
}

// CreateToken сохраняет новый refresh токен в базе данных и возвращает его ID
func (r *RefreshTokenRepo) CreateToken(token *entity.RefreshToken) (uint, error) {
	result := r.db.Create(token)
	if result.Error != nil {
		return 0, fmt.Errorf("ошибка создания refresh токена: %w", result.Error)
	}
	if token.ID == 0 {
		return 0, fmt.Errorf("не удалось получить ID после создания refresh токена")
	}
	return token.ID, nil
}

// GetTokenByHash находит refresh токен по SHA-256 hash значению
func (r *RefreshTokenRepo) GetTokenByHash(tokenHash string) (*entity.RefreshToken, error) {
	var token entity.RefreshToken
	result := r.db.Where("token_hash = ?", tokenHash).First(&token)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, apperrors.ErrNotFound
		}
		return nil, fmt.Errorf("ошибка получения refresh токена по hash: %w", result.Error)
	}

	if token.ExpiresAt.Before(time.Now()) {
		return nil, apperrors.ErrExpiredToken
	}

	return &token, nil
}

// GetTokenByID находит refresh токен по его ID
func (r *RefreshTokenRepo) GetTokenByID(tokenID uint) (*entity.RefreshToken, error) {
	var token entity.RefreshToken
	result := r.db.First(&token, tokenID)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, apperrors.ErrNotFound
		}
		return nil, fmt.Errorf("ошибка получения refresh токена по ID: %w", result.Error)
	}
	return &token, nil
}

// GetActiveTokensForUser возвращает все активные (не истекшие) refresh-токены для пользователя
func (r *RefreshTokenRepo) GetActiveTokensForUser(userID uint) ([]*entity.RefreshToken, error) {
	var tokens []*entity.RefreshToken
	result := r.db.Where("user_id = ? AND expires_at > ?", userID, time.Now()).
		Order("created_at DESC").
		Find(&tokens)

	if result.Error != nil {
		return nil, fmt.Errorf("ошибка получения активных токенов пользователя: %w", result.Error)
	}
	return tokens, nil
}

// CheckTokenByHash проверяет существование и срок действия refresh-токена по hash
func (r *RefreshTokenRepo) CheckTokenByHash(tokenHash string) (bool, error) {
	var count int64
	result := r.db.Model(&entity.RefreshToken{}).
		Where("token_hash = ? AND expires_at > ?", tokenHash, time.Now()).
		Count(&count)

	if result.Error != nil {
		return false, fmt.Errorf("ошибка проверки refresh токена: %w", result.Error)
	}
	return count > 0, nil
}

// MarkTokenAsExpiredByHash помечает токен как истекший по hash
func (r *RefreshTokenRepo) MarkTokenAsExpiredByHash(tokenHash string) error {
	result := r.db.Model(&entity.RefreshToken{}).
		Where("token_hash = ?", tokenHash).
		Updates(map[string]interface{}{
			"expires_at": time.Now().Add(-1 * time.Hour),
		})

	if result.Error != nil {
		return fmt.Errorf("ошибка маркировки refresh токена как истекшего: %w", result.Error)
	}

	if result.RowsAffected == 0 {
		return apperrors.ErrNotFound
	}

	return nil
}

// MarkTokenAsExpiredByID помечает токен как истекший по его ID
func (r *RefreshTokenRepo) MarkTokenAsExpiredByID(id uint) error {
	result := r.db.Model(&entity.RefreshToken{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{
			"expires_at": time.Now().Add(-1 * time.Hour),
		})

	if result.Error != nil {
		return fmt.Errorf("ошибка маркировки refresh токена ID=%d как истекшего: %w", id, result.Error)
	}

	if result.RowsAffected == 0 {
		return apperrors.ErrNotFound
	}

	log.Printf("[RefreshTokenRepo] Токен ID=%d помечен как истекший", id)
	return nil
}

// MarkAllAsExpiredForUser помечает все токены пользователя как истекшие
func (r *RefreshTokenRepo) MarkAllAsExpiredForUser(userID uint) error {
	result := r.db.Model(&entity.RefreshToken{}).
		Where("user_id = ? AND expires_at > ?", userID, time.Now()).
		Updates(map[string]interface{}{
			"expires_at": time.Now().Add(-1 * time.Hour),
		})

	if result.Error != nil {
		return fmt.Errorf("ошибка маркировки всех токенов пользователя %d как истекших: %w", userID, result.Error)
	}
	return nil
}

// CleanupExpiredTokens удаляет истекшие токены из базы данных
func (r *RefreshTokenRepo) CleanupExpiredTokens() (int64, error) {
	result := r.db.Where("expires_at <= ?", time.Now()).Delete(&entity.RefreshToken{})
	if result.Error != nil {
		return 0, fmt.Errorf("ошибка очистки истекших refresh токенов: %w", result.Error)
	}
	return result.RowsAffected, nil
}

// CountTokensForUser возвращает количество активных токенов для пользователя
func (r *RefreshTokenRepo) CountTokensForUser(userID uint) (int, error) {
	var count int64
	result := r.db.Model(&entity.RefreshToken{}).
		Where("user_id = ? AND expires_at > ?", userID, time.Now()).
		Count(&count)
	if result.Error != nil {
		return 0, fmt.Errorf("ошибка подсчета токенов пользователя %d: %w", userID, result.Error)
	}
	return int(count), nil
}

// MarkOldestAsExpiredForUser помечает самые старые активные токены пользователя как истекшие,
// оставляя указанное количество (`keepCount`).
func (r *RefreshTokenRepo) MarkOldestAsExpiredForUser(userID uint, keepCount int) error {
	var tokensToMarkIDs []uint
	result := r.db.Model(&entity.RefreshToken{}).
		Select("id").
		Where("user_id = ? AND expires_at > ?", userID, time.Now()).
		Order("created_at DESC").
		Offset(keepCount).
		Find(&tokensToMarkIDs)

	if result.Error != nil {
		return fmt.Errorf("ошибка получения ID старых токенов пользователя %d: %w", userID, result.Error)
	}

	if len(tokensToMarkIDs) == 0 {
		return nil
	}

	updateResult := r.db.Model(&entity.RefreshToken{}).
		Where("id IN ?", tokensToMarkIDs).
		Updates(map[string]interface{}{
			"expires_at": time.Now().Add(-1 * time.Hour),
		})

	if updateResult.Error != nil {
		return fmt.Errorf("ошибка маркировки старых токенов пользователя %d как истекших: %w", userID, updateResult.Error)
	}

	log.Printf("[RefreshTokenRepo] Помечено %d старых токенов как истекшие для пользователя %d", len(tokensToMarkIDs), userID)
	return nil
}

// DeleteTokenByHash физически удаляет refresh токен по hash
func (r *RefreshTokenRepo) DeleteTokenByHash(tokenHash string) error {
	result := r.db.Where("token_hash = ?", tokenHash).Delete(&entity.RefreshToken{})
	if result.Error != nil {
		return fmt.Errorf("ошибка удаления refresh токена: %w", result.Error)
	}

	if result.RowsAffected == 0 {
		log.Printf("[RefreshTokenRepo] Токен не найден для удаления")
		return nil
	}

	log.Printf("[RefreshTokenRepo] Токен успешно удален")
	return nil
}
