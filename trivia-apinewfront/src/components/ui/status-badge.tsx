import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { designTokens } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

type StatusTone = keyof typeof designTokens.semantic.state | 'neutral';

const neutralPalette = {
  surface: designTokens.color.surfaceMuted,
  border: designTokens.color.border,
  text: designTokens.color.textMuted,
  icon: designTokens.color.textMuted,
} as const;

type StatusBadgeProps = React.ComponentProps<typeof Badge> & {
  tone?: StatusTone;
  icon?: React.ReactNode;
};

export function StatusBadge({ tone = 'neutral', icon, className, style, children, ...props }: StatusBadgeProps) {
  const palette = tone === 'neutral' ? neutralPalette : designTokens.semantic.state[tone];

  return (
    <Badge
      variant="outline"
      className={cn('gap-1.5 border px-2.5 py-1 text-xs font-semibold', className)}
      style={{
        backgroundColor: palette.surface,
        borderColor: palette.border,
        color: palette.text,
        ...style,
      }}
      {...props}
    >
      {icon ? <span style={{ color: palette.icon }}>{icon}</span> : null}
      {children}
    </Badge>
  );
}
