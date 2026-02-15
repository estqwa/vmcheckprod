import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  WS_SERVER_EVENTS,
  isQuizFinishEvent,
  isQuizQuestionEvent,
  isQuizStateEvent,
  type QuizStateEvent,
  type WSServerMessage,
} from '@trivia/shared';
import { getQuiz } from '../../../src/api/quizzes';
import { BrandHeader } from '../../../src/components/ui/BrandHeader';
import { TimerBlock } from '../../../src/components/ui/TimerBlock';
import { useQuizWS } from '../../../src/hooks/useQuizWS';
import { palette, radii, shadow, spacing, typography } from '../../../src/theme/tokens';

function getCountdown(targetDate: string) {
  const target = new Date(targetDate).getTime();
  const now = Date.now();
  const diff = Math.max(0, target - now);

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return {
    hours: String(hours).padStart(2, '0'),
    minutes: String(minutes).padStart(2, '0'),
    seconds: String(seconds).padStart(2, '0'),
  };
}

export default function LobbyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const quizId = Number(id);

  const [playerCount, setPlayerCount] = useState(0);
  const [countdown, setCountdown] = useState({ hours: '00', minutes: '00', seconds: '00' });

  const { data: quiz, isLoading } = useQuery({
    queryKey: ['quiz', quizId],
    queryFn: () => getQuiz(quizId),
    enabled: Number.isFinite(quizId) && quizId > 0,
  });

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

        if (state.current_question && isQuizQuestionEvent(state.current_question)) {
          router.replace(`/quiz/${quizId}/play`);
          return;
        }

        if (state.status === 'in_progress') {
          router.replace(`/quiz/${quizId}/play`);
          return;
        }

        if (state.status === 'completed') {
          router.replace(`/quiz/${quizId}/results`);
          return;
        }
      }

      if (msg.type === WS_SERVER_EVENTS.FINISH && isQuizFinishEvent(msg.data)) {
        router.replace(`/quiz/${quizId}/results`);
        return;
      }

      if (msg.type === WS_SERVER_EVENTS.QUESTION || msg.type === WS_SERVER_EVENTS.START) {
        router.replace(`/quiz/${quizId}/play`);
      }
    },
    [quizId, router]
  );

  const { connectionState, isConnected } = useQuizWS({
    quizId,
    enabled: Number.isFinite(quizId) && quizId > 0,
    onMessage: handleMessage,
  });

  const statusPill = useMemo(() => {
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

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <BrandHeader subtitle={t('quiz.lobby')} onBackPress={() => router.back()} />
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
        rightSlot={<Text style={[styles.statusPill, { backgroundColor: statusPill.bg, color: statusPill.color }]}>{statusPill.text}</Text>}
      />

      <View style={styles.content}>
        <View style={styles.mainCard}>
          <View style={styles.iconWrap}>
            <Text style={styles.icon}>🎮</Text>
          </View>

          <Text style={styles.quizTitle}>{quiz?.title ?? `Quiz #${quizId}`}</Text>
          {quiz?.description ? <Text style={styles.quizDescription}>{quiz.description}</Text> : null}

          <Text style={styles.startsInLabel}>{t('quiz.startsIn')}</Text>
          <View style={styles.timerRow}>
            <TimerBlock value={countdown.hours} label={t('quiz.hours')} />
            <TimerBlock value={countdown.minutes} label={t('quiz.minutes')} />
            <TimerBlock value={countdown.seconds} label={t('quiz.seconds')} />
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{playerCount}</Text>
              <Text style={styles.statLabel}>{t('quiz.online')}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{quiz?.question_count ?? 0}</Text>
              <Text style={styles.statLabel}>{t('quiz.questions')}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.prizeValue}>{quiz?.prize_fund?.toLocaleString() ?? 0} тг</Text>
              <Text style={styles.statLabel}>{t('quiz.prizeFund')}</Text>
            </View>
          </View>

          {isConnected ? (
            <View style={styles.okStateBox}>
              <Text style={styles.okStateTitle}>✓ {t('quiz.ready')}</Text>
              <Text style={styles.okStateDesc}>{t('quiz.waiting')}</Text>
            </View>
          ) : (
            <View style={styles.warnStateBox}>
              <Text style={styles.warnStateTitle}>{t('quiz.connecting')}</Text>
              <Text style={styles.warnStateDesc}>{t('quiz.reconnecting')}</Text>
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.leaveButton} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.leaveButtonText}>← {t('quiz.leaveLobby')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
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
  statusPill: {
    fontSize: 11,
    fontWeight: '700',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    padding: spacing.lg,
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
  icon: {
    fontSize: 30,
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
