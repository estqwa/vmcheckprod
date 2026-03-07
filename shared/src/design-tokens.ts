// Canonical design tokens shared across web and mobile.
// Values are stored in px (or plain numbers) so each platform
// can transform them to its preferred units.
export const designTokens = {
  color: {
    primary: '#c24141',
    primaryHover: '#b91c1c',
    background: '#fafbfc',
    surface: '#ffffff',
    surfaceMuted: '#f3f4f6',
    text: '#4a4a4a',
    textMuted: '#6b7280',
    border: '#e5e7eb',
    accentSurface: '#fff0f0',
    success: '#15803d',
    warning: '#b45309',
    danger: '#ef4444',
    info: '#94a3b8',
    prize: '#166534',
  },

  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    pill: 9999,
  },

  spacing: {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 18,
    xl: 24,
    xxl: 32,
  },

  iconSize: {
    nav: 16,
    cta: 20,
    header: 24,
  },

  typography: {
    title: { size: 28, weight: '800' as const },
    sectionTitle: { size: 20, weight: '700' as const },
    subtitle: { size: 15, weight: '400' as const },
  },
} as const;

export type DesignTokens = typeof designTokens;

