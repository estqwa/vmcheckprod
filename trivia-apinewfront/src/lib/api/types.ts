// =============================================================================
// Re-export всех типов из @trivia/shared
// Этот файл обеспечивает обратную совместимость — все существующие импорты
// из '@/lib/api/types' продолжают работать без изменений.
// =============================================================================

// API types
export type {
    User,
    RegisterData,
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
    AuthErrorType,
    MessageResponse,
    EmailVerificationStatus,
    EmailVerificationConfirmData,
    GoogleExchangeRequestData,
    GoogleLinkRequestData,
    GoogleLinkResponse,
    DeleteAccountRequestData,
    EliminationReason,
} from '@trivia/shared';

// WebSocket events & types
export {
    WS_CLIENT_EVENTS,
    WS_QUIZ_EVENTS,
    WS_SYSTEM_EVENTS,
    WS_SERVER_EVENTS,
} from '@trivia/shared';

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
} from '@trivia/shared';

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
} from '@trivia/shared';
