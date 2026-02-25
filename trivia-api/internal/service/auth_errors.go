package service

import "errors"

// Auth flow specific errors used by handlers for stable error_type mapping.
var (
	ErrFeatureDisabled               = errors.New("feature_disabled")
	ErrLinkRequired                  = errors.New("link_required")
	ErrEmailNotVerified              = errors.New("email_not_verified")
	ErrInvalidVerificationCode       = errors.New("invalid_verification_code")
	ErrVerificationExpired           = errors.New("verification_expired")
	ErrVerificationAttemptsExceeded  = errors.New("verification_attempts_exceeded")
	ErrVerificationResendCooldown    = errors.New("verification_resend_cooldown")
	ErrGoogleTokenVerificationFailed = errors.New("google_token_verification_failed")
)

