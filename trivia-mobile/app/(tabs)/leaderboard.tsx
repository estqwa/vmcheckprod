import { useCallback } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View, type ListRenderItemInfo } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import type { LeaderboardEntry } from '@trivia/shared';
import { BrandHeader } from '../../src/components/ui/BrandHeader';
import { getLeaderboard } from '../../src/api/user';
import { palette, radii, shadow, spacing, typography } from '../../src/theme/tokens';
import { formatCurrency } from '../../src/utils/format';

const PAGE_SIZE = 20;

function getRankCardStyles(rank: number) {
  if (rank === 1) return { row: styles.rowGold };
  if (rank === 2) return { row: styles.rowSilver };
  if (rank === 3) return { row: styles.rowBronze };
  return { row: styles.rowDefault };
}

function renderRank(rank: number) {
  if (rank === 1) return <Ionicons name="trophy" size={22} color="#ca8a04" />;
  if (rank === 2) return <Ionicons name="medal" size={22} color="#64748b" />;
  if (rank === 3) return <Ionicons name="ribbon" size={22} color="#b45309" />;
  return <Text style={styles.rankText}>#{rank}</Text>;
}

export default function LeaderboardScreen() {
  const { t } = useTranslation();

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: ['leaderboard'],
    queryFn: ({ pageParam = 1 }) => getLeaderboard(pageParam, PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const totalPages = Math.ceil(lastPage.total / PAGE_SIZE);
      return lastPage.page < totalPages ? lastPage.page + 1 : undefined;
    },
  });

  const users = data?.pages.flatMap((p) => p.users) ?? [];

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = useCallback(({ item }: ListRenderItemInfo<LeaderboardEntry>) => {
    const rankStyle = getRankCardStyles(item.rank);

    return (
      <View style={[styles.row, rankStyle.row]} accessibilityLabel={`#${item.rank} ${item.username}`}>
        <View style={styles.rankBox}>{renderRank(item.rank)}</View>

        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{item.username.slice(0, 2).toUpperCase()}</Text>
        </View>

        <View style={styles.mainInfo}>
          <Text style={styles.username} numberOfLines={1}>
            {item.username}
          </Text>
          <Text style={styles.metaText}>
            {item.wins_count} {t('leaderboard.wins')}
          </Text>
        </View>

        <View style={styles.statsBox}>
          <Text style={styles.winsValue}>{item.wins_count}</Text>
          <Text style={styles.winsLabel}>{t('leaderboard.wins')}</Text>
        </View>

        <View style={styles.statsBox}>
          <Text style={styles.prizeValue}>{formatCurrency(item.total_prize_won)}</Text>
          <Text style={styles.prizeLabel}>{t('leaderboard.prize')}</Text>
        </View>
      </View>
    );
  }, [t]);

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

      <FlatList
        data={users}
        renderItem={renderItem}
        keyExtractor={(item) => String(item.user_id)}
        contentContainerStyle={styles.content}
        ListHeaderComponent={<Text style={styles.screenTitle}>{t('leaderboard.topPlayers')}</Text>}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Ionicons name="podium" size={40} color={palette.textMuted} style={styles.emptyIcon} />
            <Text style={styles.emptyText}>{t('leaderboard.noPlayers')}</Text>
          </View>
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={styles.footerLoading}>
              <ActivityIndicator size="small" color={palette.primary} />
            </View>
          ) : null
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
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
  rowGold: {
    backgroundColor: '#fef9c3',
    borderColor: '#fcd34d',
  },
  rowSilver: {
    backgroundColor: '#f3f4f6',
    borderColor: '#d1d5db',
  },
  rowBronze: {
    backgroundColor: '#ffedd5',
    borderColor: '#fdba74',
  },
  rowDefault: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
  },
  rankBox: {
    width: 38,
    alignItems: 'center',
    justifyContent: 'center',
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
  footerLoading: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
});
