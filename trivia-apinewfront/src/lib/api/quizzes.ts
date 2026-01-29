import { api } from './client';
import { Quiz, QuizWithQuestions, QuizResult, PaginatedResults, LeaderboardResponse } from './types';

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
}

interface QuestionData {
    text: string;
    options: string[];
    correct_option: number;
    time_limit_sec: number;
    point_value: number;
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
export async function scheduleQuiz(quizId: number, scheduledTime: string): Promise<void> {
    await api.put(`/api/quizzes/${quizId}/schedule`, { scheduled_time: scheduledTime });
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
