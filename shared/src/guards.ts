import type {
  AnswerResultEvent,
  EliminationEvent,
  QuizFinishEvent,
  QuizQuestionEvent,
  QuizStateEvent,
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

export function isQuizFinishEvent(value: unknown): value is QuizFinishEvent {
  if (!isRecord(value)) return false;
  return isNumber(value.quiz_id) && isString(value.status);
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

export function isQuizStateEvent(value: unknown): value is QuizStateEvent {
  if (!isRecord(value)) return false;

  const hasStatus = value.status === undefined || isString(value.status);
  const hasCurrentQuestion = value.current_question === undefined || isQuizQuestionEvent(value.current_question);
  const hasTimeRemaining = value.time_remaining === undefined || isNumber(value.time_remaining);
  const hasEliminated = value.is_eliminated === undefined || isBoolean(value.is_eliminated);
  const hasScore = value.score === undefined || isNumber(value.score);
  const hasCorrectCount = value.correct_count === undefined || isNumber(value.correct_count);
  const hasPlayerCount = value.player_count === undefined || isNumber(value.player_count);

  return (
    hasStatus &&
    hasCurrentQuestion &&
    hasTimeRemaining &&
    hasEliminated &&
    hasScore &&
    hasCorrectCount &&
    hasPlayerCount
  );
}

export function isWSMessage(value: unknown): value is { type: string; data: Record<string, unknown> } {
  if (!isRecord(value)) return false;
  return isString(value.type) && isRecord(value.data);
}
