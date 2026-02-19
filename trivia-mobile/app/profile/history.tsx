import { useCallback } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View, type ListRenderItemInfo } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import type { QuizResult } from '@trivia/shared';
import { BrandHeader } from '../../src/components/ui/BrandHeader';
import { getQuizHistory } from '../../src/api/quizzes';
import { palette, radii, shadow, spacing, typography } from '../../src/theme/tokens';
import { formatCurrency } from '../../src/utils/format';

const PAGE_SIZE = 20;

function renderStatus(result: QuizResult, t: (key: string, opts?: Record<string, unknown>) => string) {
  if (result.is_winner) {
    return { label: t('history.winner'), color: '#92400e', bg: '#fef3c7', icon: 'trophy' as const };
  }

  if (result.is_eliminated) {
    return { label: t('history.eliminated'), color: '#991b1b', bg: '#fee2e2', icon: 'close-circle' as const };
  }

  return { label: t('history.finished'), color: '#374151', bg: '#f3f4f6', icon: 'time' as const };
}

export default function HistoryScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: ['quiz-history'],
    queryFn: ({ pageParam = 1 }) => getQuizHistory(pageParam, PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const totalPages = Math.ceil(lastPage.total / PAGE_SIZE);
      return lastPage.page < totalPages ? lastPage.page + 1 : undefined;
    },
  });

  const allResults = data?.pages.flatMap((p) => p.results) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = useCallback(({ item }: ListRenderItemInfo<QuizResult>) => {
    const status = renderStatus(item, t);
    return (
      <View style={styles.resultCard}>
        <View style={styles.resultHeader}>
          <View style={[styles.statusBadgeWrap, { backgroundColor: status.bg }]}>
            <Ionicons name={status.icon} size={12} color={status.color} />
            <Text style={[styles.statusBadge, { color: status.color }]}>{status.label}</Text>
          </View>
          <Text style={styles.dateText}>{new Date(item.completed_at).toLocaleString()}</Text>
        </View>

        <View style={styles.metricsRow}>
          <Text style={styles.metricText}>{t('history.score')}: {item.score}</Text>
          <Text style={styles.metricText}>{t('history.correct')}: {item.correct_answers}/{item.total_questions}</Text>
          <Text style={styles.metricText}>#{item.rank}</Text>
        </View>

        {item.is_winner && item.prize_fund > 0 ? (
          <View style={styles.prizeRow}>
            <Ionicons name="sparkles" size={14} color={palette.prize} />
            <Text style={styles.prizeText}>{formatCurrency(item.prize_fund)}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={styles.viewResultButton}
          onPress={() => router.push(`/quiz/${item.quiz_id}/results`)}
          accessibilityRole="button"
        >
          <Text style={styles.viewResultButtonText}>{t('history.viewResults')}</Text>
        </TouchableOpacity>
      </View>
    );
  }, [t, router]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <BrandHeader subtitle={t('history.title')} onBackPress={() => router.back()} />
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={palette.primary} />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <BrandHeader subtitle={t('history.title')} onBackPress={() => router.back()} />

      <FlatList
        data={allResults}
        renderItem={renderItem}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.titleRow}>
            <Ionicons name="document-text" size={20} color={palette.text} />
            <Text style={styles.title}>{t('history.title')} ({total})</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Ionicons name="flag" size={42} color={palette.textMuted} />
            <Text style={styles.emptyText}>{t('history.empty')}</Text>
            <TouchableOpacity style={styles.playButton} onPress={() => router.replace('/(tabs)')} accessibilityRole="button">
              <Text style={styles.playButtonText}>{t('history.playNow')}</Text>
            </TouchableOpacity>
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
    gap: spacing.sm,
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
  },
  title: {
    ...typography.sectionTitle,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  emptyCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
    ...shadow.card,
  },
  emptyText: {
    color: palette.textMuted,
    textAlign: 'center',
  },
  playButton: {
    marginTop: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: palette.primary,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonText: {
    color: palette.white,
    fontWeight: '700',
  },
  resultCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.card,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusBadgeWrap: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusBadge: {
    fontSize: 12,
    fontWeight: '700',
  },
  dateText: {
    color: palette.textMuted,
    fontSize: 11,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  metricText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '600',
  },
  prizeText: {
    color: palette.prize,
    fontWeight: '700',
  },
  prizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewResultButton: {
    minHeight: 40,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  viewResultButtonText: {
    color: palette.text,
    fontWeight: '600',
    fontSize: 13,
  },
  footerLoading: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
});
