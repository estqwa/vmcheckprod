import { useEffect, useMemo, useCallback, useState, type ReactElement, memo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { Quiz } from '@trivia/shared';
import { getUpcomingQuizzes } from '../../src/api/quizzes';
import { BrandHeader } from '../../src/components/ui/BrandHeader';
import { TimerBlock } from '../../src/components/ui/TimerBlock';
import { palette, radii, shadow, spacing, typography } from '../../src/theme/tokens';
import { getCountdown } from '../../src/utils/time';
import { formatCurrency } from '../../src/utils/format';



function sortQuizzes(quizzes: Quiz[]): Quiz[] {
  return [...quizzes].sort(
    (a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime()
  );
}

function getQuizStatusStyles(status: string) {
  switch (status) {
    case 'in_progress':
      return {
        pill: styles.statusPillInProgress,
        text: styles.statusPillInProgressText,
      };
    case 'scheduled':
      return {
        pill: styles.statusPillScheduled,
        text: styles.statusPillScheduledText,
      };
    case 'completed':
      return {
        pill: styles.statusPillCompleted,
        text: styles.statusPillCompletedText,
      };
    case 'cancelled':
      return {
        pill: styles.statusPillCancelled,
        text: styles.statusPillCancelledText,
      };
    default:
      return {
        pill: styles.statusPillDefault,
        text: styles.statusPillDefaultText,
      };
  }
}

/** Countdown-таймер. Обновляется раз в секунду, не вызывая ререндер родителя. */
const UpcomingCountdown = memo(function UpcomingCountdown({ scheduledTime }: { scheduledTime: string }) {
  const { t } = useTranslation();
  const [cd, setCd] = useState(() => getCountdown(scheduledTime));

  useEffect(() => {
    const update = () => setCd(getCountdown(scheduledTime));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [scheduledTime]);

  return (
    <>
      <Text style={styles.countdownLabel}>{t('home.startsIn')}</Text>
      <View style={styles.timerRow}>
        <TimerBlock value={cd.days} label={t('quiz.days')} />
        <TimerBlock value={cd.hours} label={t('quiz.hours')} />
        <TimerBlock value={cd.minutes} label={t('quiz.minutes')} />
        <TimerBlock value={cd.seconds} label={t('quiz.seconds')} />
      </View>
    </>
  );
});

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const { data: rawQuizzes = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['quizzes', 'upcoming'],
    queryFn: getUpcomingQuizzes,
  });

  const quizzes = useMemo(() => sortQuizzes(rawQuizzes), [rawQuizzes]);

  const upcomingQuiz = useMemo(
    () => quizzes.find((quiz) => new Date(quiz.scheduled_time).getTime() > Date.now()) ?? null,
    [quizzes]
  );


  const renderQuizCard = useCallback(
    ({ item }: ListRenderItemInfo<Quiz>) => {
      const statusStyles = getQuizStatusStyles(item.status);

      return (
        <TouchableOpacity style={styles.quizCard} onPress={() => router.push(`/quiz/${item.id}/lobby`)} accessibilityRole="button" accessibilityLabel={item.title}>
          <View style={styles.quizCardTop}>
            <Text style={styles.quizCardTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <View style={[styles.statusPill, statusStyles.pill]}>
              <Text style={[styles.statusPillText, statusStyles.text]}>{t(`quiz.status_${item.status}`, { defaultValue: item.status })}</Text>
            </View>
          </View>

          {item.description ? (
            <Text style={styles.quizCardDescription} numberOfLines={2}>
              {item.description}
            </Text>
          ) : null}

          <View style={styles.quizCardBottom}>
            <Text style={styles.quizCardMeta}>Q {item.question_count} {t('quiz.questions')}</Text>
            <Text style={styles.quizCardMeta}>{new Date(item.scheduled_time).toLocaleString()}</Text>
          </View>
        </TouchableOpacity>
      );
    },
    [router, t]
  );

  const headerContent = useMemo(
    () => (
      <View style={styles.headerWrap}>
        <View style={styles.heroBlock}>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>{t('home.liveQuiz')}</Text>
          </View>

          <Text style={styles.heroTitle}>{t('home.welcome')}</Text>
          <Text style={styles.heroSubtitle}>{t('home.description')}</Text>

          {upcomingQuiz ? (
            <TouchableOpacity style={styles.primaryCta} onPress={() => router.push(`/quiz/${upcomingQuiz.id}/lobby`)}>
              <Text style={styles.primaryCtaText}>{t('home.joinNow')}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.noQuizBox}>
              <Text style={styles.noQuizIcon}>QZ</Text>
              <Text style={styles.noQuizTitle}>{t('home.noQuizzes')}</Text>
              <Text style={styles.noQuizSubtitle}>{t('home.waiting')}</Text>
            </View>
          )}

          <View style={styles.howToBlock}>
            <Text style={styles.howToTitle}>{t('home.howToPlay')}</Text>
            <View style={styles.howToRow}>
              <Text style={styles.howToNum}>1.</Text>
              <Text style={styles.howToText}>{t('home.step1')}</Text>
            </View>
            <View style={styles.howToRow}>
              <Text style={styles.howToNum}>2.</Text>
              <Text style={styles.howToText}>{t('home.step2')}</Text>
            </View>
            <View style={styles.howToRow}>
              <Text style={styles.howToNum}>3.</Text>
              <Text style={styles.howToText}>{t('home.step3')}</Text>
            </View>
          </View>
        </View>

        {upcomingQuiz ? (
          <View style={styles.nextQuizCard}>
            <View style={styles.nextQuizHeader}>
              <View style={styles.nextQuizTitleWrap}>
                <View style={styles.nextQuizIconBox}>
                  <Text style={styles.nextQuizIcon}>Q</Text>
                </View>
                <View style={styles.flexOne}>
                  <Text style={styles.nextQuizTitle} numberOfLines={1}>
                    {upcomingQuiz.title}
                  </Text>
                  <Text style={styles.nextQuizMeta}>{t('home.nextQuiz')}</Text>
                </View>
              </View>
              <View>
                <Text style={styles.prizeValue}>{formatCurrency(upcomingQuiz.prize_fund)}</Text>
                <Text style={styles.prizeLabel}>{t('home.prizeFund')}</Text>
              </View>
            </View>

            {upcomingQuiz.description ? (
              <Text style={styles.nextQuizDescription}>{upcomingQuiz.description}</Text>
            ) : null}

            <UpcomingCountdown scheduledTime={upcomingQuiz.scheduled_time} />

            <TouchableOpacity style={styles.secondaryCta} onPress={() => router.push(`/quiz/${upcomingQuiz.id}/lobby`)}>
              <Text style={styles.secondaryCtaText}>{t('home.openLobby')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.listSection}>
          <Text style={styles.listTitle}>{t('home.upcoming')}</Text>
        </View>
      </View>
    ),
    [router, t, upcomingQuiz]
  );

  const emptyContent = useMemo(
    () => (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyText}>{t('home.noQuizzes')}</Text>
      </View>
    ),
    [t]
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <BrandHeader subtitle={t('home.title')} />
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={palette.primary} />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <BrandHeader subtitle={t('home.title')} />

      <FlatList
        data={quizzes}
        renderItem={renderQuizCard}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={headerContent as ReactElement}
        ListEmptyComponent={emptyContent as ReactElement}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={palette.primary} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  headerWrap: {
    gap: spacing.lg,
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    color: palette.textMuted,
    fontSize: 14,
  },
  heroBlock: {
    gap: spacing.md,
  },
  liveBadge: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: palette.accentSurface,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.primary,
  },
  liveText: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  heroTitle: {
    ...typography.title,
    textAlign: 'center',
  },
  heroSubtitle: {
    ...typography.subtitle,
    textAlign: 'center',
    lineHeight: 20,
  },
  primaryCta: {
    backgroundColor: palette.primary,
    borderRadius: radii.lg,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryCtaText: {
    color: palette.white,
    fontSize: 16,
    fontWeight: '700',
  },
  noQuizBox: {
    backgroundColor: palette.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.xs,
    ...shadow.card,
  },
  noQuizIcon: {
    fontSize: 42,
  },
  noQuizTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '700',
  },
  noQuizSubtitle: {
    color: palette.textMuted,
    textAlign: 'center',
  },
  howToBlock: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  howToTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  howToRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  howToNum: {
    color: palette.primary,
    fontWeight: '800',
    width: 16,
  },
  howToText: {
    color: palette.textMuted,
    flex: 1,
    lineHeight: 18,
  },
  nextQuizCard: {
    backgroundColor: palette.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.card,
  },
  nextQuizHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  nextQuizTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  nextQuizIconBox: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: palette.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextQuizIcon: {
    fontSize: 20,
  },
  flexOne: {
    flex: 1,
  },
  nextQuizTitle: {
    color: palette.text,
    fontSize: 17,
    fontWeight: '700',
  },
  nextQuizMeta: {
    color: palette.textMuted,
    fontSize: 12,
  },
  prizeValue: {
    color: palette.prize,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'right',
  },
  prizeLabel: {
    color: palette.textMuted,
    fontSize: 11,
    textAlign: 'right',
  },
  nextQuizDescription: {
    color: palette.textMuted,
    lineHeight: 19,
  },
  countdownLabel: {
    color: palette.textMuted,
    textAlign: 'center',
    fontSize: 13,
  },
  timerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  secondaryCta: {
    minHeight: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.primary,
    backgroundColor: palette.accentSurface,
  },
  secondaryCtaText: {
    color: palette.primary,
    fontWeight: '700',
    fontSize: 15,
  },
  listSection: {
    gap: spacing.sm,
  },
  listTitle: {
    ...typography.sectionTitle,
  },
  emptyCard: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  emptyText: {
    color: palette.textMuted,
  },
  quizCard: {
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  quizCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    alignItems: 'center',
  },
  quizCardTitle: {
    color: palette.text,
    fontWeight: '700',
    flex: 1,
    fontSize: 16,
  },
  statusPill: {
    borderRadius: radii.pill,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  statusPillInProgress: {
    backgroundColor: '#dcfce7',
  },
  statusPillInProgressText: {
    color: '#166534',
  },
  statusPillScheduled: {
    backgroundColor: '#dbeafe',
  },
  statusPillScheduledText: {
    color: '#1d4ed8',
  },
  statusPillCompleted: {
    backgroundColor: '#f3f4f6',
  },
  statusPillCompletedText: {
    color: '#374151',
  },
  statusPillCancelled: {
    backgroundColor: '#fee2e2',
  },
  statusPillCancelledText: {
    color: '#991b1b',
  },
  statusPillDefault: {
    backgroundColor: '#f3f4f6',
  },
  statusPillDefaultText: {
    color: '#374151',
  },
  quizCardDescription: {
    color: palette.textMuted,
    marginTop: spacing.xs,
    lineHeight: 18,
  },
  quizCardBottom: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  quizCardMeta: {
    color: '#64748b',
    fontSize: 12,
  },
});
