import { designTokens as sharedTokens } from '@trivia/shared';

const pxToRem = (px: number) => `${px / 16}rem`;

// Web adapter for shared design tokens.
// Source of truth lives in @trivia/shared.
export const designTokens = {
    meta: sharedTokens.meta,
    base: {
        ...sharedTokens.base,
        spacingScale: Object.fromEntries(
            Object.entries(sharedTokens.base.spacingScale).map(([key, value]) => [key, pxToRem(value)])
        ),
        radiusScale: {
            sm: pxToRem(sharedTokens.base.radiusScale.sm),
            md: pxToRem(sharedTokens.base.radiusScale.md),
            lg: pxToRem(sharedTokens.base.radiusScale.lg),
            xl: pxToRem(sharedTokens.base.radiusScale.xl),
            pill: `${sharedTokens.base.radiusScale.pill}px`,
        },
    },
    semantic: {
        color: sharedTokens.semantic.color,
        state: sharedTokens.semantic.state,
    },
    component: {
        ...sharedTokens.component,
        card: {
            ...sharedTokens.component.card,
            radius: pxToRem(sharedTokens.component.card.radius),
            padding: pxToRem(sharedTokens.component.card.padding),
        },
        field: {
            ...sharedTokens.component.field,
            minHeight: pxToRem(sharedTokens.component.field.minHeight),
            radius: pxToRem(sharedTokens.component.field.radius),
        },
        button: {
            ...sharedTokens.component.button,
            minHeight: pxToRem(sharedTokens.component.button.minHeight),
            radius: pxToRem(sharedTokens.component.button.radius),
            horizontalPadding: pxToRem(sharedTokens.component.button.horizontalPadding),
        },
    },
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
        display: {
            size: pxToRem(sharedTokens.typography.display.size),
            lineHeight: pxToRem(sharedTokens.typography.display.lineHeight),
            weight: sharedTokens.typography.display.weight,
        },
        headline: {
            size: pxToRem(sharedTokens.typography.headline.size),
            lineHeight: pxToRem(sharedTokens.typography.headline.lineHeight),
            weight: sharedTokens.typography.headline.weight,
        },
        title: {
            size: pxToRem(sharedTokens.typography.title.size),
            lineHeight: pxToRem(sharedTokens.typography.title.lineHeight),
            weight: sharedTokens.typography.title.weight,
        },
        sectionTitle: {
            size: pxToRem(sharedTokens.typography.sectionTitle.size),
            lineHeight: pxToRem(sharedTokens.typography.sectionTitle.lineHeight),
            weight: sharedTokens.typography.sectionTitle.weight,
        },
        subtitle: {
            size: pxToRem(sharedTokens.typography.subtitle.size),
            lineHeight: pxToRem(sharedTokens.typography.subtitle.lineHeight),
            weight: sharedTokens.typography.subtitle.weight,
        },
        body: {
            size: pxToRem(sharedTokens.typography.body.size),
            lineHeight: pxToRem(sharedTokens.typography.body.lineHeight),
            weight: sharedTokens.typography.body.weight,
        },
        bodySm: {
            size: pxToRem(sharedTokens.typography.bodySm.size),
            lineHeight: pxToRem(sharedTokens.typography.bodySm.lineHeight),
            weight: sharedTokens.typography.bodySm.weight,
        },
        label: {
            size: pxToRem(sharedTokens.typography.label.size),
            lineHeight: pxToRem(sharedTokens.typography.label.lineHeight),
            weight: sharedTokens.typography.label.weight,
        },
        caption: {
            size: pxToRem(sharedTokens.typography.caption.size),
            lineHeight: pxToRem(sharedTokens.typography.caption.lineHeight),
            weight: sharedTokens.typography.caption.weight,
        },
        metric: {
            size: pxToRem(sharedTokens.typography.metric.size),
            lineHeight: pxToRem(sharedTokens.typography.metric.lineHeight),
            weight: sharedTokens.typography.metric.weight,
        },
    },
} as const;
