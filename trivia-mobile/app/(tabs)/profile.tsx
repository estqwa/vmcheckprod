import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/hooks/useAuth';
import { useGoogleCodeAuthRequest } from '../../src/hooks/useGoogleCodeAuthRequest';
import { BrandHeader } from '../../src/components/ui/BrandHeader';
import { LanguageToggle } from '../../src/components/ui/LanguageToggle';
import { palette, radii, shadow, spacing, typography } from '../../src/theme/tokens';
import { formatCurrency } from '../../src/utils/format';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, logout, sendEmailVerificationCode, getEmailVerificationStatus, linkGoogle } = useAuth();
  const google = useGoogleCodeAuthRequest();
  const [emailCooldown, setEmailCooldown] = React.useState(0);
  const [isEmailBusy, setIsEmailBusy] = React.useState(false);
  const [isGoogleBusy, setIsGoogleBusy] = React.useState(false);

  React.useEffect(() => {
    if (!user || user.email_verified) return;
    (async () => {
      try {
        const status = await getEmailVerificationStatus();
        setEmailCooldown(Math.max(0, status.cooldown_remaining_sec || 0));
      } catch {
        // ignore
      }
    })();
  }, [user, getEmailVerificationStatus]);

  React.useEffect(() => {
    if (emailCooldown <= 0) return;
    const id = setInterval(() => setEmailCooldown((prev) => (prev > 0 ? prev - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [emailCooldown]);

  React.useEffect(() => {
    const handleGoogleResponse = async () => {
      if (!google.response || google.response.type !== 'success') return;
      const code = google.response.params?.code;
      const codeVerifier = google.request?.codeVerifier;
      if (!code || !codeVerifier) {
        Alert.alert(t('common.error'), t('auth.googleAuthIncomplete'));
        return;
      }

      setIsGoogleBusy(true);
      try {
        await linkGoogle({
          code,
          redirect_uri: google.redirectUri,
          code_verifier: codeVerifier,
          platform: google.platform,
        });
        Alert.alert(t('common.success'), t('auth.googleLinkSuccess'));
      } catch (err: unknown) {
        const apiErr = err as { error?: string };
        Alert.alert(t('common.error'), apiErr.error || t('auth.googleLinkFailed'));
      } finally {
        setIsGoogleBusy(false);
      }
    };

    void handleGoogleResponse();
  }, [google.response, google.request, google.redirectUri, google.platform, linkGoogle]);

  const handleSendVerificationCode = async () => {
    if (emailCooldown > 0) return;
    setIsEmailBusy(true);
    try {
      await sendEmailVerificationCode();
      const status = await getEmailVerificationStatus();
      setEmailCooldown(Math.max(0, status.cooldown_remaining_sec || 0));
      Alert.alert(t('common.success'), t('profile.verifyCodeSent'));
    } catch (err: unknown) {
      const apiErr = err as { error?: string };
      Alert.alert(t('common.error'), apiErr.error || t('profile.verifyCodeSendError'));
    } finally {
      setIsEmailBusy(false);
    }
  };

  const handleGoogleLinkPress = async () => {
    if (!google.enabled || !google.request) {
      Alert.alert(t('common.error'), t('auth.googleNotConfigured'));
      return;
    }
    await google.promptAsync();
  };

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

          {user && !user.email_verified ? (
            <View style={styles.verifyBanner}>
              <Text style={styles.verifyBannerTitle}>{t('profile.emailNotVerifiedTitle')}</Text>
              <Text style={styles.verifyBannerText}>{t('profile.emailNotVerifiedText')}</Text>
              <View style={styles.verifyBannerActions}>
                <TouchableOpacity
                  style={styles.verifyButton}
                  onPress={() => router.push('/(auth)/verify-email' as never)}
                  accessibilityRole="button"
                >
                  <Text style={styles.verifyButtonText}>{t('profile.verify')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.verifySecondaryButton}
                  onPress={() => void handleSendVerificationCode()}
                  disabled={emailCooldown > 0 || isEmailBusy}
                  accessibilityRole="button"
                >
                  <Text style={styles.verifySecondaryButtonText}>
                    {emailCooldown > 0 ? `${t('profile.resend')} ${emailCooldown}s` : t('profile.sendCode')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          <View style={styles.statsGrid} accessibilityRole="summary">
            <View style={styles.statTile} accessibilityLabel={`${t('profile.gamesPlayed')}: ${user?.games_played ?? 0}`}>
              <Text style={styles.statValue}>{user?.games_played ?? 0}</Text>
              <Text style={styles.statLabel}>{t('profile.gamesPlayed')}</Text>
            </View>
            <View style={[styles.statTile, styles.primaryStatTile]} accessibilityLabel={`${t('profile.wins')}: ${user?.wins_count ?? 0}`}>
              <Text style={[styles.statValue, styles.primaryValue]}>{user?.wins_count ?? 0}</Text>
              <Text style={styles.statLabel}>{t('profile.wins')}</Text>
            </View>
            <View style={styles.statTile} accessibilityLabel={`${t('profile.totalScore')}: ${user?.total_score ?? 0}`}>
              <Text style={styles.statValue}>{user?.total_score ?? 0}</Text>
              <Text style={styles.statLabel}>{t('profile.totalScore')}</Text>
            </View>
            <View style={[styles.statTile, styles.successStatTile]} accessibilityLabel={`${t('profile.totalPrize')}: ${formatCurrency(user?.total_prize_won ?? 0)}`}>
              <Text style={[styles.statValue, styles.successValue]}>{formatCurrency(user?.total_prize_won ?? 0)}</Text>
              <Text style={styles.statLabel}>{t('profile.totalPrize')}</Text>
            </View>
          </View>
        </View>

        <View style={styles.actionCard}>
          <Text style={styles.cardTitle}>{t('profile.actions')}</Text>

          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/profile/history')} accessibilityRole="button">
            <View style={styles.menuItemRow}>
              <Ionicons name="document-text" size={16} color={palette.text} />
              <Text style={styles.menuItemText}>{t('profile.history')}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/profile/sessions' as never)} accessibilityRole="button">
            <View style={styles.menuItemRow}>
              <Ionicons name="shield-checkmark" size={16} color={palette.text} />
              <Text style={styles.menuItemText}>{t('profile.sessions')}</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.menuItemStatic}>
            <LanguageToggle />
          </View>

          {google.enabled ? (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => void handleGoogleLinkPress()}
              disabled={!google.request || isGoogleBusy}
              accessibilityRole="button"
            >
              <View style={styles.menuItemRow}>
                <Ionicons name="logo-google" size={16} color={palette.text} />
                <Text style={styles.menuItemText}>
                  {isGoogleBusy ? t('profile.linkGoogleLoading') : t('profile.linkGoogle')}
                </Text>
              </View>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={[styles.menuItem, styles.deleteItem]}
            onPress={() => router.push('/profile/delete-account' as never)}
            accessibilityRole="button"
          >
            <View style={styles.menuItemRow}>
              <Ionicons name="trash-outline" size={16} color="#b91c1c" />
              <Text style={[styles.menuItemText, styles.logoutText]}>{t('profile.deleteAccount')}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.menuItem, styles.logoutItem]} onPress={logout} accessibilityRole="button" accessibilityLabel={t('auth.logout')}>
            <View style={styles.menuItemRow}>
              <Ionicons name="log-out-outline" size={16} color="#b91c1c" />
              <Text style={[styles.menuItemText, styles.logoutText]}>{t('auth.logout')}</Text>
            </View>
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
  verifyBanner: {
    width: '100%',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#fcd34d',
    backgroundColor: '#fffbeb',
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: 6,
  },
  verifyBannerTitle: {
    color: '#92400e',
    fontWeight: '800',
    fontSize: 14,
  },
  verifyBannerText: {
    color: '#92400e',
    fontSize: 12,
  },
  verifyBannerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 4,
  },
  verifyButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: radii.md,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  verifyButtonText: {
    color: palette.white,
    fontWeight: '700',
    fontSize: 13,
  },
  verifySecondaryButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#fcd34d',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  verifySecondaryButtonText: {
    color: '#92400e',
    fontWeight: '700',
    fontSize: 12,
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
  menuItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoutItem: {
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    marginTop: spacing.sm,
  },
  deleteItem: {
    borderColor: '#fecaca',
    backgroundColor: '#fff7ed',
  },
  logoutText: {
    color: '#b91c1c',
  },
});
