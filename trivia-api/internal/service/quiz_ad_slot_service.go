package service

import (
	"fmt"
	"log"

	"github.com/yourusername/trivia-api/internal/domain/entity"
	"github.com/yourusername/trivia-api/internal/domain/repository"
)

// QuizAdSlotService предоставляет методы для работы с рекламными слотами викторин
type QuizAdSlotService struct {
	slotRepo    repository.QuizAdSlotRepository
	adAssetRepo repository.AdAssetRepository
	quizRepo    repository.QuizRepository
}

// NewQuizAdSlotService создаёт новый сервис рекламных слотов
func NewQuizAdSlotService(
	slotRepo repository.QuizAdSlotRepository,
	adAssetRepo repository.AdAssetRepository,
	quizRepo repository.QuizRepository,
) *QuizAdSlotService {
	return &QuizAdSlotService{
		slotRepo:    slotRepo,
		adAssetRepo: adAssetRepo,
		quizRepo:    quizRepo,
	}
}

// CreateSlotRequest DTO для создания рекламного слота
type CreateSlotRequest struct {
	QuestionAfter int  `json:"question_after" binding:"required,min=1"`
	AdAssetID     uint `json:"ad_asset_id" binding:"required"`
	IsActive      bool `json:"is_active"`
}

// CreateSlot создаёт рекламный слот для викторины
func (s *QuizAdSlotService) CreateSlot(quizID uint, req CreateSlotRequest) (*entity.QuizAdSlot, error) {
	// Проверяем существование викторины
	quiz, err := s.quizRepo.GetWithQuestions(quizID)
	if err != nil {
		return nil, fmt.Errorf("викторина не найдена: %w", err)
	}

	// Проверяем, что question_after не превышает количество вопросов
	if req.QuestionAfter > len(quiz.Questions) {
		return nil, fmt.Errorf("question_after (%d) превышает количество вопросов (%d)", req.QuestionAfter, len(quiz.Questions))
	}

	// Проверяем существование рекламного ресурса
	asset, err := s.adAssetRepo.GetByID(req.AdAssetID)
	if err != nil {
		return nil, fmt.Errorf("рекламный ресурс не найден: %w", err)
	}

	slot := &entity.QuizAdSlot{
		QuizID:        quizID,
		QuestionAfter: req.QuestionAfter,
		AdAssetID:     req.AdAssetID,
		IsActive:      req.IsActive,
	}

	if err := s.slotRepo.Create(slot); err != nil {
		return nil, fmt.Errorf("не удалось создать слот: %w", err)
	}

	// Подгружаем AdAsset для ответа
	slot.AdAsset = asset

	log.Printf("[QuizAdSlotService] Создан слот #%d для викторины #%d после вопроса %d", slot.ID, quizID, req.QuestionAfter)
	return slot, nil
}

// ListSlots возвращает все слоты викторины
func (s *QuizAdSlotService) ListSlots(quizID uint) ([]entity.QuizAdSlot, error) {
	return s.slotRepo.ListByQuizID(quizID)
}

// GetSlotForQuestion возвращает активный слот для конкретного номера вопроса
func (s *QuizAdSlotService) GetSlotForQuestion(quizID uint, questionNumber int) (*entity.QuizAdSlot, error) {
	return s.slotRepo.GetByQuizAndQuestionAfter(quizID, questionNumber)
}

// UpdateSlot обновляет рекламный слот
func (s *QuizAdSlotService) UpdateSlot(slotID uint, isActive bool) (*entity.QuizAdSlot, error) {
	slot, err := s.slotRepo.GetByID(slotID)
	if err != nil {
		return nil, fmt.Errorf("слот не найден: %w", err)
	}

	slot.IsActive = isActive
	if err := s.slotRepo.Update(slot); err != nil {
		return nil, fmt.Errorf("не удалось обновить слот: %w", err)
	}

	log.Printf("[QuizAdSlotService] Обновлён слот #%d: is_active=%t", slotID, isActive)
	return slot, nil
}

// DeleteSlot удаляет рекламный слот
func (s *QuizAdSlotService) DeleteSlot(slotID uint) error {
	if err := s.slotRepo.Delete(slotID); err != nil {
		return fmt.Errorf("не удалось удалить слот: %w", err)
	}
	log.Printf("[QuizAdSlotService] Удалён слот #%d", slotID)
	return nil
}

// GetAllActiveSlots возвращает все активные слоты для викторины (для QuestionManager)
func (s *QuizAdSlotService) GetAllActiveSlots(quizID uint) (map[int]*entity.QuizAdSlot, error) {
	slots, err := s.slotRepo.ListByQuizID(quizID)
	if err != nil {
		return nil, err
	}

	result := make(map[int]*entity.QuizAdSlot)
	for i := range slots {
		if slots[i].IsActive {
			result[slots[i].QuestionAfter] = &slots[i]
		}
	}
	return result, nil
}
