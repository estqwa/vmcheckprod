import type { TextStyle, ViewStyle } from 'react-native';
import { designTokens } from '@trivia/shared';

export const palette = {
  ...designTokens.color,
  primaryPressed: designTokens.color.primaryHover,
  white: '#ffffff',
  black: '#000000',
  errorSoftBorder: '#fca5a5',
  errorSoftBg: '#fff1f2',
  errorTextStrong: '#9f1239',
  errorTextMuted: '#7f1d1d',
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
