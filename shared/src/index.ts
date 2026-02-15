// =============================================================================
// @trivia/shared — Barrel Export
// =============================================================================

// API types
export type {
    User,
    Quiz,
    QuizStatus,
    QuizQuestionSourceMode,
    QuestionOption,
    Question,
    QuizWithQuestions,
    AskedQuestionDetails,
    AskedQuizQuestion,
    QuizResult,
    PaginatedResults,
    Session,
    AuthResponse,
    MobileAuthResponse,
    LeaderboardEntry,
    LeaderboardResponse,
    ApiError,
    EliminationReason,
} from './types';

// WebSocket events & types
export {
    WS_CLIENT_EVENTS,
    WS_QUIZ_EVENTS,
    WS_SYSTEM_EVENTS,
    WS_SERVER_EVENTS,
} from './ws-events';

export type {
    WSClientEventType,
    WSQuizEventType,
    WSSystemEventType,
    WSServerEventType,
    WSClientMessage,
    WSServerMessage,
    QuizQuestionEvent,
    QuizTimerEvent,
    AnswerResultEvent,
    EliminationEvent,
    QuizStartEvent,
    QuizFinishEvent,
    QuizStateEvent,
} from './ws-events';

// Runtime type guards
export {
    isQuestionOption,
    isQuestionOptionArray,
    isQuizQuestionEvent,
    isAnswerResultEvent,
    isQuizFinishEvent,
    isEliminationEvent,
    isQuizTimerEvent,
    isQuizStateEvent,
    isWSMessage,
} from './guards';
