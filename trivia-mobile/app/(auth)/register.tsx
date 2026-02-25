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
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { RegisterData } from '@trivia/shared';
import { BrandHeader } from '../../src/components/ui/BrandHeader';
import { LanguageToggle } from '../../src/components/ui/LanguageToggle';
import { PrimaryButton } from '../../src/components/ui/PrimaryButton';
import { useAuth } from '../../src/hooks/useAuth';
import { useGoogleCodeAuthRequest } from '../../src/hooks/useGoogleCodeAuthRequest';
import { palette, radii, shadow, spacing, typography } from '../../src/theme/tokens';

export default function RegisterScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { register, loginWithGoogle, error, clearError, isLoading } = useAuth();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const google = useGoogleCodeAuthRequest();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gender, setGender] = useState<RegisterData['gender'] | ''>('');
  const [tosAccepted, setTosAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const displayedError = localError ?? error;

  const clearErrors = () => {
    setLocalError(null);
    clearError();
  };

  const formatDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const handleSubmit = async () => {
    if (!firstName.trim() || !lastName.trim() || !username.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
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

    if (!birthDate) {
      setLocalError(t('auth.birthDateRequired'));
      return;
    }

    if (!gender) {
      setLocalError(t('auth.genderRequired'));
      return;
    }

    if (!tosAccepted || !privacyAccepted) {
      setLocalError(t('auth.acceptTerms'));
      return;
    }

    setLocalError(null);
    try {
      await register({
        username: username.trim(),
        email: email.trim(),
        password,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        birth_date: formatDate(birthDate),
        gender,
        tos_accepted: tosAccepted,
        privacy_accepted: privacyAccepted,
      });
      router.replace('/(auth)/verify-email' as never);
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
          setLocalError(apiErr.error || t('auth.googleSignUpFailed'));
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
    clearErrors();
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
              <Ionicons name="game-controller" size={30} color={palette.primary} />
            </View>

            <Text style={styles.title}>{t('auth.register')}</Text>
            <Text style={styles.subtitle}>{t('auth.registerDescription')}</Text>

            {displayedError ? (
              <View style={styles.errorBox} accessibilityRole="alert" accessibilityLiveRegion="polite">
                <Text style={styles.errorText}>{displayedError}</Text>
              </View>
            ) : null}

            {/* First + Last name */}
            <View style={styles.row}>
              <View style={[styles.fieldGroup, styles.halfField]}>
                <Text style={styles.label}>{t('auth.firstName')}</Text>
                <TextInput
                  style={styles.input}
                  value={firstName}
                  onChangeText={(v) => { setFirstName(v); clearErrors(); }}
                  autoCapitalize="words"
                  accessibilityLabel={t('auth.firstName')}
                />
              </View>
              <View style={[styles.fieldGroup, styles.halfField]}>
                <Text style={styles.label}>{t('auth.lastName')}</Text>
                <TextInput
                  style={styles.input}
                  value={lastName}
                  onChangeText={(v) => { setLastName(v); clearErrors(); }}
                  autoCapitalize="words"
                  accessibilityLabel={t('auth.lastName')}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('auth.username')}</Text>
              <TextInput
                style={styles.input}
                placeholder="YourNickname"
                placeholderTextColor={palette.textMuted}
                value={username}
                onChangeText={(v) => { setUsername(v); clearErrors(); }}
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
                onChangeText={(v) => { setEmail(v); clearErrors(); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel={t('auth.email')}
              />
            </View>

            {/* Birth date */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('auth.birthDate')}</Text>
              <TouchableOpacity
                style={styles.input}
                onPress={() => setShowDatePicker(true)}
                accessibilityLabel={t('auth.birthDate')}
              >
                <Text style={{ color: birthDate ? palette.text : palette.textMuted, lineHeight: 48 }}>
                  {birthDate ? formatDate(birthDate) : 'YYYY-MM-DD'}
                </Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={birthDate || new Date(2000, 0, 1)}
                  mode="date"
                  maximumDate={new Date()}
                  onChange={(_, date) => {
                    setShowDatePicker(Platform.OS === 'ios');
                    if (date) setBirthDate(date);
                  }}
                />
              )}
            </View>

            {/* Gender */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('auth.gender')}</Text>
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={gender}
                  onValueChange={(v) => { setGender(v as RegisterData['gender'] | ''); clearErrors(); }}
                  style={styles.picker}
                >
                  <Picker.Item label={t('auth.selectGender')} value="" />
                  <Picker.Item label={t('auth.genderMale')} value="male" />
                  <Picker.Item label={t('auth.genderFemale')} value="female" />
                  <Picker.Item label={t('auth.genderOther')} value="other" />
                  <Picker.Item label={t('auth.genderPreferNot')} value="prefer_not_to_say" />
                </Picker>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('auth.password')}</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={palette.textMuted}
                value={password}
                onChangeText={(v) => { setPassword(v); clearErrors(); }}
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
                onChangeText={(v) => { setConfirmPassword(v); clearErrors(); }}
                secureTextEntry
                accessibilityLabel={t('auth.confirmPassword')}
              />
            </View>

            {/* Legal checkboxes */}
            <View style={styles.checkboxRow}>
              <TouchableOpacity
                onPress={() => setTosAccepted(!tosAccepted)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: tosAccepted }}
              >
                <Ionicons
                  name={tosAccepted ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={tosAccepted ? palette.primary : palette.textMuted}
                />
              </TouchableOpacity>
              <View style={styles.checkboxTextWrap}>
                <Text style={styles.checkboxLabel}>
                  {t('auth.acceptTos')}
                </Text>
                <TouchableOpacity onPress={() => router.push('/terms' as never)} accessibilityRole="link">
                  <Text style={styles.inlineLink}>{t('auth.termsLink')}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.checkboxRow}>
              <TouchableOpacity
                onPress={() => setPrivacyAccepted(!privacyAccepted)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: privacyAccepted }}
              >
                <Ionicons
                  name={privacyAccepted ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={privacyAccepted ? palette.primary : palette.textMuted}
                />
              </TouchableOpacity>
              <View style={styles.checkboxTextWrap}>
                <Text style={styles.checkboxLabel}>
                  {t('auth.acceptPrivacy')}
                </Text>
                <TouchableOpacity onPress={() => router.push('/privacy' as never)} accessibilityRole="link">
                  <Text style={styles.inlineLink}>{t('auth.privacyLink')}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <PrimaryButton title={t('auth.registerButton')} loading={isLoading} onPress={handleSubmit} />

            {google.enabled ? (
              <TouchableOpacity
                style={styles.googleButton}
                onPress={() => void handleGooglePress()}
                disabled={!google.request || isLoading || isGoogleLoading}
                accessibilityRole="button"
              >
                <Text style={styles.googleButtonText}>
                  {isGoogleLoading ? t('auth.googleLoading') : t('auth.googleRegister')}
                </Text>
              </TouchableOpacity>
            ) : null}

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
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  halfField: {
    flex: 1,
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
  pickerWrapper: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    overflow: 'hidden',
  },
  picker: {
    height: 48,
    color: palette.text,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  checkboxTextWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  checkboxLabel: {
    color: palette.textMuted,
    fontSize: 13,
    flex: 1,
    paddingTop: 2,
  },
  inlineLink: {
    color: palette.primary,
    fontSize: 13,
    fontWeight: '700',
    paddingTop: 2,
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
