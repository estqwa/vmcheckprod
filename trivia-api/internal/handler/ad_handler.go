package handler

import (
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/yourusername/trivia-api/internal/service"
)

// AdHandler обрабатывает HTTP запросы для управления рекламой
type AdHandler struct {
	adService         *service.AdService
	quizAdSlotService *service.QuizAdSlotService
}

// NewAdHandler создаёт новый обработчик рекламы
func NewAdHandler(adService *service.AdService, quizAdSlotService *service.QuizAdSlotService) *AdHandler {
	return &AdHandler{
		adService:         adService,
		quizAdSlotService: quizAdSlotService,
	}
}

// UploadAdAsset загружает рекламный медиа-файл
// POST /api/admin/ads
func (h *AdHandler) UploadAdAsset(c *gin.Context) {
	// Получаем файл
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "файл не найден: " + err.Error()})
		return
	}

	// Ограничение размера файла (50 MB)
	if file.Size > 50*1024*1024 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "файл слишком большой (макс. 50 MB)"})
		return
	}

	// Получаем параметры
	title := c.PostForm("title")
	if title == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "title обязателен"})
		return
	}

	mediaType := c.PostForm("media_type")
	if mediaType != "image" && mediaType != "video" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "media_type должен быть 'image' или 'video'"})
		return
	}

	durationSecStr := c.PostForm("duration_sec")
	durationSec := 10 // default
	if durationSecStr != "" {
		if d, err := strconv.Atoi(durationSecStr); err == nil && d >= 3 && d <= 30 {
			durationSec = d
		}
	}

	// Загружаем файл
	asset, err := h.adService.UploadAdAsset(file, title, mediaType, durationSec)
	if err != nil {
		log.Printf("[AdHandler] Ошибка загрузки рекламы: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, asset)
}

// ListAdAssets возвращает список всех рекламных ресурсов
// GET /api/admin/ads
func (h *AdHandler) ListAdAssets(c *gin.Context) {
	assets, err := h.adService.ListAdAssets()
	if err != nil {
		log.Printf("[AdHandler] Ошибка получения списка рекламы: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "не удалось получить список"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"items": assets})
}

// DeleteAdAsset удаляет рекламный ресурс
// DELETE /api/admin/ads/:id
func (h *AdHandler) DeleteAdAsset(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "некорректный ID"})
		return
	}

	if err := h.adService.DeleteAdAsset(uint(id)); err != nil {
		log.Printf("[AdHandler] Ошибка удаления рекламы #%d: %v", id, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "реклама удалена"})
}

// --- Рекламные слоты викторины ---

// CreateAdSlot создаёт рекламный слот для викторины
// POST /api/quizzes/:id/ad-slots
func (h *AdHandler) CreateAdSlot(c *gin.Context) {
	quizID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "некорректный quiz_id"})
		return
	}

	var req service.CreateSlotRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	slot, err := h.quizAdSlotService.CreateSlot(uint(quizID), req)
	if err != nil {
		log.Printf("[AdHandler] Ошибка создания слота для викторины #%d: %v", quizID, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, slot)
}

// ListAdSlots возвращает все слоты викторины
// GET /api/quizzes/:id/ad-slots
func (h *AdHandler) ListAdSlots(c *gin.Context) {
	quizID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "некорректный quiz_id"})
		return
	}

	slots, err := h.quizAdSlotService.ListSlots(uint(quizID))
	if err != nil {
		log.Printf("[AdHandler] Ошибка получения слотов для викторины #%d: %v", quizID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "не удалось получить слоты"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"items": slots})
}

// UpdateAdSlot обновляет рекламный слот
// PUT /api/quizzes/:id/ad-slots/:slotId
func (h *AdHandler) UpdateAdSlot(c *gin.Context) {
	slotID, err := strconv.ParseUint(c.Param("slotId"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "некорректный slot_id"})
		return
	}

	var req struct {
		IsActive bool `json:"is_active"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	slot, err := h.quizAdSlotService.UpdateSlot(uint(slotID), req.IsActive)
	if err != nil {
		log.Printf("[AdHandler] Ошибка обновления слота #%d: %v", slotID, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, slot)
}

// DeleteAdSlot удаляет рекламный слот
// DELETE /api/quizzes/:id/ad-slots/:slotId
func (h *AdHandler) DeleteAdSlot(c *gin.Context) {
	slotID, err := strconv.ParseUint(c.Param("slotId"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "некорректный slot_id"})
		return
	}

	if err := h.quizAdSlotService.DeleteSlot(uint(slotID)); err != nil {
		log.Printf("[AdHandler] Ошибка удаления слота #%d: %v", slotID, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "слот удалён"})
}
