import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BrandHeader } from '../../src/components/ui/BrandHeader';
import { LanguageToggle } from '../../src/components/ui/LanguageToggle';
import { PrimaryButton } from '../../src/components/ui/PrimaryButton';
import { useAuth } from '../../src/hooks/useAuth';
import { useGoogleCodeAuthRequest } from '../../src/hooks/useGoogleCodeAuthRequest';
import { palette, radii, shadow, spacing, typography } from '../../src/theme/tokens';

export default function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { login, loginWithGoogle, error, clearError, isLoading } = useAuth();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const google = useGoogleCodeAuthRequest();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const displayedError = localError ?? error;

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setLocalError(t('auth.fillAllFields'));
      return;
    }

    setLocalError(null);
    try {
      await login(email.trim(), password);
    } catch {
      // Error is surfaced through auth context.
    }
  };

  useEffect(() => {
    const handleGoogleResponse = async () => {
      if (!google.response || google.response.type !== 'success') return;
      const code = google.response.params?.code;
      const codeVerifier = google.request?.codeVerifier;
      if (!code || !codeVerifier) {
        Alert.alert(t('common.error'), t('auth.googleAuthIncomplete'));
        return;
      }

      setLocalError(null);
      setIsGoogleLoading(true);
      try {
        const user = await loginWithGoogle({
          code,
          redirect_uri: google.redirectUri,
          code_verifier: codeVerifier,
          platform: google.platform,
        });
        if (!user.email_verified) {
          router.replace('/(auth)/verify-email' as never);
        }
      } catch (err: unknown) {
        const apiErr = err as { error?: string; error_type?: string };
        if (apiErr.error_type === 'link_required') {
          Alert.alert(
            t('common.error'),
            apiErr.error || t('auth.googleLinkRequired')
          );
        } else {
          setLocalError(apiErr.error || t('auth.googleSignInFailed'));
        }
      } finally {
        setIsGoogleLoading(false);
      }
    };

    void handleGoogleResponse();
  }, [google.response, google.request, google.redirectUri, google.platform, loginWithGoogle, router, t]);

  const handleGooglePress = async () => {
    if (!google.enabled || !google.request) {
      setLocalError(t('auth.googleNotConfigured'));
      return;
    }
    clearError();
    setLocalError(null);
    await google.promptAsync();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <BrandHeader rightSlot={<LanguageToggle />} />

      <KeyboardAvoidingView
        style={styles.keyboardWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.iconCircle}>
              <Ionicons name="log-in-outline" size={30} color={palette.primary} />
            </View>

            <Text style={styles.title}>{t('auth.login')}</Text>
            <Text style={styles.subtitle}>{t('auth.loginDescription')}</Text>

            {displayedError ? (
              <View style={styles.errorBox} accessibilityRole="alert" accessibilityLiveRegion="polite">
                <Text style={styles.errorText}>{displayedError}</Text>
              </View>
            ) : null}

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('auth.email')}</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={palette.textMuted}
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  setLocalError(null);
                  clearError();
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel={t('auth.email')}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('auth.password')}</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={palette.textMuted}
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  setLocalError(null);
                  clearError();
                }}
                secureTextEntry
                accessibilityLabel={t('auth.password')}
              />
            </View>

            <PrimaryButton title={t('auth.login')} loading={isLoading} onPress={handleSubmit} />

            {google.enabled ? (
              <TouchableOpacity
                style={styles.googleButton}
                onPress={() => void handleGooglePress()}
                disabled={!google.request || isLoading || isGoogleLoading}
                accessibilityRole="button"
              >
                <Text style={styles.googleButtonText}>
                  {isGoogleLoading ? t('auth.googleLoading') : t('auth.googleLogin')}
                </Text>
              </TouchableOpacity>
            ) : null}

            <View style={styles.switchRow}>
              <Text style={styles.switchText}>{t('auth.noAccount')}</Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/register')} accessibilityRole="link">
                <Text style={styles.switchLink}>{t('auth.registerButton')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
  },
  keyboardWrapper: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.xl,
    gap: spacing.md,
    ...shadow.card,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: radii.xl,
    backgroundColor: palette.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  title: {
    ...typography.title,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.subtitle,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  errorBox: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  errorText: {
    color: '#b91c1c',
    textAlign: 'center',
    fontSize: 13,
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    height: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.md,
    color: palette.text,
    fontSize: 15,
  },
  switchRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  switchText: {
    color: palette.textMuted,
    fontSize: 13,
  },
  switchLink: {
    color: palette.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  googleButton: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  googleButtonText: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '700',
  },
});
