// =============================================================================
// @trivia/shared — Barrel Export
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
    QuizStateQuestionEvent,
    QuizTimerEvent,
    AnswerResultEvent,
    QuizAnswerRevealEvent,
    EliminationEvent,
    QuizStartEvent,
    QuizFinishEvent,
    QuizCancelledEvent,
    QuizStateEvent,
    QuizAdBreakEvent,
    QuizAdBreakEndEvent,
} from './ws-events';

// Runtime type guards
export {
    isQuestionOption,
    isQuestionOptionArray,
    isQuizQuestionEvent,
    isQuizStateQuestionEvent,
    isAnswerResultEvent,
    isQuizAnswerRevealEvent,
    isQuizFinishEvent,
    isQuizCancelledEvent,
    isEliminationEvent,
    isQuizTimerEvent,
    isQuizAdBreakEvent,
    isQuizAdBreakEndEvent,
    isQuizStateEvent,
    isWSMessage,
} from './guards';

// Design tokens
export { designTokens } from './design-tokens';
export type { DesignTokens } from './design-tokens';
