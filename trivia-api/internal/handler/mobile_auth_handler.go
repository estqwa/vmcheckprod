package handler

import (
	"errors"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	apperrors "github.com/yourusername/trivia-api/internal/pkg/errors"
	"github.com/yourusername/trivia-api/internal/service"
	"github.com/yourusername/trivia-api/internal/websocket"
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
	wsHub        websocket.HubInterface
}

// NewMobileAuthHandler создает новый обработчик мобильной аутентификации
func NewMobileAuthHandler(authService *service.AuthService, tokenManager *manager.TokenManager, wsHub websocket.HubInterface) *MobileAuthHandler {
	return &MobileAuthHandler{
		authService:  authService,
		tokenManager: tokenManager,
		wsHub:        wsHub,
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
	Username  string `json:"username" binding:"required,min=3,max=50"`
	Email     string `json:"email" binding:"required,email"`
	Password  string `json:"password" binding:"required,min=6,max=50"`
	DeviceID  string `json:"device_id" binding:"required"`
	FirstName string `json:"first_name" binding:"required,min=1,max=100"`
	LastName  string `json:"last_name" binding:"required,min=1,max=100"`
	BirthDate string `json:"birth_date" binding:"required"` // format: "2006-01-02"
	Gender    string `json:"gender" binding:"required,oneof=male female other prefer_not_to_say"`

	TOSAccepted     bool `json:"tos_accepted" binding:"required"`
	PrivacyAccepted bool `json:"privacy_accepted" binding:"required"`
	MarketingOptIn  bool `json:"marketing_opt_in"`
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

	// Парсим birth_date
	birthDate, parseErr := time.Parse("2006-01-02", req.BirthDate)
	if parseErr != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid birth_date format, expected YYYY-MM-DD"})
		return
	}

	input := service.RegisterInput{
		Username:        req.Username,
		Email:           req.Email,
		Password:        req.Password,
		FirstName:       req.FirstName,
		LastName:        req.LastName,
		BirthDate:       &birthDate,
		Gender:          req.Gender,
		TOSAccepted:     req.TOSAccepted,
		PrivacyAccepted: req.PrivacyAccepted,
		MarketingOptIn:  req.MarketingOptIn,
		IP:              c.ClientIP(),
		UserAgent:       c.Request.UserAgent(),
	}

	user, err := h.authService.RegisterUser(input)
	if err != nil {
		h.handleAuthError(c, err)
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

// MobileUpdateProfile обновляет профиль пользователя без CSRF.
// Endpoint предназначен для mobile-клиента с Bearer auth.
func (h *MobileAuthHandler) MobileUpdateProfile(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized", "error_type": "token_missing"})
		return
	}

	var req UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.authService.UpdateUserProfile(userID.(uint), req.Username, req.ProfilePicture); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Profile updated successfully"})
}

// MobileGetActiveSessions returns active sessions for the current mobile user.
func (h *MobileAuthHandler) MobileGetActiveSessions(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized", "error_type": "token_missing"})
		return
	}

	sessions, err := h.authService.GetUserActiveSessions(userID.(uint))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get active sessions", "error_type": "internal_error"})
		return
	}

	result := make([]SessionInfo, 0, len(sessions))
	for _, session := range sessions {
		result = append(result, SessionInfo{
			ID:        session.ID,
			DeviceID:  session.DeviceID,
			IPAddress: session.IPAddress,
			UserAgent: session.UserAgent,
			CreatedAt: session.CreatedAt,
			ExpiresAt: session.ExpiresAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"sessions": result,
		"count":    len(result),
	})
}

// MobileRevokeSession revokes a specific user session by ID for mobile clients.
func (h *MobileAuthHandler) MobileRevokeSession(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized", "error_type": "token_missing"})
		return
	}

	var req RevokeSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request data", "error_type": "invalid_request"})
		return
	}

	token, err := h.authService.GetRefreshTokenByID(req.SessionID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Session not found", "error_type": "session_not_found"})
		return
	}

	if token.UserID != userID.(uint) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden", "error_type": "forbidden"})
		return
	}

	reason := c.Query("reason")
	if reason == "" {
		reason = "user_revoked"
	}

	if err := h.authService.RevokeSessionByID(req.SessionID, reason); err != nil {
		log.Printf("[MobileAuth] Failed to revoke session %d: %v", req.SessionID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to revoke session", "error_type": "internal_error"})
		return
	}

	sessionEvent := map[string]interface{}{
		"event":      "session_revoked",
		"session_id": req.SessionID,
		"timestamp":  time.Now().Format(time.RFC3339),
		"reason":     reason,
		"user_id":    token.UserID,
	}
	if err := h.sendWebSocketNotification(token.UserID, sessionEvent); err != nil {
		log.Printf("[MobileAuth] Failed to send WebSocket revoke notification: %v", err)
	}

	c.JSON(http.StatusOK, gin.H{
		"message":    "Session revoked successfully",
		"session_id": req.SessionID,
	})
}

// MobileLogoutAllDevices revokes all user sessions for mobile clients.
func (h *MobileAuthHandler) MobileLogoutAllDevices(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized", "error_type": "token_missing"})
		return
	}

	if err := h.authService.RevokeAllUserSessions(userID.(uint), "user_logout_all"); err != nil {
		log.Printf("[MobileAuth] Failed to logout all devices for user %d: %v", userID.(uint), err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to logout from all devices", "error_type": "internal_error"})
		return
	}

	logoutEvent := map[string]interface{}{
		"event":     "logout_all_devices",
		"user_id":   userID,
		"timestamp": time.Now().Format(time.RFC3339),
		"reason":    "user_logout_all",
	}
	if err := h.sendWebSocketNotification(userID.(uint), logoutEvent); err != nil {
		log.Printf("[MobileAuth] Failed to send WebSocket logout-all notification: %v", err)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Successfully logged out from all devices"})
}

func (h *MobileAuthHandler) sendWebSocketNotification(userID uint, event map[string]interface{}) error {
	if h.wsHub == nil {
		return nil
	}
	return h.wsHub.SendJSONToUser(fmt.Sprintf("%d", userID), event)
}

// --- Error handling ---

// handleAuthError обрабатывает ошибки аутентификации для mobile.
// Использует тот же паттерн errors.As/errors.Is, что и web handler.
func (h *MobileAuthHandler) handleAuthError(c *gin.Context, err error) {
	var tokenErr *manager.TokenError
	log.Printf("[MobileAuth] Auth Error: %v", err)

	if errors.Is(err, service.ErrFeatureDisabled) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Feature is disabled", "error_type": "feature_disabled"})
	} else if errors.Is(err, service.ErrLinkRequired) {
		c.JSON(http.StatusConflict, gin.H{"error": "Google account requires explicit linking", "error_type": "link_required"})
	} else if errors.Is(err, service.ErrEmailNotVerified) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Email is not verified", "error_type": "email_not_verified"})
	} else if errors.Is(err, service.ErrInvalidVerificationCode) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid verification code", "error_type": "invalid_verification_code"})
	} else if errors.Is(err, service.ErrVerificationExpired) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Verification code expired", "error_type": "verification_expired"})
	} else if errors.Is(err, service.ErrVerificationAttemptsExceeded) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Verification attempts exceeded", "error_type": "verification_attempts_exceeded"})
	} else if errors.Is(err, service.ErrVerificationResendCooldown) {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "Too many requests", "error_type": "rate_limited"})
	} else if errors.Is(err, service.ErrGoogleTokenVerificationFailed) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Google token verification failed", "error_type": "token_invalid"})
	} else if errors.As(err, &tokenErr) {
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
