package entity

import "time"

// AdAsset представляет рекламный медиа-файл
type AdAsset struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	Title         string    `gorm:"size:100;not null" json:"title"`
	MediaType     string    `gorm:"size:16;not null" json:"media_type"` // "image" | "video"
	URL           string    `gorm:"size:1024;not null" json:"url"`
	ThumbnailURL  string    `gorm:"size:1024" json:"thumbnail_url,omitempty"`
	DurationSec   int       `gorm:"not null;default:10" json:"duration_sec"`
	FileSizeBytes int64     `json:"file_size_bytes,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// TableName возвращает имя таблицы
func (AdAsset) TableName() string {
	return "ad_assets"
}

// IsVideo проверяет, является ли реклама видео
func (a *AdAsset) IsVideo() bool {
	return a.MediaType == "video"
}

// IsImage проверяет, является ли реклама изображением
func (a *AdAsset) IsImage() bool {
	return a.MediaType == "image"
}
