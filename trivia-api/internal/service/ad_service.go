package service

import (
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/yourusername/trivia-api/internal/domain/entity"
	"github.com/yourusername/trivia-api/internal/domain/repository"
)

// AdService предоставляет методы для работы с рекламными ресурсами
type AdService struct {
	adAssetRepo repository.AdAssetRepository
	uploadDir   string // директория для загрузки файлов
}

// NewAdService создаёт новый сервис рекламы
func NewAdService(adAssetRepo repository.AdAssetRepository, uploadDir string) *AdService {
	// Создаём директорию для загрузки, если не существует
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		log.Printf("[AdService] WARNING: не удалось создать директорию %s: %v", uploadDir, err)
	}
	return &AdService{
		adAssetRepo: adAssetRepo,
		uploadDir:   uploadDir,
	}
}

// CreateAdAssetRequest DTO для создания рекламного ресурса
type CreateAdAssetRequest struct {
	Title       string `json:"title" binding:"required,min=1,max=100"`
	MediaType   string `json:"media_type" binding:"required,oneof=image video"`
	DurationSec int    `json:"duration_sec" binding:"required,min=3,max=30"`
}

// UploadAdAsset загружает файл и создаёт рекламный ресурс
func (s *AdService) UploadAdAsset(file *multipart.FileHeader, title string, mediaType string, durationSec int) (*entity.AdAsset, error) {
	// Валидация типа файла
	ext := strings.ToLower(filepath.Ext(file.Filename))
	allowedExts := map[string]string{
		".jpg":  "image",
		".jpeg": "image",
		".png":  "image",
		".webp": "image",
		".gif":  "image",
		".mp4":  "video",
		".webm": "video",
	}

	expectedType, ok := allowedExts[ext]
	if !ok {
		return nil, fmt.Errorf("недопустимый формат файла: %s", ext)
	}
	if expectedType != mediaType {
		return nil, fmt.Errorf("тип файла %s не соответствует указанному типу %s", ext, mediaType)
	}

	// Генерируем уникальное имя файла
	timestamp := time.Now().UnixNano()
	filename := fmt.Sprintf("ad_%d%s", timestamp, ext)
	filePath := filepath.Join(s.uploadDir, filename)

	// Открываем исходный файл
	src, err := file.Open()
	if err != nil {
		return nil, fmt.Errorf("не удалось открыть загруженный файл: %w", err)
	}
	defer src.Close()

	// Создаём целевой файл
	dst, err := os.Create(filePath)
	if err != nil {
		return nil, fmt.Errorf("не удалось создать файл: %w", err)
	}
	defer dst.Close()

	// Копируем содержимое
	if _, err := io.Copy(dst, src); err != nil {
		os.Remove(filePath) // Удаляем частично записанный файл
		return nil, fmt.Errorf("не удалось сохранить файл: %w", err)
	}

	// Формируем URL (относительный путь для сервера)
	url := "/uploads/ads/" + filename

	// Создаём запись в БД
	asset := &entity.AdAsset{
		Title:         title,
		MediaType:     mediaType,
		URL:           url,
		DurationSec:   durationSec,
		FileSizeBytes: file.Size,
	}

	if err := s.adAssetRepo.Create(asset); err != nil {
		os.Remove(filePath) // Откатываем загрузку
		return nil, fmt.Errorf("не удалось сохранить в БД: %w", err)
	}

	log.Printf("[AdService] Создан рекламный ресурс #%d: %s (%s, %d сек)", asset.ID, title, mediaType, durationSec)
	return asset, nil
}

// ListAdAssets возвращает все рекламные ресурсы
func (s *AdService) ListAdAssets() ([]entity.AdAsset, error) {
	return s.adAssetRepo.List()
}

// GetAdAsset возвращает рекламный ресурс по ID
func (s *AdService) GetAdAsset(id uint) (*entity.AdAsset, error) {
	return s.adAssetRepo.GetByID(id)
}

// DeleteAdAsset удаляет рекламный ресурс
func (s *AdService) DeleteAdAsset(id uint) error {
	// Проверяем, используется ли ресурс в слотах
	isUsed, err := s.adAssetRepo.IsUsedInSlots(id)
	if err != nil {
		return fmt.Errorf("не удалось проверить использование: %w", err)
	}
	if isUsed {
		return fmt.Errorf("ресурс используется в рекламных слотах и не может быть удалён")
	}

	// Получаем ресурс для удаления файла
	asset, err := s.adAssetRepo.GetByID(id)
	if err != nil {
		return fmt.Errorf("ресурс не найден: %w", err)
	}

	// Удаляем из БД
	if err := s.adAssetRepo.Delete(id); err != nil {
		return fmt.Errorf("не удалось удалить из БД: %w", err)
	}

	// Удаляем файл (игнорируем ошибку, если файла нет)
	filename := filepath.Base(asset.URL)
	filePath := filepath.Join(s.uploadDir, filename)
	if err := os.Remove(filePath); err != nil && !os.IsNotExist(err) {
		log.Printf("[AdService] WARNING: не удалось удалить файл %s: %v", filePath, err)
	}

	log.Printf("[AdService] Удалён рекламный ресурс #%d", id)
	return nil
}
