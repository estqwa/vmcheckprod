import * as React from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type SurfaceTone = 'default' | 'muted' | 'accent' | 'danger';

const toneClassName: Record<SurfaceTone, string> = {
  default: 'border-border bg-card shadow-sm',
  muted: 'border-border/80 bg-muted/30 shadow-none',
  accent: 'border-primary/10 bg-primary/5 shadow-sm',
  danger: 'border-destructive/15 bg-destructive/5 shadow-sm',
};

type SurfaceCardProps = React.ComponentProps<typeof Card> & {
  tone?: SurfaceTone;
};

export function SurfaceCard({ tone = 'default', className, ...props }: SurfaceCardProps) {
  return <Card className={cn('rounded-2xl border', toneClassName[tone], className)} {...props} />;
}
