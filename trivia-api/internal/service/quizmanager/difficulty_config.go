package quizmanager

// DifficultyConfig содержит настройки адаптивной системы сложности
type DifficultyConfig struct {
	// TargetPassRates — целевые pass rates для каждого вопроса (индекс 0 = вопрос 1)
	TargetPassRates []float64

	// BaseDifficultyMap — базовый уровень сложности для каждого вопроса
	BaseDifficultyMap []int

	// AdaptationThreshold — порог отклонения для адаптации (10% = 0.10)
	AdaptationThreshold float64

	// MinDifficulty — минимальный уровень сложности
	MinDifficulty int

	// MaxDifficulty — максимальный уровень сложности
	MaxDifficulty int

	// FallbackToHigher — при отсутствии вопросов искать более сложные (true) или более лёгкие (false)
	FallbackToHigher bool
}

// DefaultDifficultyConfig возвращает настройки по умолчанию для ~0.5% финалистов
func DefaultDifficultyConfig() *DifficultyConfig {
	return &DifficultyConfig{
		// Целевые pass rates: произведение ≈ 0.52%
		TargetPassRates: []float64{
			0.90, // Q1: 90% проходят
			0.85, // Q2: 85%
			0.78, // Q3: 78%
			0.70, // Q4: 70%
			0.62, // Q5: 62%
			0.55, // Q6: 55%
			0.48, // Q7: 48%
			0.42, // Q8: 42%
			0.36, // Q9: 36%
			0.50, // Q10: 50%
		},
		// Базовая сложность: 1=very_easy, 2=easy, 3=medium, 4=hard, 5=very_hard
		BaseDifficultyMap: []int{
			1, // Q1: Very Easy
			2, // Q2: Easy
			2, // Q3: Easy
			3, // Q4: Medium
			3, // Q5: Medium
			4, // Q6: Hard
			4, // Q7: Hard
			5, // Q8: Very Hard
			5, // Q9: Very Hard
			5, // Q10: Very Hard
		},
		AdaptationThreshold: 0.10,
		MinDifficulty:       1,
		MaxDifficulty:       5,
		FallbackToHigher:    true, // Если нет 4 → берём 5 (на рост)
	}
}

// GetTargetPassRate возвращает целевой pass rate для вопроса N (1-indexed)
func (c *DifficultyConfig) GetTargetPassRate(questionNumber int) float64 {
	idx := questionNumber - 1
	if idx < 0 || idx >= len(c.TargetPassRates) {
		return 0.50 // Дефолт для выходящих за пределы
	}
	return c.TargetPassRates[idx]
}

// GetBaseDifficulty возвращает базовый уровень сложности для вопроса N (1-indexed)
func (c *DifficultyConfig) GetBaseDifficulty(questionNumber int) int {
	idx := questionNumber - 1
	if idx < 0 || idx >= len(c.BaseDifficultyMap) {
		return 3 // Medium по умолчанию
	}
	return c.BaseDifficultyMap[idx]
}

// CalculateAdjustedDifficulty вычисляет скорректированную сложность на основе реального pass rate
// questionNumber — номер СЛЕДУЮЩЕГО вопроса (1-indexed)
// actualPassRate — реальный pass rate ПРЕДЫДУЩЕГО вопроса
func (c *DifficultyConfig) CalculateAdjustedDifficulty(questionNumber int, actualPassRate float64) int {
	baseDifficulty := c.GetBaseDifficulty(questionNumber)

	// Для первого вопроса нет предыдущего → используем базовый
	if questionNumber == 1 {
		return baseDifficulty
	}

	// Сравниваем с target предыдущего вопроса
	targetPassRate := c.GetTargetPassRate(questionNumber - 1)
	deviation := actualPassRate - targetPassRate

	adjustedDifficulty := baseDifficulty

	if deviation > c.AdaptationThreshold {
		// Слишком много прошло → следующий вопрос сложнее
		adjustedDifficulty = min(c.MaxDifficulty, baseDifficulty+1)
	} else if deviation < -c.AdaptationThreshold {
		// Слишком мало прошло → следующий вопрос легче
		adjustedDifficulty = max(c.MinDifficulty, baseDifficulty-1)
	}

	return adjustedDifficulty
}
