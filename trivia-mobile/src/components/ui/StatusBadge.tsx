import type { ReactNode } from 'react';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { StyleSheet, Text, View } from 'react-native';
import { palette, radii, semanticState, spacing, typography } from '../../theme/tokens';

type StatusTone = keyof typeof semanticState | 'neutral';

const neutralPalette = {
  surface: palette.surfaceMuted,
  border: palette.border,
  text: palette.textMuted,
} as const;

type StatusBadgeProps = {
  tone: StatusTone;
  label: string;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

export function StatusBadge({ tone, label, icon, style, textStyle }: StatusBadgeProps) {
  const colors = tone === 'neutral' ? neutralPalette : semanticState[tone];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text style={[styles.label, { color: colors.text }, textStyle]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...typography.caption,
    fontWeight: '700',
  },
});
