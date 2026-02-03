package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/yourusername/trivia-api/internal/service"
)

// UserHandler обрабатывает запросы, связанные с пользователями
type UserHandler struct {
	userService   *service.UserService
	resultService *service.ResultService
}

// NewUserHandler создает новый обработчик пользователей
func NewUserHandler(userService *service.UserService, resultService *service.ResultService) *UserHandler {
	return &UserHandler{
		userService:   userService,
		resultService: resultService,
	}
}

// GetLeaderboard обрабатывает запрос на получение лидерборда
func (h *UserHandler) GetLeaderboard(c *gin.Context) {
	// Получаем параметры пагинации из query
	pageStr := c.DefaultQuery("page", "1")
	pageSizeStr := c.DefaultQuery("page_size", "10")

	page, err := strconv.Atoi(pageStr)
	if err != nil || page < 1 {
		page = 1
	}

	pageSize, err := strconv.Atoi(pageSizeStr)
	if err != nil || pageSize < 1 {
		pageSize = 10 // Значение по умолчанию
	} else if pageSize > 100 {
		pageSize = 100 // Максимальный лимит
	}

	// Вызываем сервис
	leaderboard, err := h.userService.GetLeaderboard(page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error getting leaderboard"})
		return
	}

	c.JSON(http.StatusOK, leaderboard)
}

// GetMyResults возвращает историю игр текущего пользователя
// GET /api/users/me/results?page=1&page_size=10
func (h *UserHandler) GetMyResults(c *gin.Context) {
	// Получаем user_id из контекста (установлен middleware RequireAuth)
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Получаем параметры пагинации
	pageStr := c.DefaultQuery("page", "1")
	pageSizeStr := c.DefaultQuery("page_size", "10")

	page, err := strconv.Atoi(pageStr)
	if err != nil || page < 1 {
		page = 1
	}

	pageSize, err := strconv.Atoi(pageSizeStr)
	if err != nil || pageSize < 1 {
		pageSize = 10
	} else if pageSize > 50 {
		pageSize = 50 // Лимит для истории игр
	}

	// Вызываем сервис
	results, total, err := h.resultService.GetUserResults(userID.(uint), page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get game history"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"results":   results,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}
