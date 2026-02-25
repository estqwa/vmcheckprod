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
import { PrimaryButton } from '../../src/components/ui/PrimaryButton';
import { useAuth } from '../../src/hooks/useAuth';
import { palette, radii, shadow, spacing, typography } from '../../src/theme/tokens';

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
          <View style={styles.card}>
            <Text style={styles.title}>{t('profile.deleteAccountTitle')}</Text>
            <Text style={styles.warningText}>
              {t('profile.deleteAccountDescription')}
            </Text>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('profile.deleteAccountPasswordLabel')}</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder={t('profile.deleteAccountPasswordPlaceholder')}
                placeholderTextColor={palette.textMuted}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('profile.deleteAccountReasonLabel')}</Text>
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
            </View>

            <PrimaryButton
              title={isSubmitting ? t('profile.deleteAccountDeleting') : t('profile.deleteAccount')}
              loading={isLoading || isSubmitting}
              onPress={handleDelete}
            />

            <TouchableOpacity onPress={() => router.back()} accessibilityRole="button">
              <Text style={styles.cancelLink}>{t('common.cancel')}</Text>
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
  warningText: { color: '#991b1b', backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: radii.md, padding: spacing.sm },
  errorBox: { borderRadius: radii.md, borderWidth: 1, borderColor: '#fecaca', backgroundColor: '#fee2e2', padding: spacing.sm },
  errorText: { color: '#b91c1c', fontSize: 13 },
  fieldGroup: { gap: 6 },
  label: { color: palette.text, fontSize: 14, fontWeight: '600' },
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
