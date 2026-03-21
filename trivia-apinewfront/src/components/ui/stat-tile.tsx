import * as React from 'react';
import { designTokens } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

type StatTone = 'default' | 'primary' | 'success';
type StatSize = 'default' | 'compact';

type StatTileProps = React.ComponentProps<'div'> & {
  label: React.ReactNode;
  value: React.ReactNode;
  tone?: StatTone;
  size?: StatSize;
};

const toneStyles: Record<StatTone, { backgroundColor: string; borderColor: string; valueColor: string }> = {
  default: {
    backgroundColor: designTokens.color.surface,
    borderColor: designTokens.color.border,
    valueColor: designTokens.color.text,
  },
  primary: {
    backgroundColor: designTokens.color.accentSurface,
    borderColor: designTokens.color.border,
    valueColor: designTokens.color.primary,
  },
  success: {
    backgroundColor: designTokens.semantic.state.success.surface,
    borderColor: designTokens.semantic.state.success.border,
    valueColor: designTokens.color.success,
  },
};

const sizeClassName: Record<StatSize, string> = {
  default: 'min-h-28 items-center justify-center px-4 py-4 text-center',
  compact: 'min-h-[88px] min-w-0 items-start justify-between px-4 py-3 text-left',
};

export function StatTile({
  label,
  value,
  tone = 'default',
  size = 'default',
  className,
  style,
  ...props
}: StatTileProps) {
  const palette = toneStyles[tone];

  return (
    <div
      className={cn('flex rounded-2xl border', sizeClassName[size], className)}
      style={{
        backgroundColor: palette.backgroundColor,
        borderColor: palette.borderColor,
        ...style,
      }}
      {...props}
    >
      <div
        className={cn(
          'w-full break-words font-extrabold tracking-tight',
          size === 'compact' ? 'text-xl leading-tight sm:text-2xl md:text-[1.75rem]' : 'text-3xl leading-none'
        )}
        style={{ color: palette.valueColor }}
      >
        {value}
      </div>
      <div
        className={cn(
          'mt-2 w-full break-words whitespace-normal text-xs font-medium leading-4 text-muted-foreground',
          size === 'compact' ? 'uppercase tracking-wide' : null
        )}
      >
        {label}
      </div>
    </div>
  );
}
