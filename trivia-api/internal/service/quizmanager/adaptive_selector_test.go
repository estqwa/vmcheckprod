package quizmanager

import (
	"testing"

	"github.com/stretchr/testify/assert"
	apperrors "github.com/yourusername/trivia-api/internal/pkg/errors"
)

// ============================================================================
// Тесты для AdaptiveQuestionSelector.getActualPassRate
// ============================================================================

// TestGetActualPassRate_NoPassedKey — ключ total есть, passed нет.
// Это ключевой сценарий из бага: пользователь ответил (total=1), но никто
// не прошёл → ключ passed никогда не создаётся в Redis.
// Должен вернуть 0.0 (0% прошли), а НЕ 1.0 (100%).
func TestGetActualPassRate_NoPassedKey(t *testing.T) {
	mockCache := new(MockCacheRepoForAnswerProcessor)

	// total существует (1 человек ответил)
	mockCache.On("Get", "quiz:34:q3:total").Return("1", nil)
	// passed НЕ существует (никто не прошёл) → Redis возвращает ErrNotFound
	mockCache.On("Get", "quiz:34:q3:passed").Return("", apperrors.ErrNotFound)

	selector := &AdaptiveQuestionSelector{
		config: DefaultDifficultyConfig(),
		deps:   &Dependencies{CacheRepo: mockCache},
	}

	result := selector.getActualPassRate(34, 3)

	// Должен быть 0.0 (0 passed / 1 total), а не 1.0!
	assert.Equal(t, 0.0, result, "Когда total=1 и passed не существует, pass rate должен быть 0.0")
	mockCache.AssertExpectations(t)
}

// TestGetActualPassRate_NoKeysAtAll — ни total, ни passed не существуют.
// Это сценарий, когда все игроки уже были выбывшими и RecordQuestionResult
// вообще не вызывался.
// Должен вернуть -1.0 (нет данных).
func TestGetActualPassRate_NoKeysAtAll(t *testing.T) {
	mockCache := new(MockCacheRepoForAnswerProcessor)

	// Ни один ключ не существует
	mockCache.On("Get", "quiz:34:q5:total").Return("", apperrors.ErrNotFound)
	// passed не будет запрашиваться, т.к. total не найден → ранний return

	selector := &AdaptiveQuestionSelector{
		config: DefaultDifficultyConfig(),
		deps:   &Dependencies{CacheRepo: mockCache},
	}

	result := selector.getActualPassRate(34, 5)

	assert.Equal(t, -1.0, result, "Когда ни один ключ не существует, должен вернуть -1.0 (нет данных)")
	mockCache.AssertExpectations(t)
}

// TestGetActualPassRate_BothKeysExist — total=5, passed=3 → 0.6
func TestGetActualPassRate_BothKeysExist(t *testing.T) {
	mockCache := new(MockCacheRepoForAnswerProcessor)

	mockCache.On("Get", "quiz:10:q2:total").Return("5", nil)
	mockCache.On("Get", "quiz:10:q2:passed").Return("3", nil)

	selector := &AdaptiveQuestionSelector{
		config: DefaultDifficultyConfig(),
		deps:   &Dependencies{CacheRepo: mockCache},
	}

	result := selector.getActualPassRate(10, 2)

	assert.Equal(t, 0.6, result, "5 total, 3 passed → 0.6")
	mockCache.AssertExpectations(t)
}

// TestGetActualPassRate_FirstQuestion — для questionNumber < 1 всегда 1.0
func TestGetActualPassRate_FirstQuestion(t *testing.T) {
	selector := &AdaptiveQuestionSelector{
		config: DefaultDifficultyConfig(),
		deps:   &Dependencies{},
	}

	result := selector.getActualPassRate(34, 0)
	assert.Equal(t, 1.0, result, "Для первого вопроса (questionNumber=0) всегда 1.0")
}

// ============================================================================
// Тесты для DifficultyConfig.CalculateAdjustedDifficulty
// ============================================================================

// TestCalculateAdjustedDifficulty_NoData — при passRate < 0 (нет данных)
// должен вернуть базовую сложность без коррекции.
func TestCalculateAdjustedDifficulty_NoData(t *testing.T) {
	config := DefaultDifficultyConfig()

	tests := []struct {
		name           string
		questionNumber int
		passRate       float64
		expected       int
	}{
		{
			name:           "Q2 нет данных → базовая сложность 1",
			questionNumber: 2,
			passRate:       -1.0,
			expected:       config.GetBaseDifficulty(2),
		},
		{
			name:           "Q4 нет данных → базовая сложность 2",
			questionNumber: 4,
			passRate:       -1.0,
			expected:       config.GetBaseDifficulty(4),
		},
		{
			name:           "Q7 нет данных → базовая сложность 3",
			questionNumber: 7,
			passRate:       -1.0,
			expected:       config.GetBaseDifficulty(7),
		},
		{
			name:           "Q10 нет данных → базовая сложность",
			questionNumber: 10,
			passRate:       -1.0,
			expected:       config.GetBaseDifficulty(10),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := config.CalculateAdjustedDifficulty(tt.questionNumber, tt.passRate)
			assert.Equal(t, tt.expected, result,
				"При passRate < 0 (нет данных) должна быть базовая сложность без коррекции")
		})
	}
}

// TestCalculateAdjustedDifficulty_HighPassRate — слишком много прошли → сложнее
func TestCalculateAdjustedDifficulty_HighPassRate(t *testing.T) {
	config := DefaultDifficultyConfig()
	baseDiff := config.GetBaseDifficulty(3)

	// pass rate = 1.0 (все прошли), target ~0.85 → deviation > threshold → +1
	result := config.CalculateAdjustedDifficulty(3, 1.0)
	assert.Equal(t, baseDiff+1, result,
		"Слишком высокий pass rate должен увеличить сложность на 1")
}

// TestCalculateAdjustedDifficulty_LowPassRate — слишком мало прошли → легче
func TestCalculateAdjustedDifficulty_LowPassRate(t *testing.T) {
	config := DefaultDifficultyConfig()
	baseDiff := config.GetBaseDifficulty(5)

	// pass rate = 0.0 (никто не прошёл), target ~0.6 → deviation < -threshold → -1
	result := config.CalculateAdjustedDifficulty(5, 0.0)
	expected := baseDiff - 1
	if expected < config.MinDifficulty {
		expected = config.MinDifficulty
	}
	assert.Equal(t, expected, result,
		"Слишком низкий pass rate должен уменьшить сложность на 1")
}
