package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/yourusername/trivia-api/internal/config"
	"github.com/yourusername/trivia-api/internal/handler"
	"github.com/yourusername/trivia-api/internal/middleware"
	pgRepo "github.com/yourusername/trivia-api/internal/repository/postgres"
	redisRepo "github.com/yourusername/trivia-api/internal/repository/redis"
	"github.com/yourusername/trivia-api/internal/service"
	"github.com/yourusername/trivia-api/internal/service/quizmanager"
	ws "github.com/yourusername/trivia-api/internal/websocket"
	"github.com/yourusername/trivia-api/pkg/auth"
	"github.com/yourusername/trivia-api/pkg/auth/manager"
	"github.com/yourusername/trivia-api/pkg/database"
)

func main() {
	// Р—Р°РіСЂСѓР¶Р°РµРј РєРѕРЅС„РёРіСѓСЂР°С†РёСЋ
	configPath := os.Getenv("CONFIG_PATH")
	if configPath == "" {
		configPath = "config/config.yaml"
	}
	log.Printf("Р—Р°РіСЂСѓР·РєР° РєРѕРЅС„РёРіСѓСЂР°С†РёРё РёР· %s", configPath)

	cfg, err := config.Load(configPath)
	if err != nil {
		log.Printf("Failed to load config: %v", err)
		os.Exit(1)
	}

	// РРЅРёС†РёР°Р»РёР·РёСЂСѓРµРј РїРѕРґРєР»СЋС‡РµРЅРёРµ Рє PostgreSQL
	db, err := database.NewPostgresDB(cfg.Database.PostgresConnectionString())
	if err != nil {
		log.Printf("Failed to connect to database: %v", err)
		os.Exit(1)
	}

	// РџСЂРёРјРµРЅСЏРµРј РјРёРіСЂР°С†РёРё
	if err := database.MigrateDB(db); err != nil {
		log.Printf("Failed to migrate database: %v", err)
		os.Exit(1)
	}

	// РРЅРёС†РёР°Р»РёР·РёСЂСѓРµРј РїРѕРґРєР»СЋС‡РµРЅРёРµ Рє Redis СЃ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёРµРј СѓРЅРёС„РёС†РёСЂРѕРІР°РЅРЅРѕР№ РєРѕРЅС„РёРіСѓСЂР°С†РёРё
	redisClient, err := database.NewUniversalRedisClient(cfg.Redis)
	if err != nil {
		log.Printf("Failed to connect to Redis: %v", err)
		os.Exit(1)
	}
	log.Println("Successfully connected to Redis")

	// РРЅРёС†РёР°Р»РёР·РёСЂСѓРµРј СЂРµРїРѕР·РёС‚РѕСЂРёРё
	userRepo := pgRepo.NewUserRepo(db)
	quizRepo := pgRepo.NewQuizRepo(db)
	questionRepo := pgRepo.NewQuestionRepo(db)
	resultRepo := pgRepo.NewResultRepo(db)

	cacheRepo, err := redisRepo.NewCacheRepo(redisClient)
	if err != nil {
		log.Printf("Failed to initialize CacheRepo: %v", err)
		os.Exit(1)
	}

	// РРЅРёС†РёР°Р»РёР·РёСЂСѓРµРј СЂРµРїРѕР·РёС‚РѕСЂРёРё РґР»СЏ СЂРµРєР»Р°РјС‹
	adAssetRepo := pgRepo.NewAdAssetRepository(db)
	quizAdSlotRepo := pgRepo.NewQuizAdSlotRepository(db)

	// РРЅРёС†РёР°Р»РёР·РёСЂСѓРµРј СЂРµРїРѕР·РёС‚РѕСЂРёР№ РґР»СЏ РёРЅРІР°Р»РёРґРёСЂРѕРІР°РЅРЅС‹С… С‚РѕРєРµРЅРѕРІ
	invalidTokenRepo := pgRepo.NewInvalidTokenRepo(db)

	// РРЅРёС†РёР°Р»РёР·РёСЂСѓРµРј СЂРµРїРѕР·РёС‚РѕСЂРёР№ РґР»СЏ refresh-С‚РѕРєРµРЅРѕРІ
	refreshTokenRepo, err := pgRepo.NewRefreshTokenRepo(db)
	if err != nil {
		log.Printf("Failed to initialize RefreshTokenRepo: %v", err)
		os.Exit(1)
	}

	// РРЅРёС†РёР°Р»РёР·РёСЂСѓРµРј СЂРµРїРѕР·РёС‚РѕСЂРёР№ РґР»СЏ JWT РєР»СЋС‡РµР№
	jwtKeyRepo, err := pgRepo.NewPostgresJWTKeyRepository(db, cfg.JWT.DBJWTKeyEncryptionKey)
	if err != nil {
		log.Printf("Failed to initialize JWTKeyRepository: %v", err)
		os.Exit(1)
	}

	// --- РРЅРёС†РёР°Р»РёР·Р°С†РёСЏ РєРѕРЅС„РёРіСѓСЂР°С†РёРё РґР»СЏ QuizManager ---
	quizConfig := quizmanager.DefaultConfig()

	// --- РРЅРёС†РёР°Р»РёР·Р°С†РёСЏ TokenManager Рё JWTService ---

	// 1. РЎРѕР·РґР°РµРј TokenManager
	tokenManager, err := manager.NewTokenManager(refreshTokenRepo, userRepo, jwtKeyRepo)
	if err != nil {
		log.Printf("Failed to initialize TokenManager: %v", err)
		os.Exit(1)
	}
	// РЈСЃС‚Р°РЅР°РІР»РёРІР°РµРј РїР°СЂР°РјРµС‚СЂС‹ TokenManager РёР· РєРѕРЅС„РёРіСѓСЂР°С†РёРё
	// Access token TTL: РёСЃРїРѕР»СЊР·СѓРµРј РЅРѕРІС‹Р№ accessTokenTTL, fallback РЅР° legacy expirationHrs
	accessTTL := time.Duration(cfg.JWT.ExpirationHrs) * time.Hour
	if cfg.JWT.AccessTokenTTL != "" {
		ttl, parseErr := time.ParseDuration(cfg.JWT.AccessTokenTTL)
		if parseErr != nil {
			log.Printf("WARNING: failed to parse jwt.accessTokenTTL '%s': %v. Falling back to expirationHrs.", cfg.JWT.AccessTokenTTL, parseErr)
		} else {
			accessTTL = ttl
		}
	}
	tokenManager.SetAccessTokenExpiry(accessTTL)
	tokenManager.SetRefreshTokenExpiry(time.Duration(cfg.Auth.RefreshTokenLifetime) * time.Hour)
	tokenManager.SetMaxRefreshTokensPerUser(cfg.Auth.SessionLimit)

	isProduction := gin.Mode() == gin.ReleaseMode
	tokenManager.SetProductionMode(isProduction) // РЈСЃС‚Р°РЅР°РІР»РёРІР°РµРј СЂРµР¶РёРј РґР»СЏ Secure РєСѓРє

	// Р’РќРРњРђРќРР•: SameSiteNoneMode С‚СЂРµР±СѓРµС‚ Secure=true. РЈР±РµРґРёС‚РµСЃСЊ, С‡С‚Рѕ isProduction СѓСЃС‚Р°РЅР°РІР»РёРІР°РµС‚СЃСЏ РєРѕСЂСЂРµРєС‚РЅРѕ.
	// Р”Р»СЏ Р»РѕРєР°Р»СЊРЅРѕР№ СЂР°Р·СЂР°Р±РѕС‚РєРё Р±РµР· HTTPS, SameSiteLaxMode РёР»Рё SameSiteDefaultMode РјРѕР¶РµС‚ Р±С‹С‚СЊ Р±РѕР»РµРµ РїРѕРґС…РѕРґСЏС‰РёРј.
	// Р•СЃР»Рё isProduction=false (HTTP), SameSite=None РЅРµ Р±СѓРґРµС‚ СЂР°Р±РѕС‚Р°С‚СЊ РєРѕСЂСЂРµРєС‚РЅРѕ РІ Р±РѕР»СЊС€РёРЅСЃС‚РІРµ Р±СЂР°СѓР·РµСЂРѕРІ.
	sameSitePolicy := http.SameSiteLaxMode // РџРѕ СѓРјРѕР»С‡Р°РЅРёСЋ Lax
	if isProduction {
		sameSitePolicy = http.SameSiteNoneMode // None С‚РѕР»СЊРєРѕ РґР»СЏ HTTPS
	}
	tokenManager.SetCookieAttributes(
		"/",            // Path
		"",             // Domain
		isProduction,   // Secure (true РґР»СЏ РїСЂРѕРґР°)
		true,           // HttpOnly
		sameSitePolicy, // РСЃРїРѕР»СЊР·СѓРµРј РІС‹С‡РёСЃР»РµРЅРЅСѓСЋ РїРѕР»РёС‚РёРєСѓ
	)

	// РЎРѕР·РґР°РµРј РєРѕРЅС‚РµРєСЃС‚ СЃ РѕС‚РјРµРЅРѕР№ РґР»СЏ РєРѕСЂСЂРµРєС‚РЅРѕРіРѕ Р·Р°РІРµСЂС€РµРЅРёСЏ СЂР°Р±РѕС‚С‹ РіРѕСЂСѓС‚РёРЅ
	// Р­С‚РѕС‚ РєРѕРЅС‚РµРєСЃС‚ Р±СѓРґРµС‚ РёСЃРїРѕР»СЊР·РѕРІР°С‚СЊСЃСЏ РґР»СЏ СѓРїСЂР°РІР»РµРЅРёСЏ Р¶РёР·РЅРµРЅРЅС‹Рј С†РёРєР»РѕРј РіРѕСЂСѓС‚РёРЅ РІ СЃРµСЂРІРёСЃР°С…
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// --- РРЅРёС†РёР°Р»РёР·Р°С†РёСЏ WebSocket (PubSubProvider СЃРѕР·РґР°РµС‚СЃСЏ Р·РґРµСЃСЊ) ---
	var wsHub ws.HubInterface
	var pubSubProvider ws.PubSubProvider = &ws.NoOpPubSub{} // РџСЂРѕРІР°Р№РґРµСЂ РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ

	// РЎРѕР·РґР°РµРј PubSubProvider С‚РѕР»СЊРєРѕ РµСЃР»Рё РєР»Р°СЃС‚РµСЂРёР·Р°С†РёСЏ РІРєР»СЋС‡РµРЅР°
	if cfg.WebSocket.Cluster.Enabled {
		log.Println("РРЅРёС†РёР°Р»РёР·Р°С†РёСЏ Redis PubSub РґР»СЏ РєР»Р°СЃС‚РµСЂРёР·Р°С†РёРё WebSocket...")
		redisPubSubClient, errPubSub := database.NewUniversalRedisClient(cfg.Redis)
		if errPubSub != nil {
			log.Printf("РћС€РёР±РєР° РїСЂРё РёРЅРёС†РёР°Р»РёР·Р°С†РёРё Redis РєР»РёРµРЅС‚Р° РґР»СЏ PubSub: %v. РљР»Р°СЃС‚РµСЂРёР·Р°С†РёСЏ WS Р±СѓРґРµС‚ РЅРµР°РєС‚РёРІРЅР°.", errPubSub)
			pubSubProvider = &ws.NoOpPubSub{}
		} else {
			redisProvider, errProv := ws.NewRedisPubSub(redisPubSubClient)
			if errProv != nil {
				log.Printf("РћС€РёР±РєР° РїСЂРё СЃРѕР·РґР°РЅРёРё Redis PubSub РїСЂРѕРІР°Р№РґРµСЂР°: %v. РљР»Р°СЃС‚РµСЂРёР·Р°С†РёСЏ WS Р±СѓРґРµС‚ РЅРµР°РєС‚РёРІРЅР°.", errProv)
				redisPubSubClient.Close()
				pubSubProvider = &ws.NoOpPubSub{}
			} else {
				log.Println("Redis PubSub РїСЂРѕРІР°Р№РґРµСЂ СѓСЃРїРµС€РЅРѕ РёРЅРёС†РёР°Р»РёР·РёСЂРѕРІР°РЅ")
				pubSubProvider = redisProvider
			}
		}
	}
	// --- РљРѕРЅРµС† РёРЅРёС†РёР°Р»РёР·Р°С†РёРё WebSocket ---

	// 2. РЎРѕР·РґР°РµРј JWTService, РїРµСЂРµРґР°РІР°СЏ РµРјСѓ tokenManager РєР°Рє KeyProvider, pubSubProvider Рё ctx
	jwtService, err := auth.NewJWTService(
		cfg.JWT.ExpirationHrs,
		invalidTokenRepo,
		cfg.JWT.WSTicketExpirySec,
		cfg.JWT.CleanupInterval,
		tokenManager,   // tokenManager СЂРµР°Р»РёР·СѓРµС‚ KeyProvider
		pubSubProvider, // <<< РџР•Р Р•Р”РђР•Рњ РЎР®Р”Рђ
		ctx,            // <<< РџР•Р Р•Р”РђР•Рњ РЎР®Р”Рђ РљРћР РќР•Р’РћР™ РљРћРќРўР•РљРЎРў РџР РР›РћР–Р•РќРРЇ
	)
	if err != nil {
		log.Printf("Failed to initialize JWTService: %v", err)
		os.Exit(1)
	}
	jwtService.SetAccessTokenTTL(accessTTL)

	// 3. РЈСЃС‚Р°РЅР°РІР»РёРІР°РµРј jwtService РІ tokenManager
	tokenManager.SetJWTService(jwtService)

	// --- РљРѕРЅРµС† РёР·РјРµРЅРµРЅРЅРѕР№ РёРЅРёС†РёР°Р»РёР·Р°С†РёРё TokenManager Рё JWTService ---

	// РРЅРёС†РёР°Р»РёР·РёСЂСѓРµРј СЂРµРїРѕР·РёС‚РѕСЂРёР№ СЋСЂРёРґРёС‡РµСЃРєРёС… СЃРѕРіР»Р°СЃРёР№
	legalRepo := pgRepo.NewUserLegalAcceptanceRepo(db)
	emailVerificationRepo := pgRepo.NewEmailVerificationRepo(db)
	userIdentityRepo := pgRepo.NewUserIdentityRepo(db)

	// РџРµСЂРµРґР°РµРј TokenManager Рё legalRepo РІ AuthService
	authService, err := service.NewAuthService(userRepo, jwtService, tokenManager, refreshTokenRepo, invalidTokenRepo, legalRepo)
	if err != nil {
		log.Printf("Failed to initialize AuthService: %v", err)
		os.Exit(1)
	}
	authService.SetFeatureFlags(cfg.Features.EmailVerificationEnabled, cfg.Features.GoogleOAuthEnabled)
	authService.SetLegalVersions(cfg.Legal.TOSVersion, cfg.Legal.PrivacyVersion)
	authService.SetEmailVerificationRepository(emailVerificationRepo)
	authService.SetIdentityRepository(userIdentityRepo)

	if cfg.Features.EmailVerificationEnabled {
		var emailSvc service.EmailService
		switch strings.ToLower(strings.TrimSpace(cfg.Email.Provider)) {
		case "resend":
			resendSvc, emailErr := service.NewResendEmailService(cfg.Email.ResendAPIKey, cfg.Email.From)
			if emailErr != nil {
				log.Printf("Failed to initialize ResendEmailService: %v", emailErr)
				os.Exit(1)
			}
			emailSvc = resendSvc
		default:
			log.Printf("Unsupported email provider for verification: %s", cfg.Email.Provider)
			os.Exit(1)
		}

		emailVerificationService, emailErr := service.NewEmailVerificationService(
			userRepo,
			emailVerificationRepo,
			emailSvc,
			cfg.Email.VerificationTTL,
			time.Duration(cfg.Email.ResendCooldownSec)*time.Second,
			cfg.Email.MaxAttempts,
			cfg.Email.CodePepper,
		)
		if emailErr != nil {
			log.Printf("Failed to initialize EmailVerificationService: %v", emailErr)
			os.Exit(1)
		}
		authService.SetEmailVerificationService(emailVerificationService)
	}

	if cfg.Features.GoogleOAuthEnabled {
		googleOAuthService, googleErr := service.NewGoogleOAuthService(userRepo, userIdentityRepo, tokenManager, cfg.Google)
		if googleErr != nil {
			log.Printf("Failed to initialize GoogleOAuthService: %v", googleErr)
			os.Exit(1)
		}
		authService.SetGoogleOAuthService(googleOAuthService)
	}

	// Р—Р°РїСѓСЃРєР°РµРј С„РѕРЅРѕРІСѓСЋ Р·Р°РґР°С‡Сѓ РґР»СЏ РѕС‡РёСЃС‚РєРё РёСЃС‚РµРєС€РёС… CSRF С‚РѕРєРµРЅРѕРІ Рё РґСЂСѓРіРёС… СЂРµСЃСѓСЂСЃРѕРІ
	go func() {
		ticker := time.NewTicker(1 * time.Hour)
		defer ticker.Stop()

		log.Println("Р—Р°РїСѓСЃРє РјРµС…Р°РЅРёР·РјР° РїРµСЂРёРѕРґРёС‡РµСЃРєРѕР№ РѕС‡РёСЃС‚РєРё CSRF С‚РѕРєРµРЅРѕРІ Рё РёСЃС‚РµРєС€РёС… refresh-С‚РѕРєРµРЅРѕРІ (РєР°Р¶РґС‹Р№ С‡Р°СЃ)")

		for {
			select {
			case <-ticker.C:
				log.Println("Р’С‹РїРѕР»РЅСЏСЋ РїРµСЂРёРѕРґРёС‡РµСЃРєСѓСЋ РѕС‡РёСЃС‚РєСѓ CSRF С‚РѕРєРµРЅРѕРІ Рё РёСЃС‚РµРєС€РёС… refresh-С‚РѕРєРµРЅРѕРІ...")
				if err := tokenManager.CleanupExpiredTokens(); err != nil {
					log.Printf("РћС€РёР±РєР° РїСЂРё РѕС‡РёСЃС‚РєРµ С‚РѕРєРµРЅРѕРІ: %v", err)
				} else {
					log.Println("РћС‡РёСЃС‚РєР° С‚РѕРєРµРЅРѕРІ РІС‹РїРѕР»РЅРµРЅР° СѓСЃРїРµС€РЅРѕ")
				}
			case <-ctx.Done():
				log.Println("Р—Р°РІРµСЂС€РµРЅРёРµ СЂР°Р±РѕС‚С‹ РіРѕСЂСѓС‚РёРЅС‹ РѕС‡РёСЃС‚РєРё С‚РѕРєРµРЅРѕРІ")
				return
			}
		}
	}()

	// РРЅРёС†РёР°Р»РёР·Р°С†РёСЏ WebSocket Hub
	// Р’РђР–РќРћ: Р’СЃРµРіРґР° СЃРѕР·РґР°С‘Рј ShardedHub, РґР°Р¶Рµ РµСЃР»Рё С€Р°СЂРґРёСЂРѕРІР°РЅРёРµ РІС‹РєР»СЋС‡РµРЅРѕ.
	// Р Р°РЅСЊС€Рµ wsHub РѕСЃС‚Р°РІР°Р»СЃСЏ nil, С‡С‚Рѕ Р»РѕРјР°Р»Рѕ РІРµСЃСЊ WebSocket.
	// Sharding.Enabled РєРѕРЅС‚СЂРѕР»РёСЂСѓРµС‚ С‚РѕР»СЊРєРѕ Р·Р°РїСѓСЃРє ClusterHub РґР»СЏ РјРµР¶СЃРµСЂРІРµСЂРЅРѕРіРѕ
	// РІР·Р°РёРјРѕРґРµР№СЃС‚РІРёСЏ, РЅРѕ Р»РѕРєР°Р»СЊРЅС‹Р№ Hub РЅСѓР¶РµРЅ РІСЃРµРіРґР°.
	log.Println("WebSocket: РёРЅРёС†РёР°Р»РёР·Р°С†РёСЏ ShardedHub")
	shardedHub := ws.NewShardedHub(cfg.WebSocket, pubSubProvider, cacheRepo)
	go shardedHub.Run() // Р—Р°РїСѓСЃРєР°РµРј РѕР±СЂР°Р±РѕС‚С‡РёРє С€Р°СЂРґРѕРІ
	wsHub = shardedHub

	if cfg.WebSocket.Sharding.Enabled {
		log.Println("WebSocket: РєР»Р°СЃС‚РµСЂРЅС‹Р№ СЂРµР¶РёРј РІРєР»СЋС‡РµРЅ")
	} else {
		log.Println("WebSocket: СЂР°Р±РѕС‚Р° РІ Р°РІС‚РѕРЅРѕРјРЅРѕРј СЂРµР¶РёРјРµ (Р±РµР· РєР»Р°СЃС‚РµСЂР°)")
	}

	wsManager := ws.NewManager(wsHub)

	// РРЅРёС†РёР°Р»РёР·РёСЂСѓРµРј СЃРµСЂРІРёСЃС‹
	quizService := service.NewQuizService(quizRepo, questionRepo, cacheRepo, quizConfig, db)
	resultService := service.NewResultService(resultRepo, userRepo, quizRepo, questionRepo, cacheRepo, db, wsManager, quizConfig)
	resultService.SetEmailVerificationGate(cfg.Features.EmailVerificationSoftGateEnabled)
	userService := service.NewUserService(userRepo)
	quizManagerService := service.NewQuizManager(quizRepo, questionRepo, resultRepo, resultService, cacheRepo, wsManager, db, quizAdSlotRepo)

	// РРЅРёС†РёР°Р»РёР·РёСЂСѓРµРј СЃРµСЂРІРёСЃС‹ СЂРµРєР»Р°РјС‹
	adService := service.NewAdService(adAssetRepo, "./uploads/ads")
	quizAdSlotService := service.NewQuizAdSlotService(quizAdSlotRepo, adAssetRepo, quizRepo)

	// РРЅРёС†РёР°Р»РёР·РёСЂСѓРµРј РѕР±СЂР°Р±РѕС‚С‡РёРєРё
	authHandler := handler.NewAuthHandler(authService, tokenManager, wsHub)
	mobileAuthHandler := handler.NewMobileAuthHandler(authService, tokenManager, wsHub)
	quizHandler := handler.NewQuizHandler(quizService, resultService, quizManagerService)
	wsHandler := handler.NewWSHandler(wsHub, wsManager, quizManagerService, jwtService, cfg.WebSocket, cfg.CORS.AllowedOrigins)
	userHandler := handler.NewUserHandler(userService, resultService)
	adHandler := handler.NewAdHandler(adService, quizAdSlotService)

	// РРЅРёС†РёР°Р»РёР·РёСЂСѓРµРј middleware
	authMiddleware := middleware.NewAuthMiddlewareWithManager(jwtService, tokenManager)
	rateLimiter := middleware.NewRateLimiter(redisClient)

	// РРЅРёС†РёР°Р»РёР·РёСЂСѓРµРј СЂРѕСѓС‚РµСЂ Gin
	router := gin.Default()

	// РќР°СЃС‚СЂРѕР№РєР° РґРѕРІРµСЂРµРЅРЅС‹С… РїСЂРѕРєСЃРё РґР»СЏ РєРѕСЂСЂРµРєС‚РЅРѕР№ СЂР°Р±РѕС‚С‹ c.ClientIP()
	// Р’ production (GIN_MODE=release): РЅРµ РґРѕРІРµСЂСЏРµРј РїСЂРѕРєСЃРё (Р·Р°С‰РёС‚Р° РѕС‚ IP spoofing)
	// Р’ development: РґРѕРІРµСЂСЏРµРј localhost
	// РџСЂРё РґРµРїР»РѕРµ РЅР° VM СЃ load balancer: РґРѕР±Р°РІСЊС‚Рµ IP Р±Р°Р»Р°РЅСЃРёСЂРѕРІС‰РёРєР° РІ СЃРїРёСЃРѕРє
	if isProduction {
		// Production: РЅРµ РґРѕРІРµСЂСЏС‚СЊ РїСЂРѕРєСЃРё-Р·Р°РіРѕР»РѕРІРєР°Рј
		// Р•СЃР»Рё РёСЃРїРѕР»СЊР·СѓРµС‚Рµ load balancer, Р·Р°РјРµРЅРёС‚Рµ nil РЅР° []string{"IP_Р‘РђР›РђРќРЎРР РћР’Р©РРљРђ"}
		if err := router.SetTrustedProxies(nil); err != nil {
			log.Printf("Warning: failed to set trusted proxies: %v", err)
		}
	} else {
		// Development: РґРѕРІРµСЂСЏРµРј localhost
		if err := router.SetTrustedProxies([]string{"127.0.0.1", "::1"}); err != nil {
			log.Printf("Warning: failed to set trusted proxies: %v", err)
		}
	}

	// РќР°СЃС‚СЂРѕР№РєР° CORS
	// Fail-fast: РµСЃР»Рё СЃРїРёСЃРѕРє origins РїСѓСЃС‚РѕР№ вЂ” СЌС‚Рѕ РѕС€РёР±РєР° РєРѕРЅС„РёРіСѓСЂР°С†РёРё
	if len(cfg.CORS.AllowedOrigins) == 0 {
		log.Fatal("CORS configuration error: allowed_origins list is empty. This would block all browser clients.")
	}
	router.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.CORS.AllowedOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization", "X-CSRF-Token"},
		ExposeHeaders:    []string{"Content-Length", "X-Quiz-Schedule-Warning", "Retry-After", "X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// РЎС‚Р°С‚РёС‡РµСЃРєРёРµ С„Р°Р№Р»С‹ РґР»СЏ Р°РґРјРёРЅ-РїР°РЅРµР»Рё
	router.StaticFS("/admin", http.Dir("./static/admin"))

	// РЎС‚Р°С‚РёС‡РµСЃРєРёРµ С„Р°Р№Р»С‹ РґР»СЏ Р·Р°РіСЂСѓР¶РµРЅРЅС‹С… СЂРµРєР»Р°Рј
	router.Static("/uploads/ads", "./uploads/ads")

	// РќР°СЃС‚СЂР°РёРІР°РµРј РјР°СЂС€СЂСѓС‚С‹ API
	api := router.Group("/api")
	{
		// РђСѓС‚РµРЅС‚РёС„РёРєР°С†РёСЏ
		authGroup := api.Group("/auth")
		authDefaultRateLimit := rateLimiter.Limit(middleware.DefaultAuthRateLimitConfig())
		{
			authGroup.POST("/register", rateLimiter.Limit(middleware.StrictAuthRateLimitConfig()), authHandler.Register)
			authGroup.POST("/login", rateLimiter.Limit(middleware.StrictAuthRateLimitConfig()), authHandler.Login)
			authGroup.POST("/refresh", authDefaultRateLimit, authHandler.RefreshToken)
			authGroup.POST("/check-refresh", authDefaultRateLimit, authHandler.CheckRefreshToken)
			authGroup.POST("/token-info", authDefaultRateLimit, authHandler.GetTokenInfo)
			authGroup.POST("/google/exchange", authDefaultRateLimit, authHandler.GoogleExchange)

			// РњР°СЂС€СЂСѓС‚С‹, С‚СЂРµР±СѓСЋС‰РёРµ Р°СѓС‚РµРЅС‚РёС„РёРєР°С†РёРё
			authedAuth := authGroup.Group("/")
			authedAuth.Use(authDefaultRateLimit, authMiddleware.RequireAuth())
			{
				// Р­РЅРґРїРѕРёРЅС‚ РґР»СЏ РїРѕР»СѓС‡РµРЅРёСЏ CSRF С‚РѕРєРµРЅР° (С…РµС€Р°)
				authedAuth.GET("/csrf", authHandler.GetCSRFToken)
				authedAuth.GET("/verify-email/status", authHandler.GetEmailVerificationStatus)

				// РњР°СЂС€СЂСѓС‚С‹, С‚СЂРµР±СѓСЋС‰РёРµ Рё Р°СѓС‚РµРЅС‚РёС„РёРєР°С†РёРё, Рё CSRF С‚РѕРєРµРЅР°
				csrfProtected := authedAuth.Group("/")
				csrfProtected.Use(authMiddleware.RequireCSRF())
				{
					csrfProtected.POST("/logout", authHandler.Logout)
					csrfProtected.POST("/logout-all", authHandler.LogoutAllDevices)
					csrfProtected.GET("/sessions", authHandler.GetActiveSessions)
					csrfProtected.POST("/revoke-session", authHandler.RevokeSession)
					csrfProtected.POST("/change-password", authHandler.ChangePassword)
					csrfProtected.POST("/ws-ticket", authHandler.GenerateWsTicket)
					csrfProtected.POST("/verify-email/send", authHandler.SendEmailVerificationCode)
					csrfProtected.POST("/verify-email/confirm", authHandler.ConfirmEmailVerificationCode)
					csrfProtected.POST("/google/link", authHandler.GoogleLink)
				}
			}

			// РњР°СЂС€СЂСѓС‚ РґР»СЏ СЃР±СЂРѕСЃР° РёРЅРІР°Р»РёРґР°С†РёР№ С‚РѕРєРµРЅРѕРІ (С‚РѕР»СЊРєРѕ РґР»СЏ Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂРѕРІ)
			adminAuth := authGroup.Group("/admin")
			adminAuth.Use(authDefaultRateLimit, authMiddleware.RequireAuth(), authMiddleware.AdminOnly())
			adminAuth.Use(authMiddleware.RequireCSRF())
			{
				adminAuth.POST("/reset-auth", authHandler.ResetAuth)
				adminAuth.POST("/debug-token", authHandler.DebugToken)
				adminAuth.POST("/reset-password", authHandler.AdminResetPassword)
			}
		}

		// РџРѕР»СЊР·РѕРІР°С‚РµР»Рё
		users := api.Group("/users")
		users.Use(authMiddleware.RequireAuth())
		{
			users.GET("/me", authHandler.GetMe)
			users.GET("/me/results", userHandler.GetMyResults) // РСЃС‚РѕСЂРёСЏ РёРіСЂ
			users.PUT("/me", authMiddleware.RequireCSRF(), authHandler.UpdateProfile)
			users.PUT("/me/language", authMiddleware.RequireCSRF(), authHandler.UpdateLanguage)
			users.DELETE("/me", authMiddleware.RequireCSRF(), authHandler.DeleteMe)
		}

		// Р›РёРґРµСЂР±РѕСЂРґ (РїСѓР±Р»РёС‡РЅС‹Р№ РјР°СЂС€СЂСѓС‚)
		api.GET("/leaderboard", userHandler.GetLeaderboard)

		// Р’РёРєС‚РѕСЂРёРЅС‹
		quizzes := api.Group("/quizzes")
		{
			quizzes.GET("", quizHandler.ListQuizzes)
			quizzes.GET("/active", quizHandler.GetActiveQuiz)
			quizzes.GET("/scheduled", quizHandler.GetScheduledQuizzes)

			// Р“СЂСѓРїРїР° РјР°СЂС€СЂСѓС‚РѕРІ, С‚СЂРµР±СѓСЋС‰РёС… quizID
			quizWithID := quizzes.Group("/:id")
			quizWithID.Use(middleware.ExtractUintParam("id", "quizID")) // РџСЂРёРјРµРЅСЏРµРј middleware
			{
				quizWithID.GET("", quizHandler.GetQuiz)
				quizWithID.GET("/with-questions", quizHandler.GetQuizWithQuestions)
				quizWithID.GET("/results", quizHandler.GetQuizResults)

				// РњР°СЂС€СЂСѓС‚С‹ РґР»СЏ Р°СѓС‚РµРЅС‚РёС„РёС†РёСЂРѕРІР°РЅРЅС‹С… РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№
				authedQuizzes := quizWithID.Group("") // РќР°СЃР»РµРґСѓРµС‚ middleware
				authedQuizzes.Use(authMiddleware.RequireAuth())
				{
					authedQuizzes.GET("/my-result", quizHandler.GetUserQuizResult)
				}

				// РњР°СЂС€СЂСѓС‚С‹ РґР»СЏ Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂРѕРІ
				adminQuizzes := quizWithID.Group("") // РќР°СЃР»РµРґСѓРµС‚ middleware
				adminQuizzes.Use(authMiddleware.RequireAuth(), authMiddleware.AdminOnly())
				adminQuizzes.Use(authMiddleware.RequireCSRF())
				{
					adminQuizzes.POST("/questions", quizHandler.AddQuestions)
					adminQuizzes.PUT("/schedule", quizHandler.ScheduleQuiz)
					adminQuizzes.PUT("/cancel", quizHandler.CancelQuiz)
					adminQuizzes.POST("/duplicate", quizHandler.DuplicateQuiz)
					adminQuizzes.GET("/results/export", quizHandler.ExportQuizResults) // CSV/Excel СЌРєСЃРїРѕСЂС‚
					adminQuizzes.GET("/statistics", quizHandler.GetQuizStatistics)     // Р Р°СЃС€РёСЂРµРЅРЅР°СЏ СЃС‚Р°С‚РёСЃС‚РёРєР°
					adminQuizzes.GET("/winners", quizHandler.GetQuizWinners)           // РЎРїРёСЃРѕРє РїРѕР±РµРґРёС‚РµР»РµР№
					adminQuizzes.GET("/asked-questions", quizHandler.GetQuizAskedQuestions)

					// Р РµРєР»Р°РјРЅС‹Рµ СЃР»РѕС‚С‹ РІРёРєС‚РѕСЂРёРЅС‹
					adminQuizzes.POST("/ad-slots", adHandler.CreateAdSlot)
					adminQuizzes.GET("/ad-slots", adHandler.ListAdSlots)
					adminQuizzes.PUT("/ad-slots/:slotId", adHandler.UpdateAdSlot)
					adminQuizzes.DELETE("/ad-slots/:slotId", adHandler.DeleteAdSlot)
				}
			}

			// РњР°СЂС€СЂСѓС‚ СЃРѕР·РґР°РЅРёСЏ РІРёРєС‚РѕСЂРёРЅС‹ (РЅРµ С‚СЂРµР±СѓРµС‚ ID)
			adminCreateQuiz := quizzes.Group("")
			adminCreateQuiz.Use(authMiddleware.RequireAuth(), authMiddleware.AdminOnly())
			adminCreateQuiz.Use(authMiddleware.RequireCSRF())
			{
				adminCreateQuiz.POST("", quizHandler.CreateQuiz)
			}
		}

		// РЈРїСЂР°РІР»РµРЅРёРµ СЂРµРєР»Р°РјРѕР№ (Р°РґРјРёРЅ)
		adminAds := api.Group("/admin/ads")
		adminAds.Use(authMiddleware.RequireAuth(), authMiddleware.AdminOnly())
		adminAds.Use(authMiddleware.RequireCSRF())
		{
			adminAds.POST("", adHandler.UploadAdAsset)
			adminAds.GET("", adHandler.ListAdAssets)
			adminAds.DELETE("/:id", adHandler.DeleteAdAsset)
		}

		// РџСѓР» РІРѕРїСЂРѕСЃРѕРІ РґР»СЏ Р°РґР°РїС‚РёРІРЅРѕР№ СЃРёСЃС‚РµРјС‹ (admin)
		adminQuestionPool := api.Group("/admin/question-pool")
		adminQuestionPool.Use(authMiddleware.RequireAuth(), authMiddleware.AdminOnly())
		adminQuestionPool.Use(authMiddleware.RequireCSRF())
		{
			adminQuestionPool.POST("", quizHandler.BulkUploadQuestionPool)
			adminQuestionPool.GET("/stats", quizHandler.GetPoolStats)
			adminQuestionPool.POST("/reset", quizHandler.ResetPoolUsed)
		}
	}

	// ============================================================================
	// Mobile Auth Endpoints (Bearer + JSON, Р±РµР· cookies/CSRF)
	// ============================================================================
	mobileAuth := api.Group("/mobile/auth")
	mobileDefaultRateLimit := rateLimiter.Limit(middleware.DefaultAuthRateLimitConfig())
	{
		// РџСѓР±Р»РёС‡РЅС‹Рµ СЌРЅРґРїРѕРёРЅС‚С‹ (РЅРµ С‚СЂРµР±СѓСЋС‚ Р°СѓС‚РµРЅС‚РёС„РёРєР°С†РёРё)
		mobileAuth.POST("/login", rateLimiter.Limit(middleware.StrictAuthRateLimitConfig()), mobileAuthHandler.MobileLogin)
		mobileAuth.POST("/register", rateLimiter.Limit(middleware.StrictAuthRateLimitConfig()), mobileAuthHandler.MobileRegister)
		mobileAuth.POST("/refresh", mobileDefaultRateLimit, mobileAuthHandler.MobileRefresh)
		mobileAuth.POST("/google/exchange", mobileDefaultRateLimit, mobileAuthHandler.MobileGoogleExchange)

		// Logout РЅРµ С‚СЂРµР±СѓРµС‚ RequireAuth вЂ” СЂР°Р±РѕС‚Р°РµС‚ РїРѕ refresh_token РёР· body.
		// Р­С‚Рѕ РїРѕР·РІРѕР»СЏРµС‚ РІС‹Р№С‚Рё РґР°Р¶Рµ СЃ РїСЂРѕС‚СѓС…С€РёРј access token.
		mobileAuth.POST("/logout", mobileDefaultRateLimit, mobileAuthHandler.MobileLogout)

		// РўСЂРµР±СѓСЋС‚ Bearer auth, РЅРѕ РќР• CSRF
		mobileAuthed := mobileAuth.Group("/")
		mobileAuthed.Use(mobileDefaultRateLimit, authMiddleware.RequireAuth())
		{
			mobileAuthed.POST("/ws-ticket", mobileAuthHandler.MobileWsTicket)
			mobileAuthed.PUT("/profile", mobileAuthHandler.MobileUpdateProfile)
			mobileAuthed.GET("/sessions", mobileAuthHandler.MobileGetActiveSessions)
			mobileAuthed.POST("/revoke-session", mobileAuthHandler.MobileRevokeSession)
			mobileAuthed.POST("/logout-all", mobileAuthHandler.MobileLogoutAllDevices)
			mobileAuthed.POST("/verify-email/send", mobileAuthHandler.MobileSendEmailVerificationCode)
			mobileAuthed.POST("/verify-email/confirm", mobileAuthHandler.MobileConfirmEmailVerificationCode)
			mobileAuthed.GET("/verify-email/status", mobileAuthHandler.MobileGetEmailVerificationStatus)
			mobileAuthed.POST("/google/link", mobileAuthHandler.MobileGoogleLink)
			mobileAuthed.DELETE("/me", mobileAuthHandler.MobileDeleteMe)
		}
	}
	mobileUsers := api.Group("/mobile/users")
	mobileUsers.Use(mobileDefaultRateLimit, authMiddleware.RequireAuth())
	{
		mobileUsers.DELETE("/me", mobileAuthHandler.MobileDeleteMe)
	}

	// WebSocket РјР°СЂС€СЂСѓС‚
	// Р РµРґР°РєС†РёСЏ ticket РёР· access-Р»РѕРіРѕРІ Gin: ticket вЂ” СЃРµРєСЂРµС‚РЅС‹Рµ РґР°РЅРЅС‹Рµ.
	// Р’РђР–РќРћ: СЂРµРґР°РєС†РёСЏ РџРћРЎР›Р• РѕР±СЂР°Р±РѕС‚РєРё, С‡С‚РѕР±С‹ HandleConnection РїСЂРѕС‡РёС‚Р°Р» СЂРµР°Р»СЊРЅС‹Р№ ticket.
	// Gin Logger РёСЃРїРѕР»СЊР·СѓРµС‚ defer, РєРѕС‚РѕСЂС‹Р№ РІС‹РїРѕР»РЅРёС‚СЃСЏ РїРѕСЃР»Рµ РЅР°С€РµРіРѕ return вЂ” СѓРІРёРґРёС‚ [REDACTED].
	router.GET("/ws", func(c *gin.Context) {
		// РЎРЅР°С‡Р°Р»Р° РѕР±СЂР°Р±Р°С‚С‹РІР°РµРј вЂ” HandleConnection С‡РёС‚Р°РµС‚ c.Query("ticket")
		wsHandler.HandleConnection(c)
		// РџРѕСЃР»Рµ РѕР±СЂР°Р±РѕС‚РєРё РїРµСЂРµР·Р°РїРёСЃС‹РІР°РµРј URL, С‡С‚РѕР±С‹ ticket РЅРµ РїРѕРїР°Р» РІ access-Р»РѕРіРё
		if c.Request.URL.RawQuery != "" {
			c.Request.URL.RawQuery = "ticket=[REDACTED]"
		}
	})

	// WebSocket РјРѕРЅРёС‚РѕСЂРёРЅРі (Admin only)
	// Р­РЅРґРїРѕРёРЅС‚С‹ РґР»СЏ РјРѕРЅРёС‚РѕСЂРёРЅРіР° СЃРѕСЃС‚РѕСЏРЅРёСЏ WebSocket СЃРµСЂРІРµСЂР°
	adminWsMetrics := router.Group("/api/admin/ws")
	adminWsMetrics.Use(authMiddleware.RequireAuth(), authMiddleware.AdminOnly())
	{
		adminWsMetrics.GET("/metrics", gin.WrapF(ws.WebSocketMetricsHandler(shardedHub)))
		adminWsMetrics.GET("/metrics/detailed", gin.WrapF(ws.DetailedWebSocketMetricsHandler(shardedHub)))
		adminWsMetrics.GET("/metrics/prometheus", gin.WrapF(ws.PrometheusMetricsHandler(shardedHub)))
		adminWsMetrics.GET("/health", gin.WrapF(ws.WebSocketHealthCheckHandler(shardedHub)))
		adminWsMetrics.GET("/alerts", gin.WrapF(ws.WebSocketSystemAlertsHandler(shardedHub)))
	}

	// Р—Р°РїР»Р°РЅРёСЂРѕРІР°РЅРЅС‹Рµ РІРёРєС‚РѕСЂРёРЅС‹
	// РџРѕСЃР»Рµ РїРµСЂРµР·Р°РїСѓСЃРєР° СЃРµСЂРІРµСЂР° РЅСѓР¶РЅРѕ Р·Р°РЅРѕРІРѕ Р·Р°РїР»Р°РЅРёСЂРѕРІР°С‚СЊ Р°РєС‚РёРІРЅС‹Рµ РІРёРєС‚РѕСЂРёРЅС‹
	go func() {
		scheduledQuizzes, err := quizService.GetScheduledQuizzes()
		if err != nil {
			log.Printf("Failed to get scheduled quizzes: %v", err)
			return
		}

		for _, quiz := range scheduledQuizzes {
			if err := quizManagerService.ScheduleQuiz(quiz.ID, quiz.ScheduledTime); err != nil {
				log.Printf("Failed to reschedule quiz %d: %v", quiz.ID, err)
			}
		}
	}()

	// РќР°СЃС‚СЂР°РёРІР°РµРј HTTP СЃРµСЂРІРµСЂ СЃ С‚Р°Р№Рј-Р°СѓС‚Р°РјРё РґР»СЏ Р·Р°С‰РёС‚С‹ РѕС‚ slow client attacks
	srv := &http.Server{
		Addr:         ":" + cfg.Server.Port,
		Handler:      router,
		ReadTimeout:  time.Duration(cfg.Server.ReadTimeout) * time.Second,
		WriteTimeout: time.Duration(cfg.Server.WriteTimeout) * time.Second,
	}

	// Р—Р°РїСѓСЃРєР°РµРј СЃРµСЂРІРµСЂ РІ РіРѕСЂСѓС‚РёРЅРµ
	go func() {
		log.Printf("Starting server on port %s", cfg.Server.Port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Printf("Failed to start server: %v", err)
		}
	}()

	log.Printf("Server started on port %s", cfg.Server.Port)

	// Р’ РѕР±СЂР°Р±РѕС‚С‡РёРєРµ СЃРёРіРЅР°Р»РѕРІ РѕСЃС‚Р°РЅРѕРІРєРё
	// РџРѕСЃР»Рµ РїРѕР»СѓС‡РµРЅРёСЏ СЃРёРіРЅР°Р»Р° SIGINT РёР»Рё SIGTERM РІС‹Р·С‹РІР°РµРј cancel() РґР»СЏ Р·Р°РІРµСЂС€РµРЅРёСЏ РіРѕСЂСѓС‚РёРЅ
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	// РћС‚РїСЂР°РІР»СЏРµРј СЃРёРіРЅР°Р» Р·Р°РІРµСЂС€РµРЅРёСЏ РґР»СЏ РІСЃРµС… РіРѕСЂСѓС‚РёРЅ
	cancel()

	// Р—Р°РєСЂС‹РІР°РµРј PubSubProvider, РµСЃР»Рё РѕРЅ Р±С‹Р» СЃРѕР·РґР°РЅ
	if pubSubProvider != nil {
		if err := pubSubProvider.Close(); err != nil {
			log.Printf("Error closing PubSub provider: %v", err)
		}
	}

	// РЎРѕР·РґР°РµРј РєРѕРЅС‚РµРєСЃС‚ СЃ С‚Р°Р№РјР°СѓС‚РѕРј РґР»СЏ graceful shutdown СЃРµСЂРІРµСЂР°
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("Server forced to shutdown: %v", err)
		os.Exit(1)
	}

	log.Println("Server exited properly")
}
