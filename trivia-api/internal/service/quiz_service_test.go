package service

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"github.com/yourusername/trivia-api/internal/domain/entity"
	"github.com/yourusername/trivia-api/internal/service/quizmanager"
)

// ============================================================================
// Моки для QuizService
// Используем моки из quiz_manager_test.go: MockQuizRepository, MockCacheRepository
// Добавляем только MockQuestionRepoForQuizService (переименовано для избежания конфликтов)
// ============================================================================

// helper для создания pointer
func uintPtrForQS(v uint) *uint { return &v }

// MockQuestionRepoForQuizService реализует repository.QuestionRepository
type MockQuestionRepoForQuizService struct {
	mock.Mock
}

func (m *MockQuestionRepoForQuizService) Create(question *entity.Question) error {
	args := m.Called(question)
	return args.Error(0)
}

func (m *MockQuestionRepoForQuizService) CreateBatch(questions []entity.Question) error {
	args := m.Called(questions)
	return args.Error(0)
}

func (m *MockQuestionRepoForQuizService) GetByID(id uint) (*entity.Question, error) {
	args := m.Called(id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*entity.Question), args.Error(1)
}

func (m *MockQuestionRepoForQuizService) GetByQuizID(quizID uint) ([]entity.Question, error) {
	args := m.Called(quizID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]entity.Question), args.Error(1)
}

func (m *MockQuestionRepoForQuizService) Update(question *entity.Question) error {
	args := m.Called(question)
	return args.Error(0)
}

func (m *MockQuestionRepoForQuizService) Delete(id uint) error {
	args := m.Called(id)
	return args.Error(0)
}

func (m *MockQuestionRepoForQuizService) GetRandomQuestions(limit int) ([]entity.Question, error) {
	args := m.Called(limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]entity.Question), args.Error(1)
}

func (m *MockQuestionRepoForQuizService) GetRandomByDifficulty(difficulty int, limit int, excludeIDs []uint) ([]entity.Question, error) {
	args := m.Called(difficulty, limit, excludeIDs)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]entity.Question), args.Error(1)
}

func (m *MockQuestionRepoForQuizService) MarkAsUsed(questionIDs []uint) error {
	args := m.Called(questionIDs)
	return args.Error(0)
}

func (m *MockQuestionRepoForQuizService) CountByDifficulty(difficulty int) (int64, error) {
	args := m.Called(difficulty)
	return args.Get(0).(int64), args.Error(1)
}

// Новые методы для гибридной адаптивной системы
func (m *MockQuestionRepoForQuizService) GetQuizQuestionByDifficulty(quizID uint, difficulty int, excludeIDs []uint) (*entity.Question, error) {
	args := m.Called(quizID, difficulty, excludeIDs)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*entity.Question), args.Error(1)
}

func (m *MockQuestionRepoForQuizService) GetPoolQuestionByDifficulty(difficulty int, excludeIDs []uint) (*entity.Question, error) {
	args := m.Called(difficulty, excludeIDs)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*entity.Question), args.Error(1)
}

func (m *MockQuestionRepoForQuizService) GetPoolStats() (int64, int64, map[int]int64, error) {
	args := m.Called()
	return args.Get(0).(int64), args.Get(1).(int64), args.Get(2).(map[int]int64), args.Error(3)
}

func (m *MockQuestionRepoForQuizService) ResetPoolUsed() (int64, error) {
	args := m.Called()
	return args.Get(0).(int64), args.Error(1)
}

func (m *MockQuestionRepoForQuizService) CountAvailablePool() (int64, error) {
	args := m.Called()
	return args.Get(0).(int64), args.Error(1)
}

func (m *MockQuestionRepoForQuizService) LogQuizQuestion(quizID uint, questionID uint, questionOrder int) error {
	args := m.Called(quizID, questionID, questionOrder)
	return args.Error(0)
}

func (m *MockQuestionRepoForQuizService) GetQuizQuestionHistory(quizID uint) ([]entity.QuizQuestionHistory, error) {
	args := m.Called(quizID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]entity.QuizQuestionHistory), args.Error(1)
}

// ============================================================================
// createTestQuizService создаёт QuizService для тестирования
// ============================================================================

func createTestQuizServiceWithMocks(
	quizRepo *MockQuizRepository,
	questionRepo *MockQuestionRepoForQuizService,
	config *quizmanager.Config,
) *QuizService {
	return &QuizService{
		quizRepo:     quizRepo,
		questionRepo: questionRepo,
		cacheRepo:    nil, // nil для этих тестов
		config:       config,
		db:           nil,
	}
}

func getDefaultTestConfigForQuiz() *quizmanager.Config {
	return &quizmanager.Config{
		MaxQuestionsPerQuiz: 20,
	}
}

// ============================================================================
// Тесты для QuizService
// ============================================================================

func TestQuizService_CreateQuiz_Success(t *testing.T) {
	// Arrange
	mockQuizRepo := new(MockQuizRepository)
	scheduledTime := time.Now().Add(24 * time.Hour) // Завтра

	mockQuizRepo.On("Create", mock.AnythingOfType("*entity.Quiz")).Return(nil)

	quizService := createTestQuizServiceWithMocks(mockQuizRepo, nil, getDefaultTestConfigForQuiz())

	// Act
	quiz, err := quizService.CreateQuiz("Тестовая викторина", "Описание", scheduledTime, 500000, false)

	// Assert
	require.NoError(t, err, "Создание викторины должно быть успешным")
	assert.NotNil(t, quiz)
	assert.Equal(t, "Тестовая викторина", quiz.Title)
	assert.Equal(t, "Описание", quiz.Description)
	assert.Equal(t, entity.QuizStatusScheduled, quiz.Status)
	mockQuizRepo.AssertExpectations(t)
}

func TestQuizService_CreateQuiz_PastScheduledTime(t *testing.T) {
	// Arrange
	mockQuizRepo := new(MockQuizRepository)
	scheduledTime := time.Now().Add(-1 * time.Hour) // Час назад

	quizService := createTestQuizServiceWithMocks(mockQuizRepo, nil, getDefaultTestConfigForQuiz())

	// Act
	quiz, err := quizService.CreateQuiz("Викторина", "Описание", scheduledTime, 0, false)

	// Assert
	assert.Error(t, err, "Должна быть ошибка при времени в прошлом")
	assert.Nil(t, quiz)
	assert.Contains(t, err.Error(), "future", "Ошибка должна указывать на время в будущем")
	// Create не должен быть вызван
	mockQuizRepo.AssertNotCalled(t, "Create")
}

func TestQuizService_AddQuestions_Success(t *testing.T) {
	// Arrange
	mockQuizRepo := new(MockQuizRepository)
	mockQuestionRepo := new(MockQuestionRepoForQuizService)

	existingQuiz := &entity.Quiz{
		ID:            1,
		Title:         "Тест",
		Status:        entity.QuizStatusScheduled,
		QuestionCount: 0,
	}

	newQuestions := []entity.Question{
		{Text: "Вопрос 1", Options: entity.StringArray{"A", "B", "C", "D"}, CorrectOption: 0},
		{Text: "Вопрос 2", Options: entity.StringArray{"A", "B", "C", "D"}, CorrectOption: 1},
	}

	mockQuizRepo.On("GetByID", uint(1)).Return(existingQuiz, nil)
	mockQuestionRepo.On("GetByQuizID", uint(1)).Return([]entity.Question{}, nil)
	mockQuestionRepo.On("CreateBatch", mock.AnythingOfType("[]entity.Question")).Return(nil)
	// FIX: теперь вместо Update используется IncrementQuestionCount
	mockQuizRepo.On("IncrementQuestionCount", uint(1), 2).Return(nil)

	quizService := createTestQuizServiceWithMocks(mockQuizRepo, mockQuestionRepo, getDefaultTestConfigForQuiz())

	// Act
	err := quizService.AddQuestions(1, newQuestions)

	// Assert
	require.NoError(t, err, "Добавление вопросов должно быть успешным")
	mockQuizRepo.AssertExpectations(t)
	mockQuestionRepo.AssertExpectations(t)
}

func TestQuizService_AddQuestions_MaxLimit(t *testing.T) {
	// Arrange
	mockQuizRepo := new(MockQuizRepository)
	mockQuestionRepo := new(MockQuestionRepoForQuizService)

	existingQuiz := &entity.Quiz{
		ID:            1,
		Title:         "Тест",
		Status:        entity.QuizStatusScheduled,
		QuestionCount: 18,
	}

	// Config с лимитом 20 вопросов
	config := &quizmanager.Config{
		MaxQuestionsPerQuiz: 20,
	}

	// Уже есть 18 вопросов
	existingQuestions := make([]entity.Question, 18)
	for i := range existingQuestions {
		existingQuestions[i] = entity.Question{ID: uint(i + 1), QuizID: uintPtrForQS(1), Text: "Q"}
	}

	// Пытаемся добавить 5 вопросов (18+5=23 > 20)
	newQuestions := make([]entity.Question, 5)
	for i := range newQuestions {
		newQuestions[i] = entity.Question{Text: "Новый вопрос"}
	}

	mockQuizRepo.On("GetByID", uint(1)).Return(existingQuiz, nil)
	mockQuestionRepo.On("GetByQuizID", uint(1)).Return(existingQuestions, nil)

	quizService := createTestQuizServiceWithMocks(mockQuizRepo, mockQuestionRepo, config)

	// Act
	err := quizService.AddQuestions(1, newQuestions)

	// Assert
	assert.Error(t, err, "Должна быть ошибка при превышении лимита")
	assert.Contains(t, err.Error(), "20", "Ошибка должна указывать на максимальный лимит")
	// CreateBatch не должен быть вызван
	mockQuestionRepo.AssertNotCalled(t, "CreateBatch")
}

func TestQuizService_ScheduleQuiz_Success(t *testing.T) {
	// Arrange
	mockQuizRepo := new(MockQuizRepository)
	scheduledTime := time.Now().Add(48 * time.Hour) // Через 2 дня

	existingQuiz := &entity.Quiz{
		ID:            1,
		Title:         "Тест",
		Status:        entity.QuizStatusScheduled,
		ScheduledTime: time.Now().Add(24 * time.Hour),
	}

	mockQuizRepo.On("GetByID", uint(1)).Return(existingQuiz, nil)
	// FIX: теперь вместо Update используется UpdateScheduleInfo
	mockQuizRepo.On("UpdateScheduleInfo", uint(1), mock.AnythingOfType("time.Time"), entity.QuizStatusScheduled, (*bool)(nil)).Return(nil)

	quizService := createTestQuizServiceWithMocks(mockQuizRepo, nil, getDefaultTestConfigForQuiz())

	// Act
	err := quizService.ScheduleQuiz(1, scheduledTime, nil)

	// Assert
	require.NoError(t, err, "Перепланирование должно быть успешным")
	mockQuizRepo.AssertExpectations(t)
}

func TestQuizService_ScheduleQuiz_PastTime(t *testing.T) {
	// Arrange
	mockQuizRepo := new(MockQuizRepository)
	scheduledTime := time.Now().Add(-1 * time.Hour) // Час назад

	existingQuiz := &entity.Quiz{
		ID:     1,
		Title:  "Тест",
		Status: entity.QuizStatusScheduled,
	}

	mockQuizRepo.On("GetByID", uint(1)).Return(existingQuiz, nil)

	quizService := createTestQuizServiceWithMocks(mockQuizRepo, nil, getDefaultTestConfigForQuiz())

	// Act
	err := quizService.ScheduleQuiz(1, scheduledTime, nil)

	// Assert
	assert.Error(t, err, "Должна быть ошибка при времени в прошлом")
	assert.Contains(t, err.Error(), "future")
	mockQuizRepo.AssertNotCalled(t, "Update")
}

func TestQuizService_DeleteQuiz_CannotDeleteActive(t *testing.T) {
	// Arrange
	mockQuizRepo := new(MockQuizRepository)

	// Используем правильный статус: QuizStatusInProgress
	activeQuiz := &entity.Quiz{
		ID:     1,
		Title:  "Активная викторина",
		Status: entity.QuizStatusInProgress,
	}

	mockQuizRepo.On("GetByID", uint(1)).Return(activeQuiz, nil)

	quizService := createTestQuizServiceWithMocks(mockQuizRepo, nil, getDefaultTestConfigForQuiz())

	// Act
	err := quizService.DeleteQuiz(1)

	// Assert
	assert.Error(t, err, "Должна быть ошибка при удалении активной викторины")
	assert.Contains(t, err.Error(), "active")
	mockQuizRepo.AssertNotCalled(t, "Delete")
}
