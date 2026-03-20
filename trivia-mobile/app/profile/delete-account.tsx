import { useState } from 'react';
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
import { BrandHeader } from '../../src/components/ui/BrandHeader';
import { FormField } from '../../src/components/ui/FormField';
import { PrimaryButton } from '../../src/components/ui/PrimaryButton';
import { StateBanner } from '../../src/components/ui/StateBanner';
import { SurfaceCard } from '../../src/components/ui/SurfaceCard';
import { useAuth } from '../../src/providers/AuthProvider';
import { palette, radii, spacing, typography } from '../../src/theme/tokens';

export default function DeleteAccountScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { deleteAccount, isLoading } = useAuth();
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDelete = () => {
    Alert.alert(
      t('profile.deleteAccountTitle'),
      t('profile.deleteAccountConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.deleteAccount'),
          style: 'destructive',
          onPress: async () => {
            setError(null);
            setIsSubmitting(true);
            try {
              await deleteAccount({
                password: password.trim() || undefined,
                reason: reason.trim() || undefined,
              });
              router.replace('/(auth)/login');
            } catch (err: unknown) {
              const apiErr = err as { error?: string };
              setError(apiErr.error || t('profile.deleteAccountError'));
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <BrandHeader subtitle={t('profile.deleteAccountTitle')} />

      <KeyboardAvoidingView
        style={styles.keyboardWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <SurfaceCard style={styles.card}>
            <Text style={styles.title}>{t('profile.deleteAccountTitle')}</Text>
            <StateBanner tone="danger" description={t('profile.deleteAccountDescription')} />

            {error ? <StateBanner tone="danger" description={error} /> : null}

            <FormField label={t('profile.deleteAccountPasswordLabel')}>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder={t('profile.deleteAccountPasswordPlaceholder')}
                placeholderTextColor={palette.textMuted}
              />
            </FormField>

            <FormField label={t('profile.deleteAccountReasonLabel')}>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={reason}
                onChangeText={setReason}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                placeholder={t('profile.deleteAccountReasonPlaceholder')}
                placeholderTextColor={palette.textMuted}
              />
            </FormField>

            <PrimaryButton
              title={isSubmitting ? t('profile.deleteAccountDeleting') : t('profile.deleteAccount')}
              loading={isLoading || isSubmitting}
              onPress={handleDelete}
            />

            <TouchableOpacity onPress={() => router.back()} accessibilityRole="button">
              <Text style={styles.cancelLink}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </SurfaceCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  keyboardWrapper: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
  card: { gap: spacing.md },
  title: { ...typography.title, textAlign: 'center' },
  input: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: palette.text,
    fontSize: 15,
  },
  textArea: { minHeight: 96 },
  cancelLink: { color: palette.primary, textAlign: 'center', fontWeight: '700' },
});
