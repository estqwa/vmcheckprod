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
  display: {
    fontSize: designTokens.typography.display.size,
    fontWeight: designTokens.typography.display.weight,
    lineHeight: designTokens.typography.display.lineHeight,
    color: palette.text,
  } satisfies TextStyle,
  headline: {
    fontSize: designTokens.typography.headline.size,
    fontWeight: designTokens.typography.headline.weight,
    lineHeight: designTokens.typography.headline.lineHeight,
    color: palette.text,
  } satisfies TextStyle,
  title: {
    fontSize: designTokens.typography.title.size,
    fontWeight: designTokens.typography.title.weight,
    lineHeight: designTokens.typography.title.lineHeight,
    color: palette.text,
  } satisfies TextStyle,
  subtitle: {
    fontSize: designTokens.typography.subtitle.size,
    fontWeight: designTokens.typography.subtitle.weight,
    lineHeight: designTokens.typography.subtitle.lineHeight,
    color: palette.textMuted,
  } satisfies TextStyle,
  sectionTitle: {
    fontSize: designTokens.typography.sectionTitle.size,
    fontWeight: designTokens.typography.sectionTitle.weight,
    lineHeight: designTokens.typography.sectionTitle.lineHeight,
    color: palette.text,
  } satisfies TextStyle,
  body: {
    fontSize: designTokens.typography.body.size,
    fontWeight: designTokens.typography.body.weight,
    lineHeight: designTokens.typography.body.lineHeight,
    color: palette.text,
  } satisfies TextStyle,
  bodySm: {
    fontSize: designTokens.typography.bodySm.size,
    fontWeight: designTokens.typography.bodySm.weight,
    lineHeight: designTokens.typography.bodySm.lineHeight,
    color: palette.textMuted,
  } satisfies TextStyle,
  label: {
    fontSize: designTokens.typography.label.size,
    fontWeight: designTokens.typography.label.weight,
    lineHeight: designTokens.typography.label.lineHeight,
    color: palette.text,
  } satisfies TextStyle,
  caption: {
    fontSize: designTokens.typography.caption.size,
    fontWeight: designTokens.typography.caption.weight,
    lineHeight: designTokens.typography.caption.lineHeight,
    color: palette.textMuted,
  } satisfies TextStyle,
  metric: {
    fontSize: designTokens.typography.metric.size,
    fontWeight: designTokens.typography.metric.weight,
    lineHeight: designTokens.typography.metric.lineHeight,
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

export const semanticState = designTokens.semantic.state;

export const component = designTokens.component;
