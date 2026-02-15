import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../src/hooks/useAuth';
import { getMyQuizResult, getQuizResults } from '../../../src/api/quizzes';
import { BrandHeader } from '../../../src/components/ui/BrandHeader';
import { palette, radii, shadow, spacing, typography } from '../../../src/theme/tokens';

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
              {myResult.is_winner ? <Text style={styles.winnerBadge}>🏆 {t('quiz.winner')}</Text> : null}
              {myResult.is_eliminated ? <Text style={styles.eliminatedBadge}>👀 {t('quiz.eliminated')}</Text> : null}
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statTile}>
                <Text style={styles.statValue}>#{myResult.rank}</Text>
                <Text style={styles.statLabel}>{t('leaderboard.rankLabel')}</Text>
              </View>
              <View style={[styles.statTile, styles.primaryStatTile]}>
                <Text style={[styles.statValue, styles.primaryValue]}>{myResult.score}</Text>
                <Text style={styles.statLabel}>{t('quiz.scoreLabel')}</Text>
              </View>
              <View style={styles.statTile}>
                <Text style={styles.statValue}>{myResult.correct_answers}/{myResult.total_questions}</Text>
                <Text style={styles.statLabel}>{t('history.correct')}</Text>
              </View>
              {myResult.prize_fund > 0 ? (
                <View style={[styles.statTile, styles.successStatTile]}>
                  <Text style={[styles.statValue, styles.successValue]}>${myResult.prize_fund}</Text>
                  <Text style={styles.statLabel}>{t('leaderboard.prize')}</Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : (
          <View style={styles.emptyMyResultCard}>
            <Text style={styles.emptyText}>{t('quiz.resultUnavailable')}</Text>
          </View>
        )}

        <View style={styles.listCard}>
          <Text style={styles.listTitle}>🏆 {t('quiz.finalStandings')}</Text>

          {rows.length === 0 ? (
            <Text style={styles.emptyText}>{t('leaderboard.noPlayers')}</Text>
          ) : (
            rows.map((row) => {
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
                  <View style={styles.rankWrap}>
                    <Text style={styles.rankText}>
                      {row.rank <= 3 ? ['🥇', '🥈', '🥉'][row.rank - 1] : `#${row.rank}`}
                    </Text>
                  </View>

                  <View style={styles.userAvatar}>
                    <Text style={styles.userAvatarText}>{row.username.slice(0, 2).toUpperCase()}</Text>
                  </View>

                  <View style={styles.userMain}>
                    <Text style={styles.userName} numberOfLines={1}>
                      {row.username}
                      {highlight ? ` (${t('quiz.you')})` : ''}
                    </Text>
                    <Text style={styles.userMeta}>{row.correct_answers}/{row.total_questions} {t('history.correct')}</Text>
                  </View>

                  <View style={styles.userScores}>
                    <Text style={styles.userScoreBadge}>{row.score}</Text>
                    {row.prize_fund > 0 ? <Text style={styles.userPrize}>${row.prize_fund}</Text> : null}
                  </View>
                </View>
              );
            })
          )}
        </View>

        <TouchableOpacity style={styles.homeButton} onPress={() => router.replace('/(tabs)')}>
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
  winnerBadge: {
    color: '#92400e',
    backgroundColor: '#fef3c7',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: '700',
    overflow: 'hidden',
  },
  eliminatedBadge: {
    color: '#9a3412',
    backgroundColor: '#fed7aa',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: '700',
    overflow: 'hidden',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statTile: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  primaryStatTile: {
    backgroundColor: '#fff1f2',
  },
  successStatTile: {
    backgroundColor: '#ecfdf5',
  },
  statValue: {
    color: palette.text,
    fontWeight: '800',
    fontSize: 24,
  },
  primaryValue: {
    color: palette.primary,
  },
  successValue: {
    color: palette.prize,
  },
  statLabel: {
    color: palette.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  emptyMyResultCard: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.lg,
    backgroundColor: palette.surface,
    padding: spacing.lg,
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
    marginBottom: 4,
  },
  emptyText: {
    color: palette.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  resultRow: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.md,
    backgroundColor: '#f8fafc',
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
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
    fontSize: 11,
    marginTop: 2,
  },
  userScores: {
    alignItems: 'flex-end',
    minWidth: 52,
  },
  userScoreBadge: {
    color: palette.text,
    fontWeight: '800',
    fontSize: 15,
  },
  userPrize: {
    color: palette.prize,
    fontWeight: '700',
    fontSize: 12,
    marginTop: 1,
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
