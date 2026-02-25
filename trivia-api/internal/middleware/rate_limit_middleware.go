package middleware

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
)

// RateLimitConfig содержит настройки rate limiting
type RateLimitConfig struct {
	// MaxRequests — максимальное количество запросов за Window
	MaxRequests int
	// Window — временное окно для подсчёта запросов
	Window time.Duration
	// KeyPrefix — префикс для ключей в Redis
	KeyPrefix string
}

// DefaultAuthRateLimitConfig возвращает конфигурацию по умолчанию для auth endpoints
func DefaultAuthRateLimitConfig() RateLimitConfig {
	return RateLimitConfig{
		MaxRequests: 20,              // 20 запросов
		Window:      1 * time.Minute, // за 1 минуту
		KeyPrefix:   "rl:auth",
	}
}

// StrictAuthRateLimitConfig — строгий лимит для login/register (защита от brute-force)
func StrictAuthRateLimitConfig() RateLimitConfig {
	return RateLimitConfig{
		MaxRequests: 5,               // 5 попыток
		Window:      1 * time.Minute, // за 1 минуту
		KeyPrefix:   "rl:auth:strict",
	}
}

// RateLimiter создаёт middleware для rate limiting на основе Redis
type RateLimiter struct {
	redisClient redis.UniversalClient
}

// NewRateLimiter создает новый RateLimiter
func NewRateLimiter(redisClient redis.UniversalClient) *RateLimiter {
	return &RateLimiter{redisClient: redisClient}
}

// Limit возвращает Gin middleware с заданной конфигурацией
// Ключ формируется из IP + endpoint path
func (rl *RateLimiter) Limit(cfg RateLimitConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		clientIP := c.ClientIP()
		path := c.FullPath() // Gin route pattern, e.g. "/api/auth/login"
		if path == "" {
			path = c.Request.URL.Path
		}

		key := fmt.Sprintf("%s:%s:%s", cfg.KeyPrefix, clientIP, path)

		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()

		// Инкрементируем счётчик
		count, err := rl.redisClient.Incr(ctx, key).Result()
		if err != nil {
			// При ошибке Redis пропускаем запрос (fail-open), но логируем
			log.Printf("[RateLimiter] Redis error for key %s: %v. Allowing request (fail-open).", key, err)
			c.Next()
			return
		}

		// Если это первый запрос в окне — устанавливаем TTL
		if count == 1 {
			if err := rl.redisClient.Expire(ctx, key, cfg.Window).Err(); err != nil {
				log.Printf("[RateLimiter] Failed to set TTL for key %s: %v", key, err)
			}
		}

		// Устанавливаем заголовки rate limit
		remaining := cfg.MaxRequests - int(count)
		if remaining < 0 {
			remaining = 0
		}

		ttl, _ := rl.redisClient.TTL(ctx, key).Result()
		retryAfter := int(ttl.Seconds())
		if retryAfter < 0 {
			retryAfter = int(cfg.Window.Seconds())
		}

		c.Header("X-RateLimit-Limit", fmt.Sprintf("%d", cfg.MaxRequests))
		c.Header("X-RateLimit-Remaining", fmt.Sprintf("%d", remaining))
		c.Header("X-RateLimit-Reset", fmt.Sprintf("%d", retryAfter))

		// Проверяем лимит
		if int(count) > cfg.MaxRequests {
			log.Printf("[RateLimiter] Rate limit exceeded for IP=%s path=%s. Count=%d, Limit=%d",
				clientIP, path, count, cfg.MaxRequests)

			c.Header("Retry-After", fmt.Sprintf("%d", retryAfter))
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error":       "Too many requests. Please try again later.",
				"error_type":  "rate_limited",
				"retry_after": retryAfter,
			})
			return
		}

		c.Next()
	}
}

// LimitByIP ограничивает количество запросов по IP (без привязки к path)
// Полезно для глобального лимита на группу endpoints
func (rl *RateLimiter) LimitByIP(cfg RateLimitConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		clientIP := c.ClientIP()
		key := fmt.Sprintf("%s:%s", cfg.KeyPrefix, clientIP)

		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()

		count, err := rl.redisClient.Incr(ctx, key).Result()
		if err != nil {
			log.Printf("[RateLimiter] Redis error for key %s: %v. Allowing request (fail-open).", key, err)
			c.Next()
			return
		}

		if count == 1 {
			if err := rl.redisClient.Expire(ctx, key, cfg.Window).Err(); err != nil {
				log.Printf("[RateLimiter] Failed to set TTL for key %s: %v", key, err)
			}
		}

		remaining := cfg.MaxRequests - int(count)
		if remaining < 0 {
			remaining = 0
		}

		ttl, _ := rl.redisClient.TTL(ctx, key).Result()
		retryAfter := int(ttl.Seconds())
		if retryAfter < 0 {
			retryAfter = int(cfg.Window.Seconds())
		}

		c.Header("X-RateLimit-Limit", fmt.Sprintf("%d", cfg.MaxRequests))
		c.Header("X-RateLimit-Remaining", fmt.Sprintf("%d", remaining))
		c.Header("X-RateLimit-Reset", fmt.Sprintf("%d", retryAfter))

		if int(count) > cfg.MaxRequests {
			log.Printf("[RateLimiter] Rate limit exceeded for IP=%s (group). Count=%d, Limit=%d",
				clientIP, count, cfg.MaxRequests)

			c.Header("Retry-After", fmt.Sprintf("%d", retryAfter))
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error":       "Too many requests. Please try again later.",
				"error_type":  "rate_limited",
				"retry_after": retryAfter,
			})
			return
		}

		c.Next()
	}
}
