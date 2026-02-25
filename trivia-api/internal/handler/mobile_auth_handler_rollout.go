package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/yourusername/trivia-api/internal/service"
)

type MobileVerifyEmailConfirmRequest struct {
	Code string `json:"code" binding:"required,len=6,numeric"`
}

type MobileGoogleExchangeRequest struct {
	IDToken      string `json:"id_token"`
	Code         string `json:"code"`
	RedirectURI  string `json:"redirect_uri"`
	CodeVerifier string `json:"code_verifier"`
	Platform     string `json:"platform"`
	DeviceID     string `json:"device_id" binding:"required"`
}

type MobileGoogleLinkRequest struct {
	IDToken      string `json:"id_token"`
	Code         string `json:"code"`
	RedirectURI  string `json:"redirect_uri"`
	CodeVerifier string `json:"code_verifier"`
	Platform     string `json:"platform"`
}

type MobileDeleteAccountRequest struct {
	Password string `json:"password"`
	Reason   string `json:"reason"`
}

func (h *MobileAuthHandler) MobileSendEmailVerificationCode(c *gin.Context) {
	userID := c.MustGet("user_id").(uint)
	if err := h.authService.SendVerificationCode(c.Request.Context(), userID); err != nil {
		h.handleAuthError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "verification code sent"})
}

func (h *MobileAuthHandler) MobileConfirmEmailVerificationCode(c *gin.Context) {
	userID := c.MustGet("user_id").(uint)
	var req MobileVerifyEmailConfirmRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "error_type": "validation_error"})
		return
	}

	if err := h.authService.ConfirmVerificationCode(c.Request.Context(), userID, req.Code); err != nil {
		h.handleAuthError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "email verified"})
}

func (h *MobileAuthHandler) MobileGetEmailVerificationStatus(c *gin.Context) {
	userID := c.MustGet("user_id").(uint)
	status, err := h.authService.GetVerificationStatus(c.Request.Context(), userID)
	if err != nil {
		h.handleAuthError(c, err)
		return
	}
	c.JSON(http.StatusOK, status)
}

func (h *MobileAuthHandler) MobileGoogleExchange(c *gin.Context) {
	var req MobileGoogleExchangeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "error_type": "validation_error"})
		return
	}

	input := service.GoogleExchangeInput{
		IDToken:      req.IDToken,
		Code:         req.Code,
		RedirectURI:  req.RedirectURI,
		CodeVerifier: req.CodeVerifier,
		Platform:     req.Platform,
		DeviceID:     req.DeviceID,
		IPAddress:    c.ClientIP(),
		UserAgent:    c.Request.UserAgent(),
	}
	result, err := h.authService.ExchangeGoogleAuth(c.Request.Context(), input)
	if err != nil {
		if errors.Is(err, service.ErrLinkRequired) {
			c.JSON(http.StatusConflict, gin.H{
				"error":      "Google account requires explicit linking",
				"error_type": "link_required",
				"user":       serializeUserForClient(result.User),
			})
			return
		}
		h.handleAuthError(c, err)
		return
	}

	c.JSON(http.StatusOK, MobileAuthResponse{
		User:         serializeUserForClient(result.User),
		AccessToken:  result.Token.AccessToken,
		RefreshToken: result.Token.RefreshToken,
		UserID:       result.Token.UserID,
		ExpiresIn:    result.Token.ExpiresIn,
		TokenType:    "Bearer",
	})
}

func (h *MobileAuthHandler) MobileGoogleLink(c *gin.Context) {
	userID := c.MustGet("user_id").(uint)
	var req MobileGoogleLinkRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "error_type": "validation_error"})
		return
	}

	if err := h.authService.LinkGoogleAuth(c.Request.Context(), userID, service.GoogleLinkInput{
		IDToken:      req.IDToken,
		Code:         req.Code,
		RedirectURI:  req.RedirectURI,
		CodeVerifier: req.CodeVerifier,
		Platform:     req.Platform,
	}); err != nil {
		h.handleAuthError(c, err)
		return
	}

	user, err := h.authService.GetUserByID(userID)
	if err != nil {
		h.handleAuthError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "google account linked",
		"user":    serializeUserForClient(user),
	})
}

func (h *MobileAuthHandler) MobileDeleteMe(c *gin.Context) {
	userID := c.MustGet("user_id").(uint)
	var req MobileDeleteAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		req = MobileDeleteAccountRequest{}
	}

	if err := h.authService.DeleteMyAccount(c.Request.Context(), userID, service.DeleteAccountInput{
		Password: req.Password,
		Reason:   req.Reason,
	}); err != nil {
		h.handleAuthError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "account deleted"})
}
