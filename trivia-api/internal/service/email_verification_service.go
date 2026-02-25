package service

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/yourusername/trivia-api/internal/domain/entity"
	"github.com/yourusername/trivia-api/internal/domain/repository"
	apperrors "github.com/yourusername/trivia-api/internal/pkg/errors"
)

type EmailVerificationStatus struct {
	Email                string     `json:"email"`
	EmailVerified        bool       `json:"email_verified"`
	CanSendCode          bool       `json:"can_send_code"`
	CooldownRemainingSec int        `json:"cooldown_remaining_sec"`
	ExpiresAt            *time.Time `json:"expires_at,omitempty"`
	AttemptsLeft         int        `json:"attempts_left"`
}

type EmailVerificationService struct {
	userRepo            repository.UserRepository
	emailVerificationDB repository.EmailVerificationRepository
	emailService        EmailService
	verificationTTL     time.Duration
	resendCooldown      time.Duration
	maxAttempts         int
	codePepper          string
}

func NewEmailVerificationService(
	userRepo repository.UserRepository,
	emailVerificationDB repository.EmailVerificationRepository,
	emailService EmailService,
	verificationTTL time.Duration,
	resendCooldown time.Duration,
	maxAttempts int,
	codePepper string,
) (*EmailVerificationService, error) {
	if userRepo == nil {
		return nil, fmt.Errorf("user repository is required")
	}
	if emailVerificationDB == nil {
		return nil, fmt.Errorf("email verification repository is required")
	}
	if emailService == nil {
		return nil, fmt.Errorf("email service is required")
	}
	if verificationTTL <= 0 {
		verificationTTL = 15 * time.Minute
	}
	if resendCooldown <= 0 {
		resendCooldown = 60 * time.Second
	}
	if maxAttempts <= 0 {
		maxAttempts = 5
	}

	return &EmailVerificationService{
		userRepo:            userRepo,
		emailVerificationDB: emailVerificationDB,
		emailService:        emailService,
		verificationTTL:     verificationTTL,
		resendCooldown:      resendCooldown,
		maxAttempts:         maxAttempts,
		codePepper:          codePepper,
	}, nil
}

func (s *EmailVerificationService) SendCode(ctx context.Context, userID uint) error {
	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return err
	}
	if user.EmailVerifiedAt != nil {
		return nil
	}

	now := time.Now()
	latest, err := s.emailVerificationDB.GetLatestActiveByUserID(userID)
	if err == nil && latest != nil {
		if now.Before(latest.LastSentAt.Add(s.resendCooldown)) {
			return fmt.Errorf("%w: please wait before requesting a new code", ErrVerificationResendCooldown)
		}
	}

	code, err := generateVerificationCode()
	if err != nil {
		return fmt.Errorf("failed to generate verification code: %w", err)
	}
	salt, err := generateVerificationSalt()
	if err != nil {
		return fmt.Errorf("failed to generate verification salt: %w", err)
	}

	record := &entity.EmailVerificationCode{
		UserID:       user.ID,
		Email:        user.Email,
		CodeHash:     hashVerificationCode(code, salt, s.codePepper),
		CodeSalt:     salt,
		ExpiresAt:    now.Add(s.verificationTTL),
		AttemptCount: 0,
		MaxAttempts:  s.maxAttempts,
		LastSentAt:   now,
	}
	if err := s.emailVerificationDB.Create(record); err != nil {
		return fmt.Errorf("failed to create verification record: %w", err)
	}

	idempotencyKey := fmt.Sprintf("email-verify:%d:%d", user.ID, record.ID)
	if err := s.emailService.SendVerificationCode(ctx, user.Email, code, idempotencyKey); err != nil {
		return fmt.Errorf("failed to send verification email: %w", err)
	}

	return nil
}

func (s *EmailVerificationService) ConfirmCode(ctx context.Context, userID uint, code string) error {
	if strings.TrimSpace(code) == "" {
		return fmt.Errorf("%w: empty verification code", apperrors.ErrValidation)
	}

	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return err
	}
	if user.EmailVerifiedAt != nil {
		return nil
	}

	record, err := s.emailVerificationDB.GetLatestActiveByUserID(userID)
	if err != nil {
		if err == apperrors.ErrNotFound {
			return ErrInvalidVerificationCode
		}
		return err
	}

	now := time.Now()
	if record.IsConsumed() {
		return ErrInvalidVerificationCode
	}
	if record.IsExpired(now) {
		return ErrVerificationExpired
	}
	if record.AttemptCount >= record.MaxAttempts {
		return ErrVerificationAttemptsExceeded
	}

	expectedHash := hashVerificationCode(code, record.CodeSalt, s.codePepper)
	if subtle.ConstantTimeCompare([]byte(expectedHash), []byte(record.CodeHash)) != 1 {
		_ = s.emailVerificationDB.IncrementAttempts(record.ID)
		if record.AttemptCount+1 >= record.MaxAttempts {
			return ErrVerificationAttemptsExceeded
		}
		return ErrInvalidVerificationCode
	}

	if err := s.emailVerificationDB.MarkConsumed(record.ID); err != nil {
		return fmt.Errorf("failed to mark verification code consumed: %w", err)
	}

	verifiedAt := now
	updates := map[string]interface{}{
		"email_verified_at": &verifiedAt,
	}
	if user.ProfileCompletedAt == nil && user.IsProfileComplete() {
		updates["profile_completed_at"] = &verifiedAt
	}

	if err := s.userRepo.UpdateProfile(userID, updates); err != nil {
		return fmt.Errorf("failed to mark user email verified: %w", err)
	}
	return nil
}

func (s *EmailVerificationService) GetStatus(ctx context.Context, userID uint) (*EmailVerificationStatus, error) {
	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return nil, err
	}

	status := &EmailVerificationStatus{
		Email:         user.Email,
		EmailVerified: user.EmailVerifiedAt != nil,
		CanSendCode:   user.EmailVerifiedAt == nil,
		AttemptsLeft:  s.maxAttempts,
	}
	if user.EmailVerifiedAt != nil {
		status.CanSendCode = false
		status.AttemptsLeft = 0
		return status, nil
	}

	latest, err := s.emailVerificationDB.GetLatestActiveByUserID(userID)
	if err != nil {
		return status, nil
	}

	now := time.Now()
	if latest.ExpiresAt.After(now) && latest.ConsumedAt == nil {
		exp := latest.ExpiresAt
		status.ExpiresAt = &exp
		status.AttemptsLeft = latest.MaxAttempts - latest.AttemptCount
		if status.AttemptsLeft < 0 {
			status.AttemptsLeft = 0
		}
	}

	cooldownRemaining := int(latest.LastSentAt.Add(s.resendCooldown).Sub(now).Seconds())
	if cooldownRemaining > 0 {
		status.CanSendCode = false
		status.CooldownRemainingSec = cooldownRemaining
	}

	if latest.AttemptCount >= latest.MaxAttempts {
		status.AttemptsLeft = 0
		status.CanSendCode = true
		status.CooldownRemainingSec = 0
	}

	return status, nil
}

func generateVerificationCode() (string, error) {
	max := big.NewInt(1000000)
	n, err := rand.Int(rand.Reader, max)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

func generateVerificationSalt() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func hashVerificationCode(code, salt, pepper string) string {
	sum := sha256.Sum256([]byte(pepper + ":" + salt + ":" + code))
	return hex.EncodeToString(sum[:])
}
