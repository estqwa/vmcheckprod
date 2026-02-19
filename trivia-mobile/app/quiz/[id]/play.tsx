import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { hapticSelection, hapticSuccess, hapticWarning } from '../../../src/services/haptics';
import { useTranslation } from 'react-i18next';
import {
  type AnswerResultEvent,
  type QuizAnswerRevealEvent,
  type QuizAdBreakEndEvent,
  type QuizAdBreakEvent,
  type QuizFinishEvent,
  type QuizStateEvent,
  WS_SERVER_EVENTS,
  isAnswerResultEvent,
  isEliminationEvent,
  isQuizAnswerRevealEvent,
  isQuizAdBreakEndEvent,
  isQuizAdBreakEvent,
  isQuizCancelledEvent,
  isQuizFinishEvent,
  isQuizQuestionEvent,
  isQuizStateQuestionEvent,
  isQuizStateEvent,
  isQuizTimerEvent,
  type QuestionOption,
  type WSServerMessage,
} from '@trivia/shared';
import { BrandHeader } from '../../../src/components/ui/BrandHeader';
import { AdBreakOverlay } from '../../../src/components/game/AdBreakOverlay';
import { ConnectionStatusPill } from '../../../src/components/ui/ConnectionStatusPill';
import { useAuth } from '../../../src/hooks/useAuth';
import { useQuizWS } from '../../../src/hooks/useQuizWS';
import { leaderboardQueryKey, userQueryKey } from '../../../src/hooks/useUserQuery';
import { palette, radii, shadow, spacing } from '../../../src/theme/tokens';

type QuestionState = {
  id: number;
  text: string;
  textKK?: string;
  options: QuestionOption[];
  optionsKK?: QuestionOption[];
  current: number;
  total: number;
};

type LocalizableQuestionPayload = {
  text: string;
  text_kk?: string;
  options: QuestionOption[];
  options_kk?: QuestionOption[];
};

function getLocalizedQuestionData(question: LocalizableQuestionPayload, language: string) {
  const isKazakh = language.startsWith('kk');
  const text = isKazakh && typeof question.text_kk === 'string' ? question.text_kk : question.text;
  const options = isKazakh && Array.isArray(question.options_kk) && question.options_kk.length > 0
    ? question.options_kk
    : question.options;

  return { text, options };
}

export default function PlayScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const quizId = Number(id);

  const [question, setQuestion] = useState<QuestionState | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isEliminated, setIsEliminated] = useState(false);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [revealedCorrectOption, setRevealedCorrectOption] = useState<number | null>(null);
  const [adBreak, setAdBreak] = useState<QuizAdBreakEvent | null>(null);
  const [showAdOverlay, setShowAdOverlay] = useState(false);

  const hideAdOverlay = useCallback(() => {
    setShowAdOverlay(false);
    setAdBreak(null);
  }, []);

  const invalidateUserAndLeaderboard = useCallback(() => {
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: userQueryKey }),
      queryClient.invalidateQueries({ queryKey: leaderboardQueryKey }),
    ]);
  }, [queryClient]);

  const handleSessionEnded = useCallback(async () => {
    await logout();
    router.replace('/(auth)/login');
  }, [logout, router]);

  const handleMessage = useCallback(
    (msg: WSServerMessage) => {
      if (msg.type === WS_SERVER_EVENTS.AD_BREAK && isQuizAdBreakEvent(msg.data)) {
        const adData = msg.data as QuizAdBreakEvent;
        if (adData.quiz_id === quizId) {
          setAdBreak(adData);
          setShowAdOverlay(true);
        }
        return;
      }

      if (msg.type === WS_SERVER_EVENTS.AD_BREAK_END && isQuizAdBreakEndEvent(msg.data)) {
        const adEnd = msg.data as QuizAdBreakEndEvent;
        if (adEnd.quiz_id === quizId) {
          hideAdOverlay();
        }
        return;
      }

      if (msg.type === WS_SERVER_EVENTS.QUESTION && isQuizQuestionEvent(msg.data)) {
        const localized = getLocalizedQuestionData(msg.data, i18n.language);
        setQuestion({
          id: msg.data.question_id,
          text: localized.text,
          textKK: msg.data.text_kk,
          options: msg.data.options,
          optionsKK: msg.data.options_kk,
          current: msg.data.number,
          total: msg.data.total_questions,
        });
        setSelectedOption(null);
        setFeedback(null);
        setRevealedCorrectOption(null);
        setTimeLeft(msg.data.time_limit);
        hideAdOverlay();
        return;
      }

      if (msg.type === WS_SERVER_EVENTS.TIMER && isQuizTimerEvent(msg.data)) {
        setTimeLeft(msg.data.remaining_seconds);
        return;
      }

      if (msg.type === WS_SERVER_EVENTS.ANSWER_RESULT && isAnswerResultEvent(msg.data)) {
        const answerData = msg.data as AnswerResultEvent;
        setFeedback(answerData.is_correct ? 'correct' : 'incorrect');
        setRevealedCorrectOption(answerData.correct_option);
        setScore((prev) => prev + answerData.points_earned);
        setCorrectCount((prev) => (answerData.is_correct ? prev + 1 : prev));
        if (answerData.is_eliminated) {
          setIsEliminated(true);
        }
        return;
      }

      if (msg.type === WS_SERVER_EVENTS.ANSWER_REVEAL && isQuizAnswerRevealEvent(msg.data)) {
        const revealData = msg.data as QuizAnswerRevealEvent;
        setRevealedCorrectOption(revealData.correct_option);
        return;
      }

      if (msg.type === WS_SERVER_EVENTS.ELIMINATION && isEliminationEvent(msg.data)) {
        setIsEliminated(true);
        return;
      }

      if (msg.type === WS_SERVER_EVENTS.STATE && isQuizStateEvent(msg.data)) {
        const stateData = msg.data as QuizStateEvent;
        if (stateData.status === 'completed') {
          hideAdOverlay();
          invalidateUserAndLeaderboard();
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
          if (isQuizStateQuestionEvent(currentQuestion)) {
            const localized = getLocalizedQuestionData(currentQuestion, i18n.language);
            setQuestion({
              id: currentQuestion.question_id,
              text: localized.text,
              textKK: currentQuestion.text_kk,
              options: currentQuestion.options,
              optionsKK: currentQuestion.options_kk,
              current: currentQuestion.number,
              total: currentQuestion.total_questions,
            });
            if (typeof stateData.time_remaining !== 'number') {
              setTimeLeft(currentQuestion.time_limit);
            }
            setRevealedCorrectOption(null);
            hideAdOverlay();
          }
        }
        return;
      }

      if (msg.type === WS_SERVER_EVENTS.FINISH && isQuizFinishEvent(msg.data)) {
        const finishData = msg.data as QuizFinishEvent;
        if (finishData.quiz_id === quizId) {
          hideAdOverlay();
          invalidateUserAndLeaderboard();
          router.replace(`/quiz/${quizId}/results`);
        }
        return;
      }

      if (msg.type === WS_SERVER_EVENTS.RESULTS_AVAILABLE) {
        hideAdOverlay();
        invalidateUserAndLeaderboard();
        router.replace(`/quiz/${quizId}/results`);
        return;
      }

      if (msg.type === WS_SERVER_EVENTS.CANCELLED && isQuizCancelledEvent(msg.data)) {
        if (msg.data.quiz_id === quizId) {
          hideAdOverlay();
          router.replace('/(tabs)');
        }
      }
    },
    [hideAdOverlay, i18n.language, invalidateUserAndLeaderboard, quizId, router]
  );

  const { sendAnswer, connectionState, isOffline } = useQuizWS({
    quizId,
    enabled: Number.isFinite(quizId) && quizId > 0,
    onMessage: handleMessage,
    onSessionEnded: handleSessionEnded,
  });

  useEffect(() => {
    if (feedback === 'correct') {
      hapticSuccess();
      return;
    }
    if (feedback === 'incorrect') {
      hapticWarning();
    }
  }, [feedback]);

  const handleAnswer = useCallback(
    (optionId: number) => {
      if (
        selectedOption !== null ||
        revealedCorrectOption !== null ||
        isEliminated ||
        !question ||
        isOffline ||
        connectionState !== 'connected' ||
        showAdOverlay
      ) {
        return;
      }
      setSelectedOption(optionId);
      hapticSelection();
      sendAnswer(question.id, optionId);
    },
    [connectionState, isEliminated, isOffline, question, revealedCorrectOption, selectedOption, sendAnswer, showAdOverlay]
  );

  const timerTone = useMemo(() => {
    if (timeLeft <= 5) {
      return { badge: styles.timerBadgeDanger, text: styles.timerTextDanger };
    }
    return { badge: styles.timerBadgeNormal, text: styles.timerTextNormal };
  }, [timeLeft]);



  const displayedQuestionText = useMemo(() => {
    if (!question) return '';
    if (i18n.language.startsWith('kk') && question.textKK) {
      return question.textKK;
    }
    return question.text;
  }, [i18n.language, question]);

  const displayedOptions = useMemo(() => {
    if (!question) return [];
    if (i18n.language.startsWith('kk') && question.optionsKK && question.optionsKK.length > 0) {
      return question.optionsKK;
    }
    return question.options;
  }, [i18n.language, question]);

  const getOptionStyle = useCallback(
    (optionId: number) => {
      if (revealedCorrectOption !== null) {
        if (optionId === revealedCorrectOption) {
          return [styles.optionButton, styles.optionCorrect];
        }
        if (selectedOption !== null && optionId === selectedOption && selectedOption !== revealedCorrectOption) {
          return [styles.optionButton, styles.optionIncorrect];
        }
        return [styles.optionButton, styles.optionIdle];
      }

      if (selectedOption === null) return [styles.optionButton, styles.optionIdle];
      if (optionId === selectedOption) {
        if (feedback === 'correct') return [styles.optionButton, styles.optionCorrect];
        if (feedback === 'incorrect') return [styles.optionButton, styles.optionIncorrect];
        return [styles.optionButton, styles.optionSelected];
      }
      return [styles.optionButton, styles.optionIdle];
    },
    [feedback, revealedCorrectOption, selectedOption]
  );

  const renderOption = useCallback(
    ({ item, index }: ListRenderItemInfo<QuestionOption>) => (
      <TouchableOpacity
        style={getOptionStyle(item.id)}
        onPress={() => handleAnswer(item.id)}
        disabled={selectedOption !== null || revealedCorrectOption !== null || isOffline || connectionState !== 'connected' || showAdOverlay}
        accessibilityRole="button"
        accessibilityLabel={item.text}
        accessibilityState={{ disabled: selectedOption !== null || revealedCorrectOption !== null || isOffline || connectionState !== 'connected' || showAdOverlay }}
      >
        <View style={styles.optionLetterWrap}>
          <Text style={styles.optionLetter}>{String.fromCharCode(65 + index)}</Text>
        </View>
        <Text style={styles.optionText}>{item.text}</Text>
      </TouchableOpacity>
    ),
    [connectionState, getOptionStyle, handleAnswer, isOffline, revealedCorrectOption, selectedOption, showAdOverlay]
  );

  const adOverlay = (
    <AdBreakOverlay
      adData={adBreak}
      isVisible={showAdOverlay}
      onAdEnd={hideAdOverlay}
    />
  );

  if (isEliminated) {
    return (
      <>
        {adOverlay}
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <BrandHeader subtitle={t('quiz.play')} onBackPress={() => router.replace('/(tabs)')} />
          <View style={styles.centerState}>
            <View style={styles.eliminatedCard}>
              <Text style={styles.eliminatedIcon}>OUT</Text>
              <Text style={styles.eliminatedTitle}>{t('quiz.eliminated')}</Text>
              <Text style={styles.eliminatedScore}>{t('quiz.score', { score })}</Text>
            </View>
          </View>
        </SafeAreaView>
      </>
    );
  }

  if (!question) {
    return (
      <>
        {adOverlay}
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <BrandHeader subtitle={t('quiz.play')} onBackPress={() => router.replace('/(tabs)')} />
          <View style={styles.centerState}>
            <View style={styles.waitCard}>
              <Text style={styles.waitIcon}>...</Text>
              <Text style={styles.waitText}>{t('quiz.waiting')}</Text>
              <Text style={styles.waitSubText}>{connectionState === 'connected' ? t('quiz.ready') : t('quiz.connecting')}</Text>
            </View>
          </View>
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      {adOverlay}
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <BrandHeader subtitle={t('quiz.play')} onBackPress={() => router.replace('/(tabs)')} />

        <ScrollView contentContainerStyle={styles.contentScroll}>
          <View style={styles.content}>
            <View style={styles.connectionRow}>
              <ConnectionStatusPill connectionState={connectionState} isOffline={isOffline} />
            </View>

            <View style={styles.scoreboard} accessibilityRole="summary">
              <View style={styles.scoreItem} accessibilityLabel={`${t('quiz.scoreLabel')}: ${score}`}>
                <Text style={styles.scoreValue}>{score}</Text>
                <Text style={styles.scoreLabel}>{t('quiz.scoreLabel')}</Text>
              </View>
              <View style={styles.scoreItem} accessibilityLabel={`${t('quiz.correct')}: ${correctCount}`}>
                <Text style={[styles.scoreValue, styles.scoreValueSuccess]}>{correctCount}</Text>
                <Text style={styles.scoreLabel}>{t('quiz.correct')}</Text>
              </View>
              <View style={styles.scoreItem} accessibilityLabel={`${t('quiz.questionShort')}: ${question.current}/${question.total}`}>
                <Text style={styles.scoreValue}>{question.current}/{question.total}</Text>
                <Text style={styles.scoreLabel}>{t('quiz.questionShort')}</Text>
              </View>
            </View>

            <View style={styles.questionCard}>
              <View style={styles.questionTopRow}>
                <Text style={styles.questionCounter}>
                  {t('quiz.question', { current: question.current, total: question.total })}
                </Text>
                <View style={[styles.timerBadge, timerTone.badge]} accessibilityLiveRegion="polite" accessibilityLabel={`${timeLeft} seconds`}>
                  <Text style={[styles.timerText, timerTone.text]}>{timeLeft}s</Text>
                </View>
              </View>

              <Text style={styles.questionText}>{displayedQuestionText}</Text>

              <FlatList
                data={displayedOptions}
                renderItem={renderOption}
                keyExtractor={(option) => String(option.id)}
                scrollEnabled={false}
                contentContainerStyle={styles.optionsList}
              />

              {feedback ? (
                <View style={feedback === 'correct' ? styles.feedbackOk : styles.feedbackBad}>
                  <Text style={feedback === 'correct' ? styles.feedbackOkText : styles.feedbackBadText}>
                    {feedback === 'correct' ? t('quiz.correct') : t('quiz.incorrect')}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
  },
  contentScroll: {
    flexGrow: 1,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  content: {
    gap: spacing.md,
  },
  connectionRow: {
    alignItems: 'flex-start',
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
    fontSize: 34,
    fontWeight: '700',
    color: '#64748b',
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
    color: '#9a3412',
    fontSize: 24,
    fontWeight: '800',
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
  scoreValueSuccess: {
    color: palette.success,
  },
  scoreLabel: {
    color: palette.textMuted,
    fontSize: 11,
  },
  questionCard: {
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
  timerBadgeNormal: {
    backgroundColor: '#f3f4f6',
  },
  timerBadgeDanger: {
    backgroundColor: '#fee2e2',
  },
  timerText: {
    fontSize: 18,
    fontWeight: '800',
  },
  timerTextNormal: {
    color: '#1f2937',
  },
  timerTextDanger: {
    color: '#b91c1c',
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
