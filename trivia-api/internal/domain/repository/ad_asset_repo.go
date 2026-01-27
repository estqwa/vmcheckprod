package repository

import "github.com/yourusername/trivia-api/internal/domain/entity"

// AdAssetRepository определяет методы для работы с рекламными медиа-файлами
type AdAssetRepository interface {
	// Create создаёт новый рекламный ресурс
	Create(asset *entity.AdAsset) error

	// GetByID возвращает рекламный ресурс по ID
	GetByID(id uint) (*entity.AdAsset, error)

	// List возвращает все рекламные ресурсы
	List() ([]entity.AdAsset, error)

	// Update обновляет рекламный ресурс
	Update(asset *entity.AdAsset) error

	// Delete удаляет рекламный ресурс по ID
	Delete(id uint) error

	// IsUsedInSlots проверяет, используется ли ресурс в слотах
	IsUsedInSlots(id uint) (bool, error)
}
