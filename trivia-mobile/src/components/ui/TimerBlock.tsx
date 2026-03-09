import { StyleSheet, Text, View } from 'react-native';
import { palette, radii } from '../../theme/tokens';

type TimerBlockProps = {
  value: string | number;
  label: string;
};

export function TimerBlock({ value, label }: TimerBlockProps) {
  return (
    <View style={styles.block}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    minWidth: 70,
    backgroundColor: palette.surfaceMuted,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.md,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  value: {
    fontSize: 24,
    fontWeight: '800',
    color: palette.text,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: palette.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
});
