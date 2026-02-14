import { api } from './client';
import { Quiz, QuizWithQuestions, QuizResult, PaginatedResults, LeaderboardResponse, AskedQuizQuestion } from './types';

interface PaginationParams {
    page?: number;
    page_size?: number;
}

// ============ Public Endpoints ============

/**
 * Get list of quizzes with pagination
 */
export async function getQuizzes(params?: PaginationParams): Promise<Quiz[]> {
    const query: Record<string, string> = {};
    if (params?.page) query.page = params.page.toString();
    if (params?.page_size) query.page_size = params.page_size.toString();

    return api.get<Quiz[]>('/api/quizzes', { query });
}

/**
 * Get active quiz (currently running)
 */
export async function getActiveQuiz(): Promise<Quiz | null> {
    try {
        return await api.get<Quiz>('/api/quizzes/active');
    } catch {
        return null;
    }
}

/**
 * Get scheduled quizzes
 */
export async function getScheduledQuizzes(): Promise<Quiz[]> {
    return api.get<Quiz[]>('/api/quizzes/scheduled');
}

/**
 * Get quiz by ID
 */
export async function getQuiz(id: number): Promise<Quiz> {
    return api.get<Quiz>(`/api/quizzes/${id}`);
}

/**
 * Get quiz with questions
 */
export async function getQuizWithQuestions(id: number): Promise<QuizWithQuestions> {
    return api.get<QuizWithQuestions>(`/api/quizzes/${id}/with-questions`);
}

/**
 * Get asked questions history for quiz details (admin only)
 */
export async function getQuizAskedQuestions(id: number): Promise<AskedQuizQuestion[]> {
    return api.get<AskedQuizQuestion[]>(`/api/quizzes/${id}/asked-questions`);
}

/**
 * Get quiz results with pagination
 */
export async function getQuizResults(quizId: number, params?: PaginationParams): Promise<PaginatedResults<QuizResult>> {
    const query: Record<string, string> = {};
    if (params?.page) query.page = params.page.toString();
    if (params?.page_size) query.page_size = params.page_size.toString();

    return api.get<PaginatedResults<QuizResult>>(`/api/quizzes/${quizId}/results`, { query });
}

/**
 * Get current user's result for a quiz (requires auth)
 */
export async function getMyResult(quizId: number): Promise<QuizResult | null> {
    try {
        return await api.get<QuizResult>(`/api/quizzes/${quizId}/my-result`);
    } catch {
        return null;
    }
}

/**
 * Get leaderboard
 */
export async function getLeaderboard(params?: PaginationParams): Promise<LeaderboardResponse> {
    const query: Record<string, string> = {};
    if (params?.page) query.page = params.page.toString();
    if (params?.page_size) query.page_size = params.page_size.toString();

    return api.get<LeaderboardResponse>('/api/leaderboard', { query });
}

// ============ Admin Endpoints ============

interface CreateQuizData {
    title: string;
    description?: string;
    scheduled_time: string;
    prize_fund?: number; // Опционально, 0 = дефолт 1000000
    finish_on_zero_players?: boolean;
    question_source_mode?: 'hybrid' | 'admin_only';
}

interface QuestionData {
    text: string;
    options: string[];
    correct_option: number;
    time_limit_sec: number;
    point_value: number;
    difficulty?: number; // Уровень сложности 1-5 (опционально для обратной совместимости)
}

/**
 * Create a new quiz (admin only)
 */
export async function createQuiz(data: CreateQuizData): Promise<Quiz> {
    return api.post<Quiz>('/api/quizzes', data);
}

/**
 * Add questions to a quiz (admin only)
 */
export async function addQuestions(quizId: number, questions: QuestionData[]): Promise<void> {
    await api.post(`/api/quizzes/${quizId}/questions`, { questions });
}

/**
 * Schedule a quiz (admin only)
 */
export async function scheduleQuiz(
    quizId: number,
    scheduledTime: string,
    finishOnZeroPlayers?: boolean
): Promise<void> {
    await api.put(`/api/quizzes/${quizId}/schedule`, {
        scheduled_time: scheduledTime,
        ...(finishOnZeroPlayers !== undefined ? { finish_on_zero_players: finishOnZeroPlayers } : {}),
    });
}

/**
 * Cancel a quiz (admin only)
 */
export async function cancelQuiz(quizId: number): Promise<void> {
    await api.put(`/api/quizzes/${quizId}/cancel`);
}

/**
 * Duplicate a quiz (admin only)
 */
export async function duplicateQuiz(quizId: number, scheduledTime: string): Promise<Quiz> {
    return api.post<Quiz>(`/api/quizzes/${quizId}/duplicate`, { scheduled_time: scheduledTime });
}

// ============ Statistics Types ============

export interface QuestionElimination {
    question_number: number;
    question_id: number;
    eliminated_count: number;
    by_timeout: number;
    by_wrong_answer: number;
    avg_response_ms: number;
    difficulty: number;      // NEW: сложность вопроса (1-5)
    pass_rate: number;       // NEW: % прошедших (0-1)
    total_answers: number;   // NEW: всего ответов
}

export interface EliminationReasons {
    timeout: number;
    wrong_answer: number;
    disconnected: number;
    other: number;
}

export interface DifficultyDistribution {
    difficulty_1: number;
    difficulty_2: number;
    difficulty_3: number;
    difficulty_4: number;
    difficulty_5: number;
}

export interface QuizStatistics {
    quiz_id: number;
    total_participants: number;
    total_winners: number;
    total_eliminated: number;
    avg_response_time_ms: number;
    avg_correct_answers: number;
    eliminations_by_question: QuestionElimination[];
    elimination_reasons: EliminationReasons;
    difficulty_distribution: DifficultyDistribution; // NEW
    pool_questions_used: number;                     // NEW
    avg_pass_rate: number;                           // NEW
}

/**
 * Get quiz statistics (admin only)
 */
export async function getQuizStatistics(quizId: number): Promise<QuizStatistics> {
    return api.get<QuizStatistics>(`/api/quizzes/${quizId}/statistics`);
}

interface WinnersResponse {
    winners: QuizResult[];
    total: number;
}

/**
 * Get quiz winners (admin only) - returns ALL winners without pagination
 */
export async function getQuizWinners(quizId: number): Promise<WinnersResponse> {
    return api.get<WinnersResponse>(`/api/quizzes/${quizId}/winners`);
}
