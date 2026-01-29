// User from backend API
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
    created_at: string;
    updated_at: string;
}

// Quiz statuses
export type QuizStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

// Quiz from backend API
export interface Quiz {
    id: number;
    title: string;
    description?: string;
    scheduled_time: string;
    status: QuizStatus;
    question_count: number;
    prize_fund: number;
    created_at: string;
    updated_at: string;
}

// Question option
export interface QuestionOption {
    id: number;
    text: string;
}

// Question from backend API
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

// Quiz with questions
export interface QuizWithQuestions extends Quiz {
    questions: Question[];
}

// Quiz result
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
    completed_at: string;
}

// Paginated results response
export interface PaginatedResults<T> {
    results: T[];
    total: number;
    page: number;
    per_page: number;
}

// Session info
export interface Session {
    id: number;
    device_id: string;
    ip_address: string;
    user_agent: string;
    created_at: string;
    expires_at: string;
}

// Auth response from login/register
export interface AuthResponse {
    user: User;
    accessToken: string;
    csrfToken: string;
    userId: number;
    expiresIn: number;
    tokenType: string;
}

// Leaderboard entry
export interface LeaderboardEntry {
    rank: number;
    user_id: number;
    username: string;
    profile_picture?: string;
    wins_count: number;
    total_prize_won: number;
}

// Leaderboard response
export interface LeaderboardResponse {
    users: LeaderboardEntry[];
    total: number;
    page: number;
    per_page: number;
}

// ============ WebSocket Message Types ============

// Message from client to server
export interface WSClientMessage {
    type: 'user:ready' | 'user:answer' | 'user:heartbeat';
    data: Record<string, unknown>;
}

// Message from server to client
export interface WSServerMessage {
    type: string;
    data: Record<string, unknown>;
}

// Quiz start event
export interface QuizStartEvent {
    quiz_id: number;
    title: string;
    question_count: number;
}

// Quiz question event
export interface QuizQuestionEvent {
    question_id: number;
    quiz_id: number;
    number: number;
    text: string;
    options: QuestionOption[];
    time_limit: number;
    total_questions: number;
    start_time: number;
    server_timestamp: number;
}

// Quiz timer event
export interface QuizTimerEvent {
    question_id: number;
    remaining_seconds: number;
    server_timestamp: number;
}

// Answer result event
export interface AnswerResultEvent {
    question_id: number;
    correct_option: number;
    your_answer: number;
    is_correct: boolean;
    points_earned: number;
    time_taken_ms: number;
    is_eliminated: boolean;
    elimination_reason: string;
    time_limit_exceeded: boolean;
}

// Elimination reasons
export type EliminationReason =
    | 'incorrect_answer'
    | 'time_exceeded'
    | 'no_answer_timeout'
    | 'already_eliminated';

// Elimination event
export interface EliminationEvent {
    quiz_id: number;
    user_id: number;
    reason: EliminationReason;
    message: string;
}

// Quiz finish event
export interface QuizFinishEvent {
    quiz_id: number;
    title: string;
    message: string;
    status: string;
    ended_at: string;
}

// API Error
export interface ApiError {
    error: string;
    error_type?: string;
}
