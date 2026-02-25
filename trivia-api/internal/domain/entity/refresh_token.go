package entity

import "time"

// RefreshToken stores a refresh token session record (hash-only model).
type RefreshToken struct {
	ID        uint       `gorm:"primaryKey" json:"id"`
	UserID    uint       `gorm:"not null;index" json:"user_id"`
	TokenHash string     `gorm:"column:token_hash;type:text;not null;uniqueIndex" json:"-"`
	DeviceID  string     `gorm:"size:255;not null" json:"device_id"`
	IPAddress string     `gorm:"size:50;not null;default:''" json:"ip_address"`
	UserAgent string     `gorm:"type:text;not null;default:''" json:"user_agent"`
	ExpiresAt time.Time  `gorm:"not null;index" json:"expires_at"`
	CreatedAt time.Time  `gorm:"not null" json:"created_at"`
	IsExpired bool       `gorm:"not null;default:false;index" json:"is_expired"`
	RevokedAt *time.Time `gorm:"index" json:"revoked_at,omitempty"`
	Reason    string     `gorm:"size:255" json:"reason,omitempty"`
}

// NewRefreshToken creates a refresh token entity using precomputed SHA-256 token hash.
func NewRefreshToken(userID uint, tokenHash, deviceID, ipAddress, userAgent string, expiresAt time.Time) *RefreshToken {
	return &RefreshToken{
		UserID:    userID,
		TokenHash: tokenHash,
		DeviceID:  deviceID,
		IPAddress: ipAddress,
		UserAgent: userAgent,
		ExpiresAt: expiresAt,
		CreatedAt: time.Now(),
		IsExpired: false,
	}
}

// IsValid checks token validity.
func (rt *RefreshToken) IsValid() bool {
	return !rt.IsExpired && rt.RevokedAt == nil && rt.ExpiresAt.After(time.Now())
}

// Revoke marks token as revoked with reason.
func (rt *RefreshToken) Revoke(reason string) {
	now := time.Now()
	rt.RevokedAt = &now
	rt.IsExpired = true
	rt.Reason = reason
}

// SessionInfo returns safe session details for clients.
func (rt *RefreshToken) SessionInfo() map[string]interface{} {
	info := map[string]interface{}{
		"id":         rt.ID,
		"device_id":  rt.DeviceID,
		"ip_address": rt.IPAddress,
		"user_agent": rt.UserAgent,
		"created_at": rt.CreatedAt,
		"expires_at": rt.ExpiresAt,
		"is_expired": rt.IsExpired,
	}

	if rt.RevokedAt != nil {
		info["revoked_at"] = rt.RevokedAt
	}
	if rt.Reason != "" {
		info["reason"] = rt.Reason
	}

	return info
}

func (RefreshToken) TableName() string {
	return "refresh_tokens"
}

