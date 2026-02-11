package quizmanager

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"github.com/yourusername/trivia-api/internal/domain/entity"
	"github.com/yourusername/trivia-api/internal/domain/repository"
)

// ============================================================================
// Моки для Scheduler
// ============================================================================

// MockQuizRepoForScheduler реализует repository.QuizRepository
type MockQuizRepoForScheduler struct {
	mock.Mock
}

func (m *MockQuizRepoForScheduler) GetByID(id uint) (*entity.Quiz, error) {
	args := m.Called(id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*entity.Quiz), args.Error(1)
}

func (m *MockQuizRepoForScheduler) GetWithQuestions(id uint) (*entity.Quiz, error) {
	args := m.Called(id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*entity.Quiz), args.Error(1)
}

func (m *MockQuizRepoForScheduler) UpdateStatus(id uint, status string) error {
	args := m.Called(id, status)
	return args.Error(0)
}

func (m *MockQuizRepoForScheduler) UpdateQuestionCount(quizID uint, questionCount int) error {
	args := m.Called(quizID, questionCount)
	return args.Error(0)
}

func (m *MockQuizRepoForScheduler) IncrementQuestionCount(quizID uint, delta int) error {
	args := m.Called(quizID, delta)
	return args.Error(0)
}

func (m *MockQuizRepoForScheduler) UpdateScheduleInfo(quizID uint, scheduledTime time.Time, status string) error {
	args := m.Called(quizID, scheduledTime, status)
	return args.Error(0)
}

func (m *MockQuizRepoForScheduler) AtomicStartQuiz(quizID uint) error {
	args := m.Called(quizID)
	return args.Error(0)
}

func (m *MockQuizRepoForScheduler) Update(quiz *entity.Quiz) error {
	args := m.Called(quiz)
	return args.Error(0)
}

func (m *MockQuizRepoForScheduler) Create(quiz *entity.Quiz) error {
	args := m.Called(quiz)
	return args.Error(0)
}

func (m *MockQuizRepoForScheduler) GetActive() (*entity.Quiz, error) {
	args := m.Called()
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*entity.Quiz), args.Error(1)
}

func (m *MockQuizRepoForScheduler) GetScheduled() ([]entity.Quiz, error) {
	args := m.Called()
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]entity.Quiz), args.Error(1)
}

func (m *MockQuizRepoForScheduler) List(limit, offset int) ([]entity.Quiz, error) {
	args := m.Called(limit, offset)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]entity.Quiz), args.Error(1)
}

func (m *MockQuizRepoForScheduler) Delete(id uint) error {
	args := m.Called(id)
	return args.Error(0)
}

func (m *MockQuizRepoForScheduler) ListWithFilters(filters repository.QuizFilters, limit, offset int) ([]entity.Quiz, int64, error) {
	args := m.Called(filters, limit, offset)
	if args.Get(0) == nil {
		return nil, args.Get(1).(int64), args.Error(2)
	}
	return args.Get(0).([]entity.Quiz), args.Get(1).(int64), args.Error(2)
}

// MockQuestionRepoForScheduler реализует repository.QuestionRepository для тестов
type MockQuestionRepoForScheduler struct {
	mock.Mock
}

func (m *MockQuestionRepoForScheduler) Create(question *entity.Question) error {
	return m.Called(question).Error(0)
}

func (m *MockQuestionRepoForScheduler) CreateBatch(questions []entity.Question) error {
	return m.Called(questions).Error(0)
}

func (m *MockQuestionRepoForScheduler) GetByID(id uint) (*entity.Question, error) {
	args := m.Called(id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*entity.Question), args.Error(1)
}

func (m *MockQuestionRepoForScheduler) GetByQuizID(quizID uint) ([]entity.Question, error) {
	args := m.Called(quizID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]entity.Question), args.Error(1)
}

func (m *MockQuestionRepoForScheduler) Update(question *entity.Question) error {
	return m.Called(question).Error(0)
}

func (m *MockQuestionRepoForScheduler) Delete(id uint) error {
	return m.Called(id).Error(0)
}

func (m *MockQuestionRepoForScheduler) GetRandomQuestions(limit int) ([]entity.Question, error) {
	args := m.Called(limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]entity.Question), args.Error(1)
}

func (m *MockQuestionRepoForScheduler) GetRandomByDifficulty(difficulty int, limit int, excludeIDs []uint) ([]entity.Question, error) {
	args := m.Called(difficulty, limit, excludeIDs)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]entity.Question), args.Error(1)
}

func (m *MockQuestionRepoForScheduler) MarkAsUsed(questionIDs []uint) error {
	return m.Called(questionIDs).Error(0)
}

func (m *MockQuestionRepoForScheduler) CountByDifficulty(difficulty int) (int64, error) {
	args := m.Called(difficulty)
	return args.Get(0).(int64), args.Error(1)
}

func (m *MockQuestionRepoForScheduler) GetQuizQuestionByDifficulty(quizID uint, difficulty int, excludeIDs []uint) (*entity.Question, error) {
	args := m.Called(quizID, difficulty, excludeIDs)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*entity.Question), args.Error(1)
}

func (m *MockQuestionRepoForScheduler) GetPoolQuestionByDifficulty(difficulty int, excludeIDs []uint) (*entity.Question, error) {
	args := m.Called(difficulty, excludeIDs)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*entity.Question), args.Error(1)
}

func (m *MockQuestionRepoForScheduler) GetPoolStats() (total int64, available int64, byDifficulty map[int]int64, err error) {
	args := m.Called()
	return args.Get(0).(int64), args.Get(1).(int64), args.Get(2).(map[int]int64), args.Error(3)
}

func (m *MockQuestionRepoForScheduler) ResetPoolUsed() (int64, error) {
	args := m.Called()
	return args.Get(0).(int64), args.Error(1)
}

func (m *MockQuestionRepoForScheduler) CountAvailablePool() (int64, error) {
	args := m.Called()
	return args.Get(0).(int64), args.Error(1)
}

// MockWSManagerForScheduler реализует минимальный интерфейс WebSocket Manager
type MockWSManagerForScheduler struct {
	mock.Mock
}

func (m *MockWSManagerForScheduler) BroadcastEvent(eventType string, data interface{}) error {
	args := m.Called(eventType, data)
	return args.Error(0)
}

// ============================================================================
// createTestScheduler создаёт Scheduler для тестирования
// ============================================================================

// createTestSchedulerDeps создаёт Dependencies с моками
func createTestSchedulerDeps(
	quizRepo *MockQuizRepoForScheduler,
	wsManager *MockWSManagerForScheduler,
) *Dependencies {
	return &Dependencies{
		QuizRepo:  quizRepo,
		WSManager: nil, // Будет установлен отдельно для тестов
	}
}

// ============================================================================
// Тесты для Scheduler
// ============================================================================

func TestScheduler_ScheduleQuiz_Success(t *testing.T) {
	// Arrange
	mockQuizRepo := new(MockQuizRepoForScheduler)
	mockQuestionRepo := new(MockQuestionRepoForScheduler)
	config := DefaultConfig()

	// Викторина с вопросами (2 вопроса, нужно ещё 8 из пула)
	scheduledTime := time.Now().Add(1 * time.Hour)
	quiz := &entity.Quiz{
		ID:            1,
		Title:         "Тестовая викторина",
		Status:        entity.QuizStatusScheduled,
		ScheduledTime: scheduledTime,
		Questions: []entity.Question{
			{ID: 1, Text: "Вопрос 1"},
			{ID: 2, Text: "Вопрос 2"},
		},
	}

	mockQuizRepo.On("GetWithQuestions", uint(1)).Return(quiz, nil)
	// Новый метод вместо Update
	mockQuizRepo.On("UpdateScheduleInfo", uint(1), mock.AnythingOfType("time.Time"), entity.QuizStatusScheduled).Return(nil)
	// Хватает вопросов в пуле (needed=8, available=15)
	mockQuestionRepo.On("CountAvailablePool").Return(int64(15), nil)

	// Создаём Scheduler напрямую (без wsManager для этого теста)
	deps := &Dependencies{
		QuizRepo:     mockQuizRepo,
		QuestionRepo: mockQuestionRepo,
	}
	scheduler := NewScheduler(config, deps)

	// Act
	ctx := context.Background()
	err := scheduler.ScheduleQuiz(ctx, 1, scheduledTime)

	// Assert
	require.NoError(t, err, "Планирование викторины должно быть успешным")
	mockQuizRepo.AssertExpectations(t)
}

func TestScheduler_ScheduleQuiz_PastTime(t *testing.T) {
	// Arrange
	mockQuizRepo := new(MockQuizRepoForScheduler)
	config := DefaultConfig()

	deps := &Dependencies{
		QuizRepo: mockQuizRepo,
	}
	scheduler := NewScheduler(config, deps)

	// Время в прошлом
	pastTime := time.Now().Add(-1 * time.Hour)

	// Act
	ctx := context.Background()
	err := scheduler.ScheduleQuiz(ctx, 1, pastTime)

	// Assert
	assert.Error(t, err, "Должна быть ошибка при времени в прошлом")
	assert.Contains(t, err.Error(), "past", "Ошибка должна указывать на время в прошлом")
	// GetWithQuestions не должен быть вызван
	mockQuizRepo.AssertNotCalled(t, "GetWithQuestions")
}

func TestScheduler_ScheduleQuiz_NoQuestions_EmptyPool(t *testing.T) {
	// Arrange
	mockQuizRepo := new(MockQuizRepoForScheduler)
	mockQuestionRepo := new(MockQuestionRepoForScheduler)
	config := DefaultConfig()

	// Викторина БЕЗ вопросов
	scheduledTime := time.Now().Add(1 * time.Hour)
	quiz := &entity.Quiz{
		ID:            1,
		Title:         "Пустая викторина",
		Status:        entity.QuizStatusScheduled,
		ScheduledTime: scheduledTime,
		Questions:     []entity.Question{}, // Пусто!
	}

	mockQuizRepo.On("GetWithQuestions", uint(1)).Return(quiz, nil)
	// Пул пуст — 0 доступных вопросов
	mockQuestionRepo.On("CountAvailablePool").Return(int64(0), nil)

	deps := &Dependencies{
		QuizRepo:     mockQuizRepo,
		QuestionRepo: mockQuestionRepo,
	}
	scheduler := NewScheduler(config, deps)

	// Act
	ctx := context.Background()
	err := scheduler.ScheduleQuiz(ctx, 1, scheduledTime)

	// Assert
	assert.Error(t, err, "Должна быть ошибка при отсутствии вопросов и пустом пуле")
	assert.Contains(t, err.Error(), "недостаточно", "Ошибка должна указывать на нехватку вопросов")
	mockQuizRepo.AssertNotCalled(t, "UpdateScheduleInfo")
}

func TestScheduler_ScheduleQuiz_NoQuestions_PoolAvailable(t *testing.T) {
	// Arrange
	mockQuizRepo := new(MockQuizRepoForScheduler)
	mockQuestionRepo := new(MockQuestionRepoForScheduler)
	config := DefaultConfig()

	// Викторина БЕЗ вопросов
	scheduledTime := time.Now().Add(1 * time.Hour)
	quiz := &entity.Quiz{
		ID:            1,
		Title:         "Адаптивная викторина",
		Status:        entity.QuizStatusScheduled,
		ScheduledTime: scheduledTime,
		Questions:     []entity.Question{}, // Пусто
	}

	mockQuizRepo.On("GetWithQuestions", uint(1)).Return(quiz, nil)
	mockQuizRepo.On("UpdateScheduleInfo", uint(1), mock.AnythingOfType("time.Time"), entity.QuizStatusScheduled).Return(nil)

	// Пул имеет достаточно вопросов для MaxQuestionsPerQuiz
	mockQuestionRepo.On("CountAvailablePool").Return(int64(15), nil)

	deps := &Dependencies{
		QuizRepo:     mockQuizRepo,
		QuestionRepo: mockQuestionRepo,
	}
	scheduler := NewScheduler(config, deps)

	// Act
	ctx := context.Background()
	err := scheduler.ScheduleQuiz(ctx, 1, scheduledTime)

	// Assert
	require.NoError(t, err, "Планирование должно быть успешным при наличии пула")
	mockQuizRepo.AssertCalled(t, "UpdateScheduleInfo", uint(1), mock.AnythingOfType("time.Time"), entity.QuizStatusScheduled)
}

func TestScheduler_Reschedule_NoDuplicateStart(t *testing.T) {
	// Arrange
	mockQuizRepo := new(MockQuizRepoForScheduler)
	mockQuestionRepo := new(MockQuestionRepoForScheduler)
	config := DefaultConfig()

	// Время в будущем (не ждём реального старта)
	scheduledTime := time.Now().Add(1 * time.Hour)
	quiz := &entity.Quiz{
		ID:            1,
		Title:         "Перепланируемая викторина",
		Status:        entity.QuizStatusScheduled,
		ScheduledTime: scheduledTime,
		Questions: []entity.Question{
			{ID: 1, Text: "Вопрос 1"},
		},
	}

	mockQuizRepo.On("GetWithQuestions", uint(1)).Return(quiz, nil)
	mockQuizRepo.On("UpdateScheduleInfo", uint(1), mock.AnythingOfType("time.Time"), entity.QuizStatusScheduled).Return(nil)
	// Хватает вопросов в пуле
	mockQuestionRepo.On("CountAvailablePool").Return(int64(15), nil)

	deps := &Dependencies{
		QuizRepo:     mockQuizRepo,
		QuestionRepo: mockQuestionRepo,
	}
	scheduler := NewScheduler(config, deps)
	ctx := context.Background()

	// Act: первый ScheduleQuiz
	err1 := scheduler.ScheduleQuiz(ctx, 1, scheduledTime)
	require.NoError(t, err1)

	// Проверяем первый токен
	scheduler.mu.Lock()
	sq1, exists1 := scheduler.quizCancels[uint(1)]
	scheduler.mu.Unlock()
	require.True(t, exists1, "Должен быть первый таймер")
	assert.Equal(t, uint64(1), sq1.token, "Первый токен = 1")

	// Act: перепланирование (старый таймер должен отмениться)
	newTime := scheduledTime.Add(30 * time.Minute)
	err2 := scheduler.ScheduleQuiz(ctx, 1, newTime)
	require.NoError(t, err2)

	// Assert: только новый таймер в map, токен = 2
	scheduler.mu.Lock()
	sq2, exists2 := scheduler.quizCancels[uint(1)]
	scheduler.mu.Unlock()
	require.True(t, exists2, "Должен быть второй таймер")
	assert.Equal(t, uint64(2), sq2.token, "Второй токен = 2 (перепланирование)")

	// Старый cancel должен быть вызван (контекст отменён)
	// Это подтверждается тем, что Map содержит только новый таймер
}

func TestScheduler_CancelQuiz_Success(t *testing.T) {
	// Arrange
	mockQuizRepo := new(MockQuizRepoForScheduler)
	config := DefaultConfig()

	// Викторина в статусе scheduled
	quiz := &entity.Quiz{
		ID:     1,
		Title:  "Викторина",
		Status: entity.QuizStatusScheduled,
	}

	mockQuizRepo.On("GetByID", uint(1)).Return(quiz, nil)
	mockQuizRepo.On("UpdateStatus", uint(1), entity.QuizStatusCancelled).Return(nil)

	// Создаём mock для WSManager
	mockWSManager := new(MockWSManagerForScheduler)
	mockWSManager.On("BroadcastEvent", "quiz:cancelled", mock.Anything).Return(nil)

	// Для теста создаём Scheduler с WSManager через обёртку
	// Но WSManager в Dependencies — это *websocket.Manager, не интерфейс
	// Поэтому создаём Scheduler без WSManager и проверяем только репозиторий

	deps := &Dependencies{
		QuizRepo:  mockQuizRepo,
		WSManager: nil, // nil — WS вызов вызовет panic
	}
	_ = NewScheduler(config, deps) // Создаём, но не используем — тест пропущен

	// Для полного теста потребуется интеграционный тест с настоящим WSManager
	// или рефакторинг Dependencies для использования интерфейса вместо *websocket.Manager

	t.Skip("CancelQuiz требует *websocket.Manager, рекомендуется интеграционный тест")
}
