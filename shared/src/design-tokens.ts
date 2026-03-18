// Canonical design tokens shared across web and mobile.
// Values are stored in px (or plain numbers) so each platform
// can transform them to its preferred units.
//
// Phase 1 goal:
// keep the existing live token aliases stable while making the
// design system structure explicit for future refactors.
const primitiveColor = {
  coral500: '#c24141',
  coral600: '#b91c1c',
  gray50: '#fafbfc',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray500: '#6b7280',
  gray700: '#4a4a4a',
  rose50: '#fff0f0',
  green700: '#15803d',
  green800: '#166534',
  amber700: '#b45309',
  red500: '#ef4444',
  slate400: '#94a3b8',
  white: '#ffffff',
  black: '#000000',
} as const;

const semanticColor = {
  primary: primitiveColor.coral500,
  primaryHover: primitiveColor.coral600,
  background: primitiveColor.gray50,
  surface: primitiveColor.white,
  surfaceMuted: primitiveColor.gray100,
  text: primitiveColor.gray700,
  textMuted: primitiveColor.gray500,
  border: primitiveColor.gray200,
  accentSurface: primitiveColor.rose50,
  success: primitiveColor.green700,
  warning: primitiveColor.amber700,
  danger: primitiveColor.red500,
  info: primitiveColor.slate400,
  prize: primitiveColor.green800,
} as const;

const semanticState = {
  success: {
    surface: '#ecfdf5',
    border: '#86efac',
    text: '#166534',
    icon: '#166534',
  },
  warning: {
    surface: '#fffbeb',
    border: '#fcd34d',
    text: '#92400e',
    icon: '#b45309',
  },
  danger: {
    surface: '#fff1f2',
    border: '#fca5a5',
    text: '#9f1239',
    icon: '#b91c1c',
  },
  info: {
    surface: '#eff6ff',
    border: '#93c5fd',
    text: '#1d4ed8',
    icon: '#1d4ed8',
  },
  offline: {
    surface: '#fee2e2',
    border: '#fecaca',
    text: '#991b1b',
    icon: '#7f1d1d',
  },
} as const;

const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 9999,
} as const;

const spacing = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 32,
} as const;

const typography = {
  display: { size: 34, lineHeight: 40, weight: '800' as const },
  headline: { size: 28, lineHeight: 34, weight: '800' as const },
  title: { size: 28, lineHeight: 34, weight: '800' as const },
  sectionTitle: { size: 20, lineHeight: 26, weight: '700' as const },
  subtitle: { size: 15, lineHeight: 21, weight: '400' as const },
  body: { size: 16, lineHeight: 24, weight: '400' as const },
  bodySm: { size: 14, lineHeight: 20, weight: '400' as const },
  label: { size: 14, lineHeight: 20, weight: '600' as const },
  caption: { size: 12, lineHeight: 16, weight: '500' as const },
  metric: { size: 24, lineHeight: 30, weight: '800' as const },
} as const;

export const designTokens = {
  meta: {
    standard: 'phase-1',
    sourceOfTruth: '@trivia/shared/src/design-tokens.ts',
    principles: ['shared-semantics', 'platform-respectful-shells', 'non-breaking-rollout'],
  },

  base: {
    color: primitiveColor,
    fontFamily: {
      sans: 'Inter',
      display: 'Inter',
      mono: 'Geist Mono',
    },
    spacingScale: {
      4: 4,
      8: 8,
      12: 12,
      16: 16,
      24: 24,
      32: 32,
      40: 40,
      48: 48,
      64: 64,
    },
    radiusScale: radius,
  },

  semantic: {
    color: semanticColor,
    state: semanticState,
  },

  component: {
    touchTarget: {
      mobileMin: 44,
      mobilePreferred: 48,
    },
    card: {
      radius: radius.xl,
      borderWidth: 1,
      padding: spacing.lg,
    },
    field: {
      minHeight: 48,
      radius: radius.md,
      borderWidth: 1,
    },
    button: {
      minHeight: 48,
      radius: radius.md,
      horizontalPadding: spacing.lg,
    },
    nav: {
      mobileItemMinHeight: 52,
      iconSize: 20,
    },
  },

  // Compatibility layer used by current screens.
  color: semanticColor,
  radius,
  spacing,

  iconSize: {
    nav: 16,
    cta: 20,
    header: 24,
  },

  typography,
} as const;

export type DesignTokens = typeof designTokens;
