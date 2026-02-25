package service

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/yourusername/trivia-api/internal/domain/entity"
	"github.com/yourusername/trivia-api/internal/domain/repository"
	apperrors "github.com/yourusername/trivia-api/internal/pkg/errors"
	"github.com/yourusername/trivia-api/pkg/auth"
	"github.com/yourusername/trivia-api/pkg/auth/manager"
)

// AuthService РїСЂРµРґРѕСЃС‚Р°РІР»СЏРµС‚ РјРµС‚РѕРґС‹ РґР»СЏ СЂР°Р±РѕС‚С‹ СЃ Р°СѓС‚РµРЅС‚РёС„РёРєР°С†РёРµР№ Рё РїРѕР»СЊР·РѕРІР°С‚РµР»СЏРјРё
type AuthService struct {
	userRepo         repository.UserRepository
	jwtService       *auth.JWTService
	tokenManager     *manager.TokenManager
	refreshTokenRepo repository.RefreshTokenRepository
	invalidTokenRepo repository.InvalidTokenRepository
	legalRepo        repository.UserLegalAcceptanceRepository

	// Phase 2/3/4 optional dependencies configured from main.
	emailVerificationService *EmailVerificationService
	googleOAuthService       *GoogleOAuthService
	emailVerificationRepo    repository.EmailVerificationRepository
	identityRepo             repository.UserIdentityRepository
	emailVerificationEnabled bool
	googleOAuthEnabled       bool
	tosVersion               string
	privacyVersion           string
}

// RegisterInput СЃРѕРґРµСЂР¶РёС‚ РІСЃРµ РґР°РЅРЅС‹Рµ РґР»СЏ СЂРµРіРёСЃС‚СЂР°С†РёРё
type RegisterInput struct {
	Username  string
	Email     string
	Password  string
	FirstName string
	LastName  string
	BirthDate *time.Time
	Gender    string // male, female, other, prefer_not_to_say

	// Legal consent (required for new users)
	TOSAccepted     bool
	PrivacyAccepted bool
	MarketingOptIn  bool

	// РњРµС‚Р°РґР°РЅРЅС‹Рµ
	IP        string
	UserAgent string
}

// NewAuthService СЃРѕР·РґР°РµС‚ РЅРѕРІС‹Р№ СЃРµСЂРІРёСЃ Р°СѓС‚РµРЅС‚РёС„РёРєР°С†РёРё Рё РІРѕР·РІСЂР°С‰Р°РµС‚ РѕС€РёР±РєСѓ РїСЂРё РїСЂРѕР±Р»РµРјР°С…
func NewAuthService(
	userRepo repository.UserRepository,
	jwtService *auth.JWTService,
	tokenManager *manager.TokenManager,
	refreshTokenRepo repository.RefreshTokenRepository,
	invalidTokenRepo repository.InvalidTokenRepository,
	legalRepo repository.UserLegalAcceptanceRepository,
) (*AuthService, error) {
	if userRepo == nil {
		return nil, fmt.Errorf("UserRepository is required for AuthService")
	}
	if jwtService == nil {
		return nil, fmt.Errorf("JWTService is required for AuthService")
	}
	if tokenManager == nil {
		return nil, fmt.Errorf("TokenManager is required for AuthService")
	}
	if refreshTokenRepo == nil {
		return nil, fmt.Errorf("RefreshTokenRepository is required for AuthService")
	}
	if invalidTokenRepo == nil {
		return nil, fmt.Errorf("InvalidTokenRepository is required for AuthService")
	}
	// legalRepo РјРѕР¶РµС‚ Р±С‹С‚СЊ nil РґР»СЏ РѕР±СЂР°С‚РЅРѕР№ СЃРѕРІРјРµСЃС‚РёРјРѕСЃС‚Рё СЃ С‚РµСЃС‚Р°РјРё

	return &AuthService{
		userRepo:         userRepo,
		jwtService:       jwtService,
		tokenManager:     tokenManager,
		refreshTokenRepo: refreshTokenRepo,
		invalidTokenRepo: invalidTokenRepo,
		legalRepo:        legalRepo,
		tosVersion:       "1.0",
		privacyVersion:   "1.0",
	}, nil
}

// RegisterUser СЂРµРіРёСЃС‚СЂРёСЂСѓРµС‚ РЅРѕРІРѕРіРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ СЃ РїСЂРѕС„РёР»РµРј Рё СЋСЂРёРґРёС‡РµСЃРєРёРј СЃРѕРіР»Р°СЃРёРµРј
func (s *AuthService) RegisterUser(input RegisterInput) (*entity.User, error) {
	// РќРѕСЂРјР°Р»РёР·СѓРµРј
	input.Email = normalizeEmail(input.Email)
	input.Username = strings.TrimSpace(input.Username)
	input.FirstName = strings.TrimSpace(input.FirstName)
	input.LastName = strings.TrimSpace(input.LastName)
	input.Gender = strings.TrimSpace(input.Gender)

	if input.FirstName == "" || input.LastName == "" {
		return nil, fmt.Errorf("%w: first_name and last_name are required", apperrors.ErrValidation)
	}
	if input.BirthDate == nil {
		return nil, fmt.Errorf("%w: birth_date is required", apperrors.ErrValidation)
	}
	if !isValidGender(input.Gender) {
		return nil, fmt.Errorf("%w: invalid gender", apperrors.ErrValidation)
	}

	// РџСЂРѕРІРµСЂРєР° РІРѕР·СЂР°СЃС‚Р° (>= 13 Р»РµС‚)
	age := calculateAge(*input.BirthDate)
	if age < 13 {
		return nil, fmt.Errorf("%w: user must be at least 13 years old", apperrors.ErrValidation)
	}

	// РџСЂРѕРІРµСЂРєР° СЋСЂРёРґРёС‡РµСЃРєРѕРіРѕ СЃРѕРіР»Р°СЃРёСЏ
	if !input.TOSAccepted || !input.PrivacyAccepted {
		return nil, fmt.Errorf("%w: terms of service and privacy policy must be accepted", apperrors.ErrValidation)
	}

	// РџСЂРѕРІРµСЂСЏРµРј, СЃСѓС‰РµСЃС‚РІСѓРµС‚ Р»Рё РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ СЃ С‚Р°РєРёРј email
	_, err := s.userRepo.GetByEmail(input.Email)
	if err == nil {
		return nil, fmt.Errorf("%w: user with this email already exists", apperrors.ErrConflict)
	}
	if !errors.Is(err, apperrors.ErrNotFound) {
		return nil, fmt.Errorf("failed to check email existence: %w", err)
	}

	// РџСЂРѕРІРµСЂСЏРµРј, СЃСѓС‰РµСЃС‚РІСѓРµС‚ Р»Рё РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ СЃ С‚Р°РєРёРј username
	_, err = s.userRepo.GetByUsername(input.Username)
	if err == nil {
		return nil, fmt.Errorf("%w: user with this username already exists", apperrors.ErrConflict)
	}
	if !errors.Is(err, apperrors.ErrNotFound) {
		return nil, fmt.Errorf("failed to check username existence: %w", err)
	}

	// РћРїСЂРµРґРµР»СЏРµРј, Р·Р°РїРѕР»РЅРµРЅ Р»Рё РїСЂРѕС„РёР»СЊ
	var profileCompletedAt *time.Time
	if input.FirstName != "" && input.LastName != "" && input.BirthDate != nil && input.Gender != "" {
		now := time.Now()
		profileCompletedAt = &now
	}

	user := &entity.User{
		Username:            input.Username,
		Email:               input.Email,
		Password:            input.Password,
		PasswordAuthEnabled: true,
		FirstName:           input.FirstName,
		LastName:            input.LastName,
		BirthDate:           input.BirthDate,
		Gender:              input.Gender,
		ProfileCompletedAt:  profileCompletedAt,
	}

	if err := s.userRepo.Create(user); err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	// РЎРѕС…СЂР°РЅСЏРµРј СЋСЂРёРґРёС‡РµСЃРєРѕРµ СЃРѕРіР»Р°СЃРёРµ
	if s.legalRepo != nil {
		acceptance := &entity.UserLegalAcceptance{
			UserID:         user.ID,
			TOSVersion:     s.tosVersion,
			PrivacyVersion: s.privacyVersion,
			MarketingOptIn: input.MarketingOptIn,
			AcceptedAt:     time.Now(),
			IP:             input.IP,
			UserAgent:      input.UserAgent,
		}
		if err := s.legalRepo.Create(acceptance); err != nil {
			log.Printf("[AuthService] РћС€РёР±РєР° СЃРѕС…СЂР°РЅРµРЅРёСЏ СЋСЂРёРґРёС‡РµСЃРєРѕРіРѕ СЃРѕРіР»Р°СЃРёСЏ РґР»СЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ ID=%d: %v", user.ID, err)
			// РќРµ РїСЂРµСЂС‹РІР°РµРј СЂРµРіРёСЃС‚СЂР°С†РёСЋ, РЅРѕ Р»РѕРіРёСЂСѓРµРј
		}
	}

	return user, nil
}

// calculateAge РІС‹С‡РёСЃР»СЏРµС‚ РІРѕР·СЂР°СЃС‚ РїРѕ РґР°С‚Рµ СЂРѕР¶РґРµРЅРёСЏ
func calculateAge(birthDate time.Time) int {
	now := time.Now()
	age := now.Year() - birthDate.Year()
	if now.Month() < birthDate.Month() || (now.Month() == birthDate.Month() && now.Day() < birthDate.Day()) {
		age--
	}
	return age
}

func isValidGender(gender string) bool {
	switch gender {
	case "male", "female", "other", "prefer_not_to_say":
		return true
	default:
		return false
	}
}

// AuthResponse СЃРѕРґРµСЂР¶РёС‚ РґР°РЅРЅС‹Рµ РґР»СЏ РѕС‚РІРµС‚Р° РЅР° Р·Р°РїСЂРѕСЃ Р°РІС‚РѕСЂРёР·Р°С†РёРё
type AuthResponse struct {
	User         *entity.User `json:"user"`
	AccessToken  string       `json:"access_token"`
	RefreshToken string       `json:"refresh_token"`
}

// LoginUser Р°СѓС‚РµРЅС‚РёС„РёС†РёСЂСѓРµС‚ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ Рё РІРѕР·РІСЂР°С‰Р°РµС‚ РїР°СЂСѓ С‚РѕРєРµРЅРѕРІ
// РћР±РЅРѕРІР»РµРЅРѕ РґР»СЏ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёСЏ TokenManager
func (s *AuthService) LoginUser(email, password, deviceID, ipAddress, userAgent string) (*manager.TokenResponse, error) {
	user, err := s.AuthenticateUser(email, password)
	if err != nil {
		// РћС€РёР±РєР° СѓР¶Рµ Р·Р°Р»РѕРіРёСЂРѕРІР°РЅР° РІ AuthenticateUser
		// РџСЂРѕР±СЂР°СЃС‹РІР°РµРј РѕС€РёР±РєСѓ (РІРµСЂРѕСЏС‚РЅРѕ, apperrors.ErrUnauthorized)
		return nil, err
	}

	// РСЃРїРѕР»СЊР·СѓРµРј TokenManager РґР»СЏ РіРµРЅРµСЂР°С†РёРё С‚РѕРєРµРЅРѕРІ
	tokenResp, err := s.tokenManager.GenerateTokenPair(user.ID, deviceID, ipAddress, userAgent)
	if err != nil {
		log.Printf("[AuthService] РћС€РёР±РєР° РіРµРЅРµСЂР°С†РёРё С‚РѕРєРµРЅРѕРІ РґР»СЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ ID=%d: %v", user.ID, err)
		return nil, fmt.Errorf("РѕС€РёР±РєР° РіРµРЅРµСЂР°С†РёРё С‚РѕРєРµРЅРѕРІ")
	}

	// РЎР±СЂРѕСЃ РёРЅРІР°Р»РёРґР°С†РёРё JWT РґР»СЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РїСЂРё СѓСЃРїРµС€РЅРѕРј РІС…РѕРґРµ
	// РЎРѕР·РґР°РµРј РєРѕРЅС‚РµРєСЃС‚ РґР»СЏ РІС‹Р·РѕРІР°
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	s.jwtService.ResetInvalidationForUser(ctx, user.ID)

	log.Printf("[AuthService] РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ ID=%d (%s) СѓСЃРїРµС€РЅРѕ РІРѕС€РµР» РІ СЃРёСЃС‚РµРјСѓ", user.ID, user.Email)
	return tokenResp, nil
}

// RefreshTokens РѕР±РЅРѕРІР»СЏРµС‚ РїР°СЂСѓ С‚РѕРєРµРЅРѕРІ, РёСЃРїРѕР»СЊР·СѓСЏ refresh С‚РѕРєРµРЅ
// РћР±РЅРѕРІР»РµРЅРѕ РґР»СЏ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёСЏ TokenManager
func (s *AuthService) RefreshTokens(refreshToken, csrfToken, deviceID, ipAddress, userAgent string) (*manager.TokenResponse, error) {
	// РСЃРїРѕР»СЊР·СѓРµРј TokenManager РґР»СЏ РѕР±РЅРѕРІР»РµРЅРёСЏ С‚РѕРєРµРЅРѕРІ
	tokenResp, err := s.tokenManager.RefreshTokens(refreshToken, csrfToken, deviceID, ipAddress, userAgent)
	if err != nil {
		var tokenErr *manager.TokenError
		if errors.As(err, &tokenErr) {
			log.Printf("[AuthService] РћС€РёР±РєР° РѕР±РЅРѕРІР»РµРЅРёСЏ С‚РѕРєРµРЅРѕРІ: %s - %s", tokenErr.Type, tokenErr.Message)
			// РџСЂРѕР±СЂР°СЃС‹РІР°РµРј РѕС€РёР±РєСѓ TokenManager
			return nil, err // Р’РѕР·РІСЂР°С‰Р°РµРј РёСЃС…РѕРґРЅСѓСЋ РѕС€РёР±РєСѓ TokenError
		} else {
			log.Printf("[AuthService] РќРµРёР·РІРµСЃС‚РЅР°СЏ РѕС€РёР±РєР° РѕР±РЅРѕРІР»РµРЅРёСЏ С‚РѕРєРµРЅРѕРІ: %v", err)
			return nil, fmt.Errorf("РІРЅСѓС‚СЂРµРЅРЅСЏСЏ РѕС€РёР±РєР° СЃРµСЂРІРµСЂР° РїСЂРё РѕР±РЅРѕРІР»РµРЅРёРё С‚РѕРєРµРЅРѕРІ: %w", err)
		}
	}

	log.Printf("[AuthService] РўРѕРєРµРЅС‹ СѓСЃРїРµС€РЅРѕ РѕР±РЅРѕРІР»РµРЅС‹ РґР»СЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ ID=%d", tokenResp.UserID)
	return tokenResp, nil
}

// GetUserByID РІРѕР·РІСЂР°С‰Р°РµС‚ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РїРѕ ID
func (s *AuthService) GetUserByID(userID uint) (*entity.User, error) {
	return s.userRepo.GetByID(userID)
}

// UpdateUserProfile РѕР±РЅРѕРІР»СЏРµС‚ РїСЂРѕС„РёР»СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
func (s *AuthService) UpdateUserProfile(userID uint, username, profilePicture string) error {
	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return err
	}

	// Р•СЃР»Рё РёРјСЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РёР·РјРµРЅРёР»РѕСЃСЊ, РїСЂРѕРІРµСЂСЏРµРј, С‡С‚Рѕ РѕРЅРѕ СѓРЅРёРєР°Р»СЊРЅРѕ
	if username != user.Username {
		existingUser, err := s.userRepo.GetByUsername(username)
		if err != nil && !errors.Is(err, apperrors.ErrNotFound) {
			// Р РµР°Р»СЊРЅР°СЏ DB РѕС€РёР±РєР° вЂ” РІРѕР·РІСЂР°С‰Р°РµРј РµС‘
			return fmt.Errorf("failed to check username availability: %w", err)
		}
		if existingUser != nil {
			return fmt.Errorf("%w: username '%s' already taken", apperrors.ErrConflict, username)
		}
	}

	// РСЃРїРѕР»СЊР·СѓРµРј Р±РµР·РѕРїР°СЃРЅС‹Р№ РјРµС‚РѕРґ РѕР±РЅРѕРІР»РµРЅРёСЏ РїСЂРѕС„РёР»СЏ Р±РµР· РёР·РјРµРЅРµРЅРёСЏ РїР°СЂРѕР»СЏ
	updates := map[string]interface{}{
		"username":        username,
		"profile_picture": profilePicture,
	}

	return s.userRepo.UpdateProfile(userID, updates)
}

// UpdateUserLanguage РѕР±РЅРѕРІР»СЏРµС‚ СЏР·С‹Рє РёРЅС‚РµСЂС„РµР№СЃР° РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
func (s *AuthService) UpdateUserLanguage(userID uint, language string) error {
	// Р’Р°Р»РёРґР°С†РёСЏ СЏР·С‹РєР° (ru РёР»Рё kk)
	if language != "ru" && language != "kk" {
		return fmt.Errorf("%w: invalid language '%s', allowed: ru, kk", apperrors.ErrValidation, language)
	}

	updates := map[string]interface{}{
		"language": language,
	}

	return s.userRepo.UpdateProfile(userID, updates)
}

// ChangePassword РёР·РјРµРЅСЏРµС‚ РїР°СЂРѕР»СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ Рё РёРЅРІР°Р»РёРґРёСЂСѓРµС‚ РІСЃРµ С‚РѕРєРµРЅС‹
func (s *AuthService) ChangePassword(userID uint, oldPassword, newPassword string) error {
	// РџРѕР»СѓС‡Р°РµРј РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РґР»СЏ РїСЂРѕРІРµСЂРєРё СЃС‚Р°СЂРѕРіРѕ РїР°СЂРѕР»СЏ
	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return err
	}

	// РџСЂРѕРІРµСЂСЏРµРј, С‡С‚Рѕ СЃС‚Р°СЂС‹Р№ РїР°СЂРѕР»СЊ РІРµСЂРЅС‹Р№
	if !user.CheckPassword(oldPassword) {
		return fmt.Errorf("%w: incorrect old password", apperrors.ErrUnauthorized)
	}

	// РћР±РЅРѕРІР»СЏРµРј РїР°СЂРѕР»СЊ СЃ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёРµРј Р±РµР·РѕРїР°СЃРЅРѕРіРѕ РјРµС‚РѕРґР°
	// UserRepo.UpdatePassword РІС‹РїРѕР»РЅСЏРµС‚ С…РµС€РёСЂРѕРІР°РЅРёРµ Рё РёСЃРїРѕР»СЊР·СѓРµС‚ РїСЂСЏРјРѕР№ SQL-Р·Р°РїСЂРѕСЃ
	// РґР»СЏ РѕР±С…РѕРґР° С…СѓРєР° BeforeSave Рё РїСЂРµРґРѕС‚РІСЂР°С‰РµРЅРёСЏ РґРІРѕР№РЅРѕРіРѕ С…РµС€РёСЂРѕРІР°РЅРёСЏ
	if err := s.userRepo.UpdatePassword(userID, newPassword); err != nil {
		return err
	}

	// РРЅРІР°Р»РёРґРёСЂСѓРµРј РІСЃРµ С‚РѕРєРµРЅС‹ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
	return s.LogoutAllDevices(userID)
}

// LogoutUser РѕС‚Р·С‹РІР°РµС‚ СѓРєР°Р·Р°РЅРЅС‹Р№ refresh С‚РѕРєРµРЅ
// РћР±РЅРѕРІР»РµРЅРѕ РґР»СЏ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёСЏ TokenManager
func (s *AuthService) LogoutUser(refreshToken string) error {
	// РСЃРїРѕР»СЊР·СѓРµРј TokenManager РґР»СЏ РѕС‚Р·С‹РІР° refresh С‚РѕРєРµРЅР°
	err := s.tokenManager.RevokeRefreshToken(refreshToken)
	if err != nil {
		log.Printf("[AuthService] РћС€РёР±РєР° РѕС‚Р·С‹РІР° refresh С‚РѕРєРµРЅР°: %v", err)
		// РњРѕР¶РЅРѕ РЅРµ РІРѕР·РІСЂР°С‰Р°С‚СЊ РѕС€РёР±РєСѓ РєР»РёРµРЅС‚Сѓ, РµСЃР»Рё С‚РѕРєРµРЅ СѓР¶Рµ РЅРµРґРµР№СЃС‚РІРёС‚РµР»РµРЅ
		var tokenErr *manager.TokenError
		if errors.As(err, &tokenErr) && tokenErr.Type == manager.InvalidRefreshToken {
			return nil // РўРѕРєРµРЅ СѓР¶Рµ РЅРµРґРµР№СЃС‚РІРёС‚РµР»РµРЅ, СЃС‡РёС‚Р°РµРј Р»РѕРіР°СѓС‚ СѓСЃРїРµС€РЅС‹Рј
		}
		return fmt.Errorf("РѕС€РёР±РєР° РїСЂРё РІС‹С…РѕРґРµ РёР· СЃРёСЃС‚РµРјС‹: %w", err)
	}

	log.Printf("[AuthService] Refresh С‚РѕРєРµРЅ СѓСЃРїРµС€РЅРѕ РѕС‚РѕР·РІР°РЅ")
	return nil
}

// LogoutAllDevices РѕС‚Р·С‹РІР°РµС‚ РІСЃРµ С‚РѕРєРµРЅС‹ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
// РћР±РЅРѕРІР»РµРЅРѕ РґР»СЏ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёСЏ TokenManager Рё jwtService РЅР°РїСЂСЏРјСѓСЋ
func (s *AuthService) LogoutAllDevices(userID uint) error {
	// РСЃРїРѕР»СЊР·СѓРµРј TokenManager РґР»СЏ РѕС‚Р·С‹РІР° РІСЃРµС… refresh С‚РѕРєРµРЅРѕРІ
	err := s.tokenManager.RevokeAllUserTokens(userID)
	if err != nil {
		log.Printf("[AuthService] РћС€РёР±РєР° РїСЂРё РѕС‚Р·С‹РІРµ РІСЃРµС… refresh С‚РѕРєРµРЅРѕРІ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ ID=%d: %v", userID, err)
		// РџСЂРѕРґРѕР»Р¶Р°РµРј, С‡С‚РѕР±С‹ РїРѕРїС‹С‚Р°С‚СЊСЃСЏ РёРЅРІР°Р»РёРґРёСЂРѕРІР°С‚СЊ JWT
	}

	// Р”РѕРїРѕР»РЅРёС‚РµР»СЊРЅРѕ РёРЅРІР°Р»РёРґРёСЂСѓРµРј С‚РµРєСѓС‰РёРµ JWT С‚РѕРєРµРЅС‹ С‡РµСЂРµР· jwtService
	// РЎРѕР·РґР°РµРј РєРѕРЅС‚РµРєСЃС‚ РґР»СЏ РІС‹Р·РѕРІР°
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if jwtErr := s.jwtService.InvalidateTokensForUser(ctx, userID); jwtErr != nil {
		log.Printf("[AuthService] РћС€РёР±РєР° РїСЂРё РёРЅРІР°Р»РёРґР°С†РёРё JWT С‚РѕРєРµРЅРѕРІ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ ID=%d: %v", userID, jwtErr)
		// Р•СЃР»Рё РѕС€РёР±РєР° Р±С‹Р»Р° Рё СЃ refresh С‚РѕРєРµРЅР°РјРё, РІРѕР·РІСЂР°С‰Р°РµРј РµРµ
		if err != nil {
			return fmt.Errorf("РѕС€РёР±РєР° РїСЂРё РІС‹С…РѕРґРµ СЃРѕ РІСЃРµС… СѓСЃС‚СЂРѕР№СЃС‚РІ (refresh): %w", err)
		}
		return fmt.Errorf("РѕС€РёР±РєР° РїСЂРё РІС‹С…РѕРґРµ СЃРѕ РІСЃРµС… СѓСЃС‚СЂРѕР№СЃС‚РІ (jwt): %w", jwtErr)
	}

	log.Printf("[AuthService] Р’СЃРµ СЃРµСЃСЃРёРё РґР»СЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ ID=%d Р·Р°РІРµСЂС€РµРЅС‹", userID)
	return nil
}

// ResetUserTokenInvalidation СЃР±СЂР°СЃС‹РІР°РµС‚ С„Р»Р°Рі РёРЅРІР°Р»РёРґР°С†РёРё РґР»СЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
// РСЃРїРѕР»СЊР·СѓРµС‚ jwtService Рё InvalidTokenRepository РЅР°РїСЂСЏРјСѓСЋ
func (s *AuthService) ResetUserTokenInvalidation(userID uint) error {
	// РЎРѕР·РґР°РµРј РєРѕРЅС‚РµРєСЃС‚ РґР»СЏ РІС‹Р·РѕРІР°
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// РЎР±СЂРѕСЃ РІ jwtService (in-memory)
	s.jwtService.ResetInvalidationForUser(ctx, userID)

	// РЈРґР°Р»РµРЅРёРµ Р·Р°РїРёСЃРё РёР· Р‘Р”
	if err := s.invalidTokenRepo.RemoveInvalidToken(ctx, userID); err != nil {
		log.Printf("[AuthService] РћС€РёР±РєР° РїСЂРё СѓРґР°Р»РµРЅРёРё Р·Р°РїРёСЃРё РёРЅРІР°Р»РёРґР°С†РёРё РёР· Р‘Р” РґР»СЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ ID=%d: %v", userID, err)
		return fmt.Errorf("failed to reset token invalidation: %w", err)
	}
	log.Printf("[AuthService] РЎР±СЂРѕС€РµРЅР° РёРЅРІР°Р»РёРґР°С†РёСЏ С‚РѕРєРµРЅРѕРІ РґР»СЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ ID=%d", userID)
	return nil
}

// GetUserActiveSessions РІРѕР·РІСЂР°С‰Р°РµС‚ Р°РєС‚РёРІРЅС‹Рµ СЃРµСЃСЃРёРё РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
// РћР±РЅРѕРІР»РµРЅРѕ РґР»СЏ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёСЏ TokenManager
func (s *AuthService) GetUserActiveSessions(userID uint) ([]entity.RefreshToken, error) {
	sessions, err := s.tokenManager.GetUserActiveSessions(userID)
	if err != nil {
		log.Printf("[AuthService] РћС€РёР±РєР° РїРѕР»СѓС‡РµРЅРёСЏ Р°РєС‚РёРІРЅС‹С… СЃРµСЃСЃРёР№ РґР»СЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ ID=%d: %v", userID, err)
		return nil, fmt.Errorf("РЅРµ СѓРґР°Р»РѕСЃСЊ РїРѕР»СѓС‡РёС‚СЊ СЃРїРёСЃРѕРє СЃРµСЃСЃРёР№")
	}
	return sessions, nil
}

// CheckRefreshToken РїСЂРѕРІРµСЂСЏРµС‚ РґРµР№СЃС‚РІРёС‚РµР»СЊРЅРѕСЃС‚СЊ refresh С‚РѕРєРµРЅР°
// РћР±РЅРѕРІР»РµРЅРѕ: Р›РѕРіРёРєР° РїСЂРѕРІРµСЂРєРё С‚РµРїРµСЂСЊ РїРѕР»РЅРѕСЃС‚СЊСЋ РІ TokenManager, СЌС‚РѕС‚ РјРµС‚РѕРґ РјРѕР¶РЅРѕ СѓРґР°Р»РёС‚СЊ РёР»Рё СЃРґРµР»Р°С‚СЊ РїСЂРѕРєСЃРё
func (s *AuthService) CheckRefreshToken(refreshToken string) (bool, error) {
	// РџСЂРѕРєСЃРёСЂСѓРµРј РІС‹Р·РѕРІ Рє TokenManager
	// return s.tokenManager.CheckRefreshToken(refreshToken) // РЈ TokenManager РЅРµС‚ С‚Р°РєРѕРіРѕ РїСѓР±Р»РёС‡РЅРѕРіРѕ РјРµС‚РѕРґР°
	// Р’РјРµСЃС‚Рѕ СЌС‚РѕРіРѕ РјРѕР¶РЅРѕ РёСЃРїРѕР»СЊР·РѕРІР°С‚СЊ GetTokenInfo РёР»Рё RefreshTokens СЃ РїСЂРѕРІРµСЂРєРѕР№ РѕС€РёР±РєРё
	_, err := s.tokenManager.GetTokenInfo(refreshToken)
	if err != nil {
		var tokenErr *manager.TokenError
		if errors.As(err, &tokenErr) && (tokenErr.Type == manager.InvalidRefreshToken || tokenErr.Type == manager.ExpiredRefreshToken) {
			return false, nil // РўРѕРєРµРЅ РЅРµРґРµР№СЃС‚РІРёС‚РµР»РµРЅ РёР»Рё РёСЃС‚РµРє
		}
		return false, err // Р”СЂСѓРіР°СЏ РѕС€РёР±РєР°
	}
	return true, nil // РўРѕРєРµРЅ РґРµР№СЃС‚РІРёС‚РµР»РµРЅ
}

// GetTokenInfo РІРѕР·РІСЂР°С‰Р°РµС‚ РёРЅС„РѕСЂРјР°С†РёСЋ Рѕ СЃСЂРѕРєР°С… РґРµР№СЃС‚РІРёСЏ С‚РѕРєРµРЅРѕРІ
// РћР±РЅРѕРІР»РµРЅРѕ РґР»СЏ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёСЏ TokenManager
func (s *AuthService) GetTokenInfo(refreshToken string) (*manager.TokenInfo, error) {
	info, err := s.tokenManager.GetTokenInfo(refreshToken)
	if err != nil {
		log.Printf("[AuthService] РћС€РёР±РєР° РїРѕР»СѓС‡РµРЅРёСЏ РёРЅС„РѕСЂРјР°С†РёРё Рѕ С‚РѕРєРµРЅРµ: %v", err)
		// РџСЂРѕР±СЂР°СЃС‹РІР°РµРј РѕС€РёР±РєСѓ TokenManager РёР»Рё РґСЂСѓРіСѓСЋ
		return nil, err
	}
	return info, nil
}

// DebugToken РґРµРєРѕРґРёСЂСѓРµС‚ С‚РѕРєРµРЅ РґР»СЏ РѕС‚Р»Р°РґРєРё
// РСЃРїРѕР»СЊР·СѓРµС‚ jwtService РЅР°РїСЂСЏРјСѓСЋ
func (s *AuthService) DebugToken(tokenString string) map[string]interface{} {
	return s.jwtService.DebugToken(tokenString)
}

// GetUserByEmail РІРѕР·РІСЂР°С‰Р°РµС‚ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РїРѕ Email
func (s *AuthService) GetUserByEmail(email string) (*entity.User, error) {
	email = normalizeEmail(email)
	return s.userRepo.GetByEmail(email)
}

// AdminResetPassword СЃР±СЂР°СЃС‹РІР°РµС‚ РїР°СЂРѕР»СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂРѕРј
// РќРµ С‚СЂРµР±СѓРµС‚ РїСЂРѕРІРµСЂРєРё СЃС‚Р°СЂРѕРіРѕ РїР°СЂРѕР»СЏ Рё РёРЅРІР°Р»РёРґРёСЂСѓРµС‚ РІСЃРµ С‚РѕРєРµРЅС‹ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
func (s *AuthService) AdminResetPassword(userID uint, newPassword string) error {
	// РћР±РЅРѕРІР»СЏРµРј РїР°СЂРѕР»СЊ СЃ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёРµРј Р±РµР·РѕРїР°СЃРЅРѕРіРѕ РјРµС‚РѕРґР°
	// UserRepo.UpdatePassword РІС‹РїРѕР»РЅСЏРµС‚ С…РµС€РёСЂРѕРІР°РЅРёРµ Рё РёСЃРїРѕР»СЊР·СѓРµС‚ РїСЂСЏРјРѕР№ SQL-Р·Р°РїСЂРѕСЃ
	// РґР»СЏ РѕР±С…РѕРґР° С…СѓРєР° BeforeSave Рё РїСЂРµРґРѕС‚РІСЂР°С‰РµРЅРёСЏ РґРІРѕР№РЅРѕРіРѕ С…РµС€РёСЂРѕРІР°РЅРёСЏ
	if err := s.userRepo.UpdatePassword(userID, newPassword); err != nil {
		return err
	}

	// РРЅРІР°Р»РёРґРёСЂСѓРµРј РІСЃРµ С‚РѕРєРµРЅС‹ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
	return s.LogoutAllDevices(userID)
}

// GetRefreshTokenByUserID РїРѕР»СѓС‡Р°РµС‚ Р°РєС‚РёРІРЅС‹Р№ refresh С‚РѕРєРµРЅ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
func (s *AuthService) GetRefreshTokenByUserID(userID uint) (*entity.RefreshToken, error) {
	tokens, err := s.refreshTokenRepo.GetActiveTokensForUser(userID)
	if err != nil {
		return nil, err
	}

	if len(tokens) == 0 {
		return nil, errors.New("no active refresh tokens found")
	}

	// Р’РѕР·РІСЂР°С‰Р°РµРј РїРµСЂРІС‹Р№ Р°РєС‚РёРІРЅС‹Р№ С‚РѕРєРµРЅ
	return tokens[0], nil
}

// AuthenticateUser РїСЂРѕРІРµСЂСЏРµС‚ СѓС‡РµС‚РЅС‹Рµ РґР°РЅРЅС‹Рµ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ Р±РµР· СЃРѕР·РґР°РЅРёСЏ С‚РѕРєРµРЅРѕРІ
func (s *AuthService) AuthenticateUser(email, password string) (*entity.User, error) {
	// РќРѕСЂРјР°Р»РёР·СѓРµРј email
	email = normalizeEmail(email)

	// РџРѕР»СѓС‡Р°РµРј РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РїРѕ email
	user, err := s.userRepo.GetByEmail(email)
	if err != nil {
		log.Printf("[AuthService] РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ СЃ email %s РЅРµ РЅР°Р№РґРµРЅ: %v", email, err)
		// Р’РѕР·РІСЂР°С‰Р°РµРј СЃС‚Р°РЅРґР°СЂС‚РЅСѓСЋ РѕС€РёР±РєСѓ
		return nil, fmt.Errorf("%w: invalid credentials", apperrors.ErrUnauthorized)
	}

	// РџСЂРѕРІРµСЂСЏРµРј РїР°СЂРѕР»СЊ
	if !user.CheckPassword(password) {
		log.Printf("[AuthService] РќРµРІРµСЂРЅС‹Р№ РїР°СЂРѕР»СЊ РґР»СЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ СЃ email %s", email)
		// Р’РѕР·РІСЂР°С‰Р°РµРј СЃС‚Р°РЅРґР°СЂС‚РЅСѓСЋ РѕС€РёР±РєСѓ
		return nil, fmt.Errorf("%w: invalid credentials", apperrors.ErrUnauthorized)
	}

	return user, nil
}

// IsSessionOwnedByUser РїСЂРѕРІРµСЂСЏРµС‚, РїСЂРёРЅР°РґР»РµР¶РёС‚ Р»Рё СЃРµСЃСЃРёСЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЋ
func (s *AuthService) IsSessionOwnedByUser(userID, sessionID uint) (bool, error) {
	if s.refreshTokenRepo == nil {
		return false, errors.New("refresh token repository not available")
	}

	// РџРѕР»СѓС‡Р°РµРј С‚РѕРєРµРЅ РїРѕ ID
	token, err := s.refreshTokenRepo.GetTokenByID(sessionID)
	if err != nil {
		if errors.Is(err, apperrors.ErrNotFound) {
			return false, nil
		}
		return false, err
	}

	// РџСЂРѕРІРµСЂСЏРµРј, С‡С‚Рѕ С‚РѕРєРµРЅ РїСЂРёРЅР°РґР»РµР¶РёС‚ РїРѕР»СЊР·РѕРІР°С‚РµР»СЋ
	return token.UserID == userID, nil
}

// RevokeSession РѕС‚Р·С‹РІР°РµС‚ РѕС‚РґРµР»СЊРЅСѓСЋ СЃРµСЃСЃРёСЋ РїРѕ ID
func (s *AuthService) RevokeSession(sessionID uint) error {
	if s.refreshTokenRepo == nil {
		return errors.New("refresh token repository not available")
	}

	return s.refreshTokenRepo.MarkTokenAsExpiredByID(sessionID)
}

// GetRefreshTokenByID РїРѕР»СѓС‡Р°РµС‚ refresh-С‚РѕРєРµРЅ РїРѕ РµРіРѕ ID
func (s *AuthService) GetRefreshTokenByID(tokenID uint) (*entity.RefreshToken, error) {
	return s.refreshTokenRepo.GetTokenByID(tokenID)
}

// RevokeSessionByID РѕС‚Р·С‹РІР°РµС‚ РєРѕРЅРєСЂРµС‚РЅСѓСЋ СЃРµСЃСЃРёСЋ РїРѕ РµРµ ID
// РћР±РЅРѕРІР»РµРЅРѕ РґР»СЏ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёСЏ TokenManager
func (s *AuthService) RevokeSessionByID(sessionID uint, reason string) error {
	if err := s.refreshTokenRepo.MarkTokenAsExpiredByID(sessionID); err != nil {
		log.Printf("[AuthService] Ошибка отзыва сессии ID=%d: %v", sessionID, err)
		return fmt.Errorf("ошибка отзыва сессии")
	}

	log.Printf("[AuthService] Сессия ID=%d успешно отозвана. Причина: %s", sessionID, reason)
	return nil
}

// RevokeAllUserSessions РѕС‚Р·С‹РІР°РµС‚ РІСЃРµ СЃРµСЃСЃРёРё РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ СЃ СѓРєР°Р·Р°РЅРёРµРј РїСЂРёС‡РёРЅС‹
func (s *AuthService) RevokeAllUserSessions(userID uint, reason string) error {
	// РџРѕР»СѓС‡Р°РµРј РІСЃРµ Р°РєС‚РёРІРЅС‹Рµ СЃРµСЃСЃРёРё РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
	tokens, err := s.refreshTokenRepo.GetActiveTokensForUser(userID)
	if err != nil {
		return fmt.Errorf("РЅРµ СѓРґР°Р»РѕСЃСЊ РїРѕР»СѓС‡РёС‚СЊ Р°РєС‚РёРІРЅС‹Рµ СЃРµСЃСЃРёРё: %w", err)
	}

	// РћС‚Р·С‹РІР°РµРј РєР°Р¶РґСѓСЋ СЃРµСЃСЃРёСЋ СЃ СѓРєР°Р·Р°РЅРёРµРј РїСЂРёС‡РёРЅС‹
	for _, token := range tokens {
		now := time.Now()
		token.RevokedAt = &now
		token.Reason = reason
		token.IsExpired = true

		err = s.refreshTokenRepo.MarkTokenAsExpiredByID(token.ID)
		if err != nil {
			log.Printf("РћС€РёР±РєР° РїСЂРё РѕС‚Р·С‹РІРµ СЃРµСЃСЃРёРё ID=%d: %v", token.ID, err)
			// РџСЂРѕРґРѕР»Р¶Р°РµРј РѕС‚Р·С‹РІ РґСЂСѓРіРёС… СЃРµСЃСЃРёР№
		}
	}

	return nil
}

// GetActiveSessionsWithDetails РІРѕР·РІСЂР°С‰Р°РµС‚ РґРµС‚Р°Р»РёР·РёСЂРѕРІР°РЅРЅСѓСЋ РёРЅС„РѕСЂРјР°С†РёСЋ РѕР± Р°РєС‚РёРІРЅС‹С… СЃРµСЃСЃРёСЏС… РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
// РћР±РЅРѕРІР»РµРЅРѕ РґР»СЏ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёСЏ TokenManager
func (s *AuthService) GetActiveSessionsWithDetails(userID uint) ([]map[string]interface{}, error) {
	sessions, err := s.tokenManager.GetUserActiveSessions(userID)
	if err != nil {
		log.Printf("[AuthService] РћС€РёР±РєР° РїРѕР»СѓС‡РµРЅРёСЏ Р°РєС‚РёРІРЅС‹С… СЃРµСЃСЃРёР№ (РґРµС‚Р°Р»Рё) РґР»СЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ ID=%d: %v", userID, err)
		return nil, fmt.Errorf("РЅРµ СѓРґР°Р»РѕСЃСЊ РїРѕР»СѓС‡РёС‚СЊ СЃРїРёСЃРѕРє СЃРµСЃСЃРёР№")
	}

	var sessionDetails []map[string]interface{}
	for _, session := range sessions {
		// РСЃРїРѕР»СЊР·СѓРµРј РјРµС‚РѕРґ SessionInfo() РёР· entity.RefreshToken
		details := session.SessionInfo()
		sessionDetails = append(sessionDetails, details)
	}

	return sessionDetails, nil
}

// GenerateWsTicket РіРµРЅРµСЂРёСЂСѓРµС‚ РєРѕСЂРѕС‚РєРѕР¶РёРІСѓС‰РёР№ С‚РёРєРµС‚ РґР»СЏ Р°СѓС‚РµРЅС‚РёС„РёРєР°С†РёРё WebSocket
// РСЃРїРѕР»СЊР·СѓРµС‚ jwtService РЅР°РїСЂСЏРјСѓСЋ
func (s *AuthService) GenerateWsTicket(ctx context.Context, userID uint, email string) (string, error) {
	ticket, err := s.jwtService.GenerateWSTicket(ctx, userID, email)
	if err != nil {
		log.Printf("[AuthService] РћС€РёР±РєР° РіРµРЅРµСЂР°С†РёРё WebSocket С‚РёРєРµС‚Р° РґР»СЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ ID=%d: %v", userID, err)
		return "", fmt.Errorf("РѕС€РёР±РєР° РіРµРЅРµСЂР°С†РёРё С‚РёРєРµС‚Р°")
	}
	return ticket, nil
}

// InvalidateUserTokens РІС‹РїРѕР»РЅСЏРµС‚ РёРЅРІР°Р»РёРґР°С†РёСЋ JWT С‚РѕРєРµРЅРѕРІ РґР»СЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
// Р­С‚Рѕ РїСѓР±Р»РёС‡РЅС‹Р№ РјРµС‚РѕРґ, С‡С‚РѕР±С‹ РµРіРѕ РјРѕР¶РЅРѕ Р±С‹Р»Рѕ РІС‹Р·РІР°С‚СЊ РёР· handler
func (s *AuthService) InvalidateUserTokens(userID uint) error {
	// РЎРѕР·РґР°РµРј РєРѕРЅС‚РµРєСЃС‚ РґР»СЏ РІС‹Р·РѕРІР°
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	return s.jwtService.InvalidateTokensForUser(ctx, userID)
}

// normalizeEmail РїСЂРёРІРѕРґРёС‚ email Рє СЃС‚Р°РЅРґР°СЂС‚РЅРѕРјСѓ РІРёРґСѓ: trim РїСЂРѕР±РµР»РѕРІ + lowercase
func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}
