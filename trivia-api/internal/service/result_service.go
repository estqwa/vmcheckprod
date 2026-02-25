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

// ResultService РїСЂРµРґРѕСЃС‚Р°РІР»СЏРµС‚ РјРµС‚РѕРґС‹ РґР»СЏ СЂР°Р±РѕС‚С‹ СЃ СЂРµР·СѓР»СЊС‚Р°С‚Р°РјРё
type ResultService struct {
	resultRepo   repository.ResultRepository
	userRepo     repository.UserRepository
	quizRepo     repository.QuizRepository
	questionRepo repository.QuestionRepository
	cacheRepo    repository.CacheRepository
	db           *gorm.DB
	wsManager    *websocket.Manager
	config       *quizmanager.Config
	requireVerifiedForPrizes bool
}

// NewResultService СЃРѕР·РґР°РµС‚ РЅРѕРІС‹Р№ СЃРµСЂРІРёСЃ СЂРµР·СѓР»СЊС‚Р°С‚РѕРІ
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

func (s *ResultService) SetEmailVerificationGate(enabled bool) {
	s.requireVerifiedForPrizes = enabled
}

// CalculateQuizResult РїРѕРґСЃС‡РёС‚С‹РІР°РµС‚ РёС‚РѕРіРѕРІС‹Р№ СЂРµР·СѓР»СЊС‚Р°С‚ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РІ РІРёРєС‚РѕСЂРёРЅРµ
func (s *ResultService) CalculateQuizResult(userID, quizID uint) (*entity.Result, error) {
	// РџРѕР»СѓС‡Р°РµРј РёРЅС„РѕСЂРјР°С†РёСЋ Рѕ РїРѕР»СЊР·РѕРІР°С‚РµР»Рµ
	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return nil, err
	}

	// РџРѕР»СѓС‡Р°РµРј РёРЅС„РѕСЂРјР°С†РёСЋ Рѕ РІРёРєС‚РѕСЂРёРЅРµ
	quiz, err := s.quizRepo.GetWithQuestions(quizID)
	if err != nil {
		return nil, err
	}

	// РџРѕР»СѓС‡Р°РµРј РІСЃРµ РѕС‚РІРµС‚С‹ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
	userAnswers, err := s.resultRepo.GetUserAnswers(userID, quizID)
	if err != nil {
		return nil, err
	}

	// РџСЂРѕРІРµСЂСЏРµРј СЃС‚Р°С‚СѓСЃ РІС‹Р±С‹РІР°РЅРёСЏ РёР· Redis
	eliminationKey := fmt.Sprintf("quiz:%d:eliminated:%d", quizID, userID)
	isEliminated, _ := s.cacheRepo.Exists(eliminationKey)

	// РџРѕРґСЃС‡РёС‚С‹РІР°РµРј РѕР±С‰РёР№ СЃС‡РµС‚ Рё РєРѕР»РёС‡РµСЃС‚РІРѕ РїСЂР°РІРёР»СЊРЅС‹С… РѕС‚РІРµС‚РѕРІ
	// РўР°РєР¶Рµ РѕРїСЂРµРґРµР»СЏРµРј РґРµС‚Р°Р»Рё РІС‹Р±С‹С‚РёСЏ (РЅР° РєР°РєРѕРј РІРѕРїСЂРѕСЃРµ Рё РїРѕС‡РµРјСѓ)
	totalScore := 0
	correctAnswers := 0
	var eliminatedOnQuestion *int
	var eliminationReason *string
	for i, answer := range userAnswers {
		totalScore += answer.Score
		if answer.IsCorrect {
			correctAnswers++
		}
		// РС‰РµРј РїРµСЂРІС‹Р№ РѕС‚РІРµС‚ СЃ РІС‹Р±С‹С‚РёРµРј
		if answer.IsEliminated && eliminatedOnQuestion == nil {
			questionNum := i + 1 // 1-indexed
			eliminatedOnQuestion = &questionNum
			if answer.EliminationReason != "" {
				reason := answer.EliminationReason
				eliminationReason = &reason
			}
		}
	}

	// РЎРѕР·РґР°РµРј Р·Р°РїРёСЃСЊ Рѕ СЂРµР·СѓР»СЊС‚Р°С‚Рµ
	result := &entity.Result{
		UserID:               userID,
		QuizID:               quizID,
		Username:             user.Username,
		ProfilePicture:       user.ProfilePicture,
		Score:                totalScore,
		CorrectAnswers:       correctAnswers,
		TotalQuestions:       s.getTotalQuestions(quiz),
		IsEliminated:         isEliminated,
		EliminatedOnQuestion: eliminatedOnQuestion,
		EliminationReason:    eliminationReason,
		CompletedAt:          time.Now(),
	}

	// --- РќР°С‡Р°Р»Рѕ С‚СЂР°РЅР·Р°РєС†РёРё ---
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

	// РЎРѕС…СЂР°РЅСЏРµРј СЂРµР·СѓР»СЊС‚Р°С‚ РІ Р‘Р” (РІРЅСѓС‚СЂРё С‚СЂР°РЅР·Р°РєС†РёРё)
	if err := tx.Create(result).Error; err != nil {
		tx.Rollback()
		log.Printf("Error saving result in transaction: %v", err)
		return nil, fmt.Errorf("failed to save result: %w", err)
	}

	// РћР±РЅРѕРІР»СЏРµРј РѕР±С‰РёР№ СЃС‡РµС‚ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ (РІРЅСѓС‚СЂРё С‚СЂР°РЅР·Р°РєС†РёРё)
	if err := tx.Model(&entity.User{}).Where("id = ?", userID).Update("total_score", gorm.Expr("total_score + ?", totalScore)).Error; err != nil {
		tx.Rollback()
		log.Printf("Error updating user score in transaction: %v", err)
		return nil, fmt.Errorf("failed to update user score: %w", err)
	}

	// РћР±РЅРѕРІР»СЏРµРј РІС‹СЃС€РёР№ СЃС‡РµС‚, РµСЃР»Рё РЅРµРѕР±С…РѕРґРёРјРѕ (РІРЅСѓС‚СЂРё С‚СЂР°РЅР·Р°РєС†РёРё)
	if err := tx.Model(&entity.User{}).Where("id = ? AND highest_score < ?", userID, totalScore).Update("highest_score", totalScore).Error; err != nil {
		// РќРµ РѕС‚РєР°С‚С‹РІР°РµРј С‚СЂР°РЅР·Р°РєС†РёСЋ РёР·-Р·Р° СЌС‚РѕР№ РѕС€РёР±РєРё, РѕРЅР° РЅРµ РєСЂРёС‚РёС‡РЅР°
		log.Printf("Warning: Error updating user highest score: %v", err)
	}

	// РЈРІРµР»РёС‡РёРІР°РµРј СЃС‡РµС‚С‡РёРє СЃС‹РіСЂР°РЅРЅС‹С… РёРіСЂ (РІРЅСѓС‚СЂРё С‚СЂР°РЅР·Р°РєС†РёРё)
	if err := tx.Model(&entity.User{}).Where("id = ?", userID).UpdateColumn("games_played", gorm.Expr("games_played + ?", 1)).Error; err != nil {
		tx.Rollback()
		log.Printf("Error incrementing games played in transaction: %v", err)
		return nil, fmt.Errorf("failed to increment games played: %w", err)
	}

	// --- РљРѕРјРјРёС‚ С‚СЂР°РЅР·Р°РєС†РёРё ---
	if err := tx.Commit().Error; err != nil {
		log.Printf("Error committing transaction in CalculateQuizResult: %v", err)
		return nil, err
	}

	log.Printf("[ResultService] РЈСЃРїРµС€РЅРѕ СЂР°СЃСЃС‡РёС‚Р°РЅ Рё СЃРѕС…СЂР°РЅРµРЅ СЂРµР·СѓР»СЊС‚Р°С‚ РґР»СЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ #%d РІ РІРёРєС‚РѕСЂРёРЅРµ #%d", userID, quizID)
	return result, nil
}

// GetQuizResults РІРѕР·РІСЂР°С‰Р°РµС‚ РїР°РіРёРЅРёСЂРѕРІР°РЅРЅС‹Р№ СЃРїРёСЃРѕРє СЂРµР·СѓР»СЊС‚Р°С‚РѕРІ РґР»СЏ РІРёРєС‚РѕСЂРёРЅС‹
// Р’РќРРњРђРќРР•: Р­С‚Р° С„СѓРЅРєС†РёСЏ Р±РѕР»СЊС€Рµ РќР• РІС‹Р·С‹РІР°РµС‚ CalculateRanks РЅР°РїСЂСЏРјСѓСЋ.
// CalculateRanks С‚РµРїРµСЂСЊ РІС‹Р·С‹РІР°РµС‚СЃСЏ РІ DetermineWinnersAndAllocatePrizes.
func (s *ResultService) GetQuizResults(quizID uint, page, pageSize int) ([]entity.Result, int64, error) {
	// Р’Р°Р»РёРґР°С†РёСЏ РїР°СЂР°РјРµС‚СЂРѕРІ РїР°РіРёРЅР°С†РёРё (РѕРїС†РёРѕРЅР°Р»СЊРЅРѕ, РЅРѕ СЂРµРєРѕРјРµРЅРґСѓРµС‚СЃСЏ)
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 10 // Р—РЅР°С‡РµРЅРёРµ РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ РёР»Рё РёР· РєРѕРЅС„РёРіР°
	} else if pageSize > 100 {
		pageSize = 100 // РњР°РєСЃРёРјР°Р»СЊРЅС‹Р№ Р»РёРјРёС‚
	}

	offset := (page - 1) * pageSize

	// Р’С‹Р·С‹РІР°РµРј РѕР±РЅРѕРІР»РµРЅРЅС‹Р№ РјРµС‚РѕРґ СЂРµРїРѕР·РёС‚РѕСЂРёСЏ
	results, total, err := s.resultRepo.GetQuizResults(quizID, pageSize, offset)
	if err != nil {
		// Р›РѕРіРёСЂСѓРµРј РѕС€РёР±РєСѓ СЂРµРїРѕР·РёС‚РѕСЂРёСЏ
		log.Printf("[ResultService] РћС€РёР±РєР° РїСЂРё РїРѕР»СѓС‡РµРЅРёРё СЂРµР·СѓР»СЊС‚Р°С‚РѕРІ РІРёРєС‚РѕСЂРёРЅС‹ %d (page %d, size %d): %v", quizID, page, pageSize, err)
		return nil, 0, err // РџСЂРѕСЃС‚Рѕ РїСЂРѕР±СЂР°СЃС‹РІР°РµРј РѕС€РёР±РєСѓ РІС‹С€Рµ
	}

	return results, total, nil
}

// GetUserResult РІРѕР·РІСЂР°С‰Р°РµС‚ СЂРµР·СѓР»СЊС‚Р°С‚ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РґР»СЏ РєРѕРЅРєСЂРµС‚РЅРѕР№ РІРёРєС‚РѕСЂРёРЅС‹
func (s *ResultService) GetUserResult(userID, quizID uint) (*entity.Result, error) {
	return s.resultRepo.GetUserResult(userID, quizID)
}

// GetUserResults РІРѕР·РІСЂР°С‰Р°РµС‚ РІСЃРµ СЂРµР·СѓР»СЊС‚Р°С‚С‹ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ СЃ РїР°РіРёРЅР°С†РёРµР№
func (s *ResultService) GetUserResults(userID uint, page, pageSize int) ([]entity.Result, int64, error) {
	offset := (page - 1) * pageSize
	return s.resultRepo.GetUserResults(userID, pageSize, offset)
}

// GetQuizResultsAll РІРѕР·РІСЂР°С‰Р°РµС‚ Р’РЎР• СЂРµР·СѓР»СЊС‚Р°С‚С‹ РІРёРєС‚РѕСЂРёРЅС‹ Р±РµР· РїР°РіРёРЅР°С†РёРё.
// РСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ РґР»СЏ СЌРєСЃРїРѕСЂС‚Р°, РіРґРµ РЅСѓР¶РЅР° РїРѕР»РЅР°СЏ РІС‹Р±РѕСЂРєР°.
func (s *ResultService) GetQuizResultsAll(quizID uint) ([]entity.Result, error) {
	return s.resultRepo.GetAllQuizResults(quizID)
}

// DetermineWinnersAndAllocatePrizes С„РёРЅР°Р»РёР·РёСЂСѓРµС‚ СЂРµР·СѓР»СЊС‚Р°С‚С‹ РІРёРєС‚РѕСЂРёРЅС‹.
//  1. Р’ РўР РђРќР—РђРљР¦РР:
//     Р°. Р’С‹Р·С‹РІР°РµС‚ ResultRepo.CalculateRanks РґР»СЏ СЂР°СЃС‡РµС‚Р° Рё СЃРѕС…СЂР°РЅРµРЅРёСЏ СЂР°РЅРіРѕРІ.
//     Р±. Р’С‹Р·С‹РІР°РµС‚ ResultRepo.FindAndUpdateWinners РґР»СЏ РѕРїСЂРµРґРµР»РµРЅРёСЏ РїРѕР±РµРґРёС‚РµР»РµР№, СЂР°СЃС‡РµС‚Р° РїСЂРёР·РѕРІ Рё РѕР±РЅРѕРІР»РµРЅРёСЏ РёС… СЃС‚Р°С‚СѓСЃР° РІ Р‘Р”.
//     РІ. РћР±РЅРѕРІР»СЏРµС‚ СЃС‚Р°С‚РёСЃС‚РёРєСѓ (wins_count, total_prize_won) РІ С‚Р°Р±Р»РёС†Рµ users РґР»СЏ РїРѕР±РµРґРёС‚РµР»РµР№.
//  2. РћС‚РїСЂР°РІР»СЏРµС‚ WebSocket-СЃРѕРѕР±С‰РµРЅРёРµ Рѕ РґРѕСЃС‚СѓРїРЅРѕСЃС‚Рё СЂРµР·СѓР»СЊС‚Р°С‚РѕРІ.
func (s *ResultService) DetermineWinnersAndAllocatePrizes(ctx context.Context, quizID uint) error {
	log.Printf("[ResultService] Р¤РёРЅР°Р»РёР·Р°С†РёСЏ СЂРµР·СѓР»СЊС‚Р°С‚РѕРІ РґР»СЏ РІРёРєС‚РѕСЂРёРЅС‹ #%d", quizID)

	// FIX: РСЃРїРѕР»СЊР·СѓРµРј GetWithQuestions РґР»СЏ РїРѕР»СѓС‡РµРЅРёСЏ СЂРµР°Р»СЊРЅРѕРіРѕ РєРѕР»РёС‡РµСЃС‚РІР° РІРѕРїСЂРѕСЃРѕРІ.
	// РџРѕР»Рµ quiz.QuestionCount РјРѕР¶РµС‚ Р±С‹С‚СЊ РЅРµ СЃРёРЅС…СЂРѕРЅРёР·РёСЂРѕРІР°РЅРѕ СЃ СЂРµР°Р»СЊРЅС‹Рј РєРѕР»РёС‡РµСЃС‚РІРѕРј
	// РІРѕРїСЂРѕСЃРѕРІ РІ С‚Р°Р±Р»РёС†Рµ questions (РЅР°РїСЂРёРјРµСЂ, РїРѕСЃР»Рµ Р°РІС‚РѕР·Р°РїРѕР»РЅРµРЅРёСЏ).
	quiz, err := s.quizRepo.GetWithQuestions(quizID)
	if err != nil {
		log.Printf("[ResultService] РћС€РёР±РєР° РїСЂРё РїРѕР»СѓС‡РµРЅРёРё РІРёРєС‚РѕСЂРёРЅС‹ #%d СЃ РІРѕРїСЂРѕСЃР°РјРё: %v", quizID, err)
		return fmt.Errorf("РѕС€РёР±РєР° РїРѕР»СѓС‡РµРЅРёСЏ РІРёРєС‚РѕСЂРёРЅС‹: %w", err)
	}

	// Р•РґРёРЅС‹Р№ РёСЃС‚РѕС‡РЅРёРє РёСЃС‚РёРЅС‹ РґР»СЏ totalQuestions
	totalQuestions := s.getTotalQuestions(quiz)

	if totalQuestions <= 0 {
		log.Printf("[ResultService] Р’РёРєС‚РѕСЂРёРЅР° #%d РЅРµ РёРјРµРµС‚ РІРѕРїСЂРѕСЃРѕРІ, РїСЂРѕРїСѓСЃРє РѕРїСЂРµРґРµР»РµРЅРёСЏ РїРѕР±РµРґРёС‚РµР»РµР№ Рё РѕР±РЅРѕРІР»РµРЅРёСЏ СЂР°РЅРіРѕРІ.", quizID)
		s.sendResultsAvailableNotification(quizID)
		return nil
	}
	log.Printf("[ResultService] Р’РёРєС‚РѕСЂРёРЅР° #%d: РѕРїСЂРµРґРµР»РµРЅРёРµ РїРѕР±РµРґРёС‚РµР»РµР№ РЅР° РѕСЃРЅРѕРІРµ %d РІРѕРїСЂРѕСЃРѕРІ", quizID, totalQuestions)

	// РСЃРїРѕР»СЊР·СѓРµРј РїСЂРёР·РѕРІРѕР№ С„РѕРЅРґ РєРѕРЅРєСЂРµС‚РЅРѕР№ РІРёРєС‚РѕСЂРёРЅС‹, fallback РЅР° РґРµС„РѕР»С‚ РёР· РєРѕРЅС„РёРіР°
	totalPrizeFund := quiz.PrizeFund
	if totalPrizeFund <= 0 {
		totalPrizeFund = s.config.TotalPrizeFund
	}
	var winnerIDs []uint
	var prizePerWinner int

	// === РќР°С‡Р°Р»Рѕ С‚СЂР°РЅР·Р°РєС†РёРё ===
	tx := s.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
			log.Printf("PANIC recovered during DetermineWinnersAndAllocatePrizes transaction for quiz %d: %v", quizID, r)
		}
	}()
	if tx.Error != nil {
		log.Printf("[ResultService] РћС€РёР±РєР° СЃС‚Р°СЂС‚Р° С‚СЂР°РЅР·Р°РєС†РёРё РґР»СЏ РІРёРєС‚РѕСЂРёРЅС‹ #%d: %v", quizID, tx.Error)
		return tx.Error
	}

	// 1Р°. Р Р°СЃСЃС‡РёС‚С‹РІР°РµРј Рё СЃРѕС…СЂР°РЅСЏРµРј СЂР°РЅРіРё Р’РќРЈРўР Р С‚СЂР°РЅР·Р°РєС†РёРё
	if err = s.resultRepo.CalculateRanks(tx, quizID); err != nil {
		log.Printf("[ResultService] РћС€РёР±РєР° РїСЂРё СЂР°СЃС‡РµС‚Рµ СЂР°РЅРіРѕРІ РґР»СЏ РІРёРєС‚РѕСЂРёРЅС‹ #%d РІ С‚СЂР°РЅР·Р°РєС†РёРё: %v", quizID, err)
		tx.Rollback()
		return fmt.Errorf("РѕС€РёР±РєР° СЂР°СЃС‡РµС‚Р° СЂР°РЅРіРѕРІ: %w", err)
	}
	log.Printf("[ResultService] Р Р°РЅРіРё РґР»СЏ РІРёРєС‚РѕСЂРёРЅС‹ #%d СѓСЃРїРµС€РЅРѕ СЂР°СЃСЃС‡РёС‚Р°РЅС‹ Рё СЃРѕС…СЂР°РЅРµРЅС‹ РІ С‚СЂР°РЅР·Р°РєС†РёРё.", quizID)

	// 1Р±. РћРїСЂРµРґРµР»СЏРµРј РїРѕР±РµРґРёС‚РµР»РµР№, СЂР°СЃСЃС‡РёС‚С‹РІР°РµРј РїСЂРёР·С‹ Рё РѕР±РЅРѕРІР»СЏРµРј СЃС‚Р°С‚СѓСЃ РІ Р‘Р” Р’РќРЈРўР Р С‚СЂР°РЅР·Р°РєС†РёРё
	winnerIDs, prizePerWinner, err = s.resultRepo.FindAndUpdateWinners(tx, quizID, totalQuestions, totalPrizeFund)
	if err != nil {
		log.Printf("[ResultService] РћС€РёР±РєР° РїСЂРё РѕРїСЂРµРґРµР»РµРЅРёРё/РѕР±РЅРѕРІР»РµРЅРёРё РїРѕР±РµРґРёС‚РµР»РµР№ РґР»СЏ РІРёРєС‚РѕСЂРёРЅС‹ #%d РІ С‚СЂР°РЅР·Р°РєС†РёРё: %v", quizID, err)
		tx.Rollback()
		return fmt.Errorf("РѕС€РёР±РєР° РѕРїСЂРµРґРµР»РµРЅРёСЏ РїРѕР±РµРґРёС‚РµР»РµР№: %w", err)
	}
	winnersCount := len(winnerIDs)
	log.Printf("[ResultService] РќР°Р№РґРµРЅРѕ Рё РѕР±РЅРѕРІР»РµРЅРѕ %d РїРѕР±РµРґРёС‚РµР»РµР№ РґР»СЏ РІРёРєС‚РѕСЂРёРЅС‹ #%d РІ С‚СЂР°РЅР·Р°РєС†РёРё. РџСЂРёР· РЅР° РїРѕР±РµРґРёС‚РµР»СЏ: %d.", winnersCount, quizID, prizePerWinner)
	if s.requireVerifiedForPrizes && winnersCount > 0 {
		var verifiedWinnerIDs []uint
		if err = tx.Model(&entity.User{}).
			Where("id IN ? AND email_verified_at IS NOT NULL", winnerIDs).
			Pluck("id", &verifiedWinnerIDs).Error; err != nil {
			tx.Rollback()
			return fmt.Errorf("failed to apply verified-email gate to winners: %w", err)
		}

		verifiedSet := make(map[uint]struct{}, len(verifiedWinnerIDs))
		for _, id := range verifiedWinnerIDs {
			verifiedSet[id] = struct{}{}
		}
		ineligibleIDs := make([]uint, 0)
		for _, id := range winnerIDs {
			if _, ok := verifiedSet[id]; !ok {
				ineligibleIDs = append(ineligibleIDs, id)
			}
		}

		if len(ineligibleIDs) > 0 {
			if err = tx.Model(&entity.Result{}).
				Where("quiz_id = ? AND user_id IN ?", quizID, ineligibleIDs).
				Updates(map[string]interface{}{"is_winner": false, "prize_fund": 0}).Error; err != nil {
				tx.Rollback()
				return fmt.Errorf("failed to exclude unverified winners: %w", err)
			}
		}

		if len(verifiedWinnerIDs) == 0 {
			winnerIDs = []uint{}
			prizePerWinner = 0
			winnersCount = 0
		} else {
			recalculatedPrize := 0
			if totalPrizeFund > 0 {
				recalculatedPrize = totalPrizeFund / len(verifiedWinnerIDs)
			}
			if err = tx.Model(&entity.Result{}).
				Where("quiz_id = ? AND user_id IN ?", quizID, verifiedWinnerIDs).
				Updates(map[string]interface{}{"is_winner": true, "prize_fund": recalculatedPrize}).Error; err != nil {
				tx.Rollback()
				return fmt.Errorf("failed to update verified winners prize: %w", err)
			}

			winnerIDs = verifiedWinnerIDs
			prizePerWinner = recalculatedPrize
			winnersCount = len(winnerIDs)
		}

		log.Printf("[ResultService] Email verification gate applied for quiz #%d. Eligible winners: %d, prize per winner: %d", quizID, winnersCount, prizePerWinner)
	}
	// 1РІ. РћР±РЅРѕРІР»СЏРµРј СЃС‚Р°С‚РёСЃС‚РёРєСѓ РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№-РїРѕР±РµРґРёС‚РµР»РµР№ Р’РќРЈРўР Р С‚СЂР°РЅР·Р°РєС†РёРё (РµСЃР»Рё РµСЃС‚СЊ РїРѕР±РµРґРёС‚РµР»Рё)
	if winnersCount > 0 && prizePerWinner >= 0 { // Р”РѕР±Р°РІРёРј РїСЂРѕРІРµСЂРєСѓ РЅР° РЅРµРѕС‚СЂРёС†Р°С‚РµР»СЊРЅС‹Р№ РїСЂРёР·
		if err = tx.Model(&entity.User{}).Where("id IN ?", winnerIDs).Updates(map[string]interface{}{
			"wins_count":      gorm.Expr("wins_count + ?", 1),
			"total_prize_won": gorm.Expr("total_prize_won + ?", prizePerWinner),
		}).Error; err != nil {
			log.Printf("[ResultService] РћС€РёР±РєР° РїСЂРё РѕР±РЅРѕРІР»РµРЅРёРё СЃС‚Р°С‚РёСЃС‚РёРєРё РїРѕР±РµРґРёС‚РµР»РµР№ (wins_count, total_prize_won) РґР»СЏ РІРёРєС‚РѕСЂРёРЅС‹ #%d РІ С‚СЂР°РЅР·Р°РєС†РёРё: %v", quizID, err)
			tx.Rollback()
			return fmt.Errorf("РѕС€РёР±РєР° РѕР±РЅРѕРІР»РµРЅРёСЏ СЃС‚Р°С‚РёСЃС‚РёРєРё РїРѕР±РµРґРёС‚РµР»РµР№: %w", err)
		}
		log.Printf("[ResultService] РЎС‚Р°С‚РёСЃС‚РёРєР° РґР»СЏ %d РїРѕР±РµРґРёС‚РµР»РµР№ РІРёРєС‚РѕСЂРёРЅС‹ #%d СѓСЃРїРµС€РЅРѕ РѕР±РЅРѕРІР»РµРЅР° РІ С‚СЂР°РЅР·Р°РєС†РёРё.", winnersCount, quizID)
	}

	// === РљРѕРјРјРёС‚ С‚СЂР°РЅР·Р°РєС†РёРё ===
	if err = tx.Commit().Error; err != nil {
		log.Printf("[ResultService] РћС€РёР±РєР° РєРѕРјРјРёС‚Р° С‚СЂР°РЅР·Р°РєС†РёРё РґР»СЏ РІРёРєС‚РѕСЂРёРЅС‹ #%d: %v", quizID, err)
		return fmt.Errorf("РѕС€РёР±РєР° СЃРѕС…СЂР°РЅРµРЅРёСЏ СЂРµР·СѓР»СЊС‚Р°С‚РѕРІ: %w", err)
	}

	// 2. РћС‚РїСЂР°РІР»СЏРµРј WebSocket-СЃРѕРѕР±С‰РµРЅРёРµ Рѕ РґРѕСЃС‚СѓРїРЅРѕСЃС‚Рё СЂРµР·СѓР»СЊС‚Р°С‚РѕРІ (РџРћРЎР›Р• РєРѕРјРјРёС‚Р°)
	s.sendResultsAvailableNotification(quizID)

	log.Printf("[ResultService] Р¤РёРЅР°Р»РёР·Р°С†РёСЏ СЂРµР·СѓР»СЊС‚Р°С‚РѕРІ РґР»СЏ РІРёРєС‚РѕСЂРёРЅС‹ #%d СѓСЃРїРµС€РЅРѕ Р·Р°РІРµСЂС€РµРЅР°.", quizID)
	return nil
}

// sendResultsAvailableNotification - РІСЃРїРѕРјРѕРіР°С‚РµР»СЊРЅР°СЏ С„СѓРЅРєС†РёСЏ РґР»СЏ РѕС‚РїСЂР°РІРєРё WS СѓРІРµРґРѕРјР»РµРЅРёСЏ
func (s *ResultService) sendResultsAvailableNotification(quizID uint) {
	if s.wsManager != nil {
		resultsAvailableEvent := map[string]interface{}{
			"quiz_id": quizID,
		}
		fullEvent := map[string]interface{}{ // РСЃРїРѕР»СЊР·СѓРµРј СЃС‚Р°РЅРґР°СЂС‚РЅСѓСЋ СЃС‚СЂСѓРєС‚СѓСЂСѓ СЃРѕР±С‹С‚РёСЏ
			"type": "quiz:results_available",
			"data": resultsAvailableEvent,
		}
		if err := s.wsManager.BroadcastEventToQuiz(quizID, fullEvent); err != nil {
			// Р›РѕРіРёСЂСѓРµРј РѕС€РёР±РєСѓ, РЅРѕ РЅРµ РїСЂРµСЂС‹РІР°РµРј РІС‹РїРѕР»РЅРµРЅРёРµ, С‚.Рє. РѕСЃРЅРѕРІРЅР°СЏ СЂР°Р±РѕС‚Р° СЃРґРµР»Р°РЅР°
			log.Printf("[ResultService] РћС€РёР±РєР° РїСЂРё РѕС‚РїСЂР°РІРєРµ СЃРѕР±С‹С‚РёСЏ quiz:results_available РґР»СЏ РІРёРєС‚РѕСЂРёРЅС‹ #%d: %v", quizID, err)
		} else {
			log.Printf("[ResultService] РЎРѕР±С‹С‚РёРµ quiz:results_available РґР»СЏ РІРёРєС‚РѕСЂРёРЅС‹ #%d СѓСЃРїРµС€РЅРѕ РѕС‚РїСЂР°РІР»РµРЅРѕ", quizID)
		}
	} else {
		log.Println("[ResultService] РњРµРЅРµРґР¶РµСЂ WebSocket РЅРµ РёРЅРёС†РёР°Р»РёР·РёСЂРѕРІР°РЅ, СѓРІРµРґРѕРјР»РµРЅРёРµ quiz:results_available РЅРµ РѕС‚РїСЂР°РІР»РµРЅРѕ.")
	}
}

// GetQuizWinners РІРѕР·РІСЂР°С‰Р°РµС‚ СЃРїРёСЃРѕРє РїРѕР±РµРґРёС‚РµР»РµР№ РІРёРєС‚РѕСЂРёРЅС‹
func (s *ResultService) GetQuizWinners(quizID uint) ([]entity.Result, error) {
	return s.resultRepo.GetQuizWinners(quizID)
}

// QuizStatistics РїСЂРµРґСЃС‚Р°РІР»СЏРµС‚ СЃС‚Р°С‚РёСЃС‚РёРєСѓ РІРёРєС‚РѕСЂРёРЅС‹
type QuizStatistics struct {
	QuizID                 uint                   `json:"quiz_id"`
	TotalParticipants      int                    `json:"total_participants"`
	TotalWinners           int                    `json:"total_winners"`
	TotalEliminated        int                    `json:"total_eliminated"`
	AvgResponseTimeMs      float64                `json:"avg_response_time_ms"`
	AvgCorrectAnswers      float64                `json:"avg_correct_answers"`
	EliminationsByQ        []QuestionElimination  `json:"eliminations_by_question"`
	EliminationReasons     EliminationReasons     `json:"elimination_reasons"`
	DifficultyDistribution DifficultyDistribution `json:"difficulty_distribution"` // NEW
	PoolQuestionsUsed      int                    `json:"pool_questions_used"`     // NEW
	AvgPassRate            float64                `json:"avg_pass_rate"`           // NEW
}

// QuestionElimination РїСЂРµРґСЃС‚Р°РІР»СЏРµС‚ СЃС‚Р°С‚РёСЃС‚РёРєСѓ РІС‹Р±С‹С‚РёР№ РґР»СЏ РІРѕРїСЂРѕСЃР°
type QuestionElimination struct {
	QuestionNumber  int     `json:"question_number"`
	QuestionID      uint    `json:"question_id"`
	EliminatedCount int     `json:"eliminated_count"`
	ByTimeout       int     `json:"by_timeout"`
	ByWrongAnswer   int     `json:"by_wrong_answer"`
	AvgResponseMs   float64 `json:"avg_response_ms"`
	Difficulty      int     `json:"difficulty"`    // NEW: СЃР»РѕР¶РЅРѕСЃС‚СЊ РІРѕРїСЂРѕСЃР° (1-5)
	PassRate        float64 `json:"pass_rate"`     // NEW: % РїСЂРѕС€РµРґС€РёС… (0-1)
	TotalAnswers    int     `json:"total_answers"` // NEW: РІСЃРµРіРѕ РѕС‚РІРµС‚РѕРІ
}

// DifficultyDistribution РїСЂРµРґСЃС‚Р°РІР»СЏРµС‚ СЂР°СЃРїСЂРµРґРµР»РµРЅРёРµ РІРѕРїСЂРѕСЃРѕРІ РїРѕ СЃР»РѕР¶РЅРѕСЃС‚Рё
type DifficultyDistribution struct {
	Difficulty1 int `json:"difficulty_1"` // РћС‡РµРЅСЊ Р»РµРіРєРѕ
	Difficulty2 int `json:"difficulty_2"` // Р›РµРіРєРѕ
	Difficulty3 int `json:"difficulty_3"` // РЎСЂРµРґРЅРµ
	Difficulty4 int `json:"difficulty_4"` // РЎР»РѕР¶РЅРѕ
	Difficulty5 int `json:"difficulty_5"` // РћС‡РµРЅСЊ СЃР»РѕР¶РЅРѕ
}

// EliminationReasons РїСЂРµРґСЃС‚Р°РІР»СЏРµС‚ СЃСѓРјРјР°СЂРЅС‹Рµ РїСЂРёС‡РёРЅС‹ РІС‹Р±С‹С‚РёСЏ
type EliminationReasons struct {
	Timeout      int `json:"timeout"`
	WrongAnswer  int `json:"wrong_answer"`
	Disconnected int `json:"disconnected"`
	Other        int `json:"other"`
}

// CalculateQuizStatistics РІС‹С‡РёСЃР»СЏРµС‚ СЂР°СЃС€РёСЂРµРЅРЅСѓСЋ СЃС‚Р°С‚РёСЃС‚РёРєСѓ РґР»СЏ РІРёРєС‚РѕСЂРёРЅС‹
func (s *ResultService) CalculateQuizStatistics(quizID uint) (*QuizStatistics, error) {
	// РџСЂРѕРІРµСЂСЏРµРј СЃСѓС‰РµСЃС‚РІРѕРІР°РЅРёРµ РІРёРєС‚РѕСЂРёРЅС‹
	quiz, err := s.quizRepo.GetByID(quizID)
	if err != nil {
		return nil, err
	}

	stats := &QuizStatistics{
		QuizID: quizID,
	}

	// 1. РџРѕР»СѓС‡Р°РµРј РѕР±С‰РµРµ РєРѕР»РёС‡РµСЃС‚РІРѕ СѓС‡Р°СЃС‚РЅРёРєРѕРІ Рё РїРѕР±РµРґРёС‚РµР»РµР№ РёР· results
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

	// 2. РЎСЂРµРґРЅРµРµ РІСЂРµРјСЏ РѕС‚РІРµС‚Р° Рё РїСЂР°РІРёР»СЊРЅС‹С… РѕС‚РІРµС‚РѕРІ
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

	// РЎСЂРµРґРЅРµРµ РІСЂРµРјСЏ РёР· user_answers
	s.db.Table("user_answers").
		Select("AVG(response_time_ms)").
		Where("quiz_id = ? AND response_time_ms > 0", quizID).
		Scan(&stats.AvgResponseTimeMs)

	// 3. Р’С‹Р±С‹С‚РёСЏ РїРѕ РІРѕРїСЂРѕСЃР°Рј СЃ GROUP BY (СЂР°СЃС€РёСЂРµРЅРЅР°СЏ СЃС‚Р°С‚РёСЃС‚РёРєР°)
	type elimByQ struct {
		QuestionID      uint
		EliminatedCount int
		ByTimeout       int
		ByWrongAnswer   int
		AvgRespMs       float64
		TotalAnswers    int // NEW: РІСЃРµРіРѕ РѕС‚РІРµС‚РѕРІ
		PassedCount     int // NEW: РїСЂРѕС€РµРґС€РёС… (РїСЂР°РІРёР»СЊРЅРѕ + РІРѕРІСЂРµРјСЏ)
	}
	var eliminations []elimByQ

	s.db.Table("user_answers").
		Select(`
			question_id,
			COUNT(*) FILTER (WHERE is_eliminated = true) as eliminated_count,
			COUNT(*) FILTER (WHERE elimination_reason IN ('time_exceeded', 'no_answer_timeout')) as by_timeout,
			COUNT(*) FILTER (WHERE elimination_reason = 'incorrect_answer') as by_wrong_answer,
			AVG(response_time_ms) FILTER (WHERE response_time_ms > 0) as avg_resp_ms,
			COUNT(*) as total_answers,
			COUNT(*) FILTER (WHERE is_correct = true AND is_eliminated = false) as passed_count
		`).
		Where("quiz_id = ?", quizID).
		Group("question_id").
		Order("question_id").
		Scan(&eliminations)

	// РљР°СЂС‚Р° Р°РіСЂРµРіР°С‚РѕРІ РїРѕ РІРѕРїСЂРѕСЃСѓ (РїРѕ РѕС‚РІРµС‚Р°Рј РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№)
	aggregatesByQuestion := make(map[uint]elimByQ, len(eliminations))
	for _, e := range eliminations {
		aggregatesByQuestion[e.QuestionID] = e
	}

	// Production-РїСѓС‚СЊ: СЃС‚СЂРѕРёРј РїРѕСЂСЏРґРѕРє Рё РїРѕРєСЂС‹С‚РёРµ РІРѕРїСЂРѕСЃРѕРІ РёР· РёСЃС‚РѕСЂРёРё РїРѕРєР°Р·Р°.
	// Р­С‚Рѕ РєРѕСЂСЂРµРєС‚РЅРѕ РґР°Р¶Рµ РєРѕРіРґР° РІСЃРµ РІС‹Р±С‹Р»Рё СЂР°РЅРѕ Рё РЅР° С‡Р°СЃС‚Рё РІРѕРїСЂРѕСЃРѕРІ РЅРµС‚ РѕС‚РІРµС‚РѕРІ.
	history, historyErr := s.questionRepo.GetQuizQuestionHistory(quiz.ID)
	if historyErr != nil {
		log.Printf("[ResultService] WARNING: РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РёСЃС‚РѕСЂРёСЋ РІРѕРїСЂРѕСЃРѕРІ РІРёРєС‚РѕСЂРёРЅС‹ #%d: %v", quiz.ID, historyErr)
	}

	if len(history) > 0 {
		var diffDist DifficultyDistribution
		var poolUsed int
		var totalPassRate float64
		stats.EliminationsByQ = make([]QuestionElimination, 0, len(history))

		questionCache := make(map[uint]*entity.Question)
		for _, h := range history {
			q := questionCache[h.QuestionID]
			if q == nil {
				loadedQ, fetchErr := s.questionRepo.GetByID(h.QuestionID)
				if fetchErr != nil {
					log.Printf("[ResultService] WARNING: РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РІРѕРїСЂРѕСЃ #%d РёР· РёСЃС‚РѕСЂРёРё: %v", h.QuestionID, fetchErr)
				} else if loadedQ != nil {
					questionCache[h.QuestionID] = loadedQ
					q = loadedQ
				}
			}

			difficulty := 0
			if q != nil {
				difficulty = q.Difficulty
				switch q.Difficulty {
				case 1:
					diffDist.Difficulty1++
				case 2:
					diffDist.Difficulty2++
				case 3:
					diffDist.Difficulty3++
				case 4:
					diffDist.Difficulty4++
				case 5:
					diffDist.Difficulty5++
				}
				// РџСЂРёР·РЅР°Рє "РёР· РїСѓР»Р°": РІРѕРїСЂРѕСЃ РЅРµ РїСЂРёРІСЏР·Р°РЅ Рє РєРѕРЅРєСЂРµС‚РЅРѕР№ РІРёРєС‚РѕСЂРёРЅРµ.
				if q.QuizID == nil {
					poolUsed++
				}
			}

			agg := aggregatesByQuestion[h.QuestionID]
			passRate := 0.0
			if agg.TotalAnswers > 0 {
				passRate = float64(agg.PassedCount) / float64(agg.TotalAnswers)
			}
			totalPassRate += passRate

			stats.EliminationsByQ = append(stats.EliminationsByQ, QuestionElimination{
				QuestionNumber:  h.QuestionOrder,
				QuestionID:      h.QuestionID,
				EliminatedCount: agg.EliminatedCount,
				ByTimeout:       agg.ByTimeout,
				ByWrongAnswer:   agg.ByWrongAnswer,
				AvgResponseMs:   agg.AvgRespMs,
				Difficulty:      difficulty,
				PassRate:        passRate,
				TotalAnswers:    agg.TotalAnswers,
			})
		}

		stats.DifficultyDistribution = diffDist
		stats.PoolQuestionsUsed = poolUsed
		if len(stats.EliminationsByQ) > 0 {
			stats.AvgPassRate = totalPassRate / float64(len(stats.EliminationsByQ))
		}
	} else {
		// Legacy fallback РґР»СЏ СЃС‚Р°СЂС‹С… РІРёРєС‚РѕСЂРёРЅ Р±РµР· РёСЃС‚РѕСЂРёРё: СЃС‚СЂРѕРёРј СЃС‚Р°С‚РёСЃС‚РёРєСѓ РёР· СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёС… РґР°РЅРЅС‹С….
		questions, qErr := s.questionRepo.GetByQuizID(quiz.ID)
		if qErr != nil {
			log.Printf("[ResultService] WARNING: РќРµ СѓРґР°Р»РѕСЃСЊ РїРѕР»СѓС‡РёС‚СЊ РІРѕРїСЂРѕСЃС‹ РґР»СЏ РІРёРєС‚РѕСЂРёРЅС‹ #%d: %v", quiz.ID, qErr)
		}
		if len(questions) == 0 && len(eliminations) > 0 {
			for _, e := range eliminations {
				q, fetchErr := s.questionRepo.GetByID(e.QuestionID)
				if fetchErr != nil {
					log.Printf("[ResultService] WARNING: РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РІРѕРїСЂРѕСЃ #%d: %v", e.QuestionID, fetchErr)
					continue
				}
				if q != nil {
					questions = append(questions, *q)
				}
			}
		}

		questionOrder := make(map[uint]int)
		questionDifficulty := make(map[uint]int)
		for i, q := range questions {
			questionOrder[q.ID] = i + 1
			questionDifficulty[q.ID] = q.Difficulty
		}

		var diffDist DifficultyDistribution
		var poolUsed int
		for _, q := range questions {
			switch q.Difficulty {
			case 1:
				diffDist.Difficulty1++
			case 2:
				diffDist.Difficulty2++
			case 3:
				diffDist.Difficulty3++
			case 4:
				diffDist.Difficulty4++
			case 5:
				diffDist.Difficulty5++
			}
			if q.QuizID == nil {
				poolUsed++
			}
		}
		stats.DifficultyDistribution = diffDist
		stats.PoolQuestionsUsed = poolUsed

		stats.EliminationsByQ = make([]QuestionElimination, 0, len(eliminations))
		var totalPassRate float64
		for _, e := range eliminations {
			qNum := questionOrder[e.QuestionID]
			if qNum == 0 {
				qNum = int(e.QuestionID)
			}
			passRate := 0.0
			if e.TotalAnswers > 0 {
				passRate = float64(e.PassedCount) / float64(e.TotalAnswers)
			}
			totalPassRate += passRate

			stats.EliminationsByQ = append(stats.EliminationsByQ, QuestionElimination{
				QuestionNumber:  qNum,
				QuestionID:      e.QuestionID,
				EliminatedCount: e.EliminatedCount,
				ByTimeout:       e.ByTimeout,
				ByWrongAnswer:   e.ByWrongAnswer,
				AvgResponseMs:   e.AvgRespMs,
				Difficulty:      questionDifficulty[e.QuestionID],
				PassRate:        passRate,
				TotalAnswers:    e.TotalAnswers,
			})
		}
		if len(eliminations) > 0 {
			stats.AvgPassRate = totalPassRate / float64(len(eliminations))
		}
	}

	// 4. РћР±С‰РёРµ РїСЂРёС‡РёРЅС‹ РІС‹Р±С‹С‚РёСЏ
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

	log.Printf("[ResultService] РЎС‚Р°С‚РёСЃС‚РёРєР° РґР»СЏ РІРёРєС‚РѕСЂРёРЅС‹ #%d: %d СѓС‡Р°СЃС‚РЅРёРєРѕРІ, %d РїРѕР±РµРґРёС‚РµР»РµР№, %d РІС‹Р±С‹Р»Рѕ",
		quizID, stats.TotalParticipants, stats.TotalWinners, stats.TotalEliminated)

	return stats, nil
}

// getTotalQuestions РѕРїСЂРµРґРµР»СЏРµС‚ РѕР±С‰РµРµ РєРѕР»РёС‡РµСЃС‚РІРѕ РІРѕРїСЂРѕСЃРѕРІ РІ РІРёРєС‚РѕСЂРёРЅРµ.
// Р•РґРёРЅС‹Р№ РёСЃС‚РѕС‡РЅРёРє РёСЃС‚РёРЅС‹. РџСЂРёРѕСЂРёС‚РµС‚:
//  1. quiz.QuestionCount (С„РёРєСЃРёСЂСѓРµС‚СЃСЏ РїСЂРё СЃС‚Р°СЂС‚Рµ РІ triggerQuizStart)
//  2. len(quiz.Questions) (legacy fallback РґР»СЏ СЃС‚Р°СЂС‹С… РІРёРєС‚РѕСЂРёРЅ)
//  3. config.MaxQuestionsPerQuiz (С„РёРЅР°Р»СЊРЅС‹Р№ fallback)
func (s *ResultService) getTotalQuestions(quiz *entity.Quiz) int {
	// РџСЂРёРѕСЂРёС‚РµС‚: QuestionCount вЂ” Р°РІС‚РѕСЂРёС‚РµС‚РЅС‹Р№ РёСЃС‚РѕС‡РЅРёРє
	if quiz.QuestionCount > 0 {
		return quiz.QuestionCount
	}

	// Legacy fallback: GORM Р°СЃСЃРѕС†РёР°С†РёСЏ (РґР»СЏ СЃС‚Р°СЂС‹С… РІРёРєС‚РѕСЂРёРЅ Р±РµР· QuestionCount)
	if len(quiz.Questions) > 0 {
		return len(quiz.Questions)
	}

	// Р”Р»СЏ Р·Р°РІРµСЂС€С‘РЅРЅРѕР№ РІРёРєС‚РѕСЂРёРЅС‹ РЅРµ РїРѕРґСЃС‚Р°РІР»СЏРµРј "РїР»Р°РЅРѕРІРѕРµ" Р·РЅР°С‡РµРЅРёРµ РёР· РєРѕРЅС„РёРіР°:
	// РµСЃР»Рё РІРѕРїСЂРѕСЃРѕРІ С„Р°РєС‚РёС‡РµСЃРєРё РЅРµ Р±С‹Р»Рѕ, РєРѕСЂСЂРµРєС‚РЅРµРµ РІРµСЂРЅСѓС‚СЊ 0 Рё РїСЂРѕРїСѓСЃС‚РёС‚СЊ winners flow.
	if quiz.Status == entity.QuizStatusCompleted {
		log.Printf("[ResultService] getTotalQuestions: РІРёРєС‚РѕСЂРёРЅР° #%d Р·Р°РІРµСЂС€РµРЅР° Р±РµР· РІРѕРїСЂРѕСЃРѕРІ (QuestionCount=0, Questions=0)", quiz.ID)
		return 0
	}

	// Р¤РёРЅР°Р»СЊРЅС‹Р№ fallback вЂ” РєРѕРЅС„РёРі
	if s.config != nil && s.config.MaxQuestionsPerQuiz > 0 {
		log.Printf("[ResultService] getTotalQuestions: РІРёРєС‚РѕСЂРёРЅР° #%d вЂ” fallback РЅР° MaxQuestionsPerQuiz=%d",
			quiz.ID, s.config.MaxQuestionsPerQuiz)
		return s.config.MaxQuestionsPerQuiz
	}

	log.Printf("[ResultService] WARNING: РќРµ СѓРґР°Р»РѕСЃСЊ РѕРїСЂРµРґРµР»РёС‚СЊ РєРѕР»РёС‡РµСЃС‚РІРѕ РІРѕРїСЂРѕСЃРѕРІ РґР»СЏ РІРёРєС‚РѕСЂРёРЅС‹ #%d (Questions=%d, QuestionCount=%d)",
		quiz.ID, len(quiz.Questions), quiz.QuestionCount)
	return 0
}


