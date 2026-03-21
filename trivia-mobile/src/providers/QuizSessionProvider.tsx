import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
  WS_SERVER_EVENTS,
  isAnswerResultEvent,
  isEliminationEvent,
  isQuizAdBreakEndEvent,
  isQuizAdBreakEvent,
  isQuizCancelledEvent,
  isQuizFinishEvent,
  isQuizQuestionEvent,
  isQuizStateEvent,
  isQuizStateQuestionEvent,
  isQuizTimerEvent,
  type AnswerResultEvent,
  type QuestionOption,
  type QuizAdBreakEvent,
  type QuizQuestionEvent,
  type QuizStateEvent,
  type QuizStateQuestionEvent,
  type QuizTimerEvent,
  type WSServerMessage,
} from '@trivia/shared';
import { useQuizWS, type ConnectionState } from '../hooks/useQuizWS';
import { leaderboardQueryKey, userQueryKey } from '../hooks/useUserQuery';
import { useAuth } from './AuthProvider';

type FeedbackState = 'correct' | 'incorrect' | null;

export interface QuizSessionQuestion {
  id: number;
  text: string;
  textKK?: string;
  options: QuestionOption[];
  optionsKK?: QuestionOption[];
  current: number;
  total: number;
  timeLimit: number;
}

interface QuizSessionState {
  status: string | null;
  playerCount: number;
  question: QuizSessionQuestion | null;
  timeLeft: number;
  isEliminated: boolean;
  score: number;
  correctCount: number;
  feedback: FeedbackState;
  revealedCorrectOption: number | null;
  selectedOption: number | null;
  adBreak: QuizAdBreakEvent | null;
  showAdOverlay: boolean;
}

interface QuizSessionContextValue extends QuizSessionState {
  quizId: number;
  connectionState: ConnectionState;
  isConnected: boolean;
  isOffline: boolean;
  reconnect: () => void;
  submitAnswer: (optionId: number) => boolean;
  dismissAdBreak: () => void;
}

interface QuizSessionProviderProps {
  quizId: number;
  enabled?: boolean;
  children: ReactNode;
}

const initialSessionState: QuizSessionState = {
  status: null,
  playerCount: 0,
  question: null,
  timeLeft: 0,
  isEliminated: false,
  score: 0,
  correctCount: 0,
  feedback: null,
  revealedCorrectOption: null,
  selectedOption: null,
  adBreak: null,
  showAdOverlay: false,
};

const QuizSessionContext = createContext<QuizSessionContextValue | null>(null);

function mapQuestion(question: QuizQuestionEvent | QuizStateQuestionEvent): QuizSessionQuestion {
  return {
    id: question.question_id,
    text: question.text,
    textKK: question.text_kk,
    options: question.options,
    optionsKK: question.options_kk,
    current: question.number,
    total: question.total_questions,
    timeLimit: question.time_limit,
  };
}

export function QuizSessionProvider({ quizId, enabled = true, children }: QuizSessionProviderProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { logout } = useAuth();

  const [session, setSession] = useState<QuizSessionState>(initialSessionState);

  useEffect(() => {
    setSession(initialSessionState);
  }, [quizId]);

  const invalidateUserAndLeaderboard = useCallback(() => {
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: userQueryKey }),
      queryClient.invalidateQueries({ queryKey: leaderboardQueryKey }),
    ]);
  }, [queryClient]);

  const dismissAdBreak = useCallback(() => {
    setSession((prev) => {
      if (!prev.showAdOverlay && !prev.adBreak) {
        return prev;
      }

      return {
        ...prev,
        adBreak: null,
        showAdOverlay: false,
      };
    });
  }, []);

  const handleSessionEnded = useCallback(async () => {
    await logout();
    router.replace('/(auth)/login');
  }, [logout, router]);

  const routeToResults = useCallback(() => {
    invalidateUserAndLeaderboard();
    setSession((prev) => ({
      ...prev,
      status: 'completed',
      question: null,
      timeLeft: 0,
      selectedOption: null,
      feedback: null,
      revealedCorrectOption: null,
      adBreak: null,
      showAdOverlay: false,
    }));
    router.replace(`/quiz/${quizId}/results`);
  }, [invalidateUserAndLeaderboard, quizId, router]);

  const routeToHome = useCallback(() => {
    setSession((prev) => ({
      ...prev,
      status: 'cancelled',
      question: null,
      timeLeft: 0,
      selectedOption: null,
      feedback: null,
      revealedCorrectOption: null,
      adBreak: null,
      showAdOverlay: false,
    }));
    router.replace('/(tabs)');
  }, [router]);

  const handleMessage = useCallback(
    (msg: WSServerMessage) => {
      if (msg.type === WS_SERVER_EVENTS.PLAYER_COUNT || msg.type === WS_SERVER_EVENTS.USER_READY) {
        const count = Number(msg.data.player_count);
        if (Number.isFinite(count)) {
          setSession((prev) => ({ ...prev, playerCount: count }));
        }
        return;
      }

      if (msg.type === WS_SERVER_EVENTS.AD_BREAK && isQuizAdBreakEvent(msg.data)) {
        const adData = msg.data as QuizAdBreakEvent;
        if (adData.quiz_id === quizId) {
          setSession((prev) => ({
            ...prev,
            adBreak: adData,
            showAdOverlay: true,
          }));
        }
        return;
      }

      if (msg.type === WS_SERVER_EVENTS.AD_BREAK_END && isQuizAdBreakEndEvent(msg.data)) {
        if (msg.data.quiz_id === quizId) {
          dismissAdBreak();
        }
        return;
      }

      if (msg.type === WS_SERVER_EVENTS.START) {
        setSession((prev) => ({
          ...prev,
          status: 'in_progress',
        }));
        return;
      }

      if (msg.type === WS_SERVER_EVENTS.QUESTION && isQuizQuestionEvent(msg.data)) {
        const questionData = msg.data as QuizQuestionEvent;
        setSession((prev) => ({
          ...prev,
          status: 'in_progress',
          question: mapQuestion(questionData),
          timeLeft: questionData.time_limit,
          selectedOption: null,
          feedback: null,
          revealedCorrectOption: null,
          adBreak: null,
          showAdOverlay: false,
        }));
        return;
      }

      if (msg.type === WS_SERVER_EVENTS.TIMER && isQuizTimerEvent(msg.data)) {
        const timerData = msg.data as QuizTimerEvent;
        setSession((prev) => {
          if (!prev.question || prev.question.id !== timerData.question_id) {
            return prev;
          }

          return {
            ...prev,
            timeLeft: timerData.remaining_seconds,
          };
        });
        return;
      }

      if (msg.type === WS_SERVER_EVENTS.ANSWER_RESULT && isAnswerResultEvent(msg.data)) {
        const answerData = msg.data as AnswerResultEvent;
        setSession((prev) => {
          if (!prev.question || prev.question.id !== answerData.question_id) {
            return prev;
          }

          return {
            ...prev,
            feedback: answerData.is_correct ? 'correct' : 'incorrect',
            revealedCorrectOption: answerData.correct_option,
            score: prev.score + answerData.points_earned,
            correctCount: prev.correctCount + (answerData.is_correct ? 1 : 0),
            isEliminated: prev.isEliminated || answerData.is_eliminated,
          };
        });
        return;
      }

      if (msg.type === WS_SERVER_EVENTS.ANSWER_REVEAL) {
        const option = Number(msg.data.correct_option);
        const questionId = Number(msg.data.question_id);

        if (!Number.isFinite(option) || !Number.isFinite(questionId)) {
          return;
        }

        setSession((prev) => {
          if (!prev.question || prev.question.id !== questionId) {
            return prev;
          }

          return {
            ...prev,
            revealedCorrectOption: option,
          };
        });
        return;
      }

      if (msg.type === WS_SERVER_EVENTS.ELIMINATION && isEliminationEvent(msg.data)) {
        setSession((prev) => ({
          ...prev,
          isEliminated: true,
        }));
        return;
      }

      if (msg.type === WS_SERVER_EVENTS.STATE && isQuizStateEvent(msg.data)) {
        const state = msg.data as QuizStateEvent;

        if (state.status === 'completed') {
          routeToResults();
          return;
        }

        setSession((prev) => {
          const next: QuizSessionState = {
            ...prev,
            status: typeof state.status === 'string' ? state.status : prev.status,
            playerCount: typeof state.player_count === 'number' ? state.player_count : prev.playerCount,
            isEliminated: typeof state.is_eliminated === 'boolean' ? state.is_eliminated : prev.isEliminated,
            score: typeof state.score === 'number' ? state.score : prev.score,
            correctCount: typeof state.correct_count === 'number' ? state.correct_count : prev.correctCount,
            timeLeft: typeof state.time_remaining === 'number' ? state.time_remaining : prev.timeLeft,
          };

          if (state.current_question && isQuizStateQuestionEvent(state.current_question)) {
            next.question = mapQuestion(state.current_question);
            next.timeLeft =
              typeof state.time_remaining === 'number'
                ? state.time_remaining
                : state.current_question.time_limit;
            next.selectedOption = null;
            next.feedback = null;
            next.revealedCorrectOption = null;
            next.adBreak = null;
            next.showAdOverlay = false;
          }

          return next;
        });
        return;
      }

      if (msg.type === WS_SERVER_EVENTS.FINISH && isQuizFinishEvent(msg.data)) {
        if (msg.data.quiz_id === quizId) {
          routeToResults();
        }
        return;
      }

      if (msg.type === WS_SERVER_EVENTS.RESULTS_AVAILABLE) {
        routeToResults();
        return;
      }

      if (msg.type === WS_SERVER_EVENTS.CANCELLED && isQuizCancelledEvent(msg.data)) {
        if (msg.data.quiz_id === quizId) {
          routeToHome();
        }
      }
    },
    [dismissAdBreak, quizId, routeToHome, routeToResults]
  );

  const { connectionState, isConnected, isOffline, reconnect, sendAnswer } = useQuizWS({
    quizId,
    enabled,
    onMessage: handleMessage,
    onSessionEnded: handleSessionEnded,
  });

  const submitAnswer = useCallback(
    (optionId: number) => {
      if (
        session.selectedOption !== null ||
        session.revealedCorrectOption !== null ||
        session.isEliminated ||
        !session.question ||
        isOffline ||
        connectionState !== 'connected' ||
        session.showAdOverlay
      ) {
        return false;
      }

      setSession((prev) => ({
        ...prev,
        selectedOption: optionId,
      }));

      sendAnswer(session.question.id, optionId);
      return true;
    },
    [
      connectionState,
      isOffline,
      sendAnswer,
      session.isEliminated,
      session.question,
      session.revealedCorrectOption,
      session.selectedOption,
      session.showAdOverlay,
    ]
  );

  const value = useMemo<QuizSessionContextValue>(
    () => ({
      quizId,
      connectionState,
      isConnected,
      isOffline,
      reconnect,
      submitAnswer,
      dismissAdBreak,
      ...session,
    }),
    [connectionState, dismissAdBreak, isConnected, isOffline, quizId, reconnect, session, submitAnswer]
  );

  return <QuizSessionContext.Provider value={value}>{children}</QuizSessionContext.Provider>;
}

export function useQuizSession() {
  const context = useContext(QuizSessionContext);

  if (!context) {
    throw new Error('useQuizSession must be used within a QuizSessionProvider');
  }

  return context;
}
