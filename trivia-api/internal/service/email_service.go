package service

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net"
	"strconv"
	"strings"
	"time"

	"github.com/resend/resend-go/v2"
)

// EmailService sends transactional emails.
type EmailService interface {
	SendVerificationCode(ctx context.Context, toEmail, code, idempotencyKey string) error
}

// NoopEmailService is used when email verification is disabled.
type NoopEmailService struct{}

func (s *NoopEmailService) SendVerificationCode(ctx context.Context, toEmail, code, idempotencyKey string) error {
	log.Printf("[EmailService] noop send verification code to=%s", toEmail)
	return nil
}

// ResendEmailService sends emails via Resend REST API.
type ResendEmailService struct {
	from   string
	client *resend.Client
}

func NewResendEmailService(apiKey, from string) (*ResendEmailService, error) {
	if apiKey == "" {
		return nil, fmt.Errorf("resend api key is required")
	}
	if from == "" {
		return nil, fmt.Errorf("email from is required")
	}
	return &ResendEmailService{
		from:   from,
		client: resend.NewClient(apiKey),
	}, nil
}

func (s *ResendEmailService) SendVerificationCode(ctx context.Context, toEmail, code, idempotencyKey string) error {
	if toEmail == "" || code == "" {
		return fmt.Errorf("toEmail and code are required")
	}

	params := &resend.SendEmailRequest{
		From:    s.from,
		To:      []string{toEmail},
		Subject: "Verify your email",
		Text:    fmt.Sprintf("Your verification code is %s. It expires in 15 minutes.", code),
		Html:    fmt.Sprintf("<p>Your verification code is <strong>%s</strong>.</p><p>It expires in 15 minutes.</p>", code),
	}

	options := &resend.SendEmailOptions{}
	if strings.TrimSpace(idempotencyKey) != "" {
		options.IdempotencyKey = strings.TrimSpace(idempotencyKey)
	}

	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		_, err := s.client.Emails.SendWithOptions(ctx, params, options)
		if err == nil {
			return nil
		}
		lastErr = err

		if wait, ok := resendRetryDelay(err, attempt); ok {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(wait):
				continue
			}
		}

		return fmt.Errorf("resend send failed: %w", err)
	}

	return fmt.Errorf("resend send failed after retries: %w", lastErr)
}

func resendRetryDelay(err error, attempt int) (time.Duration, bool) {
	var rateLimitErr *resend.RateLimitError
	if errors.As(err, &rateLimitErr) {
		if seconds, convErr := strconv.Atoi(strings.TrimSpace(rateLimitErr.RetryAfter)); convErr == nil && seconds > 0 {
			if seconds > 30 {
				seconds = 30
			}
			return time.Duration(seconds) * time.Second, true
		}
		return time.Duration(attempt+1) * time.Second, true
	}

	var netErr net.Error
	if errors.As(err, &netErr) && (netErr.Timeout() || netErr.Temporary()) {
		return time.Duration(attempt+1) * 500 * time.Millisecond, true
	}

	msg := strings.ToLower(err.Error())
	if strings.Contains(msg, "timeout") || strings.Contains(msg, "temporar") {
		return time.Duration(attempt+1) * 500 * time.Millisecond, true
	}

	return 0, false
}
