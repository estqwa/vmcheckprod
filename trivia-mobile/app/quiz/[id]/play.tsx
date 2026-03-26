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
import { useRouter } from 'expo-router';
import { hapticSelection, hapticSuccess, hapticWarning } from '../../../src/services/haptics';
import { useTranslation } from 'react-i18next';
import { type QuestionOption } from '@trivia/shared';
import { BrandHeader } from '../../../src/components/ui/BrandHeader';
import { AdBreakOverlay } from '../../../src/components/game/AdBreakOverlay';
import { ConnectionStatusPill } from '../../../src/components/ui/ConnectionStatusPill';
import { useQuizSession } from '../../../src/providers/QuizSessionProvider';
import { palette, radii, shadow, spacing } from '../../../src/theme/tokens';

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
  const [isResyncDelayed, setIsResyncDelayed] = useState(false);
  const {
    question,
    selectedOption,
    timeLeft,
    isEliminated,
    score,
    correctCount,
    playerCount,
    feedback,
    revealedCorrectOption,
    adBreak,
    showAdOverlay,
    reconnect,
    submitAnswer,
    dismissAdBreak,
    connectionState,
    isOffline,
  } = useQuizSession();

  useEffect(() => {
    if (question || isOffline || connectionState !== 'connected') {
      setIsResyncDelayed(false);
      return;
    }

    const timeoutId = setTimeout(() => {
      setIsResyncDelayed(true);
    }, 15000);

    return () => clearTimeout(timeoutId);
  }, [connectionState, isOffline, question]);

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
      if (submitAnswer(optionId)) {
        hapticSelection();
      }
    },
    [submitAnswer]
  );

  const timerTone = useMemo(() => {
    if (timeLeft <= 5) {
      return { badge: styles.timerBadgeDanger, text: styles.timerTextDanger };
    }
    return { badge: styles.timerBadgeNormal, text: styles.timerTextNormal };
  }, [timeLeft]);

  const displayedQuestion = useMemo(() => {
    if (!question) {
      return { text: '', options: [] as QuestionOption[] };
    }

    return getLocalizedQuestionData(
      {
        text: question.text,
        text_kk: question.textKK,
        options: question.options,
        options_kk: question.optionsKK,
      },
      i18n.language
    );
  }, [i18n.language, question]);

  const getOptionStyle = useCallback(
    (optionId: number) => {
      if (isEliminated && revealedCorrectOption === null) {
        return [styles.optionButton, styles.optionDisabled];
      }

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
    [feedback, isEliminated, revealedCorrectOption, selectedOption]
  );

  const renderOption = useCallback(
    ({ item, index }: ListRenderItemInfo<QuestionOption>) => {
      const isDisabled =
        selectedOption !== null ||
        revealedCorrectOption !== null ||
        isEliminated ||
        isOffline ||
        connectionState !== 'connected' ||
        showAdOverlay;

      return (
        <TouchableOpacity
          style={getOptionStyle(item.id)}
          onPress={() => handleAnswer(item.id)}
          disabled={isDisabled}
          accessibilityRole="button"
          accessibilityLabel={item.text}
          accessibilityState={{ disabled: isDisabled }}
        >
          <View style={styles.optionLetterWrap}>
            <Text style={styles.optionLetter}>{String.fromCharCode(65 + index)}</Text>
          </View>
          <Text style={styles.optionText}>{item.text}</Text>
        </TouchableOpacity>
      );
    },
    [connectionState, getOptionStyle, handleAnswer, isEliminated, isOffline, revealedCorrectOption, selectedOption, showAdOverlay]
  );

  const adOverlay = (
    <AdBreakOverlay
      adData={adBreak}
      isVisible={showAdOverlay}
      onAdEnd={dismissAdBreak}
    />
  );

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
              {isEliminated ? (
                <View style={styles.spectatorBanner}>
                  <Text style={styles.spectatorTitle}>{t('quiz.eliminated')}</Text>
                  <Text style={styles.spectatorHint}>{t('quiz.spectatorHint')}</Text>
                </View>
              ) : null}
              {isResyncDelayed ? (
                <View style={styles.waitActions}>
                  <Text style={styles.waitHint}>{t('quiz.reconnecting')}</Text>
                  <TouchableOpacity
                    style={styles.waitActionButton}
                    onPress={() => reconnect()}
                    accessibilityRole="button"
                    accessibilityLabel={t('common.retry')}
                  >
                    <Text style={styles.waitActionButtonText}>{t('common.retry')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.waitActionButton, styles.waitActionButtonSecondary]}
                    onPress={() => router.replace('/(tabs)')}
                    accessibilityRole="button"
                    accessibilityLabel={t('quiz.leaveLobby')}
                  >
                    <Text style={styles.waitActionButtonSecondaryText}>{t('quiz.leaveLobby')}</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
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
            {isEliminated ? (
              <View style={styles.spectatorBanner}>
                <Text style={styles.spectatorTitle}>{t('quiz.eliminated')}</Text>
                <Text style={styles.spectatorHint}>{t('quiz.spectatorHint')}</Text>
              </View>
            ) : null}

            <View style={styles.scoreboard} accessibilityRole="summary">
              <View style={styles.scoreItem} accessibilityLabel={`${t('quiz.scoreLabel')}: ${score}`}>
                <Text style={styles.scoreValue}>{score}</Text>
                <Text style={styles.scoreLabel}>{t('quiz.scoreLabel')}</Text>
              </View>
              <View style={styles.scoreItem} accessibilityLabel={`${t('quiz.correct')}: ${correctCount}`}>
                <Text style={[styles.scoreValue, styles.scoreValueSuccess]}>{correctCount}</Text>
                <Text style={styles.scoreLabel}>{t('quiz.correct')}</Text>
              </View>
              <View style={styles.scoreItem} accessibilityLabel={`${t('quiz.online')}: ${playerCount}`}>
                <Text style={styles.scoreValue}>{playerCount}</Text>
                <Text style={styles.scoreLabel}>{t('quiz.online')}</Text>
              </View>
            </View>

            <View style={styles.questionCard}>
              <View style={styles.questionTopRow}>
                <Text style={styles.questionCounter}>
                  {t('quiz.question', { current: question.current, total: question.total })}
                </Text>
                <View style={[styles.timerBadge, timerTone.badge]} accessibilityLiveRegion="polite" accessibilityLabel={`${timeLeft} ${t('common.secondsShort')}`}>
                  <Text style={[styles.timerText, timerTone.text]}>{timeLeft} {t('common.secondsShort')}</Text>
                </View>
              </View>

              <Text style={styles.questionText}>{displayedQuestion.text}</Text>

              <FlatList
                data={displayedQuestion.options}
                renderItem={renderOption}
                keyExtractor={(option) => String(option.id)}
                extraData={[selectedOption, revealedCorrectOption, isEliminated, isOffline, connectionState, showAdOverlay, feedback]}
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
  spectatorBanner: {
    width: '100%',
    marginTop: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#fed7aa',
    backgroundColor: '#fff7ed',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: 2,
  },
  spectatorTitle: {
    color: '#9a3412',
    fontSize: 14,
    fontWeight: '700',
  },
  spectatorHint: {
    color: '#b45309',
    fontSize: 13,
  },
  waitHint: {
    color: palette.textMuted,
    fontSize: 13,
    marginTop: spacing.xs,
  },
  waitActions: {
    width: '100%',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  waitActionButton: {
    minHeight: 44,
    borderRadius: radii.md,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waitActionButtonSecondary: {
    backgroundColor: palette.surfaceMuted,
    borderWidth: 1,
    borderColor: palette.border,
  },
  waitActionButtonText: {
    color: palette.white,
    fontWeight: '700',
  },
  waitActionButtonSecondaryText: {
    color: palette.text,
    fontWeight: '700',
  },
  scoreboard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    flexDirection: 'row',
    paddingVertical: spacing.md,
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
    fontSize: 12,
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
    fontSize: 14,
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
  optionDisabled: {
    borderColor: '#e5e7eb',
    backgroundColor: '#f3f4f6',
    opacity: 0.72,
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

