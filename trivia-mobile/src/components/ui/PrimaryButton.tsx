import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, type TouchableOpacityProps } from 'react-native';
import { palette, radii, spacing } from '../../theme/tokens';

type PrimaryButtonProps = TouchableOpacityProps & {
  title: string;
  loading?: boolean;
};

export function PrimaryButton({ title, loading = false, disabled, style, ...props }: PrimaryButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      style={[styles.button, isDisabled ? styles.buttonDisabled : null, style]}
      disabled={isDisabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: isDisabled }}
      {...props}
    >
      {loading ? <ActivityIndicator color={palette.white} /> : <Text style={styles.text}>{title}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: palette.primary,
    minHeight: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  text: {
    color: palette.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
