package postgres

import (
	"github.com/yourusername/trivia-api/internal/domain/entity"
	"gorm.io/gorm"
)

// QuizAdSlotRepository реализует repository.QuizAdSlotRepository
type QuizAdSlotRepository struct {
	db *gorm.DB
}

// NewQuizAdSlotRepository создаёт новый репозиторий рекламных слотов
func NewQuizAdSlotRepository(db *gorm.DB) *QuizAdSlotRepository {
	return &QuizAdSlotRepository{db: db}
}

// Create создаёт новый рекламный слот
func (r *QuizAdSlotRepository) Create(slot *entity.QuizAdSlot) error {
	return r.db.Create(slot).Error
}

// GetByID возвращает слот по ID с загруженным AdAsset
func (r *QuizAdSlotRepository) GetByID(id uint) (*entity.QuizAdSlot, error) {
	var slot entity.QuizAdSlot
	if err := r.db.Preload("AdAsset").First(&slot, id).Error; err != nil {
		return nil, err
	}
	return &slot, nil
}

// ListByQuizID возвращает все слоты для викторины с загруженными AdAsset
func (r *QuizAdSlotRepository) ListByQuizID(quizID uint) ([]entity.QuizAdSlot, error) {
	var slots []entity.QuizAdSlot
	err := r.db.Preload("AdAsset").
		Where("quiz_id = ?", quizID).
		Order("question_after ASC").
		Find(&slots).Error
	if err != nil {
		return nil, err
	}
	return slots, nil
}

// GetByQuizAndQuestionAfter возвращает активный слот для конкретного вопроса викторины
func (r *QuizAdSlotRepository) GetByQuizAndQuestionAfter(quizID uint, questionAfter int) (*entity.QuizAdSlot, error) {
	var slot entity.QuizAdSlot
	err := r.db.Preload("AdAsset").
		Where("quiz_id = ? AND question_after = ? AND is_active = true", quizID, questionAfter).
		First(&slot).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil // Нет слота для этого вопроса — это нормально
		}
		return nil, err
	}
	return &slot, nil
}

// Update обновляет слот
func (r *QuizAdSlotRepository) Update(slot *entity.QuizAdSlot) error {
	return r.db.Save(slot).Error
}

// Delete удаляет слот по ID
func (r *QuizAdSlotRepository) Delete(id uint) error {
	return r.db.Delete(&entity.QuizAdSlot{}, id).Error
}

// DeleteByQuizID удаляет все слоты викторины
func (r *QuizAdSlotRepository) DeleteByQuizID(quizID uint) error {
	return r.db.Where("quiz_id = ?", quizID).Delete(&entity.QuizAdSlot{}).Error
}
