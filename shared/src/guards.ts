import type {
  QuizAdBreakEndEvent,
  QuizAdBreakEvent,
  AnswerResultEvent,
  QuizAnswerRevealEvent,
  EliminationEvent,
  QuizCancelledEvent,
  QuizFinishEvent,
  QuizQuestionEvent,
  QuizStateEvent,
  QuizStateQuestionEvent,
  QuizTimerEvent,
} from './ws-events';
import type { QuestionOption } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isMediaType(value: unknown): value is 'image' | 'video' {
  return value === 'image' || value === 'video';
}

export function isQuestionOption(value: unknown): value is QuestionOption {
  if (!isRecord(value)) return false;
  return isNumber(value.id) && isString(value.text);
}

export function isQuestionOptionArray(value: unknown): value is QuestionOption[] {
  return Array.isArray(value) && value.length > 0 && value.every(isQuestionOption);
}

export function isQuizQuestionEvent(value: unknown): value is QuizQuestionEvent {
  if (!isRecord(value)) return false;
  return (
    isNumber(value.question_id) &&
    isNumber(value.quiz_id) &&
    isNumber(value.number) &&
    isString(value.text) &&
    isQuestionOptionArray(value.options) &&
    isNumber(value.time_limit) &&
    isNumber(value.total_questions) &&
    isNumber(value.start_time) &&
    isNumber(value.server_timestamp)
  );
}

export function isQuizStateQuestionEvent(value: unknown): value is QuizStateQuestionEvent {
  if (!isRecord(value)) return false;
  return (
    isNumber(value.question_id) &&
    isNumber(value.number) &&
    isNumber(value.total_questions) &&
    isString(value.text) &&
    isQuestionOptionArray(value.options) &&
    isNumber(value.time_limit) &&
    (value.quiz_id === undefined || isNumber(value.quiz_id)) &&
    (value.start_time === undefined || isNumber(value.start_time)) &&
    (value.server_timestamp === undefined || isNumber(value.server_timestamp)) &&
    (value.text_kk === undefined || isString(value.text_kk)) &&
    (value.options_kk === undefined || isQuestionOptionArray(value.options_kk))
  );
}

export function isAnswerResultEvent(value: unknown): value is AnswerResultEvent {
  if (!isRecord(value)) return false;
  return (
    isNumber(value.question_id) &&
    isNumber(value.correct_option) &&
    isNumber(value.your_answer) &&
    isBoolean(value.is_correct) &&
    isNumber(value.points_earned) &&
    isNumber(value.time_taken_ms) &&
    isBoolean(value.is_eliminated)
  );
}

export function isQuizAnswerRevealEvent(value: unknown): value is QuizAnswerRevealEvent {
  if (!isRecord(value)) return false;
  return isNumber(value.question_id) && isNumber(value.correct_option);
}

export function isQuizFinishEvent(value: unknown): value is QuizFinishEvent {
  if (!isRecord(value)) return false;
  return isNumber(value.quiz_id) && isString(value.status);
}

export function isQuizCancelledEvent(value: unknown): value is QuizCancelledEvent {
  if (!isRecord(value)) return false;
  return (
    isNumber(value.quiz_id) &&
    (value.reason === undefined || isString(value.reason)) &&
    (value.message === undefined || isString(value.message)) &&
    (value.details === undefined || isString(value.details))
  );
}

export function isEliminationEvent(value: unknown): value is EliminationEvent {
  if (!isRecord(value)) return false;
  return (
    isNumber(value.quiz_id) &&
    isNumber(value.user_id) &&
    isString(value.reason) &&
    isString(value.message)
  );
}

export function isQuizTimerEvent(value: unknown): value is QuizTimerEvent {
  if (!isRecord(value)) return false;
  return (
    isNumber(value.question_id) &&
    isNumber(value.remaining_seconds) &&
    isNumber(value.server_timestamp)
  );
}

export function isQuizAdBreakEvent(value: unknown): value is QuizAdBreakEvent {
  if (!isRecord(value)) return false;
  return (
    isNumber(value.quiz_id) &&
    isMediaType(value.media_type) &&
    isString(value.media_url) &&
    isNumber(value.duration_sec) &&
    value.duration_sec > 0
  );
}

export function isQuizAdBreakEndEvent(value: unknown): value is QuizAdBreakEndEvent {
  if (!isRecord(value)) return false;
  return isNumber(value.quiz_id);
}

export function isQuizStateEvent(value: unknown): value is QuizStateEvent {
  if (!isRecord(value)) return false;

  const hasStatus = value.status === undefined || isString(value.status);
  const hasCurrentQuestion = value.current_question === undefined || isQuizStateQuestionEvent(value.current_question);
  const hasTimeRemaining = value.time_remaining === undefined || isNumber(value.time_remaining);
  const hasEliminated = value.is_eliminated === undefined || isBoolean(value.is_eliminated);
  const hasEliminationReason = value.elimination_reason === undefined || isString(value.elimination_reason);
  const hasScore = value.score === undefined || isNumber(value.score);
  const hasCorrectCount = value.correct_count === undefined || isNumber(value.correct_count);
  const hasPlayerCount = value.player_count === undefined || isNumber(value.player_count);

  return (
    hasStatus &&
    hasCurrentQuestion &&
    hasTimeRemaining &&
    hasEliminated &&
    hasEliminationReason &&
    hasScore &&
    hasCorrectCount &&
    hasPlayerCount
  );
}

export function isWSMessage(value: unknown): value is { type: string; data: Record<string, unknown> } {
  if (!isRecord(value)) return false;
  return isString(value.type) && isRecord(value.data);
}
