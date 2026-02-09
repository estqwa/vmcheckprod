package handler

import (
	"encoding/csv"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/xuri/excelize/v2"
	"github.com/yourusername/trivia-api/internal/domain/entity"
	"github.com/yourusername/trivia-api/internal/domain/repository"
	"github.com/yourusername/trivia-api/internal/handler/dto"
	apperrors "github.com/yourusername/trivia-api/internal/pkg/errors"
	"github.com/yourusername/trivia-api/internal/service"
)

// QuizHandler обрабатывает запросы, связанные с викторинами
type QuizHandler struct {
	quizService   *service.QuizService
	resultService *service.ResultService
	quizManager   *service.QuizManager
}

// NewQuizHandler создает новый обработчик викторин
func NewQuizHandler(
	quizService *service.QuizService,
	resultService *service.ResultService,
	quizManager *service.QuizManager,
) *QuizHandler {
	return &QuizHandler{
		quizService:   quizService,
		resultService: resultService,
		quizManager:   quizManager,
	}
}

// CreateQuizRequest представляет запрос на создание викторины
type CreateQuizRequest struct {
	Title         string    `json:"title" binding:"required,min=3,max=100"`
	Description   string    `json:"description" binding:"omitempty,max=500"`
	ScheduledTime time.Time `json:"scheduled_time" binding:"required"`
	PrizeFund     int       `json:"prize_fund"` // Опционально, 0 = дефолт
}

// CreateQuiz обрабатывает запрос на создание викторины
func (h *QuizHandler) CreateQuiz(c *gin.Context) {
	var req CreateQuizRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	quiz, err := h.quizService.CreateQuiz(req.Title, req.Description, req.ScheduledTime, req.PrizeFund)
	if err != nil {
		h.handleQuizError(c, err)
		return
	}

	// Auto-планирование викторины
	if err := h.quizManager.ScheduleQuiz(quiz.ID, req.ScheduledTime); err != nil {
		log.Printf("[CreateQuiz] Schedule failed for quiz #%d: %v", quiz.ID, err)
		c.Header("X-Quiz-Schedule-Warning", err.Error())
	}

	c.JSON(http.StatusCreated, dto.NewQuizResponse(quiz, false))
}

// GetQuiz возвращает информацию о викторине
func (h *QuizHandler) GetQuiz(c *gin.Context) {
	quizID := c.MustGet("quizID").(uint) // Получаем из контекста

	quiz, err := h.quizService.GetQuizByID(quizID)
	if err != nil {
		h.handleQuizError(c, err)
		return
	}

	c.JSON(http.StatusOK, dto.NewQuizResponse(quiz, false))
}

// GetActiveQuiz возвращает информацию об активной викторине
func (h *QuizHandler) GetActiveQuiz(c *gin.Context) {
	// Проверяем сначала в QuizManager
	activeQuiz := h.quizManager.GetActiveQuiz()
	if activeQuiz != nil {
		c.JSON(http.StatusOK, dto.NewQuizResponse(activeQuiz, false))
		return
	}

	// Если не найдена активная викторина у менеджера, ищем в БД
	quiz, err := h.quizService.GetActiveQuiz()
	if err != nil {
		h.handleQuizError(c, err)
		return
	}

	c.JSON(http.StatusOK, dto.NewQuizResponse(quiz, false))
}

// GetScheduledQuizzes возвращает список запланированных викторин
func (h *QuizHandler) GetScheduledQuizzes(c *gin.Context) {
	quizzes, err := h.quizService.GetScheduledQuizzes()
	if err != nil {
		log.Printf("[QuizHandler] Ошибка при получении запланированных викторин: %v", err)
		h.handleQuizError(c, err)
		return
	}

	c.JSON(http.StatusOK, dto.NewListQuizResponse(quizzes))
}

// AddQuestionsRequest представляет запрос на добавление вопросов
type AddQuestionsRequest struct {
	Questions []struct {
		Text          string   `json:"text" binding:"required,min=3,max=500"`
		TextKK        string   `json:"text_kk,omitempty"` // Казахский текст (опционально)
		Options       []string `json:"options" binding:"required,min=2,max=5"`
		OptionsKK     []string `json:"options_kk,omitempty"` // Казахские варианты (опционально)
		CorrectOption int      `json:"correct_option" binding:"required,min=0"`
		TimeLimitSec  int      `json:"time_limit_sec" binding:"required,min=5,max=60"`
		PointValue    int      `json:"point_value" binding:"required,min=1,max=100"`
	} `json:"questions" binding:"required,min=1"`
}

// AddQuestions обрабатывает запрос на добавление вопросов к викторине
func (h *QuizHandler) AddQuestions(c *gin.Context) {
	quizID := c.MustGet("quizID").(uint) // Получаем из контекста

	var req AddQuestionsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Преобразуем данные в формат для сервиса
	questions := make([]entity.Question, 0, len(req.Questions))
	for _, q := range req.Questions {
		if q.CorrectOption < 0 || q.CorrectOption >= len(q.Options) {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("invalid correct_option index %d for question '%s'", q.CorrectOption, q.Text)})
			return
		}
		questions = append(questions, entity.Question{
			Text:          q.Text,
			TextKK:        q.TextKK,
			Options:       entity.StringArray(q.Options),
			OptionsKK:     entity.StringArray(q.OptionsKK),
			CorrectOption: q.CorrectOption,
			TimeLimitSec:  q.TimeLimitSec,
			PointValue:    q.PointValue,
		})
	}

	if err := h.quizService.AddQuestions(quizID, questions); err != nil {
		h.handleQuizError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Questions added successfully"})
}

// ScheduleQuizRequest представляет запрос на планирование викторины
type ScheduleQuizRequest struct {
	ScheduledTime time.Time `json:"scheduled_time" binding:"required"`
}

// ScheduleQuiz обрабатывает запрос на планирование времени викторины
func (h *QuizHandler) ScheduleQuiz(c *gin.Context) {
	quizID := c.MustGet("quizID").(uint) // Получаем из контекста

	var req ScheduleQuizRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Сначала обновляем время в базе данных
	if err := h.quizService.ScheduleQuiz(quizID, req.ScheduledTime); err != nil {
		h.handleQuizError(c, err)
		return
	}

	// Затем планируем викторину через QuizManager
	if err := h.quizManager.ScheduleQuiz(quizID, req.ScheduledTime); err != nil {
		h.handleQuizError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Quiz scheduled successfully"})
}

// CancelQuiz обрабатывает запрос на отмену викторины
func (h *QuizHandler) CancelQuiz(c *gin.Context) {
	quizID := c.MustGet("quizID").(uint) // Получаем из контекста

	if err := h.quizManager.CancelQuiz(quizID); err != nil {
		h.handleQuizError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Quiz cancelled successfully"})
}

// GetQuizWithQuestions возвращает викторину вместе с вопросами
func (h *QuizHandler) GetQuizWithQuestions(c *gin.Context) {
	quizID := c.MustGet("quizID").(uint) // Получаем из контекста

	quiz, err := h.quizService.GetQuizWithQuestions(quizID)
	if err != nil {
		h.handleQuizError(c, err)
		return
	}

	response := dto.NewQuizResponse(quiz, true)

	c.JSON(http.StatusOK, response)
}

// GetQuizResults возвращает пагинированные результаты викторины
func (h *QuizHandler) GetQuizResults(c *gin.Context) {
	quizID := c.MustGet("quizID").(uint) // Получаем из контекста

	// Получаем параметры пагинации из query
	pageStr := c.DefaultQuery("page", "1")
	pageSizeStr := c.DefaultQuery("page_size", "10")

	page, err := strconv.Atoi(pageStr)
	if err != nil || page < 1 {
		page = 1
	}

	pageSize, err := strconv.Atoi(pageSizeStr)
	if err != nil || pageSize < 1 || pageSize > 100 {
		pageSize = 10 // Можно взять из конфига
	}

	// Вызываем сервис с пагинацией
	results, total, err := h.resultService.GetQuizResults(quizID, page, pageSize)
	if err != nil {
		h.handleQuizError(c, err) // Используем стандартизированный обработчик
		return
	}

	// Возвращаем пагинированный DTO
	c.JSON(http.StatusOK, dto.NewPaginatedResultResponse(results, total, page, pageSize))
}

// GetUserQuizResult возвращает результат пользователя для конкретной викторины
func (h *QuizHandler) GetUserQuizResult(c *gin.Context) {
	quizID := c.MustGet("quizID").(uint) // Получаем из контекста

	// Получаем ID пользователя из контекста
	userIDRaw, exists := c.Get("user_id")
	if !exists {
		h.handleQuizError(c, apperrors.ErrUnauthorized)
		return
	}
	userID, ok := userIDRaw.(uint)
	if !ok {
		h.handleQuizError(c, errors.New("invalid user ID in context"))
		return
	}

	result, err := h.resultService.GetUserResult(userID, quizID)
	if err != nil {
		h.handleQuizError(c, err)
		return
	}

	c.JSON(http.StatusOK, dto.NewResultResponse(result))
}

// GetQuizWinners возвращает список всех победителей викторины (без пагинации)
func (h *QuizHandler) GetQuizWinners(c *gin.Context) {
	quizID := c.MustGet("quizID").(uint)

	winners, err := h.resultService.GetQuizWinners(quizID)
	if err != nil {
		h.handleQuizError(c, err)
		return
	}

	// Конвертируем в DTO
	response := make([]dto.ResultResponse, len(winners))
	for i, w := range winners {
		response[i] = *dto.NewResultResponse(&w)
	}

	c.JSON(http.StatusOK, gin.H{
		"winners": response,
		"total":   len(winners),
	})
}

// ListQuizzes возвращает список викторин с пагинацией и фильтрацией
func (h *QuizHandler) ListQuizzes(c *gin.Context) {
	pageStr := c.DefaultQuery("page", "1")
	pageSizeStr := c.DefaultQuery("page_size", "10")

	page, err := strconv.Atoi(pageStr)
	if err != nil || page < 1 {
		page = 1
	}

	pageSize, err := strconv.Atoi(pageSizeStr)
	if err != nil || pageSize < 1 || pageSize > 100 {
		pageSize = 10
	}

	// Собираем фильтры из query-параметров
	filters := repository.QuizFilters{
		Status: c.Query("status"), // scheduled, in_progress, completed, cancelled
		Search: c.Query("search"), // Поиск по title/description
	}

	// Парсим даты если переданы
	if dateFromStr := c.Query("date_from"); dateFromStr != "" {
		if dateFrom, err := time.Parse(time.RFC3339, dateFromStr); err == nil {
			filters.DateFrom = &dateFrom
		}
	}
	if dateToStr := c.Query("date_to"); dateToStr != "" {
		if dateTo, err := time.Parse(time.RFC3339, dateToStr); err == nil {
			filters.DateTo = &dateTo
		}
	}

	// Проверяем, есть ли какие-либо фильтры
	hasFilters := filters.Status != "" || filters.Search != "" || filters.DateFrom != nil || filters.DateTo != nil

	if hasFilters {
		// Используем метод с фильтрами
		quizzes, total, err := h.quizService.ListQuizzesWithFilters(page, pageSize, filters)
		if err != nil {
			h.handleQuizError(c, err)
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"quizzes": dto.NewListQuizResponse(quizzes),
			"total":   total,
			"page":    page,
			"size":    pageSize,
		})
	} else {
		// Используем обычный метод без фильтров
		quizzes, err := h.quizService.ListQuizzes(page, pageSize)
		if err != nil {
			h.handleQuizError(c, err)
			return
		}

		c.JSON(http.StatusOK, dto.NewListQuizResponse(quizzes))
	}
}

// DuplicateQuizRequest представляет запрос на дублирование викторины
type DuplicateQuizRequest struct {
	ScheduledTime time.Time `json:"scheduled_time" binding:"required"`
}

// DuplicateQuiz обрабатывает запрос на дублирование существующей викторины.
func (h *QuizHandler) DuplicateQuiz(c *gin.Context) {
	quizID := c.MustGet("quizID").(uint) // Получаем ID оригинальной викторины из контекста

	var req DuplicateQuizRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Неверный формат запроса: %v", err)})
		return
	}

	// Вызываем сервис для дублирования
	newQuiz, err := h.quizService.DuplicateQuiz(quizID, req.ScheduledTime)
	if err != nil {
		// Используем стандартизированный обработчик ошибок
		h.handleQuizError(c, err)
		return
	}

	// !!! ВАЖНО: После успешного создания дубликата, его нужно запланировать в QuizManager !!!
	if err := h.quizManager.ScheduleQuiz(newQuiz.ID, newQuiz.ScheduledTime); err != nil {
		// Логируем ошибку планирования, но не отменяем создание
		// Викторина создана в БД, но может не запуститься автоматически без перезапуска
		log.Printf("[QuizHandler] ВНИМАНИЕ: Не удалось автоматически запланировать дубликат викторины #%d: %v", newQuiz.ID, err)
		// Можно опционально вернуть предупреждение клиенту, но основной результат - создание
		// h.handleQuizError(c, err) // Не возвращаем ошибку клиенту, т.к. викторина создана
	}

	// Отправляем ответ с данными новой викторины
	// Указываем false, чтобы не включать вопросы в ответ (они только что созданы)
	c.JSON(http.StatusCreated, dto.NewQuizResponse(newQuiz, false))
}

// ExportQuizResults экспортирует результаты викторины в CSV или Excel формате
// GET /api/quizzes/:id/results/export?format=csv|xlsx
func (h *QuizHandler) ExportQuizResults(c *gin.Context) {
	quizID := c.MustGet("quizID").(uint)
	format := c.DefaultQuery("format", "csv")

	// Получаем ВСЕ результаты без пагинации для экспорта
	results, err := h.resultService.GetQuizResultsAll(quizID)
	if err != nil {
		h.handleQuizError(c, err)
		return
	}

	// Получаем информацию о викторине для имени файла
	quiz, err := h.quizService.GetQuizByID(quizID)
	if err != nil {
		h.handleQuizError(c, err)
		return
	}

	filename := fmt.Sprintf("quiz_%d_results_%s", quizID, time.Now().Format("2006-01-02"))

	switch format {
	case "xlsx":
		h.exportXLSX(c, results, quiz, filename)
	default:
		h.exportCSV(c, results, quiz, filename)
	}
}

// exportCSV экспортирует результаты в CSV с правильным экранированием спецсимволов
func (h *QuizHandler) exportCSV(c *gin.Context, results []entity.Result, quiz *entity.Quiz, filename string) {
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s.csv\"", filename))

	// BOM для корректного отображения UTF-8 в Excel
	c.Writer.Write([]byte{0xEF, 0xBB, 0xBF})

	// Используем encoding/csv для правильного экранирования запятых/кавычек
	writer := csv.NewWriter(c.Writer)
	defer writer.Flush()

	// Заголовки
	writer.Write([]string{"Место", "Пользователь", "Очки", "Правильных", "Всего вопросов", "Победитель", "Выбыл", "Вопрос выбытия", "Причина выбытия", "Приз"})

	// Данные
	for _, r := range results {
		winner := "Нет"
		if r.IsWinner {
			winner = "Да"
		}
		eliminated := "Нет"
		if r.IsEliminated {
			eliminated = "Да"
		}
		elimQuestion := ""
		if r.EliminatedOnQuestion != nil {
			elimQuestion = strconv.Itoa(*r.EliminatedOnQuestion)
		}
		elimReason := ""
		if r.EliminationReason != nil {
			elimReason = translateEliminationReason(*r.EliminationReason)
		}
		prize := ""
		if r.PrizeFund > 0 {
			prize = fmt.Sprintf("%d ₸", r.PrizeFund)
		}

		writer.Write([]string{
			strconv.Itoa(r.Rank),
			sanitizeForExcel(r.Username),
			strconv.Itoa(r.Score),
			strconv.Itoa(r.CorrectAnswers),
			strconv.Itoa(r.TotalQuestions),
			winner,
			eliminated,
			elimQuestion,
			elimReason,
			prize,
		})
	}
}

// exportXLSX экспортирует результаты в Excel с использованием StreamWriter
func (h *QuizHandler) exportXLSX(c *gin.Context, results []entity.Result, quiz *entity.Quiz, filename string) {
	// Импорт excelize будет добавлен в начало файла
	// Используем StreamWriter для эффективной работы с большими файлами

	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s.xlsx\"", filename))

	f := excelize.NewFile()
	defer f.Close()

	sheetName := "Результаты"
	f.SetSheetName("Sheet1", sheetName)

	sw, err := f.NewStreamWriter(sheetName)
	if err != nil {
		log.Printf("[QuizHandler] Ошибка создания StreamWriter: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create Excel file"})
		return
	}

	// Заголовки
	headers := []interface{}{"Место", "Пользователь", "Очки", "Правильных", "Всего вопросов", "Победитель", "Выбыл", "Вопрос выбытия", "Причина выбытия", "Приз (₸)"}
	if err := sw.SetRow("A1", headers); err != nil {
		log.Printf("[QuizHandler] Ошибка записи заголовков: %v", err)
	}

	// Данные
	for i, r := range results {
		rowNum := i + 2 // Начинаем с 2 строки (1 - заголовки)
		cell := fmt.Sprintf("A%d", rowNum)

		winner := "Нет"
		if r.IsWinner {
			winner = "Да"
		}
		eliminated := "Нет"
		if r.IsEliminated {
			eliminated = "Да"
		}
		elimQuestion := ""
		if r.EliminatedOnQuestion != nil {
			elimQuestion = strconv.Itoa(*r.EliminatedOnQuestion)
		}
		elimReason := ""
		if r.EliminationReason != nil {
			elimReason = translateEliminationReason(*r.EliminationReason)
		}
		prize := 0
		if r.PrizeFund > 0 {
			prize = r.PrizeFund
		}

		row := []interface{}{r.Rank, sanitizeForExcel(r.Username), r.Score, r.CorrectAnswers, r.TotalQuestions, winner, eliminated, elimQuestion, elimReason, prize}
		if err := sw.SetRow(cell, row); err != nil {
			log.Printf("[QuizHandler] Ошибка записи строки %d: %v", rowNum, err)
		}
	}

	if err := sw.Flush(); err != nil {
		log.Printf("[QuizHandler] Ошибка при Flush: %v", err)
	}

	// Записываем в response
	if err := f.Write(c.Writer); err != nil {
		log.Printf("[QuizHandler] Ошибка записи Excel в response: %v", err)
	}
}

// sanitizeForExcel экранирует данные для защиты от formula injection в Excel/CSV
func sanitizeForExcel(s string) string {
	if len(s) == 0 {
		return s
	}
	// Символы, начинающие формулу в Excel/LibreOffice: = + - @ \t \r
	if s[0] == '=' || s[0] == '+' || s[0] == '-' || s[0] == '@' || s[0] == '\t' || s[0] == '\r' {
		return "'" + s
	}
	return s
}

// translateEliminationReason переводит причину выбытия на русский
func translateEliminationReason(reason string) string {
	switch reason {
	case "time_exceeded", "no_answer_timeout":
		return "Время истекло"
	case "incorrect_answer":
		return "Неверный ответ"
	case "disconnected":
		return "Отключился"
	default:
		return reason
	}
}

// GetQuizStatistics возвращает расширенную статистику викторины
func (h *QuizHandler) GetQuizStatistics(c *gin.Context) {
	quizID := c.MustGet("quizID").(uint)

	stats, err := h.resultService.CalculateQuizStatistics(quizID)
	if err != nil {
		h.handleQuizError(c, err)
		return
	}

	c.JSON(http.StatusOK, stats)
}

// BulkUploadQuestionPoolRequest представляет запрос на массовую загрузку вопросов
type BulkUploadQuestionPoolRequest struct {
	Questions []struct {
		Text          string   `json:"text" binding:"required,min=3,max=500"`
		TextKK        string   `json:"text_kk,omitempty"`
		Options       []string `json:"options" binding:"required,min=2,max=5"`
		OptionsKK     []string `json:"options_kk,omitempty"`
		CorrectOption int      `json:"correct_option" binding:"required,min=0"`
		Difficulty    int      `json:"difficulty" binding:"required,min=1,max=5"` // ОБЯЗАТЕЛЬНОЕ поле
		TimeLimitSec  int      `json:"time_limit_sec,omitempty"`                  // По умолчанию 20 сек
		PointValue    int      `json:"point_value,omitempty"`                     // По умолчанию 10
	} `json:"questions" binding:"required,min=1"`
}

// BulkUploadQuestionPool загружает вопросы в пул для адаптивной системы
// POST /api/admin/question-pool
func (h *QuizHandler) BulkUploadQuestionPool(c *gin.Context) {
	var req BulkUploadQuestionPoolRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Преобразуем данные в формат entity.Question
	questions := make([]entity.Question, 0, len(req.Questions))
	for i, q := range req.Questions {
		if q.CorrectOption < 0 || q.CorrectOption >= len(q.Options) {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": fmt.Sprintf("invalid correct_option index %d for question #%d", q.CorrectOption, i+1),
			})
			return
		}

		// Дефолтные значения
		timeLimitSec := q.TimeLimitSec
		if timeLimitSec == 0 {
			timeLimitSec = 10 // 10 секунд по умолчанию
		}
		pointValue := q.PointValue
		if pointValue == 0 {
			pointValue = 1 // 1 очко по умолчанию
		}

		questions = append(questions, entity.Question{
			QuizID:        nil, // Вопросы в пуле не привязаны к викторине
			Text:          q.Text,
			TextKK:        q.TextKK,
			Options:       entity.StringArray(q.Options),
			OptionsKK:     entity.StringArray(q.OptionsKK),
			CorrectOption: q.CorrectOption,
			Difficulty:    q.Difficulty,
			IsUsed:        false, // Новые вопросы не использованы
			TimeLimitSec:  timeLimitSec,
			PointValue:    pointValue,
		})
	}

	// Сохраняем через сервис
	if err := h.quizService.BulkUploadQuestionPool(questions); err != nil {
		h.handleQuizError(c, err)
		return
	}

	// Подсчитываем вопросы по сложности для ответа
	difficultyCount := make(map[int]int)
	for _, q := range questions {
		difficultyCount[q.Difficulty]++
	}

	c.JSON(http.StatusOK, gin.H{
		"message":       "Questions uploaded successfully",
		"total":         len(questions),
		"by_difficulty": difficultyCount,
	})
}

// GetPoolStats возвращает статистику пула вопросов
// GET /api/admin/question-pool/stats
func (h *QuizHandler) GetPoolStats(c *gin.Context) {
	totalCount, availableCount, byDifficulty, err := h.quizService.GetPoolStats()
	if err != nil {
		log.Printf("[QuizHandler] Error getting pool stats: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get pool stats"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"total":         totalCount,
		"used":          totalCount - availableCount,
		"available":     availableCount,
		"by_difficulty": byDifficulty,
	})
}

// ResetPoolUsed сбрасывает флаг is_used для всех вопросов пула
// POST /api/admin/question-pool/reset
func (h *QuizHandler) ResetPoolUsed(c *gin.Context) {
	resetCount, err := h.quizService.ResetPoolUsed()
	if err != nil {
		log.Printf("[QuizHandler] Error resetting pool: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reset pool"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Pool questions reset successfully",
		"count":   resetCount,
	})
}

// handleQuizError обрабатывает ошибки от сервисов викторин и отправляет соответствующий HTTP ответ
func (h *QuizHandler) handleQuizError(c *gin.Context, err error) {
	if errors.Is(err, apperrors.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
	} else if errors.Is(err, apperrors.ErrConflict) {
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
	} else if errors.Is(err, apperrors.ErrValidation) {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": err.Error()})
	} else if errors.Is(err, apperrors.ErrUnauthorized) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
	} else if errors.Is(err, apperrors.ErrForbidden) {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
	} else {
		log.Printf("ERROR: Internal server error in QuizHandler: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
	}
}
