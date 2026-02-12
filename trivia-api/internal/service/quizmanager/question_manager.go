package quizmanager

import (
	"context"
	"fmt"
	"log"
	"strconv"
	"sync"
	"time"

	"github.com/yourusername/trivia-api/internal/domain/entity"
	"github.com/yourusername/trivia-api/internal/handler/helper"
)

// QuestionManager отвечает за управление вопросами, их отправку и таймеры
type QuestionManager struct {
	// Настройки
	config *Config

	// Зависимости
	deps *Dependencies

	// Адаптивный селектор вопросов
	adaptiveSelector *AdaptiveQuestionSelector

	// Канал для сигнализации о завершении вопроса
	questionDoneCh chan struct{}
}

// NewQuestionManager создает новый менеджер вопросов
func NewQuestionManager(config *Config, deps *Dependencies) *QuestionManager {
	// Создаём конфигурацию адаптивной сложности
	difficultyConfig := DefaultDifficultyConfig()

	return &QuestionManager{
		config:           config,
		deps:             deps,
		adaptiveSelector: NewAdaptiveQuestionSelector(difficultyConfig, deps),
		questionDoneCh:   make(chan struct{}, 1),
	}
}

// QuestionDone возвращает канал для уведомления о завершении вопроса
func (qm *QuestionManager) QuestionDone() <-chan struct{} {
	return qm.questionDoneCh
}

// RunQuizQuestions последовательно выбирает и отправляет вопросы с адаптивной сложностью
// Примечание: AutoFillQuizQuestions удалён — адаптивная система (SelectNextQuestion)
// динамически выбирает вопросы из quiz-specific или общего пула
func (qm *QuestionManager) RunQuizQuestions(ctx context.Context, quizState *ActiveQuizState) error {
	totalQuestions := qm.config.MaxQuestionsPerQuiz
	if quizState.Quiz.QuestionCount > 0 {
		totalQuestions = quizState.Quiz.QuestionCount
	}
	// Примечание: QuestionCount фиксируется в triggerQuizStart (scheduler.go),
	// но при раннем завершении может быть скорректирован в конце этой функции.
	log.Printf("[QuestionManager] Начинаю адаптивный процесс отправки вопросов для викторины #%d. Всего вопросов: %d",
		quizState.Quiz.ID, totalQuestions)

	// Создаем контекст для этой конкретной викторины
	quizCtx, quizCancel := context.WithCancel(ctx)
	defer quizCancel() // Гарантируем отмену при выходе из функции

	// WaitGroup для синхронизации всех таймеров вопросов
	var timerWg sync.WaitGroup

	// Список ID использованных вопросов в этой викторине
	usedQuestionIDs := make([]uint, 0, totalQuestions)

	// NOTE: quiz:start уже отправлен Scheduler.triggerQuizStart() перед вызовом QuestionManager.
	// Здесь мы сразу начинаем отправку вопросов.

	for i := 1; i <= totalQuestions; i++ {
		// Опциональный режим: досрочно завершаем викторину, если активных участников больше нет.
		if quizState.Quiz.FinishOnZeroPlayers {
			activeParticipants, err := qm.countActiveParticipants(quizState.Quiz.ID)
			if err != nil {
				log.Printf("[QuestionManager] WARNING: Не удалось посчитать активных участников для викторины #%d: %v",
					quizState.Quiz.ID, err)
			} else if activeParticipants == 0 {
				log.Printf("[QuestionManager] Досрочное завершение викторины #%d: активных участников нет (finish_on_zero_players=true)",
					quizState.Quiz.ID)
				break
			}
		}

		// === АДАПТИВНЫЙ ВЫБОР ВОПРОСА ===
		question, err := qm.adaptiveSelector.SelectNextQuestion(quizCtx, quizState.Quiz.ID, i, usedQuestionIDs)
		if err != nil {
			log.Printf("[QuestionManager] КРИТИЧЕСКАЯ ОШИБКА: Не удалось выбрать вопрос #%d для викторины #%d: %v. Завершаем викторину.",
				i, quizState.Quiz.ID, err)
			break // Завершаем если нет вопросов
		}

		// Добавляем в список использованных
		usedQuestionIDs = append(usedQuestionIDs, question.ID)

		// Логируем факт показа вопроса для корректной пост-статистики.
		if qm.deps.QuestionRepo != nil {
			if err := qm.deps.QuestionRepo.LogQuizQuestion(quizState.Quiz.ID, question.ID, i); err != nil {
				log.Printf("[QuestionManager] WARNING: Не удалось записать историю вопроса (quiz=%d, question=%d, order=%d): %v",
					quizState.Quiz.ID, question.ID, i, err)
			}
		}

		// Устанавливаем текущий вопрос в состоянии
		quizState.SetCurrentQuestion(question, i)

		// Добавляем задержку перед отправкой вопроса для синхронизации с фронтендом
		time.Sleep(time.Duration(qm.config.QuestionDelayMs) * time.Millisecond)

		// Получить точное время отправки вопроса
		sendTimeMs := time.Now().UnixNano() / int64(time.Millisecond)
		quizState.SetCurrentQuestionStartTime(sendTimeMs)

		// Отправляем вопрос всем участникам
		// Включаем оба языка — Frontend выбирает нужный по настройке пользователя
		questionEvent := map[string]interface{}{
			"question_id":      question.ID,
			"quiz_id":          quizState.Quiz.ID,
			"number":           i,
			"text":             question.Text,
			"text_kk":          question.TextKK, // Казахский текст (может быть пустым)
			"options":          helper.ConvertOptionsToObjects(question.Options),
			"options_kk":       helper.ConvertOptionsToObjects(question.OptionsKK), // Казахские варианты
			"time_limit":       question.TimeLimitSec,
			"total_questions":  totalQuestions,
			"start_time":       sendTimeMs,
			"server_timestamp": sendTimeMs,
		}

		// Отправка с повторными попытками при ошибке
		if err := qm.sendEventWithRetry(quizCtx, quizState.Quiz.ID, "quiz:question", questionEvent); err != nil {
			log.Printf("[QuestionManager] WARNING: Не удалось отправить вопрос #%d для викторины #%d: %v. Продолжаем викторину.",
				question.ID, quizState.Quiz.ID, err)
		}

		// Сохраняем время начала вопроса для подсчета времени ответа
		questionStartKey := fmt.Sprintf("question:%d:start_time", question.ID)
		if err := qm.deps.CacheRepo.Set(questionStartKey, fmt.Sprintf("%d", sendTimeMs), time.Hour); err != nil {
			log.Printf("[QuestionManager] WARNING: Не удалось сохранить время начала вопроса #%d в Redis: %v", question.ID, err)
		}

		// Запускаем таймер для вопроса
		timeLimit := time.Duration(question.TimeLimitSec) * time.Second
		endTime := time.Now().Add(timeLimit)
		timerWg.Add(1)
		go qm.runQuestionTimer(quizCtx, quizState.Quiz, question, i, endTime, &timerWg)

		// Ждем завершения времени на вопрос
		log.Printf("[QuestionManager][DEBUG] Викторина #%d, Вопрос #%d: Ожидание завершения таймера (%v)...", quizState.Quiz.ID, question.ID, timeLimit)
		select {
		case <-time.After(timeLimit):
			log.Printf("[QuestionManager] Викторина #%d, Вопрос #%d (%d из %d): Время истекло. Начинаем проверку не ответивших.",
				quizState.Quiz.ID, question.ID, i, totalQuestions)
		case <-quizCtx.Done():
			log.Printf("[QuestionManager] Процесс викторины #%d был прерван на вопросе #%d",
				quizState.Quiz.ID, i)
			return nil
		}

		// === ЛОГИКА ВЫБЫВАНИЯ ПРИ ОТСУТСТВИИ ОТВЕТА ===
		qm.processNoAnswerEliminations(quizCtx, quizState, question, i)

		// === ОТПРАВКА REALTIME СТАТИСТИКИ АДАПТИВНОЙ СИСТЕМЫ ===
		remainingPlayers := qm.deps.WSManager.GetSubscriberCount(quizState.Quiz.ID)
		qm.sendAdaptiveQuestionStats(quizCtx, quizState.Quiz.ID, i, question.Difficulty, remainingPlayers)

		// Добавляем задержку перед отправкой правильного ответа
		time.Sleep(time.Duration(qm.config.AnswerRevealDelayMs) * time.Millisecond)

		// Отправляем правильный ответ всем оставшимся участникам
		log.Printf("[QuestionManager][DEBUG] Викторина #%d, Вопрос #%d: Отправка события quiz:answer_reveal...", quizState.Quiz.ID, question.ID)
		revealEvent := map[string]interface{}{
			"question_id":    question.ID,
			"correct_option": question.CorrectOption,
		}
		if err := qm.sendEventWithRetry(quizCtx, quizState.Quiz.ID, "quiz:answer_reveal", revealEvent); err != nil {
			log.Printf("[QuestionManager] WARNING: Не удалось отправить ответ на вопрос #%d: %v", question.ID, err)
		}

		// === РЕКЛАМНЫЙ БЛОК ===
		qm.processAdBreak(quizCtx, quizState, i, totalQuestions)

		// Пауза между вопросами
		if i < totalQuestions {
			pauseTime := time.Duration(qm.config.InterQuestionDelayMs) * time.Millisecond
			log.Printf("[QuestionManager] Пауза %v между вопросами %d и %d", pauseTime, i, i+1)
			select {
			case <-time.After(pauseTime):
				// Продолжаем
			case <-quizCtx.Done():
				return nil
			}
		}
	}

	// === FIX BUG-2: Фиксируем ФАКТИЧЕСКОЕ количество заданных вопросов ===
	// Обновляем question_count ДО пометки вопросов. Даже если 0 (early break).
	actualAsked := len(usedQuestionIDs)
	if actualAsked != totalQuestions {
		log.Printf("[QuestionManager] Викторина #%d: фактически задано %d/%d вопросов. Обновляем question_count.",
			quizState.Quiz.ID, actualAsked, totalQuestions)
		if err := qm.deps.QuizRepo.UpdateQuestionCount(quizState.Quiz.ID, actualAsked); err != nil {
			log.Printf("[QuestionManager] WARNING: Не удалось обновить question_count=%d: %v", actualAsked, err)
		}
	}

	// === ПОМЕЧАЕМ ВОПРОСЫ КАК ИСПОЛЬЗОВАННЫЕ ===
	if len(usedQuestionIDs) > 0 {
		if err := qm.deps.QuestionRepo.MarkAsUsed(usedQuestionIDs); err != nil {
			log.Printf("[QuestionManager] WARNING: Не удалось пометить вопросы как использованные: %v", err)
		} else {
			log.Printf("[QuestionManager] Помечено %d вопросов как использованные", len(usedQuestionIDs))
		}
	}

	// Дожидаемся завершения всех таймеров перед завершением викторины
	timerWg.Wait()

	// Очищаем текущий вопрос
	quizState.ClearCurrentQuestion()

	// Отправляем сигнал о завершении всех вопросов
	select {
	case qm.questionDoneCh <- struct{}{}:
		log.Printf("[QuestionManager] Сигнал о завершении вопросов для викторины #%d отправлен", quizState.Quiz.ID)
	default:
		log.Printf("[QuestionManager] Сигнал о завершении вопросов уже был отправлен для викторины #%d", quizState.Quiz.ID)
	}

	return nil
}

// countActiveParticipants возвращает количество участников, которые еще не выбыли.
func (qm *QuestionManager) countActiveParticipants(quizID uint) (int, error) {
	if qm.deps.CacheRepo == nil {
		return 0, nil
	}

	participantsKey := fmt.Sprintf("quiz:%d:participants", quizID)
	participantStrings, err := qm.deps.CacheRepo.SMembers(participantsKey)
	if err != nil {
		return 0, err
	}
	if len(participantStrings) == 0 {
		return 0, nil
	}

	eliminationKeys := make([]string, 0, len(participantStrings))
	for _, userIDStr := range participantStrings {
		userID, parseErr := strconv.ParseUint(userIDStr, 10, 64)
		if parseErr != nil {
			continue
		}
		eliminationKeys = append(eliminationKeys, fmt.Sprintf("quiz:%d:eliminated:%d", quizID, userID))
	}
	if len(eliminationKeys) == 0 {
		return 0, nil
	}

	eliminatedMap, err := qm.deps.CacheRepo.ExistsBatch(eliminationKeys)
	if err != nil {
		// Без batch fallback на индивидуальные проверки.
		eliminatedMap = make(map[string]bool, len(eliminationKeys))
		for _, key := range eliminationKeys {
			exists, existsErr := qm.deps.CacheRepo.Exists(key)
			if existsErr != nil {
				// Консервативно считаем участника активным, чтобы не завершить игру ошибочно.
				eliminatedMap[key] = false
				continue
			}
			eliminatedMap[key] = exists
		}
	}

	activeCount := 0
	for _, key := range eliminationKeys {
		if !eliminatedMap[key] {
			activeCount++
		}
	}
	return activeCount, nil
}

// processNoAnswerEliminations обрабатывает выбывание игроков, не ответивших на вопрос
func (qm *QuestionManager) processNoAnswerEliminations(ctx context.Context, quizState *ActiveQuizState, question *entity.Question, questionNumber int) {
	participantsKey := fmt.Sprintf("quiz:%d:participants", quizState.Quiz.ID)
	log.Printf("[QuestionManager][DEBUG] Викторина #%d, Вопрос #%d: Получение участников из Redis Set %s...",
		quizState.Quiz.ID, question.ID, participantsKey)

	participantStrings, err := qm.deps.CacheRepo.SMembers(participantsKey)
	if err != nil {
		log.Printf("[QuestionManager] WARNING: Не удалось получить список участников из Redis для викторины #%d: %v",
			quizState.Quiz.ID, err)
		return
	}

	log.Printf("[QuestionManager][DEBUG] Викторина #%d, Вопрос #%d: SMembers вернул %d участников",
		quizState.Quiz.ID, question.ID, len(participantStrings))

	// === FIX BUG-9: Пакетная проверка ответов и выбываний ===
	// Собираем все ключи для batch-проверки
	type participantInfo struct {
		userID         uint64
		answerKey      string
		eliminationKey string
	}
	participants := make([]participantInfo, 0, len(participantStrings))
	answerKeys := make([]string, 0, len(participantStrings))
	eliminationKeys := make([]string, 0, len(participantStrings))

	for _, userIDStr := range participantStrings {
		userID, parseErr := strconv.ParseUint(userIDStr, 10, 64)
		if parseErr != nil {
			log.Printf("[QuestionManager][WARN] Не удалось распарсить userID '%s': %v", userIDStr, parseErr)
			continue
		}
		p := participantInfo{
			userID:         userID,
			answerKey:      fmt.Sprintf("quiz:%d:user:%d:question:%d", quizState.Quiz.ID, userID, question.ID),
			eliminationKey: fmt.Sprintf("quiz:%d:eliminated:%d", quizState.Quiz.ID, userID),
		}
		participants = append(participants, p)
		answerKeys = append(answerKeys, p.answerKey)
		eliminationKeys = append(eliminationKeys, p.eliminationKey)
	}

	// Batch 1: проверяем все ключи ответов одним Pipeline запросом
	answeredMap, err := qm.deps.CacheRepo.ExistsBatch(answerKeys)
	if err != nil {
		log.Printf("[QuestionManager][WARN] ExistsBatch(answers) failed, fallback to individual Exists: %v", err)
		answeredMap = make(map[string]bool, len(answerKeys))
		for _, key := range answerKeys {
			exists, fallbackErr := qm.deps.CacheRepo.Exists(key)
			if fallbackErr != nil {
				// Ошибка → презумпция невиновности: считаем что ответил, НЕ выбиваем
				log.Printf("[QuestionManager][WARN] Exists(%s) fallback error: %v. Skipping user.", key, fallbackErr)
				answeredMap[key] = true
				continue
			}
			answeredMap[key] = exists
		}
	}

	// Batch 2: проверяем все ключи выбываний одним Pipeline запросом
	eliminatedMap, err := qm.deps.CacheRepo.ExistsBatch(eliminationKeys)
	if err != nil {
		log.Printf("[QuestionManager][WARN] ExistsBatch(eliminations) failed, fallback: %v", err)
		eliminatedMap = make(map[string]bool, len(eliminationKeys))
		for _, key := range eliminationKeys {
			exists, fallbackErr := qm.deps.CacheRepo.Exists(key)
			if fallbackErr != nil {
				// Ошибка → считаем уже выбывшим, НЕ трогаем
				log.Printf("[QuestionManager][WARN] Exists(%s) fallback error: %v. Skipping.", key, fallbackErr)
				eliminatedMap[key] = true
				continue
			}
			eliminatedMap[key] = exists
		}
	}

	// Обрабатываем результаты
	for _, p := range participants {
		answered := answeredMap[p.answerKey]
		if answered {
			continue
		}

		alreadyEliminated := eliminatedMap[p.eliminationKey]
		if alreadyEliminated {
			log.Printf("[QuestionManager][DEBUG] Викторина #%d, Вопрос #%d: User #%d не ответил, но УЖЕ был выбывший.",
				quizState.Quiz.ID, question.ID, p.userID)
			continue
		}

		eliminationReason := "no_answer_timeout"
		log.Printf("[QuestionManager] Пользователь #%d выбывает из викторины #%d. Причина: %s (Вопрос #%d).",
			p.userID, quizState.Quiz.ID, eliminationReason, question.ID)

		// Сохраняем UserAnswer в БД для статистики
		userAnswer := &entity.UserAnswer{
			UserID:            uint(p.userID),
			QuizID:            quizState.Quiz.ID,
			QuestionID:        question.ID,
			SelectedOption:    -1,
			IsCorrect:         false,
			ResponseTimeMs:    0,
			Score:             0,
			IsEliminated:      true,
			EliminationReason: eliminationReason,
		}
		if err := qm.deps.ResultRepo.SaveUserAnswer(userAnswer); err != nil {
			log.Printf("[QuestionManager] WARNING: Не удалось сохранить user_answer для таймаута User #%d: %v", p.userID, err)
		}

		// Устанавливаем статус выбывшего в Redis
		if errSet := qm.deps.CacheRepo.Set(p.eliminationKey, "1", 24*time.Hour); errSet != nil {
			log.Printf("[QuestionManager] WARNING: Не удалось установить ключ выбывания %s в Redis: %v", p.eliminationKey, errSet)
		}

		// Отправляем уведомление о выбывании
		qm.sendEliminationNotification(uint(p.userID), quizState.Quiz.ID, eliminationReason)

		// === ЗАПИСЫВАЕМ СТАТИСТИКУ ДЛЯ АДАПТАЦИИ ===
		qm.adaptiveSelector.RecordQuestionResult(quizState.Quiz.ID, questionNumber, false)
	}
}

// processAdBreak обрабатывает показ рекламы между вопросами
func (qm *QuestionManager) processAdBreak(ctx context.Context, quizState *ActiveQuizState, questionNumber, totalQuestions int) {
	if qm.deps.QuizAdSlotRepo == nil {
		return
	}

	slot, slotErr := qm.deps.QuizAdSlotRepo.GetByQuizAndQuestionAfter(quizState.Quiz.ID, questionNumber)
	if slotErr != nil {
		log.Printf("[QuestionManager] WARNING: Ошибка получения рекламного слота для вопроса %d: %v", questionNumber, slotErr)
		return
	}

	if slot == nil || !slot.IsActive || slot.AdAsset == nil {
		return
	}

	log.Printf("[QuestionManager] Показ рекламы #%d после вопроса %d (длительность: %d сек)",
		slot.AdAsset.ID, questionNumber, slot.AdAsset.DurationSec)

	// Отправляем событие начала рекламы
	adEvent := map[string]interface{}{
		"quiz_id":      quizState.Quiz.ID,
		"media_type":   slot.AdAsset.MediaType,
		"media_url":    slot.AdAsset.URL,
		"duration_sec": slot.AdAsset.DurationSec,
	}
	if err := qm.sendEventWithRetry(ctx, quizState.Quiz.ID, "quiz:ad_break", adEvent); err != nil {
		log.Printf("[QuestionManager] WARNING: Не удалось отправить quiz:ad_break: %v", err)
	}

	// Ждём заданное время показа рекламы
	adDuration := time.Duration(slot.AdAsset.DurationSec) * time.Second
	select {
	case <-time.After(adDuration):
		log.Printf("[QuestionManager] Реклама завершена, продолжаем викторину")
	case <-ctx.Done():
		return
	}

	// Отправляем событие окончания рекламы
	adEndEvent := map[string]interface{}{
		"quiz_id": quizState.Quiz.ID,
	}
	if err := qm.sendEventWithRetry(ctx, quizState.Quiz.ID, "quiz:ad_break_end", adEndEvent); err != nil {
		log.Printf("[QuestionManager] WARNING: Не удалось отправить quiz:ad_break_end: %v", err)
	}
}

// Новый метод для отправки уведомления о выбывании из QuestionManager
func (qm *QuestionManager) sendEliminationNotification(userID uint, quizID uint, reason string) {
	eliminationEvent := map[string]interface{}{
		"quiz_id": quizID,
		"user_id": userID,
		"reason":  reason,
		"message": "Вы выбыли из викторины, так как не ответили вовремя.",
	}
	// Убираем неиспользуемый fullEvent
	// Используем WSManager напрямую
	// Исправленный вызов: передаем тип и данные отдельно
	eventType := "quiz:elimination"
	if err := qm.deps.WSManager.SendEventToUser(fmt.Sprintf("%d", userID), eventType, eliminationEvent); err != nil {
		log.Printf("[QuestionManager] Ошибка при отправке уведомления о выбывании (no_answer) пользователю #%d: %v", userID, err)
	}
}

// runQuestionTimer запускает таймер для вопроса и отправляет обновления
func (qm *QuestionManager) runQuestionTimer(
	ctx context.Context,
	quiz *entity.Quiz,
	question *entity.Question,
	questionNumber int,
	endTime time.Time,
	wg *sync.WaitGroup,
) {
	defer wg.Done()

	// Создаем отдельный контекст для этого таймера
	timerCtx, timerCancel := context.WithCancel(ctx)
	defer timerCancel()

	// Отправляем обновления таймера каждую секунду
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			remaining := int(time.Until(endTime).Seconds())
			if remaining <= 0 {
				// Время вышло
				log.Printf("[QuestionManager] Время на вопрос #%d (%d из %d) викторины #%d истекло",
					question.ID, questionNumber, len(quiz.Questions), quiz.ID)
				return
			}

			// Отправляем обновление таймера
			timerData := map[string]interface{}{
				"question_id":       question.ID,
				"remaining_seconds": remaining,
				"server_timestamp":  time.Now().UnixNano() / int64(time.Millisecond),
			}
			timerFullEvent := map[string]interface{}{
				"type": "quiz:timer",
				"data": timerData,
			}

			// Просто отправляем событие каждую секунду
			if err := qm.deps.WSManager.BroadcastEventToQuiz(quiz.ID, timerFullEvent); err != nil {
				log.Printf("[QuestionManager] ОШИБКА при отправке таймера для вопроса #%d: %v", question.ID, err)
			} else {
				log.Printf("[QuestionManager] Таймер вопроса #%d (%d из %d): осталось %d секунд",
					question.ID, questionNumber, len(quiz.Questions), remaining)
			}

		case <-timerCtx.Done():
			log.Printf("[QuestionManager] Таймер для вопроса #%d отменен", question.ID)
			return
		}
	}
}

// sendAdaptiveQuestionStats отправляет realtime статистику адаптивной системы для мониторинга
func (qm *QuestionManager) sendAdaptiveQuestionStats(ctx context.Context, quizID uint, questionNumber int, difficulty int, remainingPlayers int) {
	// Получаем данные из Redis
	totalKey := fmt.Sprintf("quiz:%d:q%d:total", quizID, questionNumber)
	passedKey := fmt.Sprintf("quiz:%d:q%d:passed", quizID, questionNumber)

	totalStr, _ := qm.deps.CacheRepo.Get(totalKey)
	passedStr, _ := qm.deps.CacheRepo.Get(passedKey)

	total, _ := strconv.Atoi(totalStr)
	passed, _ := strconv.Atoi(passedStr)

	// Вычисляем pass rate
	var actualPassRate float64
	if total > 0 {
		actualPassRate = float64(passed) / float64(total)
	}

	// Получаем целевой pass rate из конфига
	targetPassRate := qm.adaptiveSelector.config.GetTargetPassRate(questionNumber)

	// Формируем событие
	statsEvent := map[string]interface{}{
		"quiz_id":           quizID,
		"question_number":   questionNumber,
		"difficulty_used":   difficulty,
		"target_pass_rate":  targetPassRate,
		"actual_pass_rate":  actualPassRate,
		"total_answers":     total,
		"passed_count":      passed,
		"remaining_players": remainingPlayers,
		"timestamp":         time.Now().Format(time.RFC3339),
	}

	// Отправляем через WebSocket
	if err := qm.sendEventWithRetry(ctx, quizID, "adaptive:question_stats", statsEvent); err != nil {
		log.Printf("[QuestionManager] WARNING: Не удалось отправить adaptive:question_stats для Q%d: %v", questionNumber, err)
	} else {
		log.Printf("[QuestionManager] adaptive:question_stats отправлен для Q%d: pass_rate=%.2f, target=%.2f",
			questionNumber, actualPassRate, targetPassRate)
	}
}

// --- Вспомогательная функция для отправки событий с ретраями ---

// sendEventWithRetry пытается отправить событие через WSManager с заданным количеством попыток.
// Возвращает ошибку, если все попытки неудачны.
func (qm *QuestionManager) sendEventWithRetry(ctx context.Context, quizID uint, eventType string, data map[string]interface{}) error {
	var sendErr error

	// Создаем полное событие для передачи
	fullEvent := map[string]interface{}{
		"type": eventType,
		"data": data,
	}

	for attempts := 0; attempts < qm.config.MaxRetries; attempts++ {
		// Проверяем контекст перед каждой попыткой
		select {
		case <-ctx.Done():
			log.Printf("[QuestionManager] Отправка события %s для викторины #%d отменена контекстом (попытка %d)", eventType, quizID, attempts+1)
			return ctx.Err()
		default:
		}

		sendErr = qm.deps.WSManager.BroadcastEventToQuiz(quizID, fullEvent)
		if sendErr == nil {
			log.Printf("[QuestionManager] Событие %s для викторины #%d успешно отправлено с %d попытки",
				eventType, quizID, attempts+1)
			return nil // Успешно отправлено
		}
		log.Printf("[QuestionManager] ОШИБКА при отправке события %s для викторины #%d (попытка %d): %v",
			eventType, quizID, attempts+1, sendErr)

		// Ожидание перед следующей попыткой с учетом отмены контекста
		select {
		case <-time.After(qm.config.RetryInterval):
			// Продолжаем следующую попытку
		case <-ctx.Done():
			log.Printf("[QuestionManager] Ожидание перед ретраем отправки события %s для викторины #%d отменено контекстом", eventType, quizID)
			return ctx.Err()
		}
	}
	// Если все попытки не удались
	return fmt.Errorf("не удалось отправить событие %s для викторины #%d после %d попыток: %w",
		eventType, quizID, qm.config.MaxRetries, sendErr)
}
