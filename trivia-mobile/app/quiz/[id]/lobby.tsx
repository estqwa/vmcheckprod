import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import {
  WS_SERVER_EVENTS,
  isQuizCancelledEvent,
  isQuizFinishEvent,
  isQuizStateQuestionEvent,
  isQuizStateEvent,
  type QuizStateEvent,
  type WSServerMessage,
} from '@trivia/shared';
import { getQuiz } from '../../../src/api/quizzes';
import { BrandHeader } from '../../../src/components/ui/BrandHeader';
import { TimerBlock } from '../../../src/components/ui/TimerBlock';
import { useAuth } from '../../../src/hooks/useAuth';
import { useQuizWS } from '../../../src/hooks/useQuizWS';
import { ConnectionStatusPill } from '../../../src/components/ui/ConnectionStatusPill';
import { leaderboardQueryKey, userQueryKey } from '../../../src/hooks/useUserQuery';
import { palette, radii, shadow, spacing, typography } from '../../../src/theme/tokens';
import { getCountdown } from '../../../src/utils/time';
import { formatCurrency } from '../../../src/utils/format';



export default function LobbyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const quizId = Number(id);

  const [playerCount, setPlayerCount] = useState(0);
  const [countdown, setCountdown] = useState({ hours: '00', minutes: '00', seconds: '00' });

  const { data: quiz, isLoading } = useQuery({
    queryKey: ['quiz', quizId],
    queryFn: () => getQuiz(quizId),
    enabled: Number.isFinite(quizId) && quizId > 0,
  });

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

  useEffect(() => {
    if (!quiz?.scheduled_time) {
      setCountdown({ hours: '00', minutes: '00', seconds: '00' });
      return;
    }

    const update = () => setCountdown(getCountdown(quiz.scheduled_time));
    update();
    const timer = setInterval(update, 1000);

    return () => clearInterval(timer);
  }, [quiz?.scheduled_time]);

  const handleMessage = useCallback(
    (msg: WSServerMessage) => {
      if (msg.type === WS_SERVER_EVENTS.PLAYER_COUNT || msg.type === WS_SERVER_EVENTS.USER_READY) {
        const count = Number(msg.data.player_count);
        if (Number.isFinite(count)) {
          setPlayerCount(count);
        }
      }

      if (msg.type === WS_SERVER_EVENTS.STATE && isQuizStateEvent(msg.data)) {
        const state = msg.data as QuizStateEvent;
        if (typeof state.player_count === 'number') {
          setPlayerCount(state.player_count);
        }

        if (state.current_question && isQuizStateQuestionEvent(state.current_question)) {
          router.replace(`/quiz/${quizId}/play`);
          return;
        }

        if (state.status === 'in_progress') {
          router.replace(`/quiz/${quizId}/play`);
          return;
        }

        if (state.status === 'completed') {
          invalidateUserAndLeaderboard();
          router.replace(`/quiz/${quizId}/results`);
          return;
        }
      }

      if (msg.type === WS_SERVER_EVENTS.FINISH && isQuizFinishEvent(msg.data)) {
        invalidateUserAndLeaderboard();
        router.replace(`/quiz/${quizId}/results`);
        return;
      }

      if (msg.type === WS_SERVER_EVENTS.RESULTS_AVAILABLE) {
        invalidateUserAndLeaderboard();
        router.replace(`/quiz/${quizId}/results`);
        return;
      }

      if (msg.type === WS_SERVER_EVENTS.CANCELLED && isQuizCancelledEvent(msg.data)) {
        if (msg.data.quiz_id === quizId) {
          router.replace('/(tabs)');
        }
        return;
      }

      if (msg.type === WS_SERVER_EVENTS.QUESTION || msg.type === WS_SERVER_EVENTS.START) {
        router.replace(`/quiz/${quizId}/play`);
      }
    },
    [invalidateUserAndLeaderboard, quizId, router]
  );

  const { connectionState, isConnected, isOffline } = useQuizWS({
    quizId,
    enabled: Number.isFinite(quizId) && quizId > 0,
    onMessage: handleMessage,
    onSessionEnded: handleSessionEnded,
  });



  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <BrandHeader subtitle={t('quiz.lobby')} onBackPress={() => router.replace('/(tabs)')} />
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={palette.primary} />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <BrandHeader
        subtitle={quiz?.title ?? t('quiz.lobby')}
        onBackPress={() => router.replace('/(tabs)')}
        rightSlot={<ConnectionStatusPill connectionState={connectionState} isOffline={isOffline} />}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <View style={styles.mainCard}>
            <View style={styles.iconWrap} accessibilityElementsHidden>
              <Ionicons name="flag" size={30} color={palette.primary} />
            </View>

            <Text style={styles.quizTitle}>{quiz?.title ?? `Quiz #${quizId}`}</Text>
            {quiz?.description ? <Text style={styles.quizDescription}>{quiz.description}</Text> : null}

            <Text style={styles.startsInLabel}>{t('quiz.startsIn')}</Text>
            <View style={styles.timerRow}>
              <TimerBlock value={countdown.hours} label={t('quiz.hours')} />
              <TimerBlock value={countdown.minutes} label={t('quiz.minutes')} />
              <TimerBlock value={countdown.seconds} label={t('quiz.seconds')} />
            </View>

            <View style={styles.statsRow} accessibilityRole="summary">
              <View style={styles.statBox} accessibilityLabel={`${t('quiz.online')}: ${playerCount}`}>
                <Text style={styles.statValue}>{playerCount}</Text>
                <Text style={styles.statLabel}>{t('quiz.online')}</Text>
              </View>
              <View style={styles.statBox} accessibilityLabel={`${t('quiz.questions')}: ${quiz?.question_count ?? 0}`}>
                <Text style={styles.statValue}>{quiz?.question_count ?? 0}</Text>
                <Text style={styles.statLabel}>{t('quiz.questions')}</Text>
              </View>
              <View style={styles.statBox} accessibilityLabel={`${t('quiz.prizeFund')}: ${formatCurrency(quiz?.prize_fund ?? 0)}`}>
                <Text style={styles.prizeValue}>{formatCurrency(quiz?.prize_fund ?? 0)}</Text>
                <Text style={styles.statLabel}>{t('quiz.prizeFund')}</Text>
              </View>
            </View>

            {isConnected ? (
              <View style={styles.okStateBox}>
                <Text style={styles.okStateTitle}>{t('quiz.ready')}</Text>
                <Text style={styles.okStateDesc}>{t('quiz.waiting')}</Text>
              </View>
            ) : (
              <View style={styles.warnStateBox}>
                <Text style={styles.warnStateTitle}>{isOffline ? t('quiz.offline') : t('quiz.connecting')}</Text>
                <Text style={styles.warnStateDesc}>{t('quiz.reconnecting')}</Text>
              </View>
            )}
          </View>

          <TouchableOpacity style={styles.leaveButton} onPress={() => router.replace('/(tabs)')}>
            <Text style={styles.leaveButtonText}>{t('quiz.leaveLobby')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.lg,
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    color: palette.textMuted,
  },

  content: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.lg,
  },
  mainCard: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.md,
    ...shadow.card,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: radii.xl,
    backgroundColor: palette.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  quizTitle: {
    ...typography.sectionTitle,
    textAlign: 'center',
  },
  quizDescription: {
    color: palette.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  startsInLabel: {
    color: palette.textMuted,
    textAlign: 'center',
    fontSize: 13,
  },
  timerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  statValue: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '800',
  },
  prizeValue: {
    color: palette.prize,
    fontSize: 15,
    fontWeight: '800',
  },
  statLabel: {
    color: palette.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  okStateBox: {
    backgroundColor: '#dcfce7',
    borderColor: '#bbf7d0',
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: 'center',
    gap: 2,
  },
  okStateTitle: {
    color: '#166534',
    fontWeight: '700',
  },
  okStateDesc: {
    color: '#15803d',
    fontSize: 12,
  },
  warnStateBox: {
    backgroundColor: '#ffedd5',
    borderColor: '#fed7aa',
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: 'center',
    gap: 2,
  },
  warnStateTitle: {
    color: '#9a3412',
    fontWeight: '700',
  },
  warnStateDesc: {
    color: '#c2410c',
    fontSize: 12,
  },
  leaveButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
  },
  leaveButtonText: {
    color: '#64748b',
    fontWeight: '700',
  },
});


