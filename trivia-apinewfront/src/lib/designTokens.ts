import { designTokens as sharedTokens } from '@trivia/shared';

const pxToRem = (px: number) => `${px / 16}rem`;

// Web adapter for shared design tokens.
// Source of truth lives in @trivia/shared.
export const designTokens = {
    color: sharedTokens.color,
    radius: {
        sm: pxToRem(sharedTokens.radius.sm),
        md: pxToRem(sharedTokens.radius.md),
        lg: pxToRem(sharedTokens.radius.lg),
        xl: pxToRem(sharedTokens.radius.xl),
        pill: `${sharedTokens.radius.pill}px`,
    },
    spacing: {
        xs: pxToRem(sharedTokens.spacing.xs),
        sm: pxToRem(sharedTokens.spacing.sm),
        md: pxToRem(sharedTokens.spacing.md),
        lg: pxToRem(sharedTokens.spacing.lg),
        xl: pxToRem(sharedTokens.spacing.xl),
        xxl: pxToRem(sharedTokens.spacing.xxl),
    },
    iconSize: sharedTokens.iconSize,
    typography: {
        title: { size: pxToRem(sharedTokens.typography.title.size), weight: sharedTokens.typography.title.weight },
        sectionTitle: { size: pxToRem(sharedTokens.typography.sectionTitle.size), weight: sharedTokens.typography.sectionTitle.weight },
        subtitle: { size: pxToRem(sharedTokens.typography.subtitle.size), weight: sharedTokens.typography.subtitle.weight },
    },
} as const;
