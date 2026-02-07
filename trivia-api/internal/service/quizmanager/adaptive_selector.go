package quizmanager

import (
	"context"
	"fmt"
	"log"
	"strconv"

	"github.com/yourusername/trivia-api/internal/domain/entity"
)

// AdaptiveQuestionSelector динамически выбирает вопросы на основе реального pass rate
type AdaptiveQuestionSelector struct {
	config *DifficultyConfig
	deps   *Dependencies
}

// NewAdaptiveQuestionSelector создаёт новый селектор
func NewAdaptiveQuestionSelector(config *DifficultyConfig, deps *Dependencies) *AdaptiveQuestionSelector {
	return &AdaptiveQuestionSelector{
		config: config,
		deps:   deps,
	}
}

// SelectNextQuestion выбирает следующий вопрос на основе статистики предыдущих
// questionNumber — номер вопроса (1-indexed)
// usedQuestionIDs — ID уже использованных вопросов в текущей викторине
func (s *AdaptiveQuestionSelector) SelectNextQuestion(
	ctx context.Context,
	quizID uint,
	questionNumber int,
	usedQuestionIDs []uint,
) (*entity.Question, error) {
	// 1. Получаем actual pass rate предыдущего вопроса
	actualPassRate := s.getActualPassRate(quizID, questionNumber-1)

	// 2. Вычисляем нужную сложность
	targetDifficulty := s.config.CalculateAdjustedDifficulty(questionNumber, actualPassRate)

	log.Printf("[AdaptiveSelector] Quiz #%d, Q%d: prev_pass_rate=%.2f, target_difficulty=%d",
		quizID, questionNumber, actualPassRate, targetDifficulty)

	// 3. Пытаемся найти вопрос нужной сложности
	question, err := s.findQuestionByDifficulty(targetDifficulty, usedQuestionIDs)
	if err != nil {
		log.Printf("[AdaptiveSelector] Error finding question at difficulty %d: %v", targetDifficulty, err)
	}

	// 4. Если не нашли — fallback на другие уровни
	if question == nil {
		question, err = s.findQuestionWithFallback(targetDifficulty, usedQuestionIDs)
		if err != nil {
			return nil, fmt.Errorf("failed to find question with fallback: %w", err)
		}
	}

	if question == nil {
		return nil, fmt.Errorf("no questions available for quiz %d, question %d (tried difficulty %d with fallback)",
			quizID, questionNumber, targetDifficulty)
	}

	log.Printf("[AdaptiveSelector] Selected question ID=%d, difficulty=%d for Q%d",
		question.ID, question.Difficulty, questionNumber)

	return question, nil
}

// getActualPassRate получает реальный pass rate из Redis
func (s *AdaptiveQuestionSelector) getActualPassRate(quizID uint, questionNumber int) float64 {
	if questionNumber < 1 {
		return 1.0 // Для первого вопроса — 100%
	}

	totalKey := fmt.Sprintf("quiz:%d:q%d:total", quizID, questionNumber)
	passedKey := fmt.Sprintf("quiz:%d:q%d:passed", quizID, questionNumber)

	totalStr, err1 := s.deps.CacheRepo.Get(totalKey)
	passedStr, err2 := s.deps.CacheRepo.Get(passedKey)

	if err1 != nil || err2 != nil {
		// Ключи могут не существовать — это нормально для первого вопроса
		return 1.0
	}

	total, _ := strconv.Atoi(totalStr)
	passed, _ := strconv.Atoi(passedStr)

	if total == 0 {
		return 1.0
	}

	return float64(passed) / float64(total)
}

// findQuestionByDifficulty ищет вопрос заданной сложности
func (s *AdaptiveQuestionSelector) findQuestionByDifficulty(difficulty int, excludeIDs []uint) (*entity.Question, error) {
	questions, err := s.deps.QuestionRepo.GetRandomByDifficulty(difficulty, 1, excludeIDs)
	if err != nil {
		return nil, err
	}
	if len(questions) == 0 {
		return nil, nil
	}
	return &questions[0], nil
}

// findQuestionWithFallback ищет вопрос с fallback на другие уровни
// При FallbackToHigher=true: если нет 4 → берём 5, затем 3, затем 2...
func (s *AdaptiveQuestionSelector) findQuestionWithFallback(targetDifficulty int, excludeIDs []uint) (*entity.Question, error) {
	var searchOrder []int

	if s.config.FallbackToHigher {
		// Сначала вверх (сложнее), потом вниз (легче)
		for diff := targetDifficulty; diff <= s.config.MaxDifficulty; diff++ {
			searchOrder = append(searchOrder, diff)
		}
		for diff := targetDifficulty - 1; diff >= s.config.MinDifficulty; diff-- {
			searchOrder = append(searchOrder, diff)
		}
	} else {
		// Сначала вниз (легче), потом вверх (сложнее)
		for diff := targetDifficulty; diff >= s.config.MinDifficulty; diff-- {
			searchOrder = append(searchOrder, diff)
		}
		for diff := targetDifficulty + 1; diff <= s.config.MaxDifficulty; diff++ {
			searchOrder = append(searchOrder, diff)
		}
	}

	for _, diff := range searchOrder {
		q, err := s.findQuestionByDifficulty(diff, excludeIDs)
		if err == nil && q != nil {
			if diff != targetDifficulty {
				log.Printf("[AdaptiveSelector] Fallback: found question at difficulty=%d (target was %d)", diff, targetDifficulty)
			}
			return q, nil
		}
	}

	return nil, fmt.Errorf("no questions found at any difficulty level")
}

// RecordQuestionResult записывает результат ответа на вопрос в Redis
// passed=true означает, что пользователь прошёл вопрос (правильно + в срок)
func (s *AdaptiveQuestionSelector) RecordQuestionResult(quizID uint, questionNumber int, passed bool) {
	totalKey := fmt.Sprintf("quiz:%d:q%d:total", quizID, questionNumber)
	passedKey := fmt.Sprintf("quiz:%d:q%d:passed", quizID, questionNumber)

	// Инкрементируем total
	if _, err := s.deps.CacheRepo.Increment(totalKey); err != nil {
		log.Printf("[AdaptiveSelector] Error incrementing total for Q%d: %v", questionNumber, err)
	}

	// Инкрементируем passed если прошёл
	if passed {
		if _, err := s.deps.CacheRepo.Increment(passedKey); err != nil {
			log.Printf("[AdaptiveSelector] Error incrementing passed for Q%d: %v", questionNumber, err)
		}
	}
}

// GetDifficultyStats возвращает статистику по доступным вопросам
func (s *AdaptiveQuestionSelector) GetDifficultyStats() map[int]int64 {
	stats := make(map[int]int64)
	for diff := s.config.MinDifficulty; diff <= s.config.MaxDifficulty; diff++ {
		count, err := s.deps.QuestionRepo.CountByDifficulty(diff)
		if err != nil {
			log.Printf("[AdaptiveSelector] Error counting difficulty %d: %v", diff, err)
			continue
		}
		stats[diff] = count
	}
	return stats
}
