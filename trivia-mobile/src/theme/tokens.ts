import type { TextStyle, ViewStyle } from 'react-native';
import { designTokens } from '@trivia/shared';

export const palette = {
  ...designTokens.color,
  primaryPressed: designTokens.color.primaryHover,
  white: '#ffffff',
  black: '#000000',
} as const;

export const radii = {
  sm: designTokens.radius.sm,
  md: designTokens.radius.md,
  lg: designTokens.radius.lg,
  xl: designTokens.radius.xl,
  pill: designTokens.radius.pill,
} as const;

export const spacing = {
  xs: designTokens.spacing.xs,
  sm: designTokens.spacing.sm,
  md: designTokens.spacing.md,
  lg: designTokens.spacing.lg,
  xl: designTokens.spacing.xl,
  xxl: designTokens.spacing.xxl,
} as const;

export const typography = {
  title: {
    fontSize: designTokens.typography.title.size,
    fontWeight: designTokens.typography.title.weight,
    color: palette.text,
  } satisfies TextStyle,
  subtitle: {
    fontSize: designTokens.typography.subtitle.size,
    color: palette.textMuted,
  } satisfies TextStyle,
  sectionTitle: {
    fontSize: designTokens.typography.sectionTitle.size,
    fontWeight: designTokens.typography.sectionTitle.weight,
    color: palette.text,
  } satisfies TextStyle,
} as const;

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  } satisfies ViewStyle,
};

export type QuizStatusTone = {
  backgroundColor: string;
  textColor: string;
};

export function getQuizStatusTone(status: string): QuizStatusTone {
  switch (status) {
    case 'in_progress':
      return { backgroundColor: '#dcfce7', textColor: '#166534' };
    case 'scheduled':
      return { backgroundColor: '#dbeafe', textColor: '#1d4ed8' };
    case 'completed':
      return { backgroundColor: '#f3f4f6', textColor: '#374151' };
    case 'cancelled':
      return { backgroundColor: '#fee2e2', textColor: '#991b1b' };
    default:
      return { backgroundColor: '#f3f4f6', textColor: '#374151' };
  }
}
