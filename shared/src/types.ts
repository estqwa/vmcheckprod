// =============================================================================
// @trivia/shared — Общие типы API
// Используется web (trivia-apinewfront) и mobile (trivia-mobile)
// =============================================================================

// ============ Entities ============

/** Пользователь */
export interface User {
    id: number;
    username: string;
    email: string;
    profile_picture: string;
    games_played: number;
    total_score: number;
    highest_score: number;
    wins_count: number;
    total_prize_won: number;
    language: 'ru' | 'kk';
    role?: 'user' | 'admin';
    created_at: string;
    updated_at: string;
}

/** Статусы викторины */
export type QuizStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

/** Режим источника вопросов */
export type QuizQuestionSourceMode = 'hybrid' | 'admin_only';

/** Викторина */
export interface Quiz {
    id: number;
    title: string;
    description?: string;
    scheduled_time: string;
    status: QuizStatus;
    question_count: number;
    finish_on_zero_players: boolean;
    question_source_mode: QuizQuestionSourceMode;
    prize_fund: number;
    created_at: string;
    updated_at: string;
}

// ============ Questions ============

/** Вариант ответа */
export interface QuestionOption {
    id: number;
    text: string;
}

/** Вопрос */
export interface Question {
    id: number;
    quiz_id: number;
    text: string;
    options: QuestionOption[];
    time_limit_sec: number;
    point_value: number;
    created_at: string;
    updated_at: string;
}

/** Викторина с вопросами */
export interface QuizWithQuestions extends Quiz {
    questions: Question[];
}

/** Детали заданного вопроса (для admin) */
export interface AskedQuestionDetails {
    id: number;
    quiz_id?: number;
    text: string;
    text_kk?: string;
    options: QuestionOption[];
    options_kk?: QuestionOption[];
    correct_option: number;
    time_limit_sec: number;
    point_value: number;
    difficulty: number;
}

/** Заданный вопрос викторины */
export interface AskedQuizQuestion {
    question_order: number;
    asked_at: string;
    source: 'quiz' | 'pool' | 'other_quiz' | string;
    question: AskedQuestionDetails;
}

// ============ Results ============

/** Результат викторины */
export interface QuizResult {
    id: number;
    user_id: number;
    quiz_id: number;
    username: string;
    profile_picture?: string;
    score: number;
    correct_answers: number;
    total_questions: number;
    rank: number;
    is_winner: boolean;
    prize_fund: number;
    is_eliminated: boolean;
    eliminated_on_question?: number;
    elimination_reason?: string;
    completed_at: string;
}

/** Пагинированные результаты */
export interface PaginatedResults<T> {
    results: T[];
    total: number;
    page: number;
    per_page: number;
}

// ============ Session ============

/** Информация о сессии */
export interface Session {
    id: number;
    device_id: string;
    ip_address: string;
    user_agent: string;
    created_at: string;
    expires_at: string;
}

// ============ Auth ============

/** Ответ аутентификации (web — включает CSRF) */
export interface AuthResponse {
    user: User;
    accessToken: string;
    csrfToken: string;
    userId: number;
    expiresIn: number;
    tokenType: string;
}

/** Ответ аутентификации (mobile — включает refreshToken) */
export interface MobileAuthResponse {
    user: User;
    accessToken: string;
    refreshToken: string;
    userId: number;
    expiresIn: number;
    tokenType: string;
}

// ============ Leaderboard ============

/** Запись таблицы лидеров */
export interface LeaderboardEntry {
    rank: number;
    user_id: number;
    username: string;
    profile_picture?: string;
    wins_count: number;
    total_prize_won: number;
}

/** Ответ таблицы лидеров */
export interface LeaderboardResponse {
    users: LeaderboardEntry[];
    total: number;
    page: number;
    per_page: number;
}

// ============ Errors ============

/** Ошибка API */
export interface ApiError {
    error: string;
    error_type?: string;
}

// ============ Elimination ============

/** Причины выбытия */
export type EliminationReason =
    | 'incorrect_answer'
    | 'time_exceeded'
    | 'no_answer_timeout'
    | 'already_eliminated';
