import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { Session } from '@trivia/shared';
import { useAuth } from '../../src/hooks/useAuth';
import { BrandHeader } from '../../src/components/ui/BrandHeader';
import { getDeviceId } from '../../src/services/tokenService';
import { palette, radii, shadow, spacing, typography } from '../../src/theme/tokens';

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

export default function SessionsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { getActiveSessions, revokeSession, logoutAllDevices, logout } = useAuth();

  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  const [revokingSessionId, setRevokingSessionId] = useState<number | null>(null);
  const [isLogoutAllPending, setIsLogoutAllPending] = useState(false);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const deviceId = await getDeviceId();
      if (mounted) setCurrentDeviceId(deviceId);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const {
    data: sessions = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['auth', 'sessions'],
    queryFn: getActiveSessions,
    staleTime: 30_000,
  });

  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => Number(new Date(b.created_at)) - Number(new Date(a.created_at)));
  }, [sessions]);

  const handleRevokeSession = useCallback(
    async (session: Session) => {
      if (revokingSessionId !== null || isLogoutAllPending) return;
      setRevokingSessionId(session.id);
      try {
        await revokeSession(session.id);
        await queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] });

        if (currentDeviceId && session.device_id === currentDeviceId) {
          await logout();
          router.replace('/(auth)/login');
        }
      } finally {
        setRevokingSessionId(null);
      }
    },
    [currentDeviceId, isLogoutAllPending, logout, queryClient, revokeSession, revokingSessionId, router]
  );

  const handleLogoutAll = useCallback(async () => {
    if (isLogoutAllPending) return;
    setIsLogoutAllPending(true);
    try {
      await logoutAllDevices();
      router.replace('/(auth)/login');
    } finally {
      setIsLogoutAllPending(false);
    }
  }, [isLogoutAllPending, logoutAllDevices, router]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <BrandHeader subtitle={t('profile.sessions')} onBackPress={() => router.back()} />
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={palette.primary} />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <BrandHeader subtitle={t('profile.sessions')} onBackPress={() => router.back()} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>{t('profile.activeSessions')}</Text>
          <Text style={styles.summaryValue}>{sortedSessions.length}</Text>
        </View>

        {sortedSessions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>{t('profile.noSessions')}</Text>
          </View>
        ) : (
          sortedSessions.map((session) => {
            const isCurrentSession = currentDeviceId !== null && session.device_id === currentDeviceId;
            const isRevokingThis = revokingSessionId === session.id;

            return (
              <View key={session.id} style={styles.sessionCard}>
                <View style={styles.sessionHeader}>
                  <Text style={styles.sessionTitle}>
                    {isCurrentSession ? t('profile.thisDevice') : `${t('profile.device')} #${session.id}`}
                  </Text>
                  <Text style={styles.sessionMeta}>{t('profile.expiresAt')}: {formatDate(session.expires_at)}</Text>
                </View>

                <Text style={styles.sessionRow} numberOfLines={1}>
                  {t('profile.deviceId')}: {session.device_id}
                </Text>
                <Text style={styles.sessionRow} numberOfLines={1}>
                  {t('profile.ipAddress')}: {session.ip_address || '-'}
                </Text>
                <Text style={styles.sessionRow} numberOfLines={2}>
                  {t('profile.userAgent')}: {session.user_agent || '-'}
                </Text>

                <TouchableOpacity
                  style={[styles.revokeButton, isCurrentSession ? styles.revokeCurrentButton : null]}
                  onPress={() => void handleRevokeSession(session)}
                  disabled={isRevokingThis || isLogoutAllPending}
                  accessibilityRole="button"
                  accessibilityLabel={t('profile.revokeSession')}
                >
                  <Text style={styles.revokeButtonText}>
                    {isRevokingThis ? t('common.loading') : t('profile.revokeSession')}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}

        <TouchableOpacity
          style={styles.logoutAllButton}
          onPress={() => void handleLogoutAll()}
          disabled={isLogoutAllPending}
          accessibilityRole="button"
          accessibilityLabel={t('profile.logoutAllDevices')}
        >
          <Text style={styles.logoutAllButtonText}>
            {isLogoutAllPending ? t('common.loading') : t('profile.logoutAllDevices')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => void refetch()}
          disabled={isRefetching || isLogoutAllPending || revokingSessionId !== null}
          accessibilityRole="button"
          accessibilityLabel={t('common.retry')}
        >
          <Text style={styles.refreshButtonText}>
            {isRefetching ? t('common.loading') : t('common.retry')}
          </Text>
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
    gap: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  summaryCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    padding: spacing.md,
    ...shadow.card,
  },
  summaryTitle: {
    ...typography.sectionTitle,
  },
  summaryValue: {
    color: palette.primary,
    fontSize: 32,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  emptyCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    padding: spacing.lg,
  },
  emptyText: {
    color: palette.textMuted,
    textAlign: 'center',
  },
  sessionCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    padding: spacing.md,
    gap: spacing.xs,
    ...shadow.card,
  },
  sessionHeader: {
    gap: 2,
    marginBottom: spacing.xs,
  },
  sessionTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '800',
  },
  sessionMeta: {
    color: palette.textMuted,
    fontSize: 12,
  },
  sessionRow: {
    color: palette.text,
    fontSize: 13,
  },
  revokeButton: {
    marginTop: spacing.sm,
    minHeight: 40,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  revokeCurrentButton: {
    borderColor: '#fdba74',
    backgroundColor: '#fff7ed',
  },
  revokeButtonText: {
    color: '#b91c1c',
    fontWeight: '700',
  },
  logoutAllButton: {
    marginTop: spacing.sm,
    minHeight: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.primary,
  },
  logoutAllButtonText: {
    color: palette.white,
    fontWeight: '700',
  },
  refreshButton: {
    minHeight: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  refreshButtonText: {
    color: palette.text,
    fontWeight: '700',
  },
});
