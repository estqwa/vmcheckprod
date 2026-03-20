import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { palette, spacing, typography } from '../../theme/tokens';
import { SurfaceCard } from './SurfaceCard';

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function EmptyState({ title, description, icon, action, style }: EmptyStateProps) {
  return (
    <SurfaceCard tone="muted" compact style={style}>
      <View style={styles.content}>
        {icon ? <View style={styles.icon}>{icon}</View> : null}
        <Text style={styles.title}>{title}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
        {action ? <View style={styles.action}>{action}</View> : null}
      </View>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.label,
    color: palette.text,
    textAlign: 'center',
  },
  description: {
    ...typography.bodySm,
    color: palette.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  action: {
    marginTop: spacing.md,
  },
});
