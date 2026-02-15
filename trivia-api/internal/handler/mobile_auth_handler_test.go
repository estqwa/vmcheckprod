package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apperrors "github.com/yourusername/trivia-api/internal/pkg/errors"
	"github.com/yourusername/trivia-api/pkg/auth/manager"
)

func init() {
	gin.SetMode(gin.TestMode)
}

// newTestGinContext создает *gin.Context для тестов с JSON body
func newTestGinContext(method, path string, body interface{}) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()

	var req *http.Request
	if body != nil {
		bodyBytes, _ := json.Marshal(body)
		req, _ = http.NewRequest(method, path, bytes.NewReader(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
	} else {
		req, _ = http.NewRequest(method, path, nil)
	}

	c, _ := gin.CreateTestContext(w)
	c.Request = req
	return c, w
}

// parseJSONResponse парсит JSON ответ из *httptest.ResponseRecorder
func parseJSONResponse(t *testing.T, w *httptest.ResponseRecorder) map[string]interface{} {
	t.Helper()
	var resp map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &resp)
	require.NoError(t, err, "Response body should be valid JSON: %s", w.Body.String())
	return resp
}

// ============================================================================
// Request validation tests — не требуют реального AuthService/TokenManager
// Handler возвращает 400 до вызова сервиса
// ============================================================================

func TestMobileLogin_ValidationErrors(t *testing.T) {
	handler := &MobileAuthHandler{} // nil service, nil tokenManager — OK для validation tests

	tests := []struct {
		name       string
		body       interface{}
		wantStatus int
		wantField  string // ожидаемое слово в ошибке
	}{
		{
			name:       "empty body",
			body:       nil,
			wantStatus: http.StatusBadRequest,
			wantField:  "Invalid request data",
		},
		{
			name:       "missing email",
			body:       map[string]string{"password": "123456", "device_id": "test-device"},
			wantStatus: http.StatusBadRequest,
			wantField:  "Invalid request data",
		},
		{
			name:       "missing password",
			body:       map[string]string{"email": "user@test.com", "device_id": "test-device"},
			wantStatus: http.StatusBadRequest,
			wantField:  "Invalid request data",
		},
		{
			name:       "missing device_id",
			body:       map[string]string{"email": "user@test.com", "password": "123456"},
			wantStatus: http.StatusBadRequest,
			wantField:  "Invalid request data",
		},
		{
			name:       "invalid email format",
			body:       map[string]string{"email": "not-an-email", "password": "123456", "device_id": "test-device"},
			wantStatus: http.StatusBadRequest,
			wantField:  "Invalid request data",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, w := newTestGinContext("POST", "/api/mobile/auth/login", tt.body)
			handler.MobileLogin(c)

			assert.Equal(t, tt.wantStatus, w.Code)
			resp := parseJSONResponse(t, w)
			assert.Contains(t, resp["error"], tt.wantField)
		})
	}
}

func TestMobileRegister_ValidationErrors(t *testing.T) {
	handler := &MobileAuthHandler{}

	tests := []struct {
		name       string
		body       interface{}
		wantStatus int
	}{
		{
			name:       "empty body",
			body:       nil,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "missing username",
			body:       map[string]string{"email": "user@test.com", "password": "123456", "device_id": "dev1"},
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "missing device_id",
			body:       map[string]string{"username": "testuser", "email": "user@test.com", "password": "123456"},
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "username too short",
			body:       map[string]string{"username": "ab", "email": "user@test.com", "password": "123456", "device_id": "dev1"},
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "password too short",
			body:       map[string]string{"username": "testuser", "email": "user@test.com", "password": "12345", "device_id": "dev1"},
			wantStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, w := newTestGinContext("POST", "/api/mobile/auth/register", tt.body)
			handler.MobileRegister(c)

			assert.Equal(t, tt.wantStatus, w.Code)
			resp := parseJSONResponse(t, w)
			assert.NotEmpty(t, resp["error"])
		})
	}
}

func TestMobileRefresh_ValidationErrors(t *testing.T) {
	handler := &MobileAuthHandler{}

	tests := []struct {
		name       string
		body       interface{}
		wantStatus int
	}{
		{
			name:       "empty body",
			body:       nil,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "missing refresh_token",
			body:       map[string]string{"device_id": "test-device"},
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "missing device_id",
			body:       map[string]string{"refresh_token": "some-token"},
			wantStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, w := newTestGinContext("POST", "/api/mobile/auth/refresh", tt.body)
			handler.MobileRefresh(c)

			assert.Equal(t, tt.wantStatus, w.Code)
			resp := parseJSONResponse(t, w)
			assert.Contains(t, resp["error"], "Invalid request data")
		})
	}
}

func TestMobileLogout_ValidationErrors(t *testing.T) {
	handler := &MobileAuthHandler{}

	tests := []struct {
		name       string
		body       interface{}
		wantStatus int
	}{
		{
			name:       "empty body",
			body:       nil,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "missing refresh_token",
			body:       map[string]string{},
			wantStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, w := newTestGinContext("POST", "/api/mobile/auth/logout", tt.body)
			handler.MobileLogout(c)

			assert.Equal(t, tt.wantStatus, w.Code)
		})
	}
}

// ============================================================================
// WsTicket — context-based tests
// ============================================================================

func TestMobileWsTicket_MissingUserID(t *testing.T) {
	handler := &MobileAuthHandler{}

	c, w := newTestGinContext("POST", "/api/mobile/auth/ws-ticket", nil)
	// Не устанавливаем user_id в контексте — RequireAuth не прошел бы
	handler.MobileWsTicket(c)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
	resp := parseJSONResponse(t, w)
	assert.Equal(t, "Unauthorized", resp["error"])
	assert.Equal(t, "token_missing", resp["error_type"])
}

// ============================================================================
// handleAuthError — тестирование маппинга ошибок
// ============================================================================

func TestHandleAuthError_TokenErrors(t *testing.T) {
	handler := &MobileAuthHandler{}

	tests := []struct {
		name          string
		err           error
		wantStatus    int
		wantErrorType string
	}{
		{
			name:          "expired refresh token",
			err:           &manager.TokenError{Type: manager.ExpiredRefreshToken, Message: "expired"},
			wantStatus:    http.StatusUnauthorized,
			wantErrorType: "token_expired",
		},
		{
			name:          "expired access token",
			err:           &manager.TokenError{Type: manager.ExpiredAccessToken, Message: "expired"},
			wantStatus:    http.StatusUnauthorized,
			wantErrorType: "token_expired",
		},
		{
			name:          "invalid refresh token",
			err:           &manager.TokenError{Type: manager.InvalidRefreshToken, Message: "invalid"},
			wantStatus:    http.StatusUnauthorized,
			wantErrorType: "token_invalid",
		},
		{
			name:          "invalid access token",
			err:           &manager.TokenError{Type: manager.InvalidAccessToken, Message: "invalid"},
			wantStatus:    http.StatusUnauthorized,
			wantErrorType: "token_invalid",
		},
		{
			name:          "user not found",
			err:           &manager.TokenError{Type: manager.UserNotFound, Message: "user not found"},
			wantStatus:    http.StatusUnauthorized,
			wantErrorType: "invalid_credentials",
		},
		{
			name:          "token generation failed",
			err:           &manager.TokenError{Type: manager.TokenGenerationFailed, Message: "gen failed"},
			wantStatus:    http.StatusInternalServerError,
			wantErrorType: "token_generation_failed",
		},
		{
			name:          "too many sessions",
			err:           &manager.TokenError{Type: manager.TooManySessions, Message: "limit"},
			wantStatus:    http.StatusConflict,
			wantErrorType: "too_many_sessions",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, w := newTestGinContext("POST", "/test", nil)
			handler.handleAuthError(c, tt.err)

			assert.Equal(t, tt.wantStatus, w.Code)
			resp := parseJSONResponse(t, w)
			assert.Equal(t, tt.wantErrorType, resp["error_type"])
		})
	}
}

func TestHandleAuthError_AppErrors(t *testing.T) {
	handler := &MobileAuthHandler{}

	tests := []struct {
		name          string
		err           error
		wantStatus    int
		wantErrorType string
	}{
		{
			name:          "unauthorized",
			err:           apperrors.ErrUnauthorized,
			wantStatus:    http.StatusUnauthorized,
			wantErrorType: "unauthorized",
		},
		{
			name:          "forbidden",
			err:           apperrors.ErrForbidden,
			wantStatus:    http.StatusForbidden,
			wantErrorType: "forbidden",
		},
		{
			name:          "not found",
			err:           apperrors.ErrNotFound,
			wantStatus:    http.StatusNotFound,
			wantErrorType: "not_found",
		},
		{
			name:          "conflict",
			err:           apperrors.ErrConflict,
			wantStatus:    http.StatusConflict,
			wantErrorType: "conflict",
		},
		{
			name:          "validation error",
			err:           apperrors.ErrValidation,
			wantStatus:    http.StatusBadRequest,
			wantErrorType: "validation_error",
		},
		{
			name:          "expired token",
			err:           apperrors.ErrExpiredToken,
			wantStatus:    http.StatusUnauthorized,
			wantErrorType: "token_expired",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, w := newTestGinContext("POST", "/test", nil)
			handler.handleAuthError(c, tt.err)

			assert.Equal(t, tt.wantStatus, w.Code)
			resp := parseJSONResponse(t, w)
			assert.Equal(t, tt.wantErrorType, resp["error_type"])
		})
	}
}

func TestHandleAuthError_UnknownError(t *testing.T) {
	handler := &MobileAuthHandler{}

	c, w := newTestGinContext("POST", "/test", nil)
	handler.handleAuthError(c, assert.AnError)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
	resp := parseJSONResponse(t, w)
	assert.Equal(t, "internal_server_error", resp["error_type"])
}

// ============================================================================
// DTO serialization tests
// ============================================================================

func TestMobileAuthResponse_JSONSerialization(t *testing.T) {
	resp := MobileAuthResponse{
		User:         map[string]interface{}{"id": 1, "username": "test"},
		AccessToken:  "access-token-123",
		RefreshToken: "refresh-token-456",
		UserID:       1,
		ExpiresIn:    3600,
		TokenType:    "Bearer",
	}

	data, err := json.Marshal(resp)
	require.NoError(t, err)

	var parsed map[string]interface{}
	require.NoError(t, json.Unmarshal(data, &parsed))

	assert.Equal(t, "access-token-123", parsed["accessToken"])
	assert.Equal(t, "refresh-token-456", parsed["refreshToken"])
	assert.Equal(t, float64(1), parsed["userId"])
	assert.Equal(t, float64(3600), parsed["expiresIn"])
	assert.Equal(t, "Bearer", parsed["tokenType"])
	assert.NotNil(t, parsed["user"])
}

func TestMobileRefreshResponse_JSONSerialization(t *testing.T) {
	resp := MobileRefreshResponse{
		AccessToken:  "new-access",
		RefreshToken: "new-refresh",
		UserID:       42,
		ExpiresIn:    7200,
		TokenType:    "Bearer",
	}

	data, err := json.Marshal(resp)
	require.NoError(t, err)

	var parsed map[string]interface{}
	require.NoError(t, json.Unmarshal(data, &parsed))

	assert.Equal(t, "new-access", parsed["accessToken"])
	assert.Equal(t, "new-refresh", parsed["refreshToken"])
	assert.Equal(t, float64(42), parsed["userId"])
	assert.Equal(t, float64(7200), parsed["expiresIn"])
	assert.Equal(t, "Bearer", parsed["tokenType"])

	// Убеждаемся что нет полей csrfToken или csrf_token
	_, hasCSRF := parsed["csrfToken"]
	assert.False(t, hasCSRF, "MobileRefreshResponse should not have csrfToken")
	_, hasCSRFUnderscore := parsed["csrf_token"]
	assert.False(t, hasCSRFUnderscore, "MobileRefreshResponse should not have csrf_token")
}

// ============================================================================
// Request DTO binding tests
// ============================================================================

func TestMobileLoginRequest_Binding(t *testing.T) {
	body := map[string]string{
		"email":     "user@example.com",
		"password":  "secure-password",
		"device_id": "ios-device-abc123",
	}

	c, _ := newTestGinContext("POST", "/api/mobile/auth/login", body)

	var req MobileLoginRequest
	err := c.ShouldBindJSON(&req)

	require.NoError(t, err)
	assert.Equal(t, "user@example.com", req.Email)
	assert.Equal(t, "secure-password", req.Password)
	assert.Equal(t, "ios-device-abc123", req.DeviceID)
}

func TestMobileRefreshRequest_Binding(t *testing.T) {
	body := map[string]string{
		"refresh_token": "rt_abc123",
		"device_id":     "android-device-xyz",
	}
	c, _ := newTestGinContext("POST", "/api/mobile/auth/refresh", body)

	var req MobileRefreshRequest
	err := c.ShouldBindJSON(&req)

	require.NoError(t, err)
	assert.Equal(t, "rt_abc123", req.RefreshToken)
	assert.Equal(t, "android-device-xyz", req.DeviceID)
}

func TestMobileRegisterRequest_Binding(t *testing.T) {
	body := map[string]string{
		"username":  "newuser",
		"email":     "new@example.com",
		"password":  "strong-pass-123",
		"device_id": "expo-device",
	}
	c, _ := newTestGinContext("POST", "/api/mobile/auth/register", body)

	var req MobileRegisterRequest
	err := c.ShouldBindJSON(&req)

	require.NoError(t, err)
	assert.Equal(t, "newuser", req.Username)
	assert.Equal(t, "new@example.com", req.Email)
	assert.Equal(t, "strong-pass-123", req.Password)
	assert.Equal(t, "expo-device", req.DeviceID)
}
