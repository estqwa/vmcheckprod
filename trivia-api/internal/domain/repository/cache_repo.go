package repository

import (
	"time"
)

// CacheRepository определяет методы для работы с кешем
type CacheRepository interface {
	Set(key string, value interface{}, expiration time.Duration) error
	Get(key string) (string, error)
	Delete(key string) error
	Increment(key string) (int64, error)
	SetJSON(key string, value interface{}, expiration time.Duration) error
	GetJSON(key string, dest interface{}) error
	Exists(key string) (bool, error)
	ExpireAt(key string, expiration time.Time) error
	SetNX(key string, value interface{}, expiration time.Duration) (bool, error)

	// Redis Set operations for participant tracking
	// SAdd adds members to a Set. Used to register quiz participants persistently.
	SAdd(key string, members ...interface{}) error
	// SMembers returns all members of a Set. Used to get all quiz participants.
	SMembers(key string) ([]string, error)
	// SRem removes members from a Set.
	SRem(key string, members ...interface{}) error
	// SIsMember checks if a member exists in a Set.
	SIsMember(key string, member interface{}) (bool, error)
	// Expire sets a TTL on a key (duration-based, unlike ExpireAt which is time-based).
	Expire(key string, expiration time.Duration) error
}
