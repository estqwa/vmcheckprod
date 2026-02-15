// =============================================================================
// @trivia/shared — WebSocket Event Constants
// Единый источник истины для всех WS типов сообщений
// =============================================================================

// ============ Client → Server ============

/** Типы сообщений от клиента к серверу */
export const WS_CLIENT_EVENTS = {
    /** Клиент готов к викторине */
    READY: 'user:ready',
    /** Ответ на вопрос */
    ANSWER: 'user:answer',
    /** Heartbeat для поддержания соединения */
    HEARTBEAT: 'user:heartbeat',
    /** Запрос ресинхронизации состояния */
    RESYNC: 'user:resync',
} as const;

/** Тип клиентского WS-события */
export type WSClientEventType = (typeof WS_CLIENT_EVENTS)[keyof typeof WS_CLIENT_EVENTS];

// ============ Server → Client: Quiz Events ============

/** Типы quiz-событий от сервера */
export const WS_QUIZ_EVENTS = {
    /** Викторина началась */
    START: 'quiz:start',
    /** Обратный отсчет до старта */
    COUNTDOWN: 'quiz:countdown',
    /** Новый вопрос */
    QUESTION: 'quiz:question',
    /** Таймер обратного отсчета ответа */
    TIMER: 'quiz:timer',
    /** Результат ответа */
    ANSWER_RESULT: 'quiz:answer_result',
    /** Раскрытие правильного ответа */
    ANSWER_REVEAL: 'quiz:answer_reveal',
    /** Игрок выбыл */
    ELIMINATION: 'quiz:elimination',
    /** Викторина завершена */
    FINISH: 'quiz:finish',
    /** Результаты доступны */
    RESULTS_AVAILABLE: 'quiz:results_available',
    /** Текущее состояние (resync) */
    STATE: 'quiz:state',
    /** Рекламная пауза */
    AD_BREAK: 'quiz:ad_break',
    /** Конец рекламной паузы */
    AD_BREAK_END: 'quiz:ad_break_end',
    /** Количество игроков обновилось */
    PLAYER_COUNT: 'quiz:player_count',
    /** Игрок готов (с обновленным count) */
    USER_READY: 'quiz:user_ready',
} as const;

/** Тип quiz WS-события */
export type WSQuizEventType = (typeof WS_QUIZ_EVENTS)[keyof typeof WS_QUIZ_EVENTS];

// ============ Server → Client: System Events ============

/** Типы системных событий */
export const WS_SYSTEM_EVENTS = {
    /** Heartbeat от сервера */
    HEARTBEAT: 'server:heartbeat',
    /** Ошибка сервера */
    ERROR: 'server:error',
    /** Токен скоро истечет */
    TOKEN_EXPIRE_SOON: 'TOKEN_EXPIRE_SOON',
    /** Токен истек */
    TOKEN_EXPIRED: 'TOKEN_EXPIRED',
    /** Сессия отозвана */
    SESSION_REVOKED: 'session_revoked',
    /** Выход со всех устройств */
    LOGOUT_ALL: 'logout_all_devices',
} as const;

/** Тип системного WS-события */
export type WSSystemEventType = (typeof WS_SYSTEM_EVENTS)[keyof typeof WS_SYSTEM_EVENTS];

// ============ All Server Events ============

/** Все типы серверных событий */
export const WS_SERVER_EVENTS = {
    ...WS_QUIZ_EVENTS,
    ...WS_SYSTEM_EVENTS,
} as const;

/** Тип серверного WS-события */
export type WSServerEventType = WSQuizEventType | WSSystemEventType;

// ============ WebSocket Message Types ============

/** Сообщение от клиента */
export interface WSClientMessage {
    type: WSClientEventType;
    data: Record<string, unknown>;
}

/** Сообщение от сервера */
export interface WSServerMessage {
    type: string; // `string` для forward-compatibility
    data: Record<string, unknown>;
}

// ============ Quiz Event Payloads ============

/** Событие начала вопроса */
export interface QuizQuestionEvent {
    question_id: number;
    quiz_id: number;
    number: number;
    text: string;
    text_kk?: string;
    options: import('./types').QuestionOption[];
    options_kk?: import('./types').QuestionOption[];
    time_limit: number;
    total_questions: number;
    start_time: number;
    server_timestamp: number;
}

/** Событие таймера */
export interface QuizTimerEvent {
    question_id: number;
    remaining_seconds: number;
    server_timestamp: number;
}

/** Событие результата ответа */
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

/** Событие выбытия */
export interface EliminationEvent {
    quiz_id: number;
    user_id: number;
    reason: import('./types').EliminationReason;
    message: string;
}

/** Событие начала викторины */
export interface QuizStartEvent {
    quiz_id: number;
    title: string;
    question_count: number;
}

/** Событие завершения викторины */
export interface QuizFinishEvent {
    quiz_id: number;
    title: string;
    message: string;
    status: string;
    ended_at: string;
}

/** Событие текущего состояния (quiz:state, resync) */
export interface QuizStateEvent {
    status?: string;
    current_question?: QuizQuestionEvent;
    time_remaining?: number;
    is_eliminated?: boolean;
    elimination_reason?: string;
    score?: number;
    correct_count?: number;
    player_count?: number;
}
