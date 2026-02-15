import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { Quiz } from '@trivia/shared';
import { getUpcomingQuizzes } from '../../src/api/quizzes';
import { BrandHeader } from '../../src/components/ui/BrandHeader';
import { TimerBlock } from '../../src/components/ui/TimerBlock';
import { getQuizStatusTone, palette, radii, shadow, spacing, typography } from '../../src/theme/tokens';

function getCountdown(targetDate: string) {
  const target = new Date(targetDate).getTime();
  const now = Date.now();
  const diff = Math.max(0, target - now);

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return {
    days: String(days).padStart(2, '0'),
    hours: String(hours).padStart(2, '0'),
    minutes: String(minutes).padStart(2, '0'),
    seconds: String(seconds).padStart(2, '0'),
  };
}

function sortQuizzes(quizzes: Quiz[]): Quiz[] {
  return [...quizzes].sort(
    (a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime()
  );
}

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

  const [countdown, setCountdown] = useState({ days: '00', hours: '00', minutes: '00', seconds: '00' });

  useEffect(() => {
    if (!upcomingQuiz) {
      setCountdown({ days: '00', hours: '00', minutes: '00', seconds: '00' });
      return;
    }

    const update = () => setCountdown(getCountdown(upcomingQuiz.scheduled_time));
    update();
    const timer = setInterval(update, 1000);

    return () => clearInterval(timer);
  }, [upcomingQuiz]);

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

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={palette.primary} />}
      >
        <View style={styles.heroBlock}>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>{t('home.liveQuiz')}</Text>
          </View>

          <Text style={styles.heroTitle}>{t('home.welcome')}</Text>
          <Text style={styles.heroSubtitle}>{t('home.description')}</Text>

          {upcomingQuiz ? (
            <TouchableOpacity style={styles.primaryCta} onPress={() => router.push(`/quiz/${upcomingQuiz.id}/lobby`)}>
              <Text style={styles.primaryCtaText}>▶ {t('home.joinNow')}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.noQuizBox}>
              <Text style={styles.noQuizIcon}>🎮</Text>
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
                  <Text style={styles.nextQuizIcon}>🏆</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nextQuizTitle} numberOfLines={1}>
                    {upcomingQuiz.title}
                  </Text>
                  <Text style={styles.nextQuizMeta}>{t('home.nextQuiz')}</Text>
                </View>
              </View>
              <View>
                <Text style={styles.prizeValue}>{upcomingQuiz.prize_fund.toLocaleString()} тг</Text>
                <Text style={styles.prizeLabel}>{t('home.prizeFund')}</Text>
              </View>
            </View>

            {upcomingQuiz.description ? (
              <Text style={styles.nextQuizDescription}>{upcomingQuiz.description}</Text>
            ) : null}

            <Text style={styles.countdownLabel}>{t('home.startsIn')}</Text>
            <View style={styles.timerRow}>
              <TimerBlock value={countdown.days} label={t('quiz.days')} />
              <TimerBlock value={countdown.hours} label={t('quiz.hours')} />
              <TimerBlock value={countdown.minutes} label={t('quiz.minutes')} />
              <TimerBlock value={countdown.seconds} label={t('quiz.seconds')} />
            </View>

            <TouchableOpacity style={styles.secondaryCta} onPress={() => router.push(`/quiz/${upcomingQuiz.id}/lobby`)}>
              <Text style={styles.secondaryCtaText}>{t('home.openLobby')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.listSection}>
          <Text style={styles.listTitle}>{t('home.upcoming')}</Text>

          {quizzes.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>{t('home.noQuizzes')}</Text>
            </View>
          ) : (
            quizzes.map((quiz) => {
              const tone = getQuizStatusTone(quiz.status);
              return (
                <TouchableOpacity
                  key={quiz.id}
                  style={styles.quizCard}
                  onPress={() => router.push(`/quiz/${quiz.id}/lobby`)}
                >
                  <View style={styles.quizCardTop}>
                    <Text style={styles.quizCardTitle} numberOfLines={1}>
                      {quiz.title}
                    </Text>
                    <View style={[styles.statusPill, { backgroundColor: tone.backgroundColor }]}>
                      <Text style={[styles.statusPillText, { color: tone.textColor }]}>{quiz.status}</Text>
                    </View>
                  </View>

                  {quiz.description ? (
                    <Text style={styles.quizCardDescription} numberOfLines={2}>
                      {quiz.description}
                    </Text>
                  ) : null}

                  <View style={styles.quizCardBottom}>
                    <Text style={styles.quizCardMeta}>⏱ {quiz.question_count} {t('quiz.questions')}</Text>
                    <Text style={styles.quizCardMeta}>{new Date(quiz.scheduled_time).toLocaleString()}</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
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
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
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
