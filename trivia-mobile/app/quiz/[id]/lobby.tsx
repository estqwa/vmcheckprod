import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { getQuiz } from '../../../src/api/quizzes';
import { BrandHeader } from '../../../src/components/ui/BrandHeader';
import { CountdownTile } from '../../../src/components/ui/CountdownTile';
import { StateBanner } from '../../../src/components/ui/StateBanner';
import { StatTile } from '../../../src/components/ui/StatTile';
import { ConnectionStatusPill } from '../../../src/components/ui/ConnectionStatusPill';
import { useQuizSession } from '../../../src/providers/QuizSessionProvider';
import { palette, radii, shadow, spacing, typography } from '../../../src/theme/tokens';
import { getCountdown } from '../../../src/utils/time';
import { formatCurrency } from '../../../src/utils/format';

export default function LobbyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const quizId = Number(id);
  const [countdown, setCountdown] = useState({ days: '00', hours: '00', minutes: '00', seconds: '00' });
  const { connectionState, isConnected, isOffline, playerCount, question } = useQuizSession();

  const { data: quiz, isLoading } = useQuery({
    queryKey: ['quiz', quizId],
    queryFn: () => getQuiz(quizId),
    enabled: Number.isFinite(quizId) && quizId > 0,
  });

  useEffect(() => {
    if (!quiz?.scheduled_time) {
      setCountdown({ days: '00', hours: '00', minutes: '00', seconds: '00' });
      return;
    }

    const update = () => setCountdown(getCountdown(quiz.scheduled_time));
    update();
    const timer = setInterval(update, 1000);

    return () => clearInterval(timer);
  }, [quiz?.scheduled_time]);

  useEffect(() => {
    if (!question) {
      return;
    }

    router.replace(`/quiz/${quizId}/play`);
  }, [question, quizId, router]);

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

            <Text style={styles.quizTitle}>{quiz?.title ?? t('quiz.fallbackTitle', { id: quizId })}</Text>
            {quiz?.description ? <Text style={styles.quizDescription}>{quiz.description}</Text> : null}

            <Text style={styles.startsInLabel}>{t('quiz.startsIn')}</Text>
            <View style={styles.timerRow}>
              <CountdownTile value={countdown.days} label={t('quiz.days')} style={styles.timerTile} />
              <CountdownTile value={countdown.hours} label={t('quiz.hours')} style={styles.timerTile} />
              <CountdownTile value={countdown.minutes} label={t('quiz.minutes')} style={styles.timerTile} />
              <CountdownTile value={countdown.seconds} label={t('quiz.seconds')} style={styles.timerTile} />
            </View>

            <View style={styles.statsRow} accessibilityRole="summary">
              <StatTile
                label={t('quiz.online')}
                value={playerCount}
                size="compact"
                style={styles.statTile}
              />
              <StatTile
                label={t('quiz.questions')}
                value={quiz?.question_count ?? 0}
                tone="primary"
                size="compact"
                style={styles.statTile}
              />
              <StatTile
                label={t('quiz.prizeFund')}
                value={formatCurrency(quiz?.prize_fund ?? 0)}
                tone="success"
                size="compact"
                style={styles.statTile}
              />
            </View>

            {(quiz?.prize_fund ?? 0) > 0 ? (
              <View style={styles.prizeNoticeCard}>
                <Text style={styles.prizeNoticeTitle}>{t('quiz.prizeNoticeTitle')}</Text>
                <Text style={styles.prizeNoticeText}>{t('quiz.prizeNoticeText')}</Text>
                <TouchableOpacity onPress={() => router.push('/official-rules' as Href)} accessibilityRole="link">
                  <Text style={styles.prizeNoticeLink}>{t('legal.officialRulesLink')}</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <StateBanner
              tone={isConnected ? 'success' : isOffline ? 'offline' : 'warning'}
              title={isConnected ? t('quiz.ready') : isOffline ? t('quiz.offline') : t('quiz.connecting')}
              description={isConnected ? t('quiz.waiting') : t('quiz.reconnecting')}
            />
          </View>

          <TouchableOpacity style={styles.leaveButton} onPress={() => router.replace('/(tabs)')} accessibilityRole="button" accessibilityLabel={t('quiz.leaveLobby')}>
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
  timerTile: {
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statTile: {
    flex: 1,
  },
  prizeNoticeCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.accentSurface,
    padding: spacing.md,
    gap: spacing.xs,
  },
  prizeNoticeTitle: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '700',
  },
  prizeNoticeText: {
    color: palette.textMuted,
    lineHeight: 20,
  },
  prizeNoticeLink: {
    color: palette.primary,
    fontSize: 13,
    fontWeight: '700',
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

