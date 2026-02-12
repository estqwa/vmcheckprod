package entity

import "time"

// QuizQuestionHistory хранит факт заданного вопроса в конкретной викторине.
// Это журнал проведения, а не справочник вопросов.
type QuizQuestionHistory struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	QuizID        uint      `gorm:"not null;index:idx_quiz_question_history_quiz_order,priority:1;index" json:"quiz_id"`
	QuestionID    uint      `gorm:"not null;index" json:"question_id"`
	QuestionOrder int       `gorm:"not null;index:idx_quiz_question_history_quiz_order,priority:2;unique" json:"question_order"`
	AskedAt       time.Time `gorm:"not null;default:CURRENT_TIMESTAMP" json:"asked_at"`
}

// TableName задает имя таблицы для GORM.
func (QuizQuestionHistory) TableName() string {
	return "quiz_question_history"
}
