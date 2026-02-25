package service

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v4"
	"github.com/yourusername/trivia-api/internal/config"
	"github.com/yourusername/trivia-api/internal/domain/entity"
	"github.com/yourusername/trivia-api/internal/domain/repository"
	apperrors "github.com/yourusername/trivia-api/internal/pkg/errors"
	"github.com/yourusername/trivia-api/pkg/auth/manager"
)

const googleProvider = "google"

type GoogleExchangeInput struct {
	IDToken      string
	Code         string
	RedirectURI  string
	CodeVerifier string
	Platform     string
	DeviceID     string
	IPAddress    string
	UserAgent    string
}

type GoogleLinkInput struct {
	IDToken      string
	Code         string
	RedirectURI  string
	CodeVerifier string
	Platform     string
}

type GoogleAuthResult struct {
	User         *entity.User
	Token        *manager.TokenResponse
	LinkRequired bool
}

type GoogleOAuthService struct {
	userRepo     repository.UserRepository
	identityRepo repository.UserIdentityRepository
	tokenManager *manager.TokenManager
	cfg          config.GoogleOAuthConfig
	httpClient   *http.Client
	jwksMu       sync.RWMutex
	jwksKeys     map[string]*rsa.PublicKey
	jwksExpiry   time.Time
}

func NewGoogleOAuthService(
	userRepo repository.UserRepository,
	identityRepo repository.UserIdentityRepository,
	tokenManager *manager.TokenManager,
	cfg config.GoogleOAuthConfig,
) (*GoogleOAuthService, error) {
	if userRepo == nil {
		return nil, fmt.Errorf("user repository is required")
	}
	if identityRepo == nil {
		return nil, fmt.Errorf("identity repository is required")
	}
	if tokenManager == nil {
		return nil, fmt.Errorf("token manager is required")
	}
	return &GoogleOAuthService{
		userRepo:     userRepo,
		identityRepo: identityRepo,
		tokenManager: tokenManager,
		cfg:          cfg,
		httpClient:   &http.Client{Timeout: 10 * time.Second},
	}, nil
}

func (s *GoogleOAuthService) Exchange(ctx context.Context, input GoogleExchangeInput) (*GoogleAuthResult, error) {
	idToken := strings.TrimSpace(input.IDToken)
	if idToken == "" {
		if strings.TrimSpace(input.Code) == "" {
			return nil, fmt.Errorf("%w: id_token or code is required", apperrors.ErrValidation)
		}
		var err error
		idToken, err = s.exchangeCodeForIDToken(ctx, input.Code, input.RedirectURI, input.CodeVerifier, input.Platform)
		if err != nil {
			return nil, err
		}
	}

	info, err := s.verifyIDToken(ctx, idToken)
	if err != nil {
		return nil, err
	}

	identity, err := s.identityRepo.GetByProviderSub(googleProvider, info.Sub)
	if err == nil && identity != nil {
		user, userErr := s.userRepo.GetByID(identity.UserID)
		if userErr != nil {
			return nil, userErr
		}
		tokenResp, tokenErr := s.tokenManager.GenerateTokenPair(user.ID, input.DeviceID, input.IPAddress, input.UserAgent)
		if tokenErr != nil {
			return nil, tokenErr
		}
		return &GoogleAuthResult{User: user, Token: tokenResp}, nil
	}
	if err != nil && !errors.Is(err, apperrors.ErrNotFound) {
		return nil, err
	}

	email := normalizeEmail(info.Email)
	if email == "" {
		return nil, fmt.Errorf("%w: email is missing in google token", ErrGoogleTokenVerificationFailed)
	}

	existing, err := s.userRepo.GetByEmail(email)
	if err == nil && existing != nil {
		return &GoogleAuthResult{User: existing, LinkRequired: true}, ErrLinkRequired
	}
	if err != nil && !errors.Is(err, apperrors.ErrNotFound) {
		return nil, err
	}

	username, err := s.generateUniqueUsername(email, info.Sub)
	if err != nil {
		return nil, err
	}
	randomPassword, err := generateRandomHex(32)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	user := &entity.User{
		Username:            username,
		Email:               email,
		Password:            randomPassword,
		PasswordAuthEnabled: false,
		ProfilePicture:      info.Picture,
		FirstName:           strings.TrimSpace(info.GivenName),
		LastName:            strings.TrimSpace(info.FamilyName),
	}
	if info.EmailVerified {
		user.EmailVerifiedAt = &now
	}
	if user.IsProfileComplete() {
		user.ProfileCompletedAt = &now
	}

	if err := s.userRepo.Create(user); err != nil {
		return nil, fmt.Errorf("failed to create user from google auth: %w", err)
	}

	identity = &entity.UserIdentity{
		UserID:        user.ID,
		Provider:      googleProvider,
		ProviderSub:   info.Sub,
		ProviderEmail: email,
		EmailVerified: info.EmailVerified,
	}
	if err := s.identityRepo.Create(identity); err != nil {
		return nil, fmt.Errorf("failed to create google identity: %w", err)
	}

	tokenResp, err := s.tokenManager.GenerateTokenPair(user.ID, input.DeviceID, input.IPAddress, input.UserAgent)
	if err != nil {
		return nil, err
	}

	return &GoogleAuthResult{User: user, Token: tokenResp}, nil
}

func (s *GoogleOAuthService) Link(ctx context.Context, userID uint, input GoogleLinkInput) error {
	idToken := strings.TrimSpace(input.IDToken)
	if idToken == "" {
		if strings.TrimSpace(input.Code) == "" {
			return fmt.Errorf("%w: id_token or code is required", apperrors.ErrValidation)
		}
		var err error
		idToken, err = s.exchangeCodeForIDToken(ctx, input.Code, input.RedirectURI, input.CodeVerifier, input.Platform)
		if err != nil {
			return err
		}
	}

	info, err := s.verifyIDToken(ctx, idToken)
	if err != nil {
		return err
	}

	email := normalizeEmail(info.Email)
	if email == "" {
		return fmt.Errorf("%w: email is missing in google token", ErrGoogleTokenVerificationFailed)
	}

	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return err
	}
	if normalizeEmail(user.Email) != email {
		return fmt.Errorf("%w: google account email does not match current user", apperrors.ErrForbidden)
	}

	linked, err := s.identityRepo.GetByProviderSub(googleProvider, info.Sub)
	if err == nil && linked != nil {
		if linked.UserID == userID {
			return nil
		}
		return fmt.Errorf("%w: google identity already linked to another account", apperrors.ErrConflict)
	}
	if err != nil && !errors.Is(err, apperrors.ErrNotFound) {
		return err
	}

	_, err = s.identityRepo.GetByUserAndProvider(userID, googleProvider)
	if err == nil {
		return nil
	}
	if err != nil && !errors.Is(err, apperrors.ErrNotFound) {
		return err
	}

	identity := &entity.UserIdentity{
		UserID:        userID,
		Provider:      googleProvider,
		ProviderSub:   info.Sub,
		ProviderEmail: email,
		EmailVerified: info.EmailVerified,
	}
	if err := s.identityRepo.Create(identity); err != nil {
		return fmt.Errorf("failed to create google link: %w", err)
	}

	if info.EmailVerified && user.EmailVerifiedAt == nil {
		now := time.Now()
		if err := s.userRepo.UpdateProfile(userID, map[string]interface{}{"email_verified_at": &now}); err != nil {
			return fmt.Errorf("failed to set email verified from google link: %w", err)
		}
	}

	return nil
}

func (s *GoogleOAuthService) exchangeCodeForIDToken(ctx context.Context, code, redirectURI, codeVerifier, platform string) (string, error) {
	values := url.Values{}
	values.Set("code", code)
	clientID, clientSecret, resolvedRedirectURI, err := s.resolveExchangeClient(strings.TrimSpace(platform), strings.TrimSpace(redirectURI))
	if err != nil {
		return "", err
	}
	values.Set("client_id", clientID)
	if clientSecret != "" {
		values.Set("client_secret", clientSecret)
	}
	values.Set("redirect_uri", resolvedRedirectURI)
	if strings.TrimSpace(codeVerifier) != "" {
		values.Set("code_verifier", strings.TrimSpace(codeVerifier))
	}
	values.Set("grant_type", "authorization_code")

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://oauth2.googleapis.com/token", strings.NewReader(values.Encode()))
	if err != nil {
		return "", fmt.Errorf("failed to create google token exchange request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("google token exchange request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return "", fmt.Errorf("%w: google token exchange status=%d body=%s", ErrGoogleTokenVerificationFailed, resp.StatusCode, string(body))
	}

	var payload struct {
		IDToken string `json:"id_token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return "", fmt.Errorf("failed to parse google token exchange response: %w", err)
	}
	if payload.IDToken == "" {
		return "", fmt.Errorf("%w: id_token not returned by google token exchange", ErrGoogleTokenVerificationFailed)
	}

	return payload.IDToken, nil
}

type parsedGoogleTokenInfo struct {
	Sub           string
	Email         string
	EmailVerified bool
	GivenName     string
	FamilyName    string
	Picture       string
}

type googleIDTokenClaims struct {
	Email         string      `json:"email"`
	EmailVerified interface{} `json:"email_verified"`
	GivenName     string      `json:"given_name"`
	FamilyName    string      `json:"family_name"`
	Picture       string      `json:"picture"`
	jwt.RegisteredClaims
}

type googleJWKSet struct {
	Keys []googleJWK `json:"keys"`
}

type googleJWK struct {
	Kty string `json:"kty"`
	Use string `json:"use"`
	Alg string `json:"alg"`
	Kid string `json:"kid"`
	N   string `json:"n"`
	E   string `json:"e"`
}

func (s *GoogleOAuthService) verifyIDToken(ctx context.Context, idToken string) (*parsedGoogleTokenInfo, error) {
	idToken = strings.TrimSpace(idToken)
	if idToken == "" {
		return nil, fmt.Errorf("%w: empty id token", ErrGoogleTokenVerificationFailed)
	}

	claims := &googleIDTokenClaims{}
	parser := jwt.NewParser(jwt.WithValidMethods([]string{jwt.SigningMethodRS256.Alg()}))
	token, err := parser.ParseWithClaims(idToken, claims, func(token *jwt.Token) (interface{}, error) {
		kid, _ := token.Header["kid"].(string)
		if strings.TrimSpace(kid) == "" {
			return nil, fmt.Errorf("%w: missing kid header", ErrGoogleTokenVerificationFailed)
		}
		return s.getGooglePublicKey(ctx, strings.TrimSpace(kid))
	})
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrGoogleTokenVerificationFailed, err)
	}
	if token == nil || !token.Valid {
		return nil, fmt.Errorf("%w: invalid token", ErrGoogleTokenVerificationFailed)
	}

	if claims.Subject == "" {
		return nil, fmt.Errorf("%w: missing subject", ErrGoogleTokenVerificationFailed)
	}
	if claims.Issuer != "accounts.google.com" && claims.Issuer != "https://accounts.google.com" {
		return nil, fmt.Errorf("%w: invalid issuer", ErrGoogleTokenVerificationFailed)
	}
	if len(claims.Audience) == 0 {
		return nil, fmt.Errorf("%w: missing audience", ErrGoogleTokenVerificationFailed)
	}
	audMatched := false
	for _, aud := range claims.Audience {
		if s.isAllowedAudience(aud) {
			audMatched = true
			break
		}
	}
	if !audMatched {
		return nil, fmt.Errorf("%w: audience mismatch", ErrGoogleTokenVerificationFailed)
	}
	if claims.ExpiresAt == nil || time.Now().After(claims.ExpiresAt.Time) {
		return nil, fmt.Errorf("%w: token expired", ErrGoogleTokenVerificationFailed)
	}

	emailVerified, ok := parseGoogleEmailVerifiedClaim(claims.EmailVerified)
	if !ok {
		return nil, fmt.Errorf("%w: invalid email_verified claim", ErrGoogleTokenVerificationFailed)
	}

	return &parsedGoogleTokenInfo{
		Sub:           strings.TrimSpace(claims.Subject),
		Email:         strings.TrimSpace(claims.Email),
		EmailVerified: emailVerified,
		GivenName:     strings.TrimSpace(claims.GivenName),
		FamilyName:    strings.TrimSpace(claims.FamilyName),
		Picture:       strings.TrimSpace(claims.Picture),
	}, nil
}

func parseGoogleEmailVerifiedClaim(v interface{}) (bool, bool) {
	switch val := v.(type) {
	case bool:
		return val, true
	case string:
		switch strings.ToLower(strings.TrimSpace(val)) {
		case "true":
			return true, true
		case "false":
			return false, true
		default:
			return false, false
		}
	default:
		return false, false
	}
}

func (s *GoogleOAuthService) getGooglePublicKey(ctx context.Context, kid string) (*rsa.PublicKey, error) {
	now := time.Now()
	s.jwksMu.RLock()
	if key, ok := s.jwksKeys[kid]; ok && now.Before(s.jwksExpiry) {
		s.jwksMu.RUnlock()
		return key, nil
	}
	s.jwksMu.RUnlock()

	if err := s.refreshGoogleJWKS(ctx); err != nil {
		return nil, err
	}

	s.jwksMu.RLock()
	defer s.jwksMu.RUnlock()
	key, ok := s.jwksKeys[kid]
	if !ok || key == nil {
		return nil, fmt.Errorf("%w: jwks key not found", ErrGoogleTokenVerificationFailed)
	}
	return key, nil
}

func (s *GoogleOAuthService) refreshGoogleJWKS(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://www.googleapis.com/oauth2/v3/certs", nil)
	if err != nil {
		return fmt.Errorf("failed to create google jwks request: %w", err)
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("%w: failed to fetch google jwks: %v", ErrGoogleTokenVerificationFailed, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return fmt.Errorf("%w: jwks status=%d body=%s", ErrGoogleTokenVerificationFailed, resp.StatusCode, string(body))
	}

	var set googleJWKSet
	if err := json.NewDecoder(resp.Body).Decode(&set); err != nil {
		return fmt.Errorf("failed to decode google jwks response: %w", err)
	}
	if len(set.Keys) == 0 {
		return fmt.Errorf("%w: empty google jwks response", ErrGoogleTokenVerificationFailed)
	}

	keys := make(map[string]*rsa.PublicKey, len(set.Keys))
	for _, jwk := range set.Keys {
		if strings.TrimSpace(jwk.Kid) == "" {
			continue
		}
		if jwk.Kty != "RSA" {
			continue
		}
		pub, err := parseGoogleRSAPublicKey(jwk)
		if err != nil {
			continue
		}
		keys[jwk.Kid] = pub
	}
	if len(keys) == 0 {
		return fmt.Errorf("%w: no usable rsa keys in google jwks", ErrGoogleTokenVerificationFailed)
	}

	ttl := parseGoogleJWKSMaxAge(resp.Header.Get("Cache-Control"))
	if ttl <= 0 {
		ttl = time.Hour
	}

	s.jwksMu.Lock()
	s.jwksKeys = keys
	s.jwksExpiry = time.Now().Add(ttl)
	s.jwksMu.Unlock()
	return nil
}

func parseGoogleRSAPublicKey(jwk googleJWK) (*rsa.PublicKey, error) {
	nBytes, err := base64.RawURLEncoding.DecodeString(jwk.N)
	if err != nil {
		return nil, err
	}
	eBytes, err := base64.RawURLEncoding.DecodeString(jwk.E)
	if err != nil {
		return nil, err
	}

	n := new(big.Int).SetBytes(nBytes)
	eInt := 0
	for _, b := range eBytes {
		eInt = eInt<<8 + int(b)
	}
	if n.Sign() <= 0 || eInt <= 0 {
		return nil, fmt.Errorf("invalid rsa jwk")
	}

	return &rsa.PublicKey{N: n, E: eInt}, nil
}

func parseGoogleJWKSMaxAge(cacheControl string) time.Duration {
	for _, part := range strings.Split(cacheControl, ",") {
		part = strings.TrimSpace(part)
		if !strings.HasPrefix(strings.ToLower(part), "max-age=") {
			continue
		}
		value := strings.TrimSpace(strings.TrimPrefix(strings.ToLower(part), "max-age="))
		seconds, err := time.ParseDuration(value + "s")
		if err != nil {
			return 0
		}
		if seconds < time.Minute {
			return time.Minute
		}
		return seconds
	}
	return 0
}

func (s *GoogleOAuthService) resolveExchangeClient(platform, redirectURI string) (clientID, clientSecret, resolvedRedirectURI string, err error) {
	switch strings.ToLower(strings.TrimSpace(platform)) {
	case "android":
		if strings.TrimSpace(s.cfg.AndroidClientID) == "" {
			return "", "", "", fmt.Errorf("%w: android client id is not configured", ErrGoogleTokenVerificationFailed)
		}
		if redirectURI == "" {
			return "", "", "", fmt.Errorf("%w: mobile redirect_uri is required", ErrGoogleTokenVerificationFailed)
		}
		return strings.TrimSpace(s.cfg.AndroidClientID), "", redirectURI, nil
	case "ios":
		if strings.TrimSpace(s.cfg.IOSClientID) == "" {
			return "", "", "", fmt.Errorf("%w: ios client id is not configured", ErrGoogleTokenVerificationFailed)
		}
		if redirectURI == "" {
			return "", "", "", fmt.Errorf("%w: mobile redirect_uri is required", ErrGoogleTokenVerificationFailed)
		}
		return strings.TrimSpace(s.cfg.IOSClientID), "", redirectURI, nil
	default:
		if strings.TrimSpace(s.cfg.WebClientID) == "" {
			return "", "", "", fmt.Errorf("%w: web client id is not configured", ErrGoogleTokenVerificationFailed)
		}
		if redirectURI == "" {
			redirectURI = s.cfg.RedirectURIWeb
		}
		if strings.TrimSpace(redirectURI) == "" {
			return "", "", "", fmt.Errorf("%w: web redirect_uri is not configured", ErrGoogleTokenVerificationFailed)
		}
		return strings.TrimSpace(s.cfg.WebClientID), strings.TrimSpace(s.cfg.WebClientSecret), strings.TrimSpace(redirectURI), nil
	}
}

func (s *GoogleOAuthService) isAllowedAudience(aud string) bool {
	aud = strings.TrimSpace(aud)
	if aud == "" {
		return false
	}

	allowed := []string{
		strings.TrimSpace(s.cfg.WebClientID),
		strings.TrimSpace(s.cfg.AndroidClientID),
		strings.TrimSpace(s.cfg.IOSClientID),
	}

	for _, a := range allowed {
		if a != "" && a == aud {
			return true
		}
	}
	return false
}

func (s *GoogleOAuthService) generateUniqueUsername(email, sub string) (string, error) {
	base := sanitizeUsername(strings.Split(email, "@")[0])
	if base == "" {
		base = "google_" + sanitizeUsername(sub)
	}
	if len(base) < 3 {
		base = "googleuser"
	}
	if len(base) > 42 {
		base = base[:42]
	}

	candidates := []string{base}
	for i := 1; i <= 100; i++ {
		candidates = append(candidates, fmt.Sprintf("%s_%d", base, i))
	}

	for _, candidate := range candidates {
		_, err := s.userRepo.GetByUsername(candidate)
		if errors.Is(err, apperrors.ErrNotFound) {
			return candidate, nil
		}
		if err != nil {
			return "", err
		}
	}

	randomSuffix, err := generateRandomHex(6)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%s_%s", base, randomSuffix), nil
}

func sanitizeUsername(input string) string {
	input = strings.ToLower(strings.TrimSpace(input))
	var b strings.Builder
	for _, r := range input {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '_' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func generateRandomHex(byteLen int) (string, error) {
	if byteLen <= 0 {
		byteLen = 16
	}
	buf := make([]byte, byteLen)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}
