package repository

import "github.com/yourusername/trivia-api/internal/domain/entity"

// QuizAdSlotRepository определяет методы для работы с рекламными слотами викторин
type QuizAdSlotRepository interface {
	// Create создаёт новый рекламный слот
	Create(slot *entity.QuizAdSlot) error

	// GetByID возвращает слот по ID
	GetByID(id uint) (*entity.QuizAdSlot, error)

	// ListByQuizID возвращает все слоты для викторины с загруженными AdAsset
	ListByQuizID(quizID uint) ([]entity.QuizAdSlot, error)

	// GetByQuizAndQuestionAfter возвращает слот для конкретного вопроса викторины
	GetByQuizAndQuestionAfter(quizID uint, questionAfter int) (*entity.QuizAdSlot, error)

	// Update обновляет слот
	Update(slot *entity.QuizAdSlot) error

	// Delete удаляет слот по ID
	Delete(id uint) error

	// DeleteByQuizID удаляет все слоты викторины
	DeleteByQuizID(quizID uint) error
}
