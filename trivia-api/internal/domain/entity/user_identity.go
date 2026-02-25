package entity

import "time"

// UserIdentity links a local user to external auth providers (google now, apple later).
type UserIdentity struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	UserID        uint      `gorm:"not null;index" json:"user_id"`
	Provider      string    `gorm:"size:20;not null;index:idx_provider_sub,priority:1" json:"provider"`
	ProviderSub   string    `gorm:"size:255;not null;index:idx_provider_sub,priority:2" json:"provider_sub"`
	ProviderEmail string    `gorm:"size:100" json:"provider_email,omitempty"`
	EmailVerified bool      `gorm:"not null;default:false" json:"email_verified"`
	CreatedAt     time.Time `gorm:"not null;default:CURRENT_TIMESTAMP" json:"created_at"`
}

func (UserIdentity) TableName() string {
	return "user_identities"
}
