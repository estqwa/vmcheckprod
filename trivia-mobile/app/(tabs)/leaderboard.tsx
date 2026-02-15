import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { LeaderboardEntry } from '@trivia/shared';
import { BrandHeader } from '../../src/components/ui/BrandHeader';
import { getLeaderboard } from '../../src/api/user';
import { palette, radii, shadow, spacing, typography } from '../../src/theme/tokens';

const MEDALS = ['🥇', '🥈', '🥉'];

function getRankCardStyle(rank: number) {
  if (rank === 1) return { backgroundColor: '#fef9c3', borderColor: '#fcd34d' };
  if (rank === 2) return { backgroundColor: '#f3f4f6', borderColor: '#d1d5db' };
  if (rank === 3) return { backgroundColor: '#ffedd5', borderColor: '#fdba74' };
  return { backgroundColor: palette.surface, borderColor: palette.border };
}

export default function LeaderboardScreen() {
  const { t } = useTranslation();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['leaderboard', 1, 50],
    queryFn: () => getLeaderboard(1, 50),
  });

  const users = data?.users ?? [];

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <BrandHeader subtitle={t('leaderboard.title')} />
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={palette.primary} />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <BrandHeader subtitle={t('leaderboard.subtitle')} />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={palette.primary} />}
      >
        <Text style={styles.screenTitle}>{t('leaderboard.topPlayers')}</Text>

        {users.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🎮</Text>
            <Text style={styles.emptyText}>{t('leaderboard.noPlayers')}</Text>
          </View>
        ) : (
          users.map((entry: LeaderboardEntry) => {
            const rankStyle = getRankCardStyle(entry.rank);
            return (
              <View
                key={entry.user_id}
                style={[styles.row, { backgroundColor: rankStyle.backgroundColor, borderColor: rankStyle.borderColor }]}
              >
                <View style={styles.rankBox}>
                  <Text style={styles.rankText}>
                    {entry.rank <= 3 ? MEDALS[entry.rank - 1] : `#${entry.rank}`}
                  </Text>
                </View>

                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>{entry.username.slice(0, 2).toUpperCase()}</Text>
                </View>

                <View style={styles.mainInfo}>
                  <Text style={styles.username} numberOfLines={1}>
                    {entry.username}
                  </Text>
                  <Text style={styles.metaText}>
                    {entry.wins_count} {t('leaderboard.wins')}
                  </Text>
                </View>

                <View style={styles.statsBox}>
                  <Text style={styles.winsValue}>{entry.wins_count}</Text>
                  <Text style={styles.winsLabel}>{t('leaderboard.wins')}</Text>
                </View>

                <View style={styles.statsBox}>
                  <Text style={styles.prizeValue}>${entry.total_prize_won}</Text>
                  <Text style={styles.prizeLabel}>{t('leaderboard.prize')}</Text>
                </View>
              </View>
            );
          })
        )}
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
  screenTitle: {
    ...typography.sectionTitle,
    marginBottom: spacing.md,
  },
  emptyCard: {
    backgroundColor: palette.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    padding: spacing.xl,
    ...shadow.card,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  emptyText: {
    color: palette.textMuted,
  },
  row: {
    borderRadius: radii.lg,
    borderWidth: 2,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    ...shadow.card,
  },
  rankBox: {
    width: 38,
    alignItems: 'center',
  },
  rankText: {
    fontSize: 24,
    fontWeight: '800',
    color: palette.text,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: palette.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  mainInfo: {
    flex: 1,
    minWidth: 0,
  },
  username: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '700',
  },
  metaText: {
    color: palette.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  statsBox: {
    alignItems: 'flex-end',
    minWidth: 54,
  },
  winsValue: {
    color: palette.primary,
    fontSize: 16,
    fontWeight: '800',
  },
  winsLabel: {
    color: palette.textMuted,
    fontSize: 10,
  },
  prizeValue: {
    color: palette.prize,
    fontSize: 16,
    fontWeight: '800',
  },
  prizeLabel: {
    color: palette.textMuted,
    fontSize: 10,
  },
});
