import { useEffect } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../src/providers/AuthProvider';
import { getMyQuizResult, getQuizResults } from '../../../src/api/quizzes';
import { BrandHeader } from '../../../src/components/ui/BrandHeader';
import { EmptyState } from '../../../src/components/ui/EmptyState';
import { StatTile } from '../../../src/components/ui/StatTile';
import { StatusBadge } from '../../../src/components/ui/StatusBadge';
import { palette, radii, shadow, spacing, typography } from '../../../src/theme/tokens';
import { formatCurrency } from '../../../src/utils/format';
import { maybeRequestReview } from '../../../src/services/reviewPrompt';

export default function ResultsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const quizId = Number(id);

  const { data: myResult, isLoading: myResultLoading } = useQuery({
    queryKey: ['quiz-my-result', quizId],
    queryFn: () => getMyQuizResult(quizId),
    enabled: Number.isFinite(quizId) && quizId > 0,
  });

  const { data: standings, isLoading: standingsLoading } = useQuery({
    queryKey: ['quiz-results', quizId, 1, 20],
    queryFn: () => getQuizResults(quizId, 1, 20),
    enabled: Number.isFinite(quizId) && quizId > 0,
  });

  useEffect(() => {
    if (!myResult || myResultLoading) {
      return;
    }

    const hasPositiveCompletedSession =
      myResult.total_questions > 0 &&
      (myResult.score > 0 || myResult.correct_answers > 0 || myResult.is_winner || !myResult.is_eliminated);

    void maybeRequestReview(hasPositiveCompletedSession, { cooldownDays: 30 });
  }, [myResult, myResultLoading]);

  if (myResultLoading || standingsLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <BrandHeader subtitle={t('quiz.results')} onBackPress={() => router.replace('/(tabs)')} />
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={palette.primary} />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const rows = standings?.results ?? [];
  const rowsToRender =
    myResult && !rows.some((row) => row.user_id === myResult.user_id) ? [...rows, myResult] : rows;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <BrandHeader subtitle={t('quiz.results')} onBackPress={() => router.replace('/(tabs)')} />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{t('quiz.gameOver')}</Text>

        {myResult ? (
          <View
            style={[
              styles.myResultCard,
              myResult.is_winner ? styles.winnerCard : null,
              myResult.is_eliminated ? styles.eliminatedCard : null,
            ]}
          >
            <View style={styles.myResultHeader}>
              <Text style={styles.myResultTitle}>{t('quiz.myResult')}</Text>
              {myResult.is_winner ? (
                <StatusBadge
                  tone="success"
                  label={t('quiz.winner')}
                  icon={<Ionicons name="trophy" size={12} color="#92400e" />}
                  style={styles.statusBadge}
                  textStyle={styles.statusBadgeText}
                />
              ) : null}
              {myResult.is_eliminated ? (
                <StatusBadge
                  tone="danger"
                  label={t('quiz.eliminated')}
                  icon={<Ionicons name="close-circle" size={12} color="#9a3412" />}
                  style={styles.statusBadge}
                  textStyle={styles.statusBadgeText}
                />
              ) : null}
            </View>

            <View style={styles.statsGrid} accessibilityRole="summary">
              <StatTile
                label={t('leaderboard.rankLabel')}
                value={`#${myResult.rank}`}
                size="compact"
                style={styles.statTile}
              />
              <StatTile
                label={t('quiz.scoreLabel')}
                value={myResult.score}
                tone="primary"
                size="compact"
                style={styles.statTile}
              />
              <StatTile
                label={t('history.correct')}
                value={`${myResult.correct_answers}/${myResult.total_questions}`}
                size="compact"
                style={styles.statTile}
              />
              {myResult.prize_fund > 0 ? (
                <StatTile
                  label={t('leaderboard.prize')}
                  value={formatCurrency(myResult.prize_fund)}
                  tone="success"
                  size="compact"
                  style={styles.statTile}
                />
              ) : null}
            </View>
          </View>
        ) : (
          <EmptyState
            title={t('quiz.resultUnavailable')}
            description={t('quiz.resultsEmptyState', { defaultValue: t('common.noData') })}
            icon={<Ionicons name="stats-chart" size={22} color={palette.textMuted} />}
            style={styles.emptyMyResultCard}
          />
        )}

        <View style={styles.listCard}>
          <View style={styles.listTitleRow}>
            <Ionicons name="trophy" size={18} color={palette.text} />
            <Text style={styles.listTitle}>{t('quiz.finalStandings')}</Text>
          </View>

          {rowsToRender.length === 0 ? (
            <EmptyState
              title={t('leaderboard.noPlayers')}
              description={t('quiz.resultsEmptyList', { defaultValue: t('quiz.waiting') })}
              icon={<Ionicons name="people-outline" size={22} color={palette.textMuted} />}
              style={styles.emptyResultsCard}
            />
          ) : (
            rowsToRender.map((row) => {
              const highlight = row.user_id === user?.id;
              return (
                <View
                  key={row.id}
                  style={[
                    styles.resultRow,
                    row.is_winner ? styles.resultRowWinner : null,
                    highlight ? styles.resultRowCurrentUser : null,
                  ]}
                >
                  <View style={styles.rowTop}>
                    <View style={styles.rankWrap} accessibilityElementsHidden>
                      {row.rank === 1 ? (
                        <Ionicons name="trophy" size={18} color="#ca8a04" />
                      ) : row.rank === 2 ? (
                        <Ionicons name="medal" size={18} color="#64748b" />
                      ) : row.rank === 3 ? (
                        <Ionicons name="ribbon" size={18} color="#b45309" />
                      ) : (
                        <Text style={styles.rankText}>#{row.rank}</Text>
                      )}
                    </View>

                    <View style={styles.userAvatar}>
                      <Text style={styles.userAvatarText}>{row.username.slice(0, 2).toUpperCase()}</Text>
                    </View>

                    <View style={styles.userMain}>
                      <Text style={styles.userName} numberOfLines={1}>
                        {row.username}
                        {highlight ? ` (${t('quiz.you')})` : ''}
                      </Text>
                      <Text style={styles.userMeta}>{row.correct_answers}/{row.total_questions} {t('history.correctSuffix')}</Text>
                    </View>
                  </View>

                  <View style={styles.userStatsRow}>
                    <View style={styles.userStatChip}>
                      <Text style={styles.userStatLabel}>{t('quiz.scoreLabel')}</Text>
                      <Text style={styles.userStatValue}>{row.score}</Text>
                    </View>
                    {row.prize_fund > 0 ? (
                      <View style={[styles.userStatChip, styles.userStatChipSuccess]}>
                        <Text style={styles.userStatLabel}>{t('leaderboard.prize')}</Text>
                        <Text style={styles.userPrize}>{formatCurrency(row.prize_fund)}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })
          )}
        </View>

        <TouchableOpacity style={styles.homeButton} onPress={() => router.replace('/(tabs)')} accessibilityRole="button">
          <Text style={styles.homeButtonText}>{t('nav.home')}</Text>
        </TouchableOpacity>
      </ScrollView>
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
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  title: {
    ...typography.title,
    marginBottom: spacing.sm,
  },
  myResultCard: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.xl,
    backgroundColor: palette.surface,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.card,
  },
  winnerCard: {
    borderColor: '#fcd34d',
    backgroundColor: '#fffbeb',
  },
  eliminatedCard: {
    borderColor: '#fdba74',
    backgroundColor: '#fff7ed',
  },
  myResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  myResultTitle: {
    color: palette.text,
    fontWeight: '800',
    fontSize: 19,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statTile: {
    flexBasis: '48%',
    flexGrow: 1,
    minHeight: 88,
  },
  statusBadge: {
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    fontSize: 11,
  },
  emptyMyResultCard: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.lg,
    backgroundColor: palette.surface,
    padding: spacing.lg,
  },
  emptyResultsCard: {
    marginTop: spacing.sm,
  },
  listCard: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.xl,
    backgroundColor: palette.surface,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadow.card,
  },
  listTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '800',
  },
  listTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  resultRow: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.lg,
    backgroundColor: '#f8fafc',
    padding: spacing.sm,
    gap: spacing.sm,
  },
  resultRowWinner: {
    borderColor: '#fcd34d',
    backgroundColor: '#fffbeb',
  },
  resultRowCurrentUser: {
    borderColor: '#fda4af',
    backgroundColor: '#fff1f2',
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rankWrap: {
    width: 34,
    alignItems: 'center',
  },
  rankText: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.text,
  },
  userAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: palette.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    color: palette.primary,
    fontWeight: '800',
    fontSize: 12,
  },
  userMain: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    color: palette.text,
    fontWeight: '700',
    fontSize: 14,
  },
  userMeta: {
    color: palette.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  userStatsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  userStatChip: {
    flex: 1,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  userStatChipSuccess: {
    backgroundColor: '#ecfdf5',
  },
  userStatLabel: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  userStatValue: {
    color: palette.text,
    fontWeight: '800',
    fontSize: 16,
    marginTop: 2,
  },
  userPrize: {
    color: palette.prize,
    fontWeight: '800',
    fontSize: 14,
    marginTop: 2,
  },
  homeButton: {
    minHeight: 48,
    borderRadius: radii.md,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeButtonText: {
    color: palette.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
