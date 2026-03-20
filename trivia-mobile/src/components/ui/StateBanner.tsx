import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { radii, semanticState, spacing, typography } from '../../theme/tokens';

type BannerTone = keyof typeof semanticState;

type StateBannerProps = {
  tone: BannerTone;
  title?: string;
  description?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityRole?: 'alert';
};

export function StateBanner({ tone, title, description, style, accessibilityRole }: StateBannerProps) {
  const colors = semanticState[tone];

  return (
    <View
      accessibilityRole={accessibilityRole ?? (tone === 'danger' || tone === 'offline' ? 'alert' : undefined)}
      accessibilityLiveRegion={tone === 'danger' || tone === 'offline' ? 'polite' : undefined}
      style={[
        styles.banner,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {title ? <Text style={[styles.title, { color: colors.text }]}>{title}</Text> : null}
      {description ? (
        <Text style={[styles.description, { color: colors.text }]}>{description}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  title: {
    ...typography.label,
  },
  description: {
    ...typography.bodySm,
  },
});
