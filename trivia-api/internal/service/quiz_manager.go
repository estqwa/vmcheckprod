package service

import (
	"context"
	"fmt"
	"log"
	"strconv"
	"sync"
	"time"

	"github.com/yourusername/trivia-api/internal/domain/entity"
	"github.com/yourusername/trivia-api/internal/domain/repository"
	"github.com/yourusername/trivia-api/internal/service/quizmanager"
	"github.com/yourusername/trivia-api/internal/websocket"
	"gorm.io/gorm"
)

// QuizManager координирует работу компонентов для управления викторинами
type QuizManager struct {
	// Компоненты системы
	scheduler       *quizmanager.Scheduler
	questionManager *quizmanager.QuestionManager
	answerProcessor *quizmanager.AnswerProcessor

	// Репозитории для прямого доступа
	quizRepo      repository.QuizRepository
	resultService *ResultService
	wsManager     *websocket.Manager
	cacheRepo     repository.CacheRepository

	// Состояние активной викторины
	activeQuizState *quizmanager.ActiveQuizState
	stateMutex      sync.RWMutex

	// Контекст для управления жизненным циклом
	ctx    context.Context
	cancel context.CancelFunc
}

// NewQuizManager создает новый экземпляр менеджера викторин
func NewQuizManager(
	quizRepo repository.QuizRepository,
	questionRepo repository.QuestionRepository,
	resultRepo repository.ResultRepository,
	resultService *ResultService,
	cacheRepo repository.CacheRepository,
	wsManager *websocket.Manager,
	db *gorm.DB,
	quizAdSlotRepo repository.QuizAdSlotRepository,
) *QuizManager {
	// Создаем контекст для управления жизненным циклом
	ctx, cancel := context.WithCancel(context.Background())

	// Создаем конфигурацию
	config := quizmanager.DefaultConfig()

	// Собираем зависимости для компонентов
	deps := &quizmanager.Dependencies{
		QuizRepo:       quizRepo,
		QuestionRepo:   questionRepo,
		ResultRepo:     resultRepo,
		ResultService:  resultService,
		CacheRepo:      cacheRepo,
		WSManager:      wsManager,
		QuizAdSlotRepo: quizAdSlotRepo,
	}

	// Создаем компоненты
	scheduler := quizmanager.NewScheduler(config, deps)
	questionManager := quizmanager.NewQuestionManager(config, deps)
	answerProcessor := quizmanager.NewAnswerProcessor(config, deps)

	qm := &QuizManager{
		scheduler:       scheduler,
		questionManager: questionManager,
		answerProcessor: answerProcessor,
		quizRepo:        quizRepo,
		resultService:   resultService,
		wsManager:       wsManager,
		cacheRepo:       cacheRepo,
		ctx:             ctx,
		cancel:          cancel,
	}

	// Запускаем слушателя событий
	go qm.handleEvents()

	log.Println("[QuizManager] Менеджер викторин успешно инициализирован")
	return qm
}

// handleEvents обрабатывает события от компонентов
func (qm *QuizManager) handleEvents() {
	// Слушаем события запуска викторин
	quizStartCh := qm.scheduler.GetQuizStartChannel()
	// Слушаем события завершения вопросов
	questionDoneCh := qm.questionManager.QuestionDone()

	for {
		select {
		case <-qm.ctx.Done():
			log.Println("[QuizManager] Завершение работы слушателя событий")
			return

		case quizID := <-quizStartCh:
			// Обрабатываем событие запуска викторины
			go qm.handleQuizStart(quizID)

		case <-questionDoneCh:
			// Обрабатываем событие завершения вопросов
			qm.stateMutex.RLock()
			activeState := qm.activeQuizState
			qm.stateMutex.RUnlock()
			if activeState != nil && activeState.Quiz != nil {
				go qm.finishQuiz(activeState.Quiz.ID)
			}
		}
	}
}

// ScheduleQuiz планирует запуск викторины в указанное время
func (qm *QuizManager) ScheduleQuiz(quizID uint, scheduledTime time.Time) error {
	log.Printf("[QuizManager] Планирование викторины #%d на %v", quizID, scheduledTime)
	return qm.scheduler.ScheduleQuiz(qm.ctx, quizID, scheduledTime)
}

// CancelQuiz отменяет запланированную викторину
func (qm *QuizManager) CancelQuiz(quizID uint) error {
	log.Printf("[QuizManager] Отмена викторины #%d", quizID)
	return qm.scheduler.CancelQuiz(quizID)
}

// handleQuizStart обрабатывает запуск викторины
func (qm *QuizManager) handleQuizStart(quizID uint) {
	log.Printf("[QuizManager] Обработка запуска викторины #%d", quizID)

	// Получаем викторину с вопросами
	quiz, err := qm.quizRepo.GetWithQuestions(quizID)
	if err != nil {
		log.Printf("[QuizManager] Ошибка при получении викторины #%d: %v", quizID, err)
		return
	}

	// Проверяем наличие вопросов (adaptive mode работает без них)
	if len(quiz.Questions) == 0 {
		log.Printf("[QuizManager] Quiz #%d: no preset questions, using adaptive mode", quizID)
	}

	// Создаем состояние активной викторины
	newState := quizmanager.NewActiveQuizState(quiz)

	// Блокируем для записи
	qm.stateMutex.Lock()
	// Проверяем, не запущена ли уже другая викторина (на всякий случай)
	if qm.activeQuizState != nil {
		log.Printf("[QuizManager] WARNING: Попытка запустить викторину #%d, когда викторина #%d уже активна!", quizID, qm.activeQuizState.Quiz.ID)
		qm.stateMutex.Unlock()
		return
	}
	qm.activeQuizState = newState
	qm.stateMutex.Unlock()

	// Запускаем процесс отправки вопросов
	go func() {
		if err := qm.questionManager.RunQuizQuestions(qm.ctx, newState); err != nil {
			log.Printf("[QuizManager] Ошибка при выполнении викторины #%d: %v", quizID, err)
			// В случае ошибки выполнения, также завершаем викторину
			qm.finishQuiz(quizID)
		}
	}()
}

// finishQuiz завершает викторину и подсчитывает результаты
func (qm *QuizManager) finishQuiz(quizID uint) {
	log.Printf("[QuizManager] Завершение викторины #%d", quizID)

	// === 1. Быстро читаем состояние под lock ===
	qm.stateMutex.Lock()
	if qm.activeQuizState == nil || qm.activeQuizState.Quiz == nil || qm.activeQuizState.Quiz.ID != quizID {
		qm.stateMutex.Unlock()
		log.Printf("[QuizManager] Ошибка: викторина #%d не является активной или уже завершена.", quizID)
		return
	}

	// Копируем данные, которые нам нужны
	quiz := qm.activeQuizState.Quiz
	quiz.Status = entity.QuizStatusCompleted
	completedAt := time.Now()

	// Сбрасываем активную викторину сразу
	qm.activeQuizState = nil
	qm.stateMutex.Unlock()
	// === Lock освобождён — далее без блокировки ===

	// === 2. DB операции БЕЗ lock ===
	if err := qm.quizRepo.Update(quiz); err != nil {
		log.Printf("[QuizManager] Ошибка при обновлении статуса викторины #%d: %v", quizID, err)
		// Продолжаем несмотря на ошибку
	}

	// Отправляем событие о завершении
	finishEvent := map[string]interface{}{
		"quiz_id":  quizID,
		"title":    quiz.Title,
		"message":  "Викторина завершена! Подсчет результатов...",
		"status":   "completed",
		"ended_at": completedAt,
	}

	// Отправляем всем участникам через WebSocket-менеджер
	// if err := qm.wsManager.BroadcastEventToQuiz(quizID, "quiz:finish", finishEvent); err != nil {
	// Используем новую сигнатуру
	fullEvent := map[string]interface{}{ // Или websocket.Event
		"type": "quiz:finish",
		"data": finishEvent,
	}
	if err := qm.wsManager.BroadcastEventToQuiz(quizID, fullEvent); err != nil {
		log.Printf("[QuizManager] Ошибка при отправке события о завершении викторины #%d: %v", quizID, err)
	}

	// --- Расчет индивидуальных результатов для ВСЕХ участников ---
	// FIX: Используем Redis Set вместо WebSocket sync.Map,
	// чтобы отключившиеся участники тоже получили результаты
	participantsKey := fmt.Sprintf("quiz:%d:participants", quizID)
	log.Printf("[QuizManager] Получение списка участников из Redis Set %s для викторины #%d...", participantsKey, quizID)
	participantStrings, err := qm.cacheRepo.SMembers(participantsKey)
	if err != nil {
		log.Printf("[QuizManager] КРИТИЧЕСКАЯ ОШИБКА: Не удалось получить участников викторины #%d из Redis: %v. Результаты не будут рассчитаны!", quizID, err)
		return
	}

	// Конвертируем строки в uint
	var participantIDs []uint
	for _, userIDStr := range participantStrings {
		userID, parseErr := strconv.ParseUint(userIDStr, 10, 64)
		if parseErr != nil {
			log.Printf("[QuizManager] Ошибка парсинга userID '%s': %v", userIDStr, parseErr)
			continue
		}
		participantIDs = append(participantIDs, uint(userID))
	}

	log.Printf("[QuizManager] Расчет и сохранение итоговых результатов для %d участников викторины #%d...", len(participantIDs), quizID)
	var calculationWg sync.WaitGroup
	calculationWg.Add(len(participantIDs))

	for _, userID := range participantIDs {
		go func(uid uint) { // Запускаем расчет для каждого пользователя асинхронно
			defer calculationWg.Done()
			_, calcErr := qm.resultService.CalculateQuizResult(uid, quizID)
			if calcErr != nil {
				// Логируем ошибку, но не прерываем процесс для других
				log.Printf("[QuizManager] Ошибка при расчете результата для пользователя #%d в викторине #%d: %v", uid, quizID, calcErr)
			}
		}(userID)
	}
	calculationWg.Wait() // Ожидаем завершения всех расчетов CalculateQuizResult
	log.Printf("[QuizManager] Индивидуальные результаты для викторины #%d рассчитаны.", quizID)

	// --- Вызов определения победителей и распределения призов (ПОСЛЕ расчета индивидуальных результатов) ---
	log.Printf("[QuizManager] Определение победителей и распределение призов для викторины #%d...", quizID)
	if err := qm.resultService.DetermineWinnersAndAllocatePrizes(qm.ctx, quizID); err != nil {
		log.Printf("[QuizManager] Ошибка при определении победителей для викторины #%d: %v", quizID, err)
	}
	// Старый асинхронный вызов с задержкой удален
	// activeQuizState уже сброшен на L192 под lock
}

// ProcessAnswer обрабатывает ответ пользователя, находя соответствующее состояние викторины
// и делегируя обработку процессору ответов.
func (qm *QuizManager) ProcessAnswer(userID, questionID uint, selectedOption int, timestamp int64) error {
	qm.stateMutex.RLock()
	quizState := qm.activeQuizState
	qm.stateMutex.RUnlock()

	if quizState == nil {
		log.Printf("[QuizManager] Ошибка при обработке ответа: активное состояние викторины не найдено")
		return fmt.Errorf("active quiz state not found for processing answer")
	}

	// Получаем вопрос из состояния
	question, questionNumber := quizState.GetCurrentQuestion()
	if question == nil {
		log.Printf("[QuizManager] Ошибка при обработке ответа: не удалось получить текущий вопрос (nil) из состояния викторины %d", quizState.Quiz.ID)
		return fmt.Errorf("current question is nil in state for quiz %d", quizState.Quiz.ID)
	}

	// Проверяем, совпадает ли ID вопроса из ответа с текущим вопросом в состоянии
	if question.ID != questionID {
		log.Printf("[QuizManager] Ответ на неактуальный вопрос: User #%d ответил на Q#%d, но текущий Q#%d (номер %d)", userID, questionID, question.ID, questionNumber)
		return fmt.Errorf("received answer for non-current question (expected %d, got %d)", question.ID, questionID)
	}

	// ===>>> ИЗМЕНЕНИЕ: Получаем время старта вопроса ПЕРЕД вызовом <<<===
	questionStartTimeMs := quizState.GetCurrentQuestionStartTime()
	if questionStartTimeMs == 0 {
		// Это критическая ошибка, если время старта не установлено к моменту ответа
		log.Printf("[QuizManager] CRITICAL: Не удалось получить время старта для текущего вопроса Q#%d в викторине %d", question.ID, quizState.Quiz.ID)
		return fmt.Errorf("internal error: could not retrieve start time for current question %d", question.ID)
	}

	// Делегируем обработку процессору ответов, передавая все необходимые данные
	ctx := context.Background() // Используем фоновый контекст или получаем из вызывающей функции
	return qm.answerProcessor.ProcessAnswer(
		ctx,
		userID,
		question, // Передаем объект вопроса
		selectedOption,
		timestamp,
		quizState,           // Передаем состояние викторины
		questionStartTimeMs, // Передаем время старта
	)
}

// HandleReadyEvent обрабатывает событие готовности пользователя
func (qm *QuizManager) HandleReadyEvent(userID uint, quizID uint) error {
	return qm.answerProcessor.HandleReadyEvent(qm.ctx, userID, quizID)
}

// GetActiveQuiz возвращает активную викторину
func (qm *QuizManager) GetActiveQuiz() *entity.Quiz {
	// Блокируем для чтения
	qm.stateMutex.RLock()
	defer qm.stateMutex.RUnlock()

	if qm.activeQuizState == nil {
		return nil
	}
	return qm.activeQuizState.Quiz
}

// QuizStateResponse представляет состояние викторины для resync
type QuizStateResponse struct {
	QuizID            uint           `json:"quiz_id"`
	Status            string         `json:"status"` // "waiting", "in_progress", "completed"
	CurrentQuestion   *QuestionState `json:"current_question,omitempty"`
	TimeRemaining     int            `json:"time_remaining"`
	IsEliminated      bool           `json:"is_eliminated"`
	EliminationReason string         `json:"elimination_reason,omitempty"`
	Score             int            `json:"score"`
	CorrectCount      int            `json:"correct_count"`
	PlayerCount       int            `json:"player_count"`
}

// QuestionState представляет текущий вопрос для resync
type QuestionState struct {
	QuestionID     uint     `json:"question_id"`
	Number         int      `json:"number"`
	TotalQuestions int      `json:"total_questions"`
	Text           string   `json:"text"`
	Options        []Option `json:"options"`
	TimeLimit      int      `json:"time_limit"`
}

// Option представляет вариант ответа
type Option struct {
	ID   int    `json:"id"`
	Text string `json:"text"`
}

// GetCurrentState возвращает текущее состояние викторины для клиента (resync после reconnect)
func (qm *QuizManager) GetCurrentState(userID uint, quizID uint) (*QuizStateResponse, error) {
	qm.stateMutex.RLock()
	state := qm.activeQuizState
	qm.stateMutex.RUnlock()

	// Нет активной викторины
	if state == nil || state.Quiz == nil || state.Quiz.ID != quizID {
		// Проверяем, существует ли викторина и её статус
		quiz, err := qm.quizRepo.GetByID(quizID)
		if err != nil {
			return nil, fmt.Errorf("quiz not found: %w", err)
		}

		// Получаем количество активных игроков
		playerCount := qm.wsManager.GetSubscriberCount(quizID)

		response := &QuizStateResponse{
			QuizID:      quizID,
			Status:      string(quiz.Status),
			PlayerCount: playerCount,
		}

		// Если викторина завершена, получаем результаты пользователя
		if quiz.Status == entity.QuizStatusCompleted {
			result, err := qm.resultService.GetUserResult(userID, quizID)
			if err == nil && result != nil {
				response.Score = result.Score
				response.CorrectCount = result.CorrectAnswers
				response.IsEliminated = result.IsEliminated
			}
		}

		return response, nil
	}

	// Есть активная викторина
	question, questionNumber := state.GetCurrentQuestion()
	startTimeMs := state.GetCurrentQuestionStartTime()

	// Получаем количество активных игроков
	playerCount := qm.wsManager.GetSubscriberCount(quizID)

	response := &QuizStateResponse{
		QuizID:      quizID,
		Status:      "in_progress",
		PlayerCount: playerCount,
	}

	// Получаем статус пользователя (выбыл или нет)
	ctx := context.Background()
	result, err := qm.answerProcessor.GetUserQuizStatus(ctx, userID, quizID)
	if err == nil && result != nil {
		response.IsEliminated = result.IsEliminated
		response.EliminationReason = result.EliminationReason
		response.Score = result.Score
		response.CorrectCount = result.CorrectCount
	}

	// Если есть текущий вопрос
	if question != nil {
		// Рассчитываем оставшееся время
		elapsedMs := time.Now().UnixMilli() - startTimeMs
		remainingSec := question.TimeLimitSec - int(elapsedMs/1000)
		if remainingSec < 0 {
			remainingSec = 0
		}
		response.TimeRemaining = remainingSec

		// Формируем опции ответов
		options := make([]Option, len(question.Options))
		for i, opt := range question.Options {
			options[i] = Option{
				ID:   i,
				Text: opt,
			}
		}

		response.CurrentQuestion = &QuestionState{
			QuestionID:     question.ID,
			Number:         questionNumber,
			TotalQuestions: qm.getTotalQuestions(state.Quiz),
			Text:           question.Text,
			Options:        options,
			TimeLimit:      question.TimeLimitSec,
		}
	}

	return response, nil
}

// getTotalQuestions возвращает количество вопросов с fallback на дефолт
func (qm *QuizManager) getTotalQuestions(quiz *entity.Quiz) int {
	if quiz.QuestionCount > 0 {
		return quiz.QuestionCount
	}
	return quizmanager.DefaultMaxQuizQuestions
}

// Shutdown корректно завершает работу менеджера викторин
func (qm *QuizManager) Shutdown() {
	log.Println("[QuizManager] Завершение работы менеджера викторин...")

	// Отменяем контекст для завершения всех операций
	qm.cancel()

	// Здесь могли бы быть дополнительные действия по завершению работы

	log.Println("[QuizManager] Менеджер викторин остановлен")
}
