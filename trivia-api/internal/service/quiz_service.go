package service

import (
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/yourusername/trivia-api/internal/domain/entity"
	"github.com/yourusername/trivia-api/internal/domain/repository"
	apperrors "github.com/yourusername/trivia-api/internal/pkg/errors"
	"github.com/yourusername/trivia-api/internal/service/quizmanager"
	"gorm.io/gorm"
)

// QuizService предоставляет методы для работы с викторинами
type QuizService struct {
	quizRepo     repository.QuizRepository
	questionRepo repository.QuestionRepository
	cacheRepo    repository.CacheRepository
	config       *quizmanager.Config
	db           *gorm.DB
}

// NewQuizService создает новый сервис викторин
func NewQuizService(
	quizRepo repository.QuizRepository,
	questionRepo repository.QuestionRepository,
	cacheRepo repository.CacheRepository,
	config *quizmanager.Config,
	db *gorm.DB,
) *QuizService {
	return &QuizService{
		quizRepo:     quizRepo,
		questionRepo: questionRepo,
		cacheRepo:    cacheRepo,
		config:       config,
		db:           db,
	}
}

// CreateQuiz создает новую викторину
func (s *QuizService) CreateQuiz(title, description string, scheduledTime time.Time, prizeFund int, finishOnZeroPlayers bool) (*entity.Quiz, error) {
	// Проверяем, что время проведения в будущем
	if scheduledTime.Before(time.Now()) {
		return nil, errors.New("scheduled time must be in the future")
	}

	// Используем дефолт если prizeFund не указан или <= 0
	if prizeFund <= 0 {
		prizeFund = s.config.TotalPrizeFund
	}

	// Создаем новую викторину
	quiz := &entity.Quiz{
		Title:               title,
		Description:         description,
		ScheduledTime:       scheduledTime,
		Status:              entity.QuizStatusScheduled,
		QuestionCount:       0,
		PrizeFund:           prizeFund,
		FinishOnZeroPlayers: finishOnZeroPlayers,
	}

	// Сохраняем викторину в БД
	if err := s.quizRepo.Create(quiz); err != nil {
		return nil, fmt.Errorf("failed to create quiz: %w", err)
	}

	return quiz, nil
}

// GetQuizByID возвращает викторину по ID
func (s *QuizService) GetQuizByID(quizID uint) (*entity.Quiz, error) {
	return s.quizRepo.GetByID(quizID)
}

// GetActiveQuiz возвращает активную викторину
func (s *QuizService) GetActiveQuiz() (*entity.Quiz, error) {
	return s.quizRepo.GetActive()
}

// GetScheduledQuizzes возвращает список запланированных викторин
func (s *QuizService) GetScheduledQuizzes() ([]entity.Quiz, error) {
	return s.quizRepo.GetScheduled()
}

// AddQuestions добавляет вопросы к викторине
func (s *QuizService) AddQuestions(quizID uint, questions []entity.Question) error {
	// Получаем викторину, чтобы убедиться, что она существует
	quiz, err := s.quizRepo.GetByID(quizID)
	if err != nil {
		return err
	}

	// Проверяем, что викторина находится в состоянии "scheduled"
	if !quiz.IsScheduled() {
		return errors.New("can only add questions to a scheduled quiz")
	}

	// Получаем существующие вопросы
	existingQuestions, err := s.questionRepo.GetByQuizID(quizID)
	if err != nil {
		return fmt.Errorf("failed to get existing questions: %w", err)
	}

	// Проверяем, не превышает ли общее количество вопросов максимально допустимое
	maxQuestions := s.config.MaxQuestionsPerQuiz
	totalQuestions := len(existingQuestions) + len(questions)
	if totalQuestions > maxQuestions {
		return fmt.Errorf("максимальное количество вопросов – %d", maxQuestions)
	}

	// Устанавливаем quizID для всех вопросов
	for i := range questions {
		questions[i].QuizID = &quizID
	}

	// Сохраняем вопросы в БД
	if err := s.questionRepo.CreateBatch(questions); err != nil {
		return fmt.Errorf("failed to create questions: %w", err)
	}

	// Обновляем количество вопросов в викторине
	// FIX BUG-4: Атомарное увеличение question_count (без перетирания других полей)
	return s.quizRepo.IncrementQuestionCount(quizID, len(questions))
}

// ScheduleQuiz планирует время проведения викторины
func (s *QuizService) ScheduleQuiz(quizID uint, scheduledTime time.Time, finishOnZeroPlayers *bool) error {
	// Получаем викторину
	quiz, err := s.quizRepo.GetByID(quizID)
	if err != nil {
		return err
	}

	// Проверяем, что время проведения в будущем
	if scheduledTime.Before(time.Now()) {
		return errors.New("scheduled time must be in the future")
	}

	// FIX BUG-5: Запрещаем перепланирование завершённых викторин
	if quiz.IsCompleted() {
		return errors.New("cannot reschedule a completed quiz — create a new quiz instead")
	}

	// Точечное обновление scheduled_time и status (без full Save)
	return s.quizRepo.UpdateScheduleInfo(quizID, scheduledTime, entity.QuizStatusScheduled, finishOnZeroPlayers)
}

// GetQuizWithQuestions возвращает викторину с вопросами
func (s *QuizService) GetQuizWithQuestions(quizID uint) (*entity.Quiz, error) {
	return s.quizRepo.GetWithQuestions(quizID)
}

// ListQuizzes возвращает список викторин с пагинацией
func (s *QuizService) ListQuizzes(page, pageSize int) ([]entity.Quiz, error) {
	offset := (page - 1) * pageSize
	return s.quizRepo.List(pageSize, offset)
}

// ListQuizzesWithFilters возвращает список викторин с фильтрацией и пагинацией
func (s *QuizService) ListQuizzesWithFilters(page, pageSize int, filters repository.QuizFilters) ([]entity.Quiz, int64, error) {
	offset := (page - 1) * pageSize
	return s.quizRepo.ListWithFilters(filters, pageSize, offset)
}

// DeleteQuiz удаляет викторину
func (s *QuizService) DeleteQuiz(quizID uint) error {
	// Получаем викторину, чтобы убедиться, что она существует
	quiz, err := s.quizRepo.GetByID(quizID)
	if err != nil {
		return err
	}

	// Проверяем, что викторина не активна
	if quiz.IsActive() {
		return errors.New("cannot delete an active quiz")
	}

	return s.quizRepo.Delete(quizID)
}

// GetQuestionsByQuizID возвращает все вопросы для викторины
func (s *QuizService) GetQuestionsByQuizID(quizID uint) ([]entity.Question, error) {
	return s.questionRepo.GetByQuizID(quizID)
}

// DuplicateQuiz создает копию существующей викторины с новым временем начала.
// Викторина-дубликат получает статус "scheduled" и копии всех вопросов оригинала.
func (s *QuizService) DuplicateQuiz(originalQuizID uint, newScheduledTime time.Time) (*entity.Quiz, error) {
	log.Printf("[QuizService] Запрос на дублирование викторины ID=%d на время %v", originalQuizID, newScheduledTime)

	// 1. Получить Оригинал с вопросами
	originalQuiz, err := s.quizRepo.GetWithQuestions(originalQuizID)
	if err != nil {
		log.Printf("[QuizService] Ошибка получения оригинала викторины ID=%d для дублирования: %v", originalQuizID, err)
		// Оборачиваем ошибку для корректной обработки в хендлере
		if errors.Is(err, apperrors.ErrNotFound) {
			return nil, fmt.Errorf("оригинальная викторина с ID %d не найдена: %w", originalQuizID, apperrors.ErrNotFound)
		}
		return nil, fmt.Errorf("ошибка получения оригинальной викторины: %w", err)
	}

	// 2. Проверить наличие вопросов
	if len(originalQuiz.Questions) == 0 {
		log.Printf("[QuizService] Попытка дублирования викторины ID=%d без вопросов.", originalQuizID)
		return nil, fmt.Errorf("нельзя дублировать викторину без вопросов: %w", apperrors.ErrValidation)
	}

	// 3. Проверить время
	if newScheduledTime.Before(time.Now()) {
		log.Printf("[QuizService] Ошибка дублирования: новое время %v уже в прошлом.", newScheduledTime)
		return nil, fmt.Errorf("новое запланированное время должно быть в будущем: %w", apperrors.ErrValidation)
	}

	// 4. Создать Новую Сущность Викторины
	// Обрезаем title если он слишком длинный (лимит 100 символов)
	newTitle := truncateDuplicateTitle(originalQuiz.Title, 100)

	newQuiz := &entity.Quiz{
		Title:               newTitle,
		Description:         originalQuiz.Description,
		ScheduledTime:       newScheduledTime,
		Status:              entity.QuizStatusScheduled,
		QuestionCount:       len(originalQuiz.Questions),
		PrizeFund:           originalQuiz.PrizeFund, // Копируем призовой фонд из оригинала
		FinishOnZeroPlayers: originalQuiz.FinishOnZeroPlayers,
	}

	// 5. Начать Транзакцию для атомарного создания викторины и вопросов
	err = s.db.Transaction(func(tx *gorm.DB) error {
		// 5а. Сохранить Новую Викторину
		if err := tx.Create(newQuiz).Error; err != nil {
			log.Printf("[QuizService] Ошибка сохранения новой викторины (дубликат ID=%d) в транзакции: %v", originalQuizID, err)
			return fmt.Errorf("ошибка сохранения дубликата викторины: %w", err)
		}
		log.Printf("[QuizService] Дубликат викторины успешно сохранен с ID=%d в транзакции", newQuiz.ID)

		// 5б. Подготовить Новые Вопросы
		newQuestions := make([]entity.Question, 0, len(originalQuiz.Questions))
		newQuizIDCopy := newQuiz.ID // Копируем для создания pointer
		for _, origQuestion := range originalQuiz.Questions {
			newQuestion := entity.Question{
				QuizID:        &newQuizIDCopy, // *** Привязка к НОВОЙ викторине ***
				Text:          origQuestion.Text,
				Options:       origQuestion.Options, // Тип StringArray должен копироваться по значению
				CorrectOption: origQuestion.CorrectOption,
				TimeLimitSec:  origQuestion.TimeLimitSec,
				PointValue:    origQuestion.PointValue,
				// FIX: Добавлены недостающие поля для адаптивной системы и локализации
				Difficulty: origQuestion.Difficulty,
				TextKK:     origQuestion.TextKK,
				OptionsKK:  origQuestion.OptionsKK,
				// IsUsed НЕ копируем — новый вопрос должен быть доступен для использования
				// ID, CreatedAt, UpdatedAt будут установлены GORM
			}
			newQuestions = append(newQuestions, newQuestion)
		}

		// 5в. Сохранить Новые Вопросы батчем
		if len(newQuestions) > 0 {
			if err := tx.Create(&newQuestions).Error; err != nil {
				log.Printf("[QuizService] Ошибка сохранения дубликатов вопросов для викторины ID=%d (оригинал ID=%d) в транзакции: %v", newQuiz.ID, originalQuizID, err)
				return fmt.Errorf("ошибка сохранения дубликатов вопросов: %w", err)
			}
			log.Printf("[QuizService] %d дубликатов вопросов успешно сохранены для викторины ID=%d в транзакции", len(newQuestions), newQuiz.ID)
		}

		// Если все успешно, транзакция автоматически коммитится
		return nil
	})

	// 6. Проверить ошибку транзакции и вернуть результат
	if err != nil {
		// Ошибка уже залогирована внутри транзакции
		return nil, err // Возвращаем ошибку транзакции
	}

	log.Printf("[QuizService] Викторина ID=%d успешно дублирована с новым ID=%d на время %v", originalQuizID, newQuiz.ID, newScheduledTime)
	// Возвращаем новую викторину (без вопросов, т.к. GetWithQuestions не вызывался для нее)
	return newQuiz, nil
}

// BulkUploadQuestionPool загружает вопросы в пул для адаптивной системы
// Вопросы добавляются с QuizID=0, что означает что они в общем пуле
func (s *QuizService) BulkUploadQuestionPool(questions []entity.Question) error {
	if len(questions) == 0 {
		return fmt.Errorf("%w: no questions provided", apperrors.ErrValidation)
	}

	// Проверяем все вопросы
	for i, q := range questions {
		if q.Difficulty < 1 || q.Difficulty > 5 {
			return fmt.Errorf("%w: invalid difficulty %d for question #%d", apperrors.ErrValidation, q.Difficulty, i+1)
		}
		if q.CorrectOption < 0 || q.CorrectOption >= len(q.Options) {
			return fmt.Errorf("%w: invalid correct_option for question #%d", apperrors.ErrValidation, i+1)
		}
	}

	// Сохраняем пакетом
	if err := s.questionRepo.CreateBatch(questions); err != nil {
		log.Printf("[QuizService] Ошибка при bulk upload вопросов: %v", err)
		return fmt.Errorf("failed to upload questions: %w", err)
	}

	log.Printf("[QuizService] Bulk upload: добавлено %d вопросов в пул", len(questions))
	return nil
}

// GetPoolStats возвращает статистику пула вопросов
func (s *QuizService) GetPoolStats() (totalCount int64, availableCount int64, byDifficulty map[int]int64, err error) {
	return s.questionRepo.GetPoolStats()
}

// ResetPoolUsed сбрасывает флаг is_used для всех вопросов пула
func (s *QuizService) ResetPoolUsed() (int64, error) {
	count, err := s.questionRepo.ResetPoolUsed()
	if err != nil {
		return 0, err
	}
	log.Printf("[QuizService] Reset pool: обновлено %d вопросов", count)
	return count, nil
}

// truncateDuplicateTitle создаёт название для дубликата с ограничением длины.
// Если title уже заканчивается на "(Копия)" или "(Копия N)", убирает его и добавляет новый суффикс.
func truncateDuplicateTitle(originalTitle string, maxLen int) string {
	suffix := " (Копия)"

	// Убираем существующий суффикс "(Копия)" или "(Копия N)" если он есть
	if idx := strings.LastIndex(originalTitle, " (Копия"); idx > 0 {
		originalTitle = originalTitle[:idx]
	}

	newTitle := originalTitle + suffix

	// Проверяем длину в рунах (для корректной работы с кириллицей)
	runeTitle := []rune(newTitle)
	if len(runeTitle) > maxLen {
		// Обрезаем originalTitle чтобы итоговая строка уместилась
		suffixRunes := []rune(suffix)
		maxOriginalLen := maxLen - len(suffixRunes)
		if maxOriginalLen > 0 {
			originalRunes := []rune(originalTitle)
			if len(originalRunes) > maxOriginalLen {
				originalRunes = originalRunes[:maxOriginalLen]
			}
			newTitle = string(originalRunes) + suffix
		} else {
			// Крайний случай: даже суффикс не влезает
			newTitle = string(runeTitle[:maxLen])
		}
	}

	return newTitle
}
