import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { palette, radii, spacing, typography } from '../../theme/tokens';

type CountdownTileProps = {
  value: string | number;
  label: string;
  style?: StyleProp<ViewStyle>;
};

export function CountdownTile({ value, label, style }: CountdownTileProps) {
  return (
    <View style={[styles.tile, style]} accessibilityRole="timer">
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    minWidth: 64,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    color: palette.text,
    fontSize: typography.metric.fontSize,
    lineHeight: typography.metric.lineHeight,
    fontWeight: '800',
  },
  label: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginTop: 2,
  },
});
