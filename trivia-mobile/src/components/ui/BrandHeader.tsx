import type { ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, radii, spacing } from '../../theme/tokens';

type BrandHeaderProps = {
  title?: string;
  subtitle?: string;
  onBackPress?: () => void;
  rightSlot?: ReactNode;
};

export function BrandHeader({ title = 'QazaQuiz', subtitle, onBackPress, rightSlot }: BrandHeaderProps) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.left}>
        {onBackPress ? (
          <TouchableOpacity style={styles.backButton} onPress={onBackPress}>
            <Ionicons name="arrow-back" size={18} color={palette.text} />
          </TouchableOpacity>
        ) : null}
        <View style={styles.brandIcon}>
          <Text style={styles.brandIconText}>Q</Text>
        </View>
        <View>
          <Text style={styles.brandTitle}>{title}</Text>
          {subtitle ? <Text style={styles.brandSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {rightSlot ? <View style={styles.right}>{rightSlot}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surfaceMuted,
  },
  brandIcon: {
    width: 34,
    height: 34,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.primary,
  },
  brandIconText: {
    color: palette.white,
    fontSize: 17,
    fontWeight: '800',
  },
  brandTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '800',
  },
  brandSubtitle: {
    color: palette.textMuted,
    fontSize: 12,
  },
  right: {
    marginLeft: spacing.md,
  },
});
