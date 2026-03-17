import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { BrandHeader } from '../src/components/ui/BrandHeader';
import { LEGAL_TOS_VERSION } from '../src/constants/config';
import { getLegalCopy } from '../src/legal/content';
import { palette, radii, shadow, spacing, typography } from '../src/theme/tokens';
import { normalizeLegalText } from '../src/utils/legalText';

export default function TermsScreen() {
  const { t, i18n } = useTranslation();
  const body = getLegalCopy(i18n.resolvedLanguage).terms;
  const paragraphs = normalizeLegalText(body);
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <BrandHeader subtitle={t('legal.termsTitle')} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>{t('legal.termsTitle')}</Text>
          <Text style={styles.version}>{t('legal.version', { version: LEGAL_TOS_VERSION })}</Text>
          {paragraphs.map((paragraph, idx) => (
            <Text key={idx} style={styles.text}>
              {paragraph}
            </Text>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.card,
  },
  title: { ...typography.sectionTitle },
  version: { color: palette.textMuted, fontSize: 12 },
  text: { color: palette.text, lineHeight: 22 },
});
