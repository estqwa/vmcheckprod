import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  type AnswerResultEvent,
  type QuizFinishEvent,
  type QuizQuestionEvent,
  type QuizStateEvent,
  WS_SERVER_EVENTS,
  isAnswerResultEvent,
  isEliminationEvent,
  isQuizFinishEvent,
  isQuizQuestionEvent,
  isQuizStateEvent,
  isQuizTimerEvent,
  type QuestionOption,
  type WSServerMessage,
} from '@trivia/shared';
import { BrandHeader } from '../../../src/components/ui/BrandHeader';
import { useQuizWS } from '../../../src/hooks/useQuizWS';
import { palette, radii, shadow, spacing } from '../../../src/theme/tokens';

type QuestionState = {
  id: number;
  text: string;
  options: QuestionOption[];
  current: number;
  total: number;
};

export default function PlayScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const quizId = Number(id);

  const [question, setQuestion] = useState<QuestionState | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isEliminated, setIsEliminated] = useState(false);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);

  const handleMessage = useCallback(
    (msg: WSServerMessage) => {
      if (msg.type === WS_SERVER_EVENTS.QUESTION && isQuizQuestionEvent(msg.data)) {
        setQuestion({
          id: msg.data.question_id,
          text: msg.data.text,
          options: msg.data.options,
          current: msg.data.number,
          total: msg.data.total_questions,
        });
        setSelectedOption(null);
        setFeedback(null);
        setTimeLeft(msg.data.time_limit);
        return;
      }

      if (msg.type === WS_SERVER_EVENTS.TIMER && isQuizTimerEvent(msg.data)) {
        setTimeLeft(msg.data.remaining_seconds);
        return;
      }

      if (msg.type === WS_SERVER_EVENTS.ANSWER_RESULT && isAnswerResultEvent(msg.data)) {
        const answerData = msg.data as AnswerResultEvent;
        setFeedback(answerData.is_correct ? 'correct' : 'incorrect');
        setScore((prev) => prev + answerData.points_earned);
        setCorrectCount((prev) => (answerData.is_correct ? prev + 1 : prev));
        if (answerData.is_eliminated) {
          setIsEliminated(true);
        }
        return;
      }

      if (msg.type === WS_SERVER_EVENTS.ELIMINATION && isEliminationEvent(msg.data)) {
        setIsEliminated(true);
        return;
      }

      if (msg.type === WS_SERVER_EVENTS.STATE && isQuizStateEvent(msg.data)) {
        const stateData = msg.data as QuizStateEvent;
        if (stateData.status === 'completed') {
          router.replace(`/quiz/${quizId}/results`);
          return;
        }

        if (typeof stateData.is_eliminated === 'boolean') {
          setIsEliminated(stateData.is_eliminated);
        }
        if (typeof stateData.score === 'number') {
          setScore(stateData.score);
        }
        if (typeof stateData.correct_count === 'number') {
          setCorrectCount(stateData.correct_count);
        }
        if (typeof stateData.time_remaining === 'number') {
          setTimeLeft(stateData.time_remaining);
        }
        if (stateData.current_question) {
          const currentQuestion = stateData.current_question as unknown;
          if (isQuizQuestionEvent(currentQuestion)) {
            setQuestion({
              id: currentQuestion.question_id,
              text: currentQuestion.text,
              options: currentQuestion.options,
              current: currentQuestion.number,
              total: currentQuestion.total_questions,
            });
          }
        }
        return;
      }

      if (msg.type === WS_SERVER_EVENTS.FINISH && isQuizFinishEvent(msg.data)) {
        const finishData = msg.data as QuizFinishEvent;
        if (finishData.quiz_id === quizId) {
          router.replace(`/quiz/${quizId}/results`);
        }
        return;
      }

      if (msg.type === WS_SERVER_EVENTS.RESULTS_AVAILABLE) {
        router.replace(`/quiz/${quizId}/results`);
      }
    },
    [quizId, router]
  );

  const { sendAnswer, connectionState } = useQuizWS({
    quizId,
    enabled: Number.isFinite(quizId) && quizId > 0,
    onMessage: handleMessage,
  });

  const handleAnswer = (optionId: number) => {
    if (selectedOption !== null || isEliminated || !question) return;
    setSelectedOption(optionId);
    sendAnswer(question.id, optionId);
  };

  const timerStyle = useMemo(() => {
    if (timeLeft <= 5) {
      return { backgroundColor: '#fee2e2', color: '#b91c1c' };
    }
    return { backgroundColor: '#f3f4f6', color: '#1f2937' };
  }, [timeLeft]);

  const connectionPill = useMemo(() => {
    if (connectionState === 'connected') {
      return { text: `🟢 ${t('quiz.connected')}`, bg: '#dcfce7', color: '#166534' };
    }
    if (connectionState === 'reconnecting') {
      return { text: `🟠 ${t('quiz.reconnecting')}`, bg: '#ffedd5', color: '#9a3412' };
    }
    if (connectionState === 'connecting') {
      return { text: `🟡 ${t('quiz.connecting')}`, bg: '#fef9c3', color: '#854d0e' };
    }
    return { text: `🔴 ${t('quiz.disconnected')}`, bg: '#fee2e2', color: '#991b1b' };
  }, [connectionState, t]);

  const getOptionStyle = (optionId: number) => {
    if (selectedOption === null) return [styles.optionButton, styles.optionIdle];
    if (optionId === selectedOption) {
      if (feedback === 'correct') return [styles.optionButton, styles.optionCorrect];
      if (feedback === 'incorrect') return [styles.optionButton, styles.optionIncorrect];
      return [styles.optionButton, styles.optionSelected];
    }
    return [styles.optionButton, styles.optionIdle];
  };

  if (isEliminated) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <BrandHeader subtitle={t('quiz.play')} onBackPress={() => router.replace('/(tabs)')} />
        <View style={styles.centerState}>
          <View style={styles.eliminatedCard}>
            <Text style={styles.eliminatedIcon}>👀</Text>
            <Text style={styles.eliminatedTitle}>{t('quiz.eliminated')}</Text>
            <Text style={styles.eliminatedScore}>{t('quiz.score', { score })}</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!question) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <BrandHeader subtitle={t('quiz.play')} onBackPress={() => router.replace('/(tabs)')} />
        <View style={styles.centerState}>
          <View style={styles.waitCard}>
            <Text style={styles.waitIcon}>⏳</Text>
            <Text style={styles.waitText}>{t('quiz.waiting')}</Text>
            <Text style={styles.waitSubText}>{connectionState === 'connected' ? t('quiz.ready') : t('quiz.connecting')}</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <BrandHeader subtitle={t('quiz.play')} onBackPress={() => router.replace('/(tabs)')} />

      <View style={styles.content}>
        <View style={styles.connectionRow}>
          <Text style={[styles.connectionPill, { backgroundColor: connectionPill.bg, color: connectionPill.color }]}>
            {connectionPill.text}
          </Text>
        </View>

        <View style={styles.scoreboard}>
          <View style={styles.scoreItem}>
            <Text style={styles.scoreValue}>{score}</Text>
            <Text style={styles.scoreLabel}>{t('quiz.scoreLabel')}</Text>
          </View>
          <View style={styles.scoreItem}>
            <Text style={[styles.scoreValue, { color: palette.success }]}>{correctCount}</Text>
            <Text style={styles.scoreLabel}>{t('quiz.correct')}</Text>
          </View>
          <View style={styles.scoreItem}>
            <Text style={styles.scoreValue}>{question.current}/{question.total}</Text>
            <Text style={styles.scoreLabel}>{t('quiz.questionShort')}</Text>
          </View>
        </View>

        <View style={styles.questionCard}>
          <View style={styles.questionTopRow}>
            <Text style={styles.questionCounter}>
              {t('quiz.question', { current: question.current, total: question.total })}
            </Text>
            <View style={[styles.timerBadge, { backgroundColor: timerStyle.backgroundColor }]}>
              <Text style={[styles.timerText, { color: timerStyle.color }]}>{timeLeft}s</Text>
            </View>
          </View>

          <Text style={styles.questionText}>{question.text}</Text>

          <View style={styles.optionsList}>
            {question.options.map((option, index) => (
              <TouchableOpacity
                key={option.id}
                style={getOptionStyle(option.id)}
                onPress={() => handleAnswer(option.id)}
                disabled={selectedOption !== null}
              >
                <View style={styles.optionLetterWrap}>
                  <Text style={styles.optionLetter}>{String.fromCharCode(65 + index)}</Text>
                </View>
                <Text style={styles.optionText}>{option.text}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {feedback ? (
            <View style={feedback === 'correct' ? styles.feedbackOk : styles.feedbackBad}>
              <Text style={feedback === 'correct' ? styles.feedbackOkText : styles.feedbackBadText}>
                {feedback === 'correct' ? `✓ ${t('quiz.correct')}` : `✗ ${t('quiz.incorrect')}`}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  connectionRow: {
    alignItems: 'flex-start',
  },
  connectionPill: {
    fontSize: 11,
    fontWeight: '700',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    overflow: 'hidden',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  waitCard: {
    width: '100%',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.xs,
    ...shadow.card,
  },
  waitIcon: {
    fontSize: 44,
  },
  waitText: {
    color: palette.text,
    fontSize: 22,
    fontWeight: '700',
  },
  waitSubText: {
    color: palette.textMuted,
  },
  eliminatedCard: {
    width: '100%',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: '#fed7aa',
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.xs,
    ...shadow.card,
  },
  eliminatedIcon: {
    fontSize: 44,
  },
  eliminatedTitle: {
    color: '#9a3412',
    fontSize: 22,
    fontWeight: '800',
  },
  eliminatedScore: {
    color: '#b45309',
    fontSize: 16,
    fontWeight: '600',
  },
  scoreboard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    ...shadow.card,
  },
  scoreItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  scoreValue: {
    color: palette.text,
    fontSize: 20,
    fontWeight: '800',
  },
  scoreLabel: {
    color: palette.textMuted,
    fontSize: 11,
  },
  questionCard: {
    flex: 1,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    padding: spacing.lg,
    ...shadow.card,
  },
  questionTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  questionCounter: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
  },
  timerBadge: {
    borderRadius: radii.md,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  timerText: {
    fontSize: 18,
    fontWeight: '800',
  },
  questionText: {
    color: palette.text,
    fontSize: 21,
    fontWeight: '700',
    lineHeight: 29,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  optionsList: {
    gap: spacing.sm,
  },
  optionButton: {
    borderRadius: radii.md,
    borderWidth: 2,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  optionIdle: {
    borderColor: palette.border,
    backgroundColor: '#f8fafc',
  },
  optionSelected: {
    borderColor: '#fda4af',
    backgroundColor: '#fff1f2',
  },
  optionCorrect: {
    borderColor: '#86efac',
    backgroundColor: '#dcfce7',
  },
  optionIncorrect: {
    borderColor: '#fca5a5',
    backgroundColor: '#fee2e2',
  },
  optionLetterWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLetter: {
    color: '#475569',
    fontWeight: '700',
  },
  optionText: {
    flex: 1,
    color: palette.text,
    fontSize: 15,
    fontWeight: '600',
  },
  feedbackOk: {
    marginTop: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#86efac',
    backgroundColor: '#dcfce7',
    padding: spacing.sm,
    alignItems: 'center',
  },
  feedbackBad: {
    marginTop: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#fca5a5',
    backgroundColor: '#fee2e2',
    padding: spacing.sm,
    alignItems: 'center',
  },
  feedbackOkText: {
    color: '#166534',
    fontWeight: '700',
  },
  feedbackBadText: {
    color: '#991b1b',
    fontWeight: '700',
  },
});
