import { useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { BrandHeader } from '../../src/components/ui/BrandHeader';
import { LanguageToggle } from '../../src/components/ui/LanguageToggle';
import { PrimaryButton } from '../../src/components/ui/PrimaryButton';
import { useAuth } from '../../src/hooks/useAuth';
import { palette, radii, shadow, spacing, typography } from '../../src/theme/tokens';

export default function RegisterScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { register, error, clearError, isLoading } = useAuth();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const displayedError = localError ?? error;

  const handleSubmit = async () => {
    if (!username.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
      setLocalError(t('auth.fillAllFields'));
      return;
    }

    if (password.trim().length < 6) {
      setLocalError(t('auth.passwordTooShort'));
      return;
    }

    if (password !== confirmPassword) {
      setLocalError(t('auth.passwordMismatch'));
      return;
    }

    setLocalError(null);
    try {
      await register(username.trim(), email.trim(), password);
    } catch {
      // Error is surfaced through auth context.
    }
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
              <Ionicons name="game-controller" size={30} color={palette.primary} />
            </View>

            <Text style={styles.title}>{t('auth.register')}</Text>
            <Text style={styles.subtitle}>{t('auth.registerDescription')}</Text>

            {displayedError ? (
              <View style={styles.errorBox} accessibilityRole="alert" accessibilityLiveRegion="polite">
                <Text style={styles.errorText}>{displayedError}</Text>
              </View>
            ) : null}

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('auth.username')}</Text>
              <TextInput
                style={styles.input}
                placeholder="YourNickname"
                placeholderTextColor={palette.textMuted}
                value={username}
                onChangeText={(value) => {
                  setUsername(value);
                  setLocalError(null);
                  clearError();
                }}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel={t('auth.username')}
              />
            </View>

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

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('auth.confirmPassword')}</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={palette.textMuted}
                value={confirmPassword}
                onChangeText={(value) => {
                  setConfirmPassword(value);
                  setLocalError(null);
                  clearError();
                }}
                secureTextEntry
                accessibilityLabel={t('auth.confirmPassword')}
              />
            </View>

            <PrimaryButton title={t('auth.registerButton')} loading={isLoading} onPress={handleSubmit} />

            <View style={styles.switchRow}>
              <Text style={styles.switchText}>{t('auth.hasAccount')}</Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/login')} accessibilityRole="link">
                <Text style={styles.switchLink}>{t('auth.loginButton')}</Text>
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
});
