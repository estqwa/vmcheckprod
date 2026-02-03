package repository

import (
	"time"

	"github.com/yourusername/trivia-api/internal/domain/entity"
)

// QuizFilters определяет фильтры для поиска викторин
type QuizFilters struct {
	Status   string     // Фильтр по статусу (scheduled, in_progress, completed, cancelled)
	Search   string     // Поиск по названию/описанию
	DateFrom *time.Time // Фильтр по дате начала
	DateTo   *time.Time // Фильтр по дате окончания
}

// QuizRepository определяет методы для работы с викторинами
type QuizRepository interface {
	Create(quiz *entity.Quiz) error
	GetByID(id uint) (*entity.Quiz, error)
	GetActive() (*entity.Quiz, error)
	GetScheduled() ([]entity.Quiz, error)
	GetWithQuestions(id uint) (*entity.Quiz, error)
	UpdateStatus(quizID uint, status string) error
	Update(quiz *entity.Quiz) error
	List(limit, offset int) ([]entity.Quiz, error)
	ListWithFilters(filters QuizFilters, limit, offset int) ([]entity.Quiz, int64, error) // Возвращает также total count
	Delete(id uint) error
}
