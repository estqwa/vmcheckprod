import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { QuizResult } from '@trivia/shared';
import { BrandHeader } from '../../src/components/ui/BrandHeader';
import { getQuizHistory } from '../../src/api/quizzes';
import { palette, radii, shadow, spacing, typography } from '../../src/theme/tokens';

function renderStatus(result: QuizResult, t: (key: string, opts?: Record<string, unknown>) => string) {
  if (result.is_winner) {
    return { label: `🏆 ${t('history.winner')}`, color: '#92400e', bg: '#fef3c7' };
  }

  if (result.is_eliminated) {
    return { label: `❌ ${t('history.eliminated')}`, color: '#991b1b', bg: '#fee2e2' };
  }

  return { label: `⏱ ${t('history.finished')}`, color: '#374151', bg: '#f3f4f6' };
}

export default function HistoryScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const { data: history = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['quiz-history', 1, 50],
    queryFn: () => getQuizHistory(1, 50),
  });

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

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>📜 {t('history.title')}</Text>

        {history.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🎯</Text>
            <Text style={styles.emptyText}>{t('history.empty')}</Text>
            <TouchableOpacity style={styles.playButton} onPress={() => router.replace('/(tabs)')}>
              <Text style={styles.playButtonText}>{t('history.playNow')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          history.map((result: QuizResult) => {
            const status = renderStatus(result, t);
            return (
              <View key={result.id} style={styles.resultCard}>
                <View style={styles.resultHeader}>
                  <Text style={[styles.statusBadge, { color: status.color, backgroundColor: status.bg }]}> {status.label} </Text>
                  <Text style={styles.dateText}>{new Date(result.completed_at).toLocaleString()}</Text>
                </View>

                <View style={styles.metricsRow}>
                  <Text style={styles.metricText}>{t('history.score')}: {result.score}</Text>
                  <Text style={styles.metricText}>{t('history.correct')}: {result.correct_answers}/{result.total_questions}</Text>
                  <Text style={styles.metricText}>#{result.rank}</Text>
                </View>

                {result.is_winner && result.prize_fund > 0 ? (
                  <Text style={styles.prizeText}>🎉 {result.prize_fund.toLocaleString()} тг</Text>
                ) : null}

                <TouchableOpacity
                  style={styles.viewResultButton}
                  onPress={() => router.push(`/quiz/${result.quiz_id}/results`)}
                >
                  <Text style={styles.viewResultButtonText}>{t('history.viewResults')}</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}

        <TouchableOpacity style={styles.refreshButton} onPress={() => refetch()} disabled={isRefetching}>
          <Text style={styles.refreshButtonText}>{isRefetching ? t('common.loading') : t('common.retry')}</Text>
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
  emptyIcon: {
    fontSize: 42,
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
  statusBadge: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
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
  refreshButton: {
    minHeight: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    marginTop: spacing.sm,
  },
  refreshButtonText: {
    color: palette.text,
    fontWeight: '700',
  },
});
