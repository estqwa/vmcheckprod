import { Pressable, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import i18n, { changeAndPersistLanguage } from '../../i18n';
import { palette, radii, spacing } from '../../theme/tokens';

export function LanguageToggle() {
  const { t } = useTranslation();
  const isRussian = i18n.language === 'ru';
  const currentLanguageLabel = isRussian ? t('settings.russian') : t('settings.kazakh');
  const nextLanguageLabel = isRussian ? t('settings.kazakh') : t('settings.russian');

  const toggle = () => {
    void changeAndPersistLanguage(isRussian ? 'kk' : 'ru');
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.button, pressed ? styles.buttonPressed : null]}
      onPress={toggle}
      accessibilityRole="button"
      accessibilityLabel={`${t('settings.language')}: ${currentLanguageLabel}`}
      accessibilityHint={`${t('settings.language')}: ${nextLanguageLabel}`}
    >
      <Text style={styles.text}>
        {t('settings.language')}: {currentLanguageLabel}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    backgroundColor: palette.accentSurface,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  text: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: '700',
  },
});

