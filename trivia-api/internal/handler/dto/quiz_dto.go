package dto

import (
	"time"

	"github.com/yourusername/trivia-api/internal/domain/entity" // Используем правильный путь модуля
	"github.com/yourusername/trivia-api/internal/handler/helper"
)

// QuestionResponse представляет вопрос в формате для ответа клиенту
type QuestionResponse struct {
	ID           uint                    `json:"id"`
	QuizID       uint                    `json:"quiz_id"`
	Text         string                  `json:"text"`
	Options      []helper.QuestionOption `json:"options"`
	TimeLimitSec int                     `json:"time_limit_sec"`
	PointValue   int                     `json:"point_value"`
	CreatedAt    time.Time               `json:"created_at"`
	UpdatedAt    time.Time               `json:"updated_at"`
}

// QuizResponse представляет викторину в формате для ответа клиенту
type QuizResponse struct {
	ID                  uint               `json:"id"`
	Title               string             `json:"title"`
	Description         string             `json:"description,omitempty"`
	ScheduledTime       time.Time          `json:"scheduled_time"`
	Status              string             `json:"status"`
	QuestionCount       int                `json:"question_count"`
	PrizeFund           int                `json:"prize_fund"`
	FinishOnZeroPlayers bool               `json:"finish_on_zero_players"`
	QuestionSourceMode  string             `json:"question_source_mode"`
	Questions           []QuestionResponse `json:"questions,omitempty"` // Слайс DTO вопросов
	CreatedAt           time.Time          `json:"created_at"`
	UpdatedAt           time.Time          `json:"updated_at"`
}

// AskedQuestionDetailsResponse содержит детали фактически заданного вопроса.
// Используется в admin-деталях викторины.
type AskedQuestionDetailsResponse struct {
	ID            uint                    `json:"id"`
	QuizID        *uint                   `json:"quiz_id,omitempty"`
	Text          string                  `json:"text"`
	TextKK        string                  `json:"text_kk,omitempty"`
	Options       []helper.QuestionOption `json:"options"`
	OptionsKK     []helper.QuestionOption `json:"options_kk,omitempty"`
	CorrectOption int                     `json:"correct_option"`
	TimeLimitSec  int                     `json:"time_limit_sec"`
	PointValue    int                     `json:"point_value"`
	Difficulty    int                     `json:"difficulty"`
}

// AskedQuizQuestionResponse содержит запись истории заданного вопроса.
type AskedQuizQuestionResponse struct {
	QuestionOrder int                          `json:"question_order"`
	AskedAt       time.Time                    `json:"asked_at"`
	Source        string                       `json:"source"`
	Question      AskedQuestionDetailsResponse `json:"question"`
}

// ResultResponse представляет результат викторины в формате для ответа клиенту
type ResultResponse struct {
	ID                   uint      `json:"id"`
	UserID               uint      `json:"user_id"`
	QuizID               uint      `json:"quiz_id"`
	Username             string    `json:"username"`
	ProfilePicture       string    `json:"profile_picture,omitempty"`
	Score                int       `json:"score"`
	CorrectAnswers       int       `json:"correct_answers"`
	TotalQuestions       int       `json:"total_questions"`
	Rank                 int       `json:"rank"`
	IsWinner             bool      `json:"is_winner"`
	PrizeFund            int       `json:"prize_fund"`
	IsEliminated         bool      `json:"is_eliminated"`
	EliminatedOnQuestion *int      `json:"eliminated_on_question,omitempty"`
	EliminationReason    *string   `json:"elimination_reason,omitempty"`
	CompletedAt          time.Time `json:"completed_at"`
}

// PaginatedResultResponse представляет пагинированный список результатов
type PaginatedResultResponse struct {
	Results []*ResultResponse `json:"results"`
	Total   int64             `json:"total"`
	Page    int               `json:"page"`
	PerPage int               `json:"per_page"`
}

// NewQuestionResponse создает DTO для вопроса
// Примечание: Эта функция используется внутри NewQuizResponse
func NewQuestionResponse(q *entity.Question) QuestionResponse {
	// Используем хелпер для преобразования опций
	optionsDTO := helper.ConvertOptionsToObjects(q.Options)

	// Логика скрытия CorrectOption остается в вызывающем коде (хэндлере).
	resp := QuestionResponse{
		ID:           q.ID,
		Text:         q.Text,
		Options:      optionsDTO, // Используем результат хелпера
		TimeLimitSec: q.TimeLimitSec,
		PointValue:   q.PointValue,
		CreatedAt:    q.CreatedAt,
		UpdatedAt:    q.UpdatedAt,
	}
	// QuizID может быть nil для вопросов пула
	if q.QuizID != nil {
		resp.QuizID = *q.QuizID
	}
	return resp
}

// NewAskedQuizQuestionResponse создает DTO для фактически заданного вопроса.
func NewAskedQuizQuestionResponse(order int, askedAt time.Time, source string, q *entity.Question) AskedQuizQuestionResponse {
	details := AskedQuestionDetailsResponse{
		ID:            q.ID,
		Text:          q.Text,
		TextKK:        q.TextKK,
		Options:       helper.ConvertOptionsToObjects(q.Options),
		OptionsKK:     helper.ConvertOptionsToObjects(q.OptionsKK),
		CorrectOption: q.CorrectOption,
		TimeLimitSec:  q.TimeLimitSec,
		PointValue:    q.PointValue,
		Difficulty:    q.Difficulty,
	}
	if q.QuizID != nil {
		details.QuizID = q.QuizID
	}

	return AskedQuizQuestionResponse{
		QuestionOrder: order,
		AskedAt:       askedAt,
		Source:        source,
		Question:      details,
	}
}

// NewQuizResponse создает DTO для викторины
func NewQuizResponse(quiz *entity.Quiz, includeQuestions bool) *QuizResponse {
	if quiz == nil {
		return nil
	}

	questionSourceMode := quiz.QuestionSourceMode
	if questionSourceMode == "" {
		questionSourceMode = entity.QuizQuestionSourceHybrid
	}

	var questionsDTO []QuestionResponse
	if includeQuestions {
		questionsDTO = make([]QuestionResponse, len(quiz.Questions))
		for i, q := range quiz.Questions {
			// Важно: передаем указатель на элемент слайса
			// Логика скрытия правильного ответа должна быть здесь или в хендлере
			questionCopy := q // Копируем, чтобы не изменять оригинал
			if !quiz.IsCompleted() {
				questionCopy.CorrectOption = -1 // Скрываем для не завершенных
			}
			questionsDTO[i] = NewQuestionResponse(&questionCopy)
		}
	}

	return &QuizResponse{
		ID:                  quiz.ID,
		Title:               quiz.Title,
		Description:         quiz.Description,
		ScheduledTime:       quiz.ScheduledTime,
		Status:              string(quiz.Status), // Преобразуем статус в строку
		QuestionCount:       quiz.QuestionCount,  // Добавляем поле
		PrizeFund:           quiz.PrizeFund,
		FinishOnZeroPlayers: quiz.FinishOnZeroPlayers,
		QuestionSourceMode:  questionSourceMode,
		Questions:           questionsDTO,
		CreatedAt:           quiz.CreatedAt,
		UpdatedAt:           quiz.UpdatedAt,
	}
}

// NewResultResponse создает DTO для результата
func NewResultResponse(result *entity.Result) *ResultResponse {
	if result == nil {
		return nil
	}
	return &ResultResponse{
		ID:                   result.ID,
		UserID:               result.UserID,
		QuizID:               result.QuizID,
		Username:             result.Username,
		ProfilePicture:       result.ProfilePicture,
		Score:                result.Score,
		CorrectAnswers:       result.CorrectAnswers,
		TotalQuestions:       result.TotalQuestions,
		Rank:                 result.Rank,
		IsWinner:             result.IsWinner,
		PrizeFund:            result.PrizeFund,
		IsEliminated:         result.IsEliminated,
		EliminatedOnQuestion: result.EliminatedOnQuestion,
		EliminationReason:    result.EliminationReason,
		CompletedAt:          result.CompletedAt,
	}
}

// NewListQuizResponse создает слайс DTO для списка викторин
func NewListQuizResponse(quizzes []entity.Quiz) []*QuizResponse {
	list := make([]*QuizResponse, len(quizzes))
	for i, quiz := range quizzes {
		// Передаем false, чтобы не включать вопросы в список
		list[i] = NewQuizResponse(&quiz, false)
	}
	return list
}

// NewListResultResponse создает слайс DTO для списка результатов
func NewListResultResponse(results []entity.Result) []*ResultResponse {
	list := make([]*ResultResponse, len(results))
	for i, result := range results {
		list[i] = NewResultResponse(&result)
	}
	return list
}

// NewPaginatedResultResponse создает DTO для пагинированного списка результатов
func NewPaginatedResultResponse(results []entity.Result, total int64, page, perPage int) *PaginatedResultResponse {
	return &PaginatedResultResponse{
		Results: NewListResultResponse(results),
		Total:   total,
		Page:    page,
		PerPage: perPage,
	}
}
