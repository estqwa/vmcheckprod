package postgres

import (
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/lib/pq"
	"github.com/yourusername/trivia-api/internal/domain/entity"
	"github.com/yourusername/trivia-api/internal/domain/repository"
	apperrors "github.com/yourusername/trivia-api/internal/pkg/errors"
)

// QuizRepo реализует repository.QuizRepository
type QuizRepo struct {
	db *gorm.DB
}

// NewQuizRepo создает новый репозиторий викторин
func NewQuizRepo(db *gorm.DB) *QuizRepo {
	return &QuizRepo{db: db}
}

// Create создает новую викторину
func (r *QuizRepo) Create(quiz *entity.Quiz) error {
	return r.db.Create(quiz).Error
}

// GetByID возвращает викторину по ID
func (r *QuizRepo) GetByID(id uint) (*entity.Quiz, error) {
	var quiz entity.Quiz
	err := r.db.First(&quiz, id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.ErrNotFound
		}
		return nil, err
	}
	return &quiz, nil
}

// GetActive возвращает активную викторину
func (r *QuizRepo) GetActive() (*entity.Quiz, error) {
	var quiz entity.Quiz
	err := r.db.Where("status = ?", entity.QuizStatusInProgress).First(&quiz).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.ErrNotFound
		}
		return nil, err
	}
	return &quiz, nil
}

// GetScheduled возвращает все запланированные викторины
func (r *QuizRepo) GetScheduled() ([]entity.Quiz, error) {
	var quizzes []entity.Quiz
	err := r.db.Where("status = ? AND scheduled_time > ?", entity.QuizStatusScheduled, time.Now()).
		Order("scheduled_time").
		Find(&quizzes).Error
	if err != nil {
		return nil, err
	}
	return quizzes, nil
}

// GetWithQuestions возвращает викторину вместе с вопросами
func (r *QuizRepo) GetWithQuestions(id uint) (*entity.Quiz, error) {
	var quiz entity.Quiz
	err := r.db.Preload("Questions").First(&quiz, id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.ErrNotFound
		}
		return nil, err
	}
	return &quiz, nil
}

// UpdateStatus обновляет статус викторины
func (r *QuizRepo) UpdateStatus(quizID uint, status string) error {
	return r.db.Model(&entity.Quiz{}).
		Where("id = ?", quizID).
		Update("status", status).
		Error
}

// UpdateQuestionCount точечно обновляет количество вопросов викторины
func (r *QuizRepo) UpdateQuestionCount(quizID uint, questionCount int) error {
	return r.db.Model(&entity.Quiz{}).
		Where("id = ?", quizID).
		Update("question_count", questionCount).
		Error
}

// IncrementQuestionCount атомарно увеличивает question_count на delta через gorm.Expr
func (r *QuizRepo) IncrementQuestionCount(quizID uint, delta int) error {
	return r.db.Model(&entity.Quiz{}).
		Where("id = ?", quizID).
		Update("question_count", gorm.Expr("question_count + ?", delta)).
		Error
}

// UpdateScheduleInfo точечно обновляет scheduled_time, status и (опционально) finish_on_zero_players без полного Save
func (r *QuizRepo) UpdateScheduleInfo(quizID uint, scheduledTime time.Time, status string, finishOnZeroPlayers *bool) error {
	updates := map[string]interface{}{
		"scheduled_time": scheduledTime,
		"status":         status,
	}
	if finishOnZeroPlayers != nil {
		updates["finish_on_zero_players"] = *finishOnZeroPlayers
	}

	return r.db.Model(&entity.Quiz{}).
		Where("id = ?", quizID).
		Updates(updates).Error
}

// AtomicStartQuiz атомарно переводит scheduled → in_progress.
// Partial unique index idx_quiz_single_in_progress гарантирует max 1 in_progress.
// - 23505 (unique violation) → "другая викторина уже in_progress"
// - RowsAffected == 0 → "викторина не scheduled"
// - Другая DB ошибка → возвращается как есть
func (r *QuizRepo) AtomicStartQuiz(quizID uint) error {
	result := r.db.Model(&entity.Quiz{}).
		Where("id = ? AND status = ?", quizID, entity.QuizStatusScheduled).
		Update("status", entity.QuizStatusInProgress)

	if result.Error != nil {
		// Проверяем unique violation (23505) от обоих драйверов
		if isUniqueViolation(result.Error) {
			return fmt.Errorf("%w: quiz #%d", repository.ErrAnotherQuizInProgress, quizID)
		}
		return fmt.Errorf("start quiz #%d failed: %w", quizID, result.Error)
	}

	if result.RowsAffected == 0 {
		return fmt.Errorf("%w: quiz #%d", repository.ErrQuizNotScheduled, quizID)
	}

	return nil
}

// isUniqueViolation проверяет Postgres unique violation (23505) для pgconn и lib/pq драйверов
func isUniqueViolation(err error) bool {
	// pgx/v5 driver (pgconn.PgError)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return true
	}
	// lib/pq driver
	var pqErr *pq.Error
	if errors.As(err, &pqErr) && pqErr.Code == "23505" {
		return true
	}
	return false
}

// Update обновляет информацию о викторине
func (r *QuizRepo) Update(quiz *entity.Quiz) error {
	return r.db.Save(quiz).Error
}

// List возвращает список викторин с пагинацией
func (r *QuizRepo) List(limit, offset int) ([]entity.Quiz, error) {
	var quizzes []entity.Quiz
	err := r.db.Limit(limit).Offset(offset).Order("id DESC").Find(&quizzes).Error
	return quizzes, err
}

// ListWithFilters возвращает список викторин с фильтрами и total count
func (r *QuizRepo) ListWithFilters(filters repository.QuizFilters, limit, offset int) ([]entity.Quiz, int64, error) {
	var quizzes []entity.Quiz
	var total int64

	// Строим базовый запрос
	query := r.db.Model(&entity.Quiz{})

	// Применяем фильтры
	if filters.Status != "" {
		query = query.Where("status = ?", filters.Status)
	}

	if filters.Search != "" {
		search := "%" + filters.Search + "%"
		query = query.Where("title ILIKE ? OR description ILIKE ?", search, search)
	}

	if filters.DateFrom != nil {
		query = query.Where("scheduled_time >= ?", *filters.DateFrom)
	}

	if filters.DateTo != nil {
		query = query.Where("scheduled_time <= ?", *filters.DateTo)
	}

	// Получаем total count
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// Preserve legacy ordering for "no filters" mode (id DESC).
	// With active filters keep business-oriented ordering by scheduled_time DESC.
	orderBy := "id DESC"
	if filters.Status != "" || filters.Search != "" || filters.DateFrom != nil || filters.DateTo != nil {
		orderBy = "scheduled_time DESC"
	}

	// Применяем пагинацию и сортировку
	err := query.Limit(limit).Offset(offset).Order(orderBy).Find(&quizzes).Error
	if err != nil {
		return nil, 0, err
	}

	return quizzes, total, nil
}

// Delete удаляет викторину
func (r *QuizRepo) Delete(id uint) error {
	return r.db.Delete(&entity.Quiz{}, id).Error
}
