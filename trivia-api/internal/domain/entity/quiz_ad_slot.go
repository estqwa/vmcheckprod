package entity

import "time"

// QuizAdSlot привязывает рекламу к вопросу викторины
type QuizAdSlot struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	QuizID        uint      `gorm:"not null;index" json:"quiz_id"`
	QuestionAfter int       `gorm:"not null" json:"question_after"` // показывать после вопроса N
	AdAssetID     uint      `gorm:"not null;index" json:"ad_asset_id"`
	IsActive      bool      `gorm:"not null;default:true" json:"is_active"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`

	// Связанные сущности
	AdAsset *AdAsset `gorm:"foreignKey:AdAssetID" json:"ad_asset,omitempty"`
}

// TableName возвращает имя таблицы
func (QuizAdSlot) TableName() string {
	return "quiz_ad_slots"
}
