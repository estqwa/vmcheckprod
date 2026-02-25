package postgres

import (
	"errors"
	"fmt"

	"github.com/yourusername/trivia-api/internal/domain/entity"
	apperrors "github.com/yourusername/trivia-api/internal/pkg/errors"
	"gorm.io/gorm"
)

// UserLegalAcceptanceRepo реализует UserLegalAcceptanceRepository
type UserLegalAcceptanceRepo struct {
	db *gorm.DB
}

// NewUserLegalAcceptanceRepo создает новый экземпляр
func NewUserLegalAcceptanceRepo(db *gorm.DB) *UserLegalAcceptanceRepo {
	return &UserLegalAcceptanceRepo{db: db}
}

// Create сохраняет новое юридическое согласие
func (r *UserLegalAcceptanceRepo) Create(acceptance *entity.UserLegalAcceptance) error {
	if err := r.db.Create(acceptance).Error; err != nil {
		return fmt.Errorf("failed to create legal acceptance: %w", err)
	}
	return nil
}

// GetLatestByUserID возвращает последнее согласие пользователя
func (r *UserLegalAcceptanceRepo) GetLatestByUserID(userID uint) (*entity.UserLegalAcceptance, error) {
	var acceptance entity.UserLegalAcceptance
	err := r.db.Where("user_id = ?", userID).Order("accepted_at DESC").First(&acceptance).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.ErrNotFound
		}
		return nil, fmt.Errorf("failed to get latest legal acceptance: %w", err)
	}
	return &acceptance, nil
}

// GetAllByUserID возвращает все согласия пользователя
func (r *UserLegalAcceptanceRepo) GetAllByUserID(userID uint) ([]*entity.UserLegalAcceptance, error) {
	var acceptances []*entity.UserLegalAcceptance
	err := r.db.Where("user_id = ?", userID).Order("accepted_at DESC").Find(&acceptances).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get legal acceptances: %w", err)
	}
	return acceptances, nil
}

func (r *UserLegalAcceptanceRepo) DeleteByUserID(userID uint) error {
	if err := r.db.Where("user_id = ?", userID).Delete(&entity.UserLegalAcceptance{}).Error; err != nil {
		return fmt.Errorf("failed to delete legal acceptances: %w", err)
	}
	return nil
}
