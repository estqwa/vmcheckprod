import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/hooks/useAuth';
import { BrandHeader } from '../../src/components/ui/BrandHeader';
import { LanguageToggle } from '../../src/components/ui/LanguageToggle';
import { palette, radii, shadow, spacing, typography } from '../../src/theme/tokens';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, logout } = useAuth();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <BrandHeader subtitle={t('profile.title')} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.username?.slice(0, 2).toUpperCase() ?? 'U'}</Text>
          </View>
          <Text style={styles.username}>{user?.username ?? '-'}</Text>
          <Text style={styles.email}>{user?.email ?? '-'}</Text>

          <View style={styles.statsGrid}>
            <View style={styles.statTile}>
              <Text style={styles.statValue}>{user?.games_played ?? 0}</Text>
              <Text style={styles.statLabel}>{t('profile.gamesPlayed')}</Text>
            </View>
            <View style={[styles.statTile, styles.primaryStatTile]}>
              <Text style={[styles.statValue, styles.primaryValue]}>{user?.wins_count ?? 0}</Text>
              <Text style={styles.statLabel}>{t('profile.wins')}</Text>
            </View>
            <View style={styles.statTile}>
              <Text style={styles.statValue}>{user?.total_score ?? 0}</Text>
              <Text style={styles.statLabel}>{t('profile.totalScore')}</Text>
            </View>
            <View style={[styles.statTile, styles.successStatTile]}>
              <Text style={[styles.statValue, styles.successValue]}>${user?.total_prize_won ?? 0}</Text>
              <Text style={styles.statLabel}>{t('profile.totalPrize')}</Text>
            </View>
          </View>
        </View>

        <View style={styles.actionCard}>
          <Text style={styles.cardTitle}>{t('profile.actions')}</Text>

          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/profile/history')}>
            <Text style={styles.menuItemText}>📜 {t('profile.history')}</Text>
          </TouchableOpacity>

          <View style={styles.menuItemStatic}>
            <LanguageToggle />
          </View>

          <TouchableOpacity style={[styles.menuItem, styles.logoutItem]} onPress={logout}>
            <Text style={[styles.menuItemText, styles.logoutText]}>🚪 {t('auth.logout')}</Text>
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
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  userCard: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.xl,
    padding: spacing.lg,
    alignItems: 'center',
    ...shadow.card,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accentSurface,
    borderWidth: 4,
    borderColor: '#ffe4e6',
    marginBottom: spacing.sm,
  },
  avatarText: {
    color: palette.primary,
    fontSize: 28,
    fontWeight: '800',
  },
  username: {
    color: palette.text,
    fontSize: 24,
    fontWeight: '800',
  },
  email: {
    color: palette.textMuted,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  statsGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statTile: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: palette.surfaceMuted,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.border,
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
    fontSize: 24,
    fontWeight: '800',
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
    textAlign: 'center',
  },
  actionCard: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadow.card,
  },
  cardTitle: {
    ...typography.sectionTitle,
    marginBottom: 4,
  },
  menuItem: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  menuItemStatic: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  menuItemText: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '600',
  },
  logoutItem: {
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    marginTop: spacing.sm,
  },
  logoutText: {
    color: '#b91c1c',
  },
});
