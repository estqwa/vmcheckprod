import type { PropsWithChildren } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { palette, radii, shadow, spacing } from '../../theme/tokens';

type SurfaceCardProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  tone?: 'default' | 'muted';
  compact?: boolean;
}>;

export function SurfaceCard({
  children,
  style,
  tone = 'default',
  compact = false,
}: SurfaceCardProps) {
  return (
    <View
      style={[
        styles.card,
        tone === 'muted' ? styles.muted : styles.defaultTone,
        compact ? styles.compactPadding : styles.defaultPadding,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: palette.border,
    ...shadow.card,
  },
  defaultTone: {
    backgroundColor: palette.surface,
  },
  muted: {
    backgroundColor: palette.surfaceMuted,
  },
  defaultPadding: {
    padding: spacing.xl,
  },
  compactPadding: {
    padding: spacing.md,
  },
});
