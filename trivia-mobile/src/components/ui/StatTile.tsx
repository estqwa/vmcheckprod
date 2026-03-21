import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { palette, radii, spacing, typography } from '../../theme/tokens';

type StatTone = 'default' | 'primary' | 'success';
type StatSize = 'default' | 'compact';

type StatTileProps = {
  label: string;
  value: string | number;
  tone?: StatTone;
  size?: StatSize;
  style?: StyleProp<ViewStyle>;
};

const toneStyles: Record<StatTone, { backgroundColor: string; valueColor: string }> = {
  default: {
    backgroundColor: palette.surface,
    valueColor: palette.text,
  },
  primary: {
    backgroundColor: palette.accentSurface,
    valueColor: palette.primary,
  },
  success: {
    backgroundColor: '#ecfdf5',
    valueColor: palette.success,
  },
};

export function StatTile({ label, value, tone = 'default', size = 'default', style }: StatTileProps) {
  const colors = toneStyles[tone];

  return (
    <View
      style={[
        styles.tile,
        size === 'compact' ? styles.compactTile : styles.defaultTile,
        { backgroundColor: colors.backgroundColor },
        style,
      ]}
    >
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={size === 'compact' ? 0.65 : 0.8}
        style={[
          styles.value,
          size === 'compact' ? styles.compactValue : styles.defaultValue,
          { color: colors.valueColor },
        ]}
      >
        {value}
      </Text>
      <Text style={[styles.label, size === 'compact' ? styles.compactLabel : null]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.border,
  },
  defaultTile: {
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 112,
  },
  compactTile: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    minWidth: 0,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    minHeight: 88,
  },
  value: {
    ...typography.metric,
    textAlign: 'center',
  },
  defaultValue: {
    fontSize: typography.metric.fontSize,
    lineHeight: typography.metric.lineHeight,
  },
  compactValue: {
    fontSize: 22,
    lineHeight: 28,
    textAlign: 'left',
    width: '100%',
  },
  label: {
    ...typography.caption,
    color: palette.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  compactLabel: {
    textAlign: 'left',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginTop: 4,
  },
});
