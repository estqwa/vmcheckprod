package service

import (
	"context"
	"fmt"
	"log"
	"time"

	"gorm.io/gorm"

	"github.com/yourusername/trivia-api/internal/domain/entity"
	"github.com/yourusername/trivia-api/internal/domain/repository"
	"github.com/yourusername/trivia-api/internal/service/quizmanager"
	"github.com/yourusername/trivia-api/internal/websocket"
)

// ResultService предоставляет методы для работы с результатами
type ResultService struct {
	resultRepo   repository.ResultRepository
	userRepo     repository.UserRepository
	quizRepo     repository.QuizRepository
	questionRepo repository.QuestionRepository
	cacheRepo    repository.CacheRepository
	db           *gorm.DB
	wsManager    *websocket.Manager
	config       *quizmanager.Config
}

// NewResultService создает новый сервис результатов
func NewResultService(
	resultRepo repository.ResultRepository,
	userRepo repository.UserRepository,
	quizRepo repository.QuizRepository,
	questionRepo repository.QuestionRepository,
	cacheRepo repository.CacheRepository,
	db *gorm.DB,
	wsManager *websocket.Manager,
	config *quizmanager.Config,
) *ResultService {
	return &ResultService{
		resultRepo:   resultRepo,
		userRepo:     userRepo,
		quizRepo:     quizRepo,
		questionRepo: questionRepo,
		cacheRepo:    cacheRepo,
		db:           db,
		wsManager:    wsManager,
		config:       config,
	}
}

// CalculateQuizResult подсчитывает итоговый результат пользователя в викторине
func (s *ResultService) CalculateQuizResult(userID, quizID uint) (*entity.Result, error) {
	// Получаем информацию о пользователе
	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return nil, err
	}

	// Получаем информацию о викторине
	quiz, err := s.quizRepo.GetWithQuestions(quizID)
	if err != nil {
		return nil, err
	}

	// Получаем все ответы пользователя
	userAnswers, err := s.resultRepo.GetUserAnswers(userID, quizID)
	if err != nil {
		return nil, err
	}

	// Проверяем статус выбывания из Redis
	eliminationKey := fmt.Sprintf("quiz:%d:eliminated:%d", quizID, userID)
	isEliminated, _ := s.cacheRepo.Exists(eliminationKey)

	// Подсчитываем общий счет и количество правильных ответов
	// Также определяем детали выбытия (на каком вопросе и почему)
	totalScore := 0
	correctAnswers := 0
	var eliminatedOnQuestion *int
	var eliminationReason *string
	for i, answer := range userAnswers {
		totalScore += answer.Score
		if answer.IsCorrect {
			correctAnswers++
		}
		// Ищем первый ответ с выбытием
		if answer.IsEliminated && eliminatedOnQuestion == nil {
			questionNum := i + 1 // 1-indexed
			eliminatedOnQuestion = &questionNum
			if answer.EliminationReason != "" {
				reason := answer.EliminationReason
				eliminationReason = &reason
			}
		}
	}

	// Создаем запись о результате
	result := &entity.Result{
		UserID:               userID,
		QuizID:               quizID,
		Username:             user.Username,
		ProfilePicture:       user.ProfilePicture,
		Score:                totalScore,
		CorrectAnswers:       correctAnswers,
		TotalQuestions:       len(quiz.Questions),
		IsEliminated:         isEliminated,
		EliminatedOnQuestion: eliminatedOnQuestion,
		EliminationReason:    eliminationReason,
		CompletedAt:          time.Now(),
	}

	// --- Начало транзакции ---
	tx := s.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
			log.Printf("PANIC recovered during CalculateQuizResult transaction: %v", r)
		}
	}()

	if tx.Error != nil {
		log.Printf("Error starting transaction in CalculateQuizResult: %v", tx.Error)
		return nil, tx.Error
	}

	// Сохраняем результат в БД (внутри транзакции)
	if err := tx.Create(result).Error; err != nil {
		tx.Rollback()
		log.Printf("Error saving result in transaction: %v", err)
		return nil, fmt.Errorf("failed to save result: %w", err)
	}

	// Обновляем общий счет пользователя (внутри транзакции)
	if err := tx.Model(&entity.User{}).Where("id = ?", userID).Update("total_score", gorm.Expr("total_score + ?", totalScore)).Error; err != nil {
		tx.Rollback()
		log.Printf("Error updating user score in transaction: %v", err)
		return nil, fmt.Errorf("failed to update user score: %w", err)
	}

	// Обновляем высший счет, если необходимо (внутри транзакции)
	if err := tx.Model(&entity.User{}).Where("id = ? AND highest_score < ?", userID, totalScore).Update("highest_score", totalScore).Error; err != nil {
		// Не откатываем транзакцию из-за этой ошибки, она не критична
		log.Printf("Warning: Error updating user highest score: %v", err)
	}

	// Увеличиваем счетчик сыгранных игр (внутри транзакции)
	if err := tx.Model(&entity.User{}).Where("id = ?", userID).UpdateColumn("games_played", gorm.Expr("games_played + ?", 1)).Error; err != nil {
		tx.Rollback()
		log.Printf("Error incrementing games played in transaction: %v", err)
		return nil, fmt.Errorf("failed to increment games played: %w", err)
	}

	// --- Коммит транзакции ---
	if err := tx.Commit().Error; err != nil {
		log.Printf("Error committing transaction in CalculateQuizResult: %v", err)
		return nil, err
	}

	log.Printf("[ResultService] Успешно рассчитан и сохранен результат для пользователя #%d в викторине #%d", userID, quizID)
	return result, nil
}

// GetQuizResults возвращает пагинированный список результатов для викторины
// ВНИМАНИЕ: Эта функция больше НЕ вызывает CalculateRanks напрямую.
// CalculateRanks теперь вызывается в DetermineWinnersAndAllocatePrizes.
func (s *ResultService) GetQuizResults(quizID uint, page, pageSize int) ([]entity.Result, int64, error) {
	// Валидация параметров пагинации (опционально, но рекомендуется)
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 10 // Значение по умолчанию или из конфига
	} else if pageSize > 100 {
		pageSize = 100 // Максимальный лимит
	}

	offset := (page - 1) * pageSize

	// Вызываем обновленный метод репозитория
	results, total, err := s.resultRepo.GetQuizResults(quizID, pageSize, offset)
	if err != nil {
		// Логируем ошибку репозитория
		log.Printf("[ResultService] Ошибка при получении результатов викторины %d (page %d, size %d): %v", quizID, page, pageSize, err)
		return nil, 0, err // Просто пробрасываем ошибку выше
	}

	return results, total, nil
}

// GetUserResult возвращает результат пользователя для конкретной викторины
func (s *ResultService) GetUserResult(userID, quizID uint) (*entity.Result, error) {
	return s.resultRepo.GetUserResult(userID, quizID)
}

// GetUserResults возвращает все результаты пользователя с пагинацией
func (s *ResultService) GetUserResults(userID uint, page, pageSize int) ([]entity.Result, int64, error) {
	offset := (page - 1) * pageSize
	return s.resultRepo.GetUserResults(userID, pageSize, offset)
}

// GetQuizResultsAll возвращает ВСЕ результаты викторины без пагинации.
// Используется для экспорта, где нужна полная выборка.
func (s *ResultService) GetQuizResultsAll(quizID uint) ([]entity.Result, error) {
	return s.resultRepo.GetAllQuizResults(quizID)
}

// DetermineWinnersAndAllocatePrizes финализирует результаты викторины.
//  1. В ТРАНЗАКЦИИ:
//     а. Вызывает ResultRepo.CalculateRanks для расчета и сохранения рангов.
//     б. Вызывает ResultRepo.FindAndUpdateWinners для определения победителей, расчета призов и обновления их статуса в БД.
//     в. Обновляет статистику (wins_count, total_prize_won) в таблице users для победителей.
//  2. Отправляет WebSocket-сообщение о доступности результатов.
func (s *ResultService) DetermineWinnersAndAllocatePrizes(ctx context.Context, quizID uint) error {
	log.Printf("[ResultService] Финализация результатов для викторины #%d", quizID)

	// FIX: Используем GetWithQuestions для получения реального количества вопросов.
	// Поле quiz.QuestionCount может быть не синхронизировано с реальным количеством
	// вопросов в таблице questions (например, после автозаполнения).
	quiz, err := s.quizRepo.GetWithQuestions(quizID)
	if err != nil {
		log.Printf("[ResultService] Ошибка при получении викторины #%d с вопросами: %v", quizID, err)
		return fmt.Errorf("ошибка получения викторины: %w", err)
	}

	// Используем len(quiz.Questions) — это реальное количество вопросов в БД
	totalQuestions := len(quiz.Questions)
	if totalQuestions <= 0 {
		log.Printf("[ResultService] Викторина #%d не имеет вопросов, пропуск определения победителей и обновления рангов.", quizID)
		s.sendResultsAvailableNotification(quizID) // Уведомляем, что результаты (без победителей) готовы
		return nil
	}
	log.Printf("[ResultService] Викторина #%d: определение победителей на основе %d вопросов", quizID, totalQuestions)

	// Используем призовой фонд конкретной викторины, fallback на дефолт из конфига
	totalPrizeFund := quiz.PrizeFund
	if totalPrizeFund <= 0 {
		totalPrizeFund = s.config.TotalPrizeFund
	}
	var winnerIDs []uint
	var prizePerWinner int

	// === Начало транзакции ===
	tx := s.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
			log.Printf("PANIC recovered during DetermineWinnersAndAllocatePrizes transaction for quiz %d: %v", quizID, r)
		}
	}()
	if tx.Error != nil {
		log.Printf("[ResultService] Ошибка старта транзакции для викторины #%d: %v", quizID, tx.Error)
		return tx.Error
	}

	// 1а. Рассчитываем и сохраняем ранги ВНУТРИ транзакции
	if err = s.resultRepo.CalculateRanks(tx, quizID); err != nil {
		log.Printf("[ResultService] Ошибка при расчете рангов для викторины #%d в транзакции: %v", quizID, err)
		tx.Rollback()
		return fmt.Errorf("ошибка расчета рангов: %w", err)
	}
	log.Printf("[ResultService] Ранги для викторины #%d успешно рассчитаны и сохранены в транзакции.", quizID)

	// 1б. Определяем победителей, рассчитываем призы и обновляем статус в БД ВНУТРИ транзакции
	winnerIDs, prizePerWinner, err = s.resultRepo.FindAndUpdateWinners(tx, quizID, totalQuestions, totalPrizeFund)
	if err != nil {
		log.Printf("[ResultService] Ошибка при определении/обновлении победителей для викторины #%d в транзакции: %v", quizID, err)
		tx.Rollback()
		return fmt.Errorf("ошибка определения победителей: %w", err)
	}
	winnersCount := len(winnerIDs)
	log.Printf("[ResultService] Найдено и обновлено %d победителей для викторины #%d в транзакции. Приз на победителя: %d.", winnersCount, quizID, prizePerWinner)

	// 1в. Обновляем статистику пользователей-победителей ВНУТРИ транзакции (если есть победители)
	if winnersCount > 0 && prizePerWinner >= 0 { // Добавим проверку на неотрицательный приз
		if err = tx.Model(&entity.User{}).Where("id IN ?", winnerIDs).Updates(map[string]interface{}{
			"wins_count":      gorm.Expr("wins_count + ?", 1),
			"total_prize_won": gorm.Expr("total_prize_won + ?", prizePerWinner),
		}).Error; err != nil {
			log.Printf("[ResultService] Ошибка при обновлении статистики победителей (wins_count, total_prize_won) для викторины #%d в транзакции: %v", quizID, err)
			tx.Rollback()
			return fmt.Errorf("ошибка обновления статистики победителей: %w", err)
		}
		log.Printf("[ResultService] Статистика для %d победителей викторины #%d успешно обновлена в транзакции.", winnersCount, quizID)
	}

	// === Коммит транзакции ===
	if err = tx.Commit().Error; err != nil {
		log.Printf("[ResultService] Ошибка коммита транзакции для викторины #%d: %v", quizID, err)
		return fmt.Errorf("ошибка сохранения результатов: %w", err)
	}

	// 2. Отправляем WebSocket-сообщение о доступности результатов (ПОСЛЕ коммита)
	s.sendResultsAvailableNotification(quizID)

	log.Printf("[ResultService] Финализация результатов для викторины #%d успешно завершена.", quizID)
	return nil
}

// sendResultsAvailableNotification - вспомогательная функция для отправки WS уведомления
func (s *ResultService) sendResultsAvailableNotification(quizID uint) {
	if s.wsManager != nil {
		resultsAvailableEvent := map[string]interface{}{
			"quiz_id": quizID,
		}
		fullEvent := map[string]interface{}{ // Используем стандартную структуру события
			"type": "quiz:results_available",
			"data": resultsAvailableEvent,
		}
		if err := s.wsManager.BroadcastEventToQuiz(quizID, fullEvent); err != nil {
			// Логируем ошибку, но не прерываем выполнение, т.к. основная работа сделана
			log.Printf("[ResultService] Ошибка при отправке события quiz:results_available для викторины #%d: %v", quizID, err)
		} else {
			log.Printf("[ResultService] Событие quiz:results_available для викторины #%d успешно отправлено", quizID)
		}
	} else {
		log.Println("[ResultService] Менеджер WebSocket не инициализирован, уведомление quiz:results_available не отправлено.")
	}
}

// GetQuizWinners возвращает список победителей викторины
func (s *ResultService) GetQuizWinners(quizID uint) ([]entity.Result, error) {
	return s.resultRepo.GetQuizWinners(quizID)
}

// QuizStatistics представляет статистику викторины
type QuizStatistics struct {
	QuizID             uint                  `json:"quiz_id"`
	TotalParticipants  int                   `json:"total_participants"`
	TotalWinners       int                   `json:"total_winners"`
	TotalEliminated    int                   `json:"total_eliminated"`
	AvgResponseTimeMs  float64               `json:"avg_response_time_ms"`
	AvgCorrectAnswers  float64               `json:"avg_correct_answers"`
	EliminationsByQ    []QuestionElimination `json:"eliminations_by_question"`
	EliminationReasons EliminationReasons    `json:"elimination_reasons"`
}

// QuestionElimination представляет статистику выбытий для вопроса
type QuestionElimination struct {
	QuestionNumber  int     `json:"question_number"`
	QuestionID      uint    `json:"question_id"`
	EliminatedCount int     `json:"eliminated_count"`
	ByTimeout       int     `json:"by_timeout"`
	ByWrongAnswer   int     `json:"by_wrong_answer"`
	AvgResponseMs   float64 `json:"avg_response_ms"`
}

// EliminationReasons представляет суммарные причины выбытия
type EliminationReasons struct {
	Timeout      int `json:"timeout"`
	WrongAnswer  int `json:"wrong_answer"`
	Disconnected int `json:"disconnected"`
	Other        int `json:"other"`
}

// CalculateQuizStatistics вычисляет расширенную статистику для викторины
func (s *ResultService) CalculateQuizStatistics(quizID uint) (*QuizStatistics, error) {
	// Проверяем существование викторины
	quiz, err := s.quizRepo.GetByID(quizID)
	if err != nil {
		return nil, err
	}

	stats := &QuizStatistics{
		QuizID: quizID,
	}

	// 1. Получаем общее количество участников и победителей из results
	var participantStats struct {
		Total      int
		Winners    int
		Eliminated int
	}
	s.db.Table("results").
		Select(`
			COUNT(*) as total,
			COUNT(*) FILTER (WHERE is_winner = true) as winners,
			COUNT(*) FILTER (WHERE is_eliminated = true) as eliminated
		`).
		Where("quiz_id = ?", quizID).
		Scan(&participantStats)

	stats.TotalParticipants = participantStats.Total
	stats.TotalWinners = participantStats.Winners
	stats.TotalEliminated = participantStats.Eliminated

	// 2. Среднее время ответа и правильных ответов
	var avgStats struct {
		AvgRespTime float64
		AvgCorrect  float64
	}
	s.db.Table("results").
		Select(`
			AVG(NULLIF(correct_answers, 0)) as avg_correct
		`).
		Where("quiz_id = ?", quizID).
		Scan(&avgStats)
	stats.AvgCorrectAnswers = avgStats.AvgCorrect

	// Среднее время из user_answers
	s.db.Table("user_answers").
		Select("AVG(response_time_ms)").
		Where("quiz_id = ? AND response_time_ms > 0", quizID).
		Scan(&stats.AvgResponseTimeMs)

	// 3. Выбытия по вопросам с GROUP BY
	type elimByQ struct {
		QuestionID      uint
		EliminatedCount int
		ByTimeout       int
		ByWrongAnswer   int
		AvgRespMs       float64
	}
	var eliminations []elimByQ

	s.db.Table("user_answers").
		Select(`
			question_id,
			COUNT(*) FILTER (WHERE is_eliminated = true) as eliminated_count,
			COUNT(*) FILTER (WHERE elimination_reason IN ('time_exceeded', 'no_answer_timeout')) as by_timeout,
			COUNT(*) FILTER (WHERE elimination_reason = 'incorrect_answer') as by_wrong_answer,
			AVG(response_time_ms) FILTER (WHERE response_time_ms > 0) as avg_resp_ms
		`).
		Where("quiz_id = ?", quizID).
		Group("question_id").
		Order("question_id").
		Scan(&eliminations)

	// Получаем вопросы для маппинга номеров
	questions, _ := s.questionRepo.GetByQuizID(quiz.ID)
	questionOrder := make(map[uint]int)
	for i, q := range questions {
		questionOrder[q.ID] = i + 1
	}

	stats.EliminationsByQ = make([]QuestionElimination, 0, len(eliminations))
	for _, e := range eliminations {
		qNum := questionOrder[e.QuestionID]
		if qNum == 0 {
			qNum = int(e.QuestionID) // fallback
		}
		stats.EliminationsByQ = append(stats.EliminationsByQ, QuestionElimination{
			QuestionNumber:  qNum,
			QuestionID:      e.QuestionID,
			EliminatedCount: e.EliminatedCount,
			ByTimeout:       e.ByTimeout,
			ByWrongAnswer:   e.ByWrongAnswer,
			AvgResponseMs:   e.AvgRespMs,
		})
	}

	// 4. Общие причины выбытия
	var reasons struct {
		Timeout      int
		WrongAnswer  int
		Disconnected int
		Other        int
	}
	s.db.Table("user_answers").
		Select(`
			COUNT(*) FILTER (WHERE elimination_reason IN ('time_exceeded', 'no_answer_timeout') AND is_eliminated = true) as timeout,
			COUNT(*) FILTER (WHERE elimination_reason = 'incorrect_answer' AND is_eliminated = true) as wrong_answer,
			COUNT(*) FILTER (WHERE elimination_reason = 'disconnected' AND is_eliminated = true) as disconnected,
			COUNT(*) FILTER (WHERE elimination_reason NOT IN ('time_exceeded', 'no_answer_timeout', 'incorrect_answer', 'disconnected', '') AND is_eliminated = true) as other
		`).
		Where("quiz_id = ?", quizID).
		Scan(&reasons)

	stats.EliminationReasons = EliminationReasons{
		Timeout:      reasons.Timeout,
		WrongAnswer:  reasons.WrongAnswer,
		Disconnected: reasons.Disconnected,
		Other:        reasons.Other,
	}

	log.Printf("[ResultService] Статистика для викторины #%d: %d участников, %d победителей, %d выбыло",
		quizID, stats.TotalParticipants, stats.TotalWinners, stats.TotalEliminated)

	return stats, nil
}
