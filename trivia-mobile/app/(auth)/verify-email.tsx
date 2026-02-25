import { useCallback, useEffect, useState } from 'react';
import {
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
import { BrandHeader } from '../../src/components/ui/BrandHeader';
import { PrimaryButton } from '../../src/components/ui/PrimaryButton';
import { useAuth } from '../../src/hooks/useAuth';
import { palette, radii, shadow, spacing, typography } from '../../src/theme/tokens';

export default function VerifyEmailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, getEmailVerificationStatus, sendEmailVerificationCode, confirmEmailVerificationCode, isLoading } = useAuth();

  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [emailVerified, setEmailVerified] = useState<boolean>(!!user?.email_verified);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const status = await getEmailVerificationStatus();
      setEmailVerified(status.email_verified);
      setCooldown(Math.max(0, status.cooldown_remaining_sec || 0));
      setAttemptsLeft(typeof status.attempts_left === 'number' ? status.attempts_left : null);
      setExpiresAt(status.expires_at || null);
      setLocalError(null);
    } catch (err: unknown) {
      const apiErr = err as { error?: string };
      setLocalError(apiErr.error || t('auth.verifyStatusLoadError'));
    }
  }, [getEmailVerificationStatus]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const handleSendCode = async () => {
    setIsSending(true);
    try {
      await sendEmailVerificationCode();
      await loadStatus();
    } catch (err: unknown) {
      const apiErr = err as { error?: string };
      setLocalError(apiErr.error || t('auth.verifySendError'));
    } finally {
      setIsSending(false);
    }
  };

  const handleConfirm = async () => {
    if (code.trim().length !== 6) {
      setLocalError(t('auth.verifyCodeLengthError'));
      return;
    }

    setIsConfirming(true);
    try {
      await confirmEmailVerificationCode({ code: code.trim() });
      setCode('');
      await loadStatus();
      setLocalError(null);
      router.replace('/(tabs)');
    } catch (err: unknown) {
      const apiErr = err as { error?: string };
      setLocalError(apiErr.error || t('auth.verifyConfirmError'));
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <BrandHeader subtitle={t('auth.verifyEmailTitle')} />

      <KeyboardAvoidingView
        style={styles.keyboardWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.title}>{t('auth.verifyEmailTitle')}</Text>
            <Text style={styles.subtitle}>{user?.email ?? ''}</Text>

            {emailVerified ? (
              <View style={styles.successBox}>
                <Text style={styles.successText}>
                  {t('auth.emailVerified')}
                </Text>
              </View>
            ) : (
              <View style={styles.warningBox}>
                <Text style={styles.warningText}>
                  {t('auth.emailNotVerifiedHint')}
                </Text>
              </View>
            )}

            {localError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{localError}</Text>
              </View>
            ) : null}

            <View style={styles.metaBox}>
              <Text style={styles.metaText}>{t('auth.verifyAttemptsLeft')}: {attemptsLeft ?? '-'}</Text>
              {cooldown > 0 ? <Text style={styles.metaText}>{t('auth.verifyResendIn')}: {cooldown}s</Text> : null}
              {expiresAt ? <Text style={styles.metaText}>{t('auth.verifyExpires')}: {new Date(expiresAt).toLocaleString()}</Text> : null}
            </View>

            <TouchableOpacity
              style={[styles.secondaryButton, (cooldown > 0 || isSending || emailVerified) && styles.buttonDisabled]}
              onPress={() => void handleSendCode()}
              disabled={cooldown > 0 || isSending || emailVerified}
            >
              <Text style={styles.secondaryButtonText}>
                {cooldown > 0 ? `${t('profile.resend')} (${cooldown}s)` : t('auth.sendCode')}
              </Text>
            </TouchableOpacity>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('auth.verificationCode')}</Text>
              <TextInput
                style={styles.input}
                value={code}
                onChangeText={(v) => {
                  setCode(v.replace(/\D/g, '').slice(0, 6));
                  setLocalError(null);
                }}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="123456"
                placeholderTextColor={palette.textMuted}
                editable={!emailVerified}
              />
            </View>

            <PrimaryButton
              title={t('auth.confirmCode')}
              loading={isLoading || isConfirming}
              onPress={handleConfirm}
              disabled={emailVerified || code.length !== 6}
            />

            <TouchableOpacity onPress={() => router.replace('/(tabs)')} accessibilityRole="button">
              <Text style={styles.skipLink}>{t('common.back')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  keyboardWrapper: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.xl,
    gap: spacing.md,
    ...shadow.card,
  },
  title: { ...typography.title, textAlign: 'center' },
  subtitle: { ...typography.subtitle, textAlign: 'center' },
  warningBox: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#fcd34d',
    backgroundColor: '#fffbeb',
    padding: spacing.sm,
  },
  warningText: { color: '#92400e', fontSize: 13 },
  successBox: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#86efac',
    backgroundColor: '#f0fdf4',
    padding: spacing.sm,
  },
  successText: { color: '#166534', fontSize: 13 },
  errorBox: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fee2e2',
    padding: spacing.sm,
  },
  errorText: { color: '#b91c1c', fontSize: 13 },
  metaBox: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#f8fafc',
    padding: spacing.sm,
    gap: 4,
  },
  metaText: { color: palette.textMuted, fontSize: 12 },
  fieldGroup: { gap: 6 },
  label: { color: palette.text, fontSize: 14, fontWeight: '600' },
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
  secondaryButton: {
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  secondaryButtonText: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '700',
  },
  buttonDisabled: { opacity: 0.6 },
  skipLink: {
    color: palette.primary,
    textAlign: 'center',
    fontWeight: '700',
    marginTop: spacing.xs,
  },
});
