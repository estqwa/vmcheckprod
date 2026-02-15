package handler

import (
	"errors"
	"fmt"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	apperrors "github.com/yourusername/trivia-api/internal/pkg/errors"
	"github.com/yourusername/trivia-api/internal/service"
	"github.com/yourusername/trivia-api/pkg/auth/manager"
)

// MobileAuthHandler обрабатывает запросы аутентификации от мобильных клиентов.
// Отличия от web AuthHandler:
//   - Токены возвращаются в JSON (не в cookies)
//   - CSRF не используется (CSRF — браузерная атака, на mobile не актуальна)
//   - Refresh token принимается из JSON body (не из cookie)
type MobileAuthHandler struct {
	authService  *service.AuthService
	tokenManager *manager.TokenManager
}

// NewMobileAuthHandler создает новый обработчик мобильной аутентификации
func NewMobileAuthHandler(authService *service.AuthService, tokenManager *manager.TokenManager) *MobileAuthHandler {
	return &MobileAuthHandler{
		authService:  authService,
		tokenManager: tokenManager,
	}
}

// --- Mobile-specific request/response DTOs ---
// Отдельные DTO, чтобы не менять JSON-теги manager.TokenResponse (web)

// MobileAuthResponse — ответ для мобильного клиента при login/register
type MobileAuthResponse struct {
	User         interface{} `json:"user"`
	AccessToken  string      `json:"accessToken"`
	RefreshToken string      `json:"refreshToken"`
	UserID       uint        `json:"userId"`
	ExpiresIn    int         `json:"expiresIn"`
	TokenType    string      `json:"tokenType"`
}

// MobileRefreshRequest — запрос на обновление токенов от mobile
type MobileRefreshRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
	DeviceID     string `json:"device_id" binding:"required"`
}

// MobileRefreshResponse — ответ на обновление токенов для mobile
type MobileRefreshResponse struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
	UserID       uint   `json:"userId"`
	ExpiresIn    int    `json:"expiresIn"`
	TokenType    string `json:"tokenType"`
}

// MobileLogoutRequest — запрос на выход от mobile
type MobileLogoutRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

// MobileLoginRequest — запрос на вход от mobile
type MobileLoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
	DeviceID string `json:"device_id" binding:"required"`
}

// MobileRegisterRequest — запрос на регистрацию от mobile
type MobileRegisterRequest struct {
	Username string `json:"username" binding:"required,min=3,max=50"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6,max=50"`
	DeviceID string `json:"device_id" binding:"required"`
}

// --- Handlers ---

// MobileLogin обрабатывает вход с мобильного устройства.
// Возвращает accessToken + refreshToken в JSON, cookies не устанавливает.
func (h *MobileAuthHandler) MobileLogin(c *gin.Context) {
	var req MobileLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request data", "details": err.Error()})
		return
	}

	ipAddress := c.ClientIP()
	userAgent := c.Request.UserAgent()

	// Используем тот же AuthService.LoginUser — общая бизнес-логика
	tokenResp, err := h.authService.LoginUser(req.Email, req.Password, req.DeviceID, ipAddress, userAgent)
	if err != nil {
		h.handleAuthError(c, err)
		return
	}

	if tokenResp.RefreshToken == "" {
		log.Printf("[MobileAuth] ОШИБКА: RefreshToken пустой после логина для пользователя ID=%d", tokenResp.UserID)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate authentication tokens"})
		return
	}

	// Получаем информацию о пользователе
	user, userErr := h.authService.GetUserByID(tokenResp.UserID)
	if userErr != nil {
		log.Printf("[MobileAuth] Ошибка получения пользователя ID=%d после логина: %v", tokenResp.UserID, userErr)
	}

	// Возвращаем токены в JSON (БЕЗ cookies, БЕЗ CSRF)
	c.JSON(http.StatusOK, MobileAuthResponse{
		User:         serializeUserForClient(user),
		AccessToken:  tokenResp.AccessToken,
		RefreshToken: tokenResp.RefreshToken,
		UserID:       tokenResp.UserID,
		ExpiresIn:    tokenResp.ExpiresIn,
		TokenType:    "Bearer",
	})
}

// MobileRegister обрабатывает регистрацию с мобильного устройства.
// Возвращает accessToken + refreshToken в JSON, cookies не устанавливает.
func (h *MobileAuthHandler) MobileRegister(c *gin.Context) {
	var req MobileRegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Регистрируем пользователя — та же бизнес-логика
	user, err := h.authService.RegisterUser(req.Username, req.Email, req.Password)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	log.Printf("[MobileAuth] Пользователь ID=%d (%s) зарегистрирован через mobile", user.ID, user.Email)

	// Генерируем токены
	tokenResp, err := h.tokenManager.GenerateTokenPair(user.ID, req.DeviceID, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		h.handleAuthError(c, fmt.Errorf("failed to generate tokens after registration: %w", err))
		return
	}

	if tokenResp.RefreshToken == "" {
		log.Printf("[MobileAuth] ОШИБКА: RefreshToken пустой после регистрации для пользователя ID=%d", user.ID)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate authentication tokens"})
		return
	}

	c.JSON(http.StatusCreated, MobileAuthResponse{
		User:         serializeUserForClient(user),
		AccessToken:  tokenResp.AccessToken,
		RefreshToken: tokenResp.RefreshToken,
		UserID:       tokenResp.UserID,
		ExpiresIn:    tokenResp.ExpiresIn,
		TokenType:    "Bearer",
	})
}

// MobileRefresh обновляет пару токенов.
// Принимает refresh_token из JSON body (не из cookie), без CSRF-проверки.
func (h *MobileAuthHandler) MobileRefresh(c *gin.Context) {
	var req MobileRefreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request data", "details": err.Error()})
		return
	}

	ipAddress := c.ClientIP()
	userAgent := c.Request.UserAgent()

	// Вызываем TokenManager.RefreshTokens напрямую, без CSRF-валидации.
	// TokenManager.RefreshTokens внутри НЕ проверяет CSRF — проверка была в web handler.
	// Передаём пустой csrfTokenHeader — TokenManager его не использует.
	tokenResp, err := h.tokenManager.RefreshTokens(req.RefreshToken, "", req.DeviceID, ipAddress, userAgent)
	if err != nil {
		h.handleAuthError(c, err)
		return
	}

	if tokenResp.RefreshToken == "" {
		log.Printf("[MobileAuth] ОШИБКА: RefreshToken пустой после обновления для пользователя ID=%d", tokenResp.UserID)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate new tokens"})
		return
	}

	c.JSON(http.StatusOK, MobileRefreshResponse{
		AccessToken:  tokenResp.AccessToken,
		RefreshToken: tokenResp.RefreshToken,
		UserID:       tokenResp.UserID,
		ExpiresIn:    tokenResp.ExpiresIn,
		TokenType:    "Bearer",
	})
}

// MobileLogout обрабатывает выход с мобильного устройства.
// НЕ требует RequireAuth() — принимает refresh_token из body.
// Это позволяет выйти даже с протухшим access token.
func (h *MobileAuthHandler) MobileLogout(c *gin.Context) {
	var req MobileLogoutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request data", "details": err.Error()})
		return
	}

	// Отзываем refresh token — та же бизнес-логика
	err := h.authService.LogoutUser(req.RefreshToken)
	if err != nil {
		log.Printf("[MobileAuth] Ошибка при logout: %v", err)
		// Не возвращаем ошибку клиенту — logout должен быть идемпотентным
	}

	c.JSON(http.StatusOK, gin.H{"message": "Successfully logged out"})
}

// MobileWsTicket генерирует WebSocket тикет для мобильного клиента.
// Требует только RequireAuth() (Bearer token), без CSRF.
func (h *MobileAuthHandler) MobileWsTicket(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized", "error_type": "token_missing"})
		return
	}

	email, emailExists := c.Get("email")
	if !emailExists {
		// Если email нет в контексте, получаем из БД
		user, err := h.authService.GetUserByID(userID.(uint))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch user data"})
			return
		}
		email = user.Email
	}

	// Та же логика генерации тикета
	ticket, err := h.authService.GenerateWsTicket(c.Request.Context(), userID.(uint), email.(string))
	if err != nil {
		log.Printf("[MobileAuth] Ошибка генерации WS-тикета: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate WebSocket ticket"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"ticket": ticket,
		},
	})
}

// --- Error handling ---

// handleAuthError обрабатывает ошибки аутентификации для mobile.
// Использует тот же паттерн errors.As/errors.Is, что и web handler.
func (h *MobileAuthHandler) handleAuthError(c *gin.Context, err error) {
	var tokenErr *manager.TokenError
	log.Printf("[MobileAuth] Auth Error: %v", err)

	if errors.As(err, &tokenErr) {
		switch tokenErr.Type {
		case manager.ExpiredRefreshToken, manager.ExpiredAccessToken:
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Session expired", "error_type": "token_expired"})
		case manager.InvalidRefreshToken, manager.InvalidAccessToken:
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token", "error_type": "token_invalid"})
		case manager.UserNotFound:
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials", "error_type": "invalid_credentials"})
		case manager.TokenGenerationFailed:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Token generation failed", "error_type": "token_generation_failed"})
		case manager.TooManySessions:
			c.JSON(http.StatusConflict, gin.H{"error": "Too many active sessions", "error_type": "too_many_sessions"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Authentication error", "error_type": string(tokenErr.Type)})
		}
	} else if errors.Is(err, apperrors.ErrUnauthorized) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials", "error_type": "unauthorized"})
	} else if errors.Is(err, apperrors.ErrForbidden) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied", "error_type": "forbidden"})
	} else if errors.Is(err, apperrors.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Resource not found", "error_type": "not_found"})
	} else if errors.Is(err, apperrors.ErrConflict) {
		c.JSON(http.StatusConflict, gin.H{"error": "Data conflict", "error_type": "conflict"})
	} else if errors.Is(err, apperrors.ErrValidation) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation error", "error_type": "validation_error"})
	} else if errors.Is(err, apperrors.ErrExpiredToken) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Token expired", "error_type": "token_expired"})
	} else {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error", "error_type": "internal_server_error"})
	}
}
