package entity

import "time"

// UserLegalAcceptance хранит запись о принятии пользователем ToS/Privacy Policy
type UserLegalAcceptance struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	UserID         uint      `gorm:"not null;index" json:"user_id"`
	TOSVersion     string    `gorm:"column:tos_version;size:20;not null" json:"tos_version"`
	PrivacyVersion string    `gorm:"column:privacy_version;size:20;not null" json:"privacy_version"`
	MarketingOptIn bool      `gorm:"not null;default:false" json:"marketing_opt_in"`
	AcceptedAt     time.Time `gorm:"not null;default:CURRENT_TIMESTAMP" json:"accepted_at"`
	IP             string    `gorm:"size:50" json:"ip,omitempty"`
	UserAgent      string    `gorm:"type:text" json:"user_agent,omitempty"`
}

// TableName определяет имя таблицы для GORM
func (UserLegalAcceptance) TableName() string {
	return "user_legal_acceptances"
}
