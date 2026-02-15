import { Pressable, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { palette, radii, spacing } from '../../theme/tokens';

export function LanguageToggle() {
  const { t } = useTranslation();

  const toggle = () => {
    void i18n.changeLanguage(i18n.language === 'ru' ? 'kk' : 'ru');
  };

  return (
    <Pressable style={({ pressed }) => [styles.button, pressed ? styles.buttonPressed : null]} onPress={toggle}>
      <Text style={styles.text}>
        {t('settings.language')}: {i18n.language === 'ru' ? t('settings.russian') : t('settings.kazakh')}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: palette.accentSurface,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
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
