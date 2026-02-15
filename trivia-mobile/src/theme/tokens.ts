import type { TextStyle, ViewStyle } from 'react-native';

export const palette = {
  primary: '#ff6b6b',
  primaryPressed: '#fa5252',
  background: '#fafbfc',
  surface: '#ffffff',
  surfaceMuted: '#f3f4f6',
  text: '#4a4a4a',
  textMuted: '#9ca3af',
  border: '#e5e7eb',
  accentSurface: '#fff0f0',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#94a3b8',
  prize: '#16a34a',
  white: '#ffffff',
  black: '#000000',
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 32,
} as const;

export const typography = {
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: palette.text,
  } satisfies TextStyle,
  subtitle: {
    fontSize: 15,
    color: palette.textMuted,
  } satisfies TextStyle,
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
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

export function formatCompactCurrency(value: number): string {
  return `${value.toLocaleString()} тг`;
}
