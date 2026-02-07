package repository

import (
	"github.com/yourusername/trivia-api/internal/domain/entity"
)

// QuestionRepository определяет методы для работы с вопросами
type QuestionRepository interface {
	Create(question *entity.Question) error
	CreateBatch(questions []entity.Question) error
	GetByID(id uint) (*entity.Question, error)
	GetByQuizID(quizID uint) ([]entity.Question, error)
	Update(question *entity.Question) error
	Delete(id uint) error
	GetRandomQuestions(limit int) ([]entity.Question, error)

	// Методы для адаптивной системы сложности
	GetRandomByDifficulty(difficulty int, limit int, excludeIDs []uint) ([]entity.Question, error)
	MarkAsUsed(questionIDs []uint) error
	CountByDifficulty(difficulty int) (int64, error)
}
