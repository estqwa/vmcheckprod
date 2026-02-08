package postgres

import (
	"errors"

	"gorm.io/gorm"

	"github.com/yourusername/trivia-api/internal/domain/entity"
	apperrors "github.com/yourusername/trivia-api/internal/pkg/errors"
)

// QuestionRepo реализует repository.QuestionRepository
type QuestionRepo struct {
	db *gorm.DB
}

// NewQuestionRepo создает новый репозиторий вопросов
func NewQuestionRepo(db *gorm.DB) *QuestionRepo {
	return &QuestionRepo{db: db}
}

// Create создает новый вопрос
func (r *QuestionRepo) Create(question *entity.Question) error {
	return r.db.Create(question).Error
}

// CreateBatch создает пакет вопросов
func (r *QuestionRepo) CreateBatch(questions []entity.Question) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		// Устанавливаем кодировку UTF-8 внутри транзакции
		if err := tx.Exec("SET CLIENT_ENCODING TO 'UTF8'").Error; err != nil {
			return err
		}
		return tx.Create(&questions).Error
	})
}

// GetByID возвращает вопрос по ID
func (r *QuestionRepo) GetByID(id uint) (*entity.Question, error) {
	var question entity.Question
	err := r.db.First(&question, id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.ErrNotFound
		}
		return nil, err
	}
	return &question, nil
}

// GetByQuizID возвращает все вопросы для викторины
func (r *QuestionRepo) GetByQuizID(quizID uint) ([]entity.Question, error) {
	var questions []entity.Question
	err := r.db.Where("quiz_id = ?", quizID).Order("id").Find(&questions).Error
	if err != nil {
		return nil, err
	}
	return questions, nil
}

// GetRandomQuestions возвращает случайные вопросы из базы данных
// Оптимизировано для производительности при больших объёмах данных
func (r *QuestionRepo) GetRandomQuestions(limit int) ([]entity.Question, error) {
	var questions []entity.Question

	// Используем TABLESAMPLE для O(1) производительности вместо ORDER BY RANDOM()
	// SYSTEM выбирает случайные страницы данных, что намного быстрее при большом количестве записей
	// Берём больше записей, чем нужно (limit*3), затем перемешиваем и обрезаем,
	// т.к. TABLESAMPLE может вернуть меньше записей, чем ожидается
	sql := `
		SELECT * FROM questions 
		TABLESAMPLE SYSTEM_ROWS(?)
		ORDER BY RANDOM()
		LIMIT ?
	`

	// Запрашиваем с запасом, чтобы гарантировать достаточное количество
	sampleSize := limit * 3
	if sampleSize < 100 {
		sampleSize = 100 // Минимальный размер выборки
	}

	err := r.db.Raw(sql, sampleSize, limit).Scan(&questions).Error
	if err != nil {
		// Fallback на старый метод, если TABLESAMPLE не поддерживается или пустой результат
		err = r.db.Order("RANDOM()").Limit(limit).Find(&questions).Error
		if err != nil {
			return nil, err
		}
	}

	// Если TABLESAMPLE вернул пустой результат (маленькая таблица), используем fallback
	if len(questions) == 0 {
		err = r.db.Order("RANDOM()").Limit(limit).Find(&questions).Error
		if err != nil {
			return nil, err
		}
	}

	return questions, nil
}

// Update обновляет информацию о вопросе
func (r *QuestionRepo) Update(question *entity.Question) error {
	return r.db.Save(question).Error
}

// Delete удаляет вопрос
func (r *QuestionRepo) Delete(id uint) error {
	return r.db.Delete(&entity.Question{}, id).Error
}

// GetRandomByDifficulty возвращает случайные неиспользованные вопросы заданной сложности
func (r *QuestionRepo) GetRandomByDifficulty(difficulty int, limit int, excludeIDs []uint) ([]entity.Question, error) {
	var questions []entity.Question

	query := r.db.Where("difficulty = ? AND is_used = ?", difficulty, false)

	// Исключаем уже использованные в текущей викторине вопросы
	if len(excludeIDs) > 0 {
		query = query.Where("id NOT IN ?", excludeIDs)
	}

	err := query.Order("RANDOM()").Limit(limit).Find(&questions).Error
	return questions, err
}

// MarkAsUsed помечает вопросы как использованные (исключаются из будущего автовыбора)
func (r *QuestionRepo) MarkAsUsed(questionIDs []uint) error {
	if len(questionIDs) == 0 {
		return nil
	}
	return r.db.Model(&entity.Question{}).
		Where("id IN ?", questionIDs).
		Update("is_used", true).Error
}

// CountByDifficulty возвращает количество неиспользованных вопросов заданной сложности
func (r *QuestionRepo) CountByDifficulty(difficulty int) (int64, error) {
	var count int64
	err := r.db.Model(&entity.Question{}).
		Where("difficulty = ? AND is_used = ?", difficulty, false).
		Count(&count).Error
	return count, err
}

// GetQuizQuestionByDifficulty ищет неиспользованный вопрос викторины по сложности
// Используется для гибридной адаптивной системы (приоритет вопросов викторины)
func (r *QuestionRepo) GetQuizQuestionByDifficulty(quizID uint, difficulty int, excludeIDs []uint) (*entity.Question, error) {
	var question entity.Question
	query := r.db.Where("quiz_id = ? AND difficulty = ? AND is_used = ?", quizID, difficulty, false)
	if len(excludeIDs) > 0 {
		query = query.Where("id NOT IN ?", excludeIDs)
	}
	err := query.Order("RANDOM()").First(&question).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &question, nil
}

// GetPoolQuestionByDifficulty ищет вопрос в общем пуле (quiz_id IS NULL) по сложности
// Используется адаптивной системой когда у викторины нет своих вопросов нужной сложности
func (r *QuestionRepo) GetPoolQuestionByDifficulty(difficulty int, excludeIDs []uint) (*entity.Question, error) {
	var question entity.Question
	query := r.db.Where("quiz_id IS NULL AND difficulty = ? AND is_used = ?", difficulty, false)
	if len(excludeIDs) > 0 {
		query = query.Where("id NOT IN ?", excludeIDs)
	}
	err := query.Order("RANDOM()").First(&question).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &question, nil
}

// GetPoolStats возвращает статистику общего пула вопросов
func (r *QuestionRepo) GetPoolStats() (total int64, available int64, byDifficulty map[int]int64, err error) {
	byDifficulty = make(map[int]int64)

	// Всего вопросов в пуле
	if err = r.db.Model(&entity.Question{}).Where("quiz_id IS NULL").Count(&total).Error; err != nil {
		return 0, 0, nil, err
	}

	// Доступных (не использованных)
	if err = r.db.Model(&entity.Question{}).Where("quiz_id IS NULL AND is_used = ?", false).Count(&available).Error; err != nil {
		return 0, 0, nil, err
	}

	// По сложности (только доступные)
	for d := 1; d <= 5; d++ {
		var count int64
		if err = r.db.Model(&entity.Question{}).
			Where("quiz_id IS NULL AND is_used = ? AND difficulty = ?", false, d).
			Count(&count).Error; err != nil {
			return 0, 0, nil, err
		}
		byDifficulty[d] = count
	}

	return total, available, byDifficulty, nil
}

// ResetPoolUsed сбрасывает is_used = false для всех вопросов пула
// Позволяет переиспользовать вопросы после "истощения" пула
func (r *QuestionRepo) ResetPoolUsed() (int64, error) {
	result := r.db.Model(&entity.Question{}).
		Where("quiz_id IS NULL AND is_used = ?", true).
		Update("is_used", false)
	return result.RowsAffected, result.Error
}
