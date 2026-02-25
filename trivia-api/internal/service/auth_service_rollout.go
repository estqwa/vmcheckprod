package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/yourusername/trivia-api/internal/domain/repository"
	apperrors "github.com/yourusername/trivia-api/internal/pkg/errors"
)

type DeleteAccountInput struct {
	Password string
	Reason   string
}

func (s *AuthService) SetEmailVerificationService(svc *EmailVerificationService) {
	s.emailVerificationService = svc
}

func (s *AuthService) SetGoogleOAuthService(svc *GoogleOAuthService) {
	s.googleOAuthService = svc
}

func (s *AuthService) SetEmailVerificationRepository(repo repository.EmailVerificationRepository) {
	s.emailVerificationRepo = repo
}

func (s *AuthService) SetIdentityRepository(repo repository.UserIdentityRepository) {
	s.identityRepo = repo
}

func (s *AuthService) SetFeatureFlags(emailVerificationEnabled, googleOAuthEnabled bool) {
	s.emailVerificationEnabled = emailVerificationEnabled
	s.googleOAuthEnabled = googleOAuthEnabled
}

func (s *AuthService) SetLegalVersions(tosVersion, privacyVersion string) {
	if strings.TrimSpace(tosVersion) != "" {
		s.tosVersion = strings.TrimSpace(tosVersion)
	}
	if strings.TrimSpace(privacyVersion) != "" {
		s.privacyVersion = strings.TrimSpace(privacyVersion)
	}
}

func (s *AuthService) SendVerificationCode(ctx context.Context, userID uint) error {
	if !s.emailVerificationEnabled {
		return ErrFeatureDisabled
	}
	if s.emailVerificationService == nil {
		return fmt.Errorf("email verification service not configured")
	}
	return s.emailVerificationService.SendCode(ctx, userID)
}

func (s *AuthService) ConfirmVerificationCode(ctx context.Context, userID uint, code string) error {
	if !s.emailVerificationEnabled {
		return ErrFeatureDisabled
	}
	if s.emailVerificationService == nil {
		return fmt.Errorf("email verification service not configured")
	}
	return s.emailVerificationService.ConfirmCode(ctx, userID, code)
}

func (s *AuthService) GetVerificationStatus(ctx context.Context, userID uint) (*EmailVerificationStatus, error) {
	if !s.emailVerificationEnabled {
		user, err := s.userRepo.GetByID(userID)
		if err != nil {
			return nil, err
		}
		return &EmailVerificationStatus{
			Email:         user.Email,
			EmailVerified: user.EmailVerifiedAt != nil,
			CanSendCode:   false,
		}, nil
	}
	if s.emailVerificationService == nil {
		return nil, fmt.Errorf("email verification service not configured")
	}
	return s.emailVerificationService.GetStatus(ctx, userID)
}

func (s *AuthService) ExchangeGoogleAuth(ctx context.Context, input GoogleExchangeInput) (*GoogleAuthResult, error) {
	if !s.googleOAuthEnabled {
		return nil, ErrFeatureDisabled
	}
	if s.googleOAuthService == nil {
		return nil, fmt.Errorf("google oauth service not configured")
	}
	return s.googleOAuthService.Exchange(ctx, input)
}

func (s *AuthService) LinkGoogleAuth(ctx context.Context, userID uint, input GoogleLinkInput) error {
	if !s.googleOAuthEnabled {
		return ErrFeatureDisabled
	}
	if s.googleOAuthService == nil {
		return fmt.Errorf("google oauth service not configured")
	}
	return s.googleOAuthService.Link(ctx, userID, input)
}

func (s *AuthService) DeleteMyAccount(ctx context.Context, userID uint, input DeleteAccountInput) error {
	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return err
	}

	requiresPassword := user.PasswordAuthEnabled
	password := strings.TrimSpace(input.Password)
	if requiresPassword {
		if password == "" {
			return fmt.Errorf("%w: password is required for account deletion", apperrors.ErrValidation)
		}
		if !user.CheckPassword(password) {
			return fmt.Errorf("%w: invalid password", apperrors.ErrUnauthorized)
		}
	}

	// Revoke all sessions first to ensure instant logout.
	if err := s.LogoutAllDevices(userID); err != nil {
		return err
	}

	if s.emailVerificationRepo != nil {
		_ = s.emailVerificationRepo.DeleteByUserID(userID)
	}
	if s.identityRepo != nil {
		_ = s.identityRepo.DeleteByUserID(userID)
	}
	if s.legalRepo != nil {
		_ = s.legalRepo.DeleteByUserID(userID)
	}

	now := time.Now()
	reason := strings.TrimSpace(input.Reason)
	if reason == "" {
		reason = "user_requested"
	}

	anonUsername := fmt.Sprintf("deleted_user_%d_%d", userID, now.Unix())
	anonEmail := fmt.Sprintf("deleted+%d_%d@example.invalid", userID, now.Unix())
	newPassword, err := generateRandomHex(32)
	if err != nil {
		return err
	}
	if err := s.userRepo.UpdatePassword(userID, newPassword); err != nil {
		return err
	}

	updates := map[string]interface{}{
		"username":              anonUsername,
		"email":                 anonEmail,
		"password_auth_enabled": false,
		"profile_picture":       "",
		"first_name":            "",
		"last_name":             "",
		"birth_date":            nil,
		"gender":                "",
		"email_verified_at":     nil,
		"profile_completed_at":  nil,
		"deleted_at":            &now,
		"deletion_reason":       reason,
	}
	if err := s.userRepo.UpdateProfile(userID, updates); err != nil {
		return err
	}

	_ = ctx // reserved for future async cleanup hooks
	return nil
}
