import type { PropsWithChildren } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { palette, spacing, typography } from '../../theme/tokens';

type FormFieldProps = PropsWithChildren<{
  label: string;
  hint?: string;
  error?: string;
  style?: StyleProp<ViewStyle>;
}>;

export function FormField({ label, hint, error, style, children }: FormFieldProps) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 6,
  },
  label: {
    ...typography.label,
    color: palette.text,
  },
  hint: {
    ...typography.caption,
    color: palette.textMuted,
  },
  error: {
    marginTop: spacing.xs,
    ...typography.caption,
    color: '#b91c1c',
  },
});
