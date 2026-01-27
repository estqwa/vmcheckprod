package postgres

import (
	"github.com/yourusername/trivia-api/internal/domain/entity"
	"gorm.io/gorm"
)

// AdAssetRepository реализует repository.AdAssetRepository
type AdAssetRepository struct {
	db *gorm.DB
}

// NewAdAssetRepository создаёт новый репозиторий рекламных ресурсов
func NewAdAssetRepository(db *gorm.DB) *AdAssetRepository {
	return &AdAssetRepository{db: db}
}

// Create создаёт новый рекламный ресурс
func (r *AdAssetRepository) Create(asset *entity.AdAsset) error {
	return r.db.Create(asset).Error
}

// GetByID возвращает рекламный ресурс по ID
func (r *AdAssetRepository) GetByID(id uint) (*entity.AdAsset, error) {
	var asset entity.AdAsset
	if err := r.db.First(&asset, id).Error; err != nil {
		return nil, err
	}
	return &asset, nil
}

// List возвращает все рекламные ресурсы
func (r *AdAssetRepository) List() ([]entity.AdAsset, error) {
	var assets []entity.AdAsset
	if err := r.db.Order("created_at DESC").Find(&assets).Error; err != nil {
		return nil, err
	}
	return assets, nil
}

// Update обновляет рекламный ресурс
func (r *AdAssetRepository) Update(asset *entity.AdAsset) error {
	return r.db.Save(asset).Error
}

// Delete удаляет рекламный ресурс по ID
func (r *AdAssetRepository) Delete(id uint) error {
	return r.db.Delete(&entity.AdAsset{}, id).Error
}

// IsUsedInSlots проверяет, используется ли ресурс в слотах
func (r *AdAssetRepository) IsUsedInSlots(id uint) (bool, error) {
	var count int64
	err := r.db.Model(&entity.QuizAdSlot{}).Where("ad_asset_id = ?", id).Count(&count).Error
	if err != nil {
		return false, err
	}
	return count > 0, nil
}
