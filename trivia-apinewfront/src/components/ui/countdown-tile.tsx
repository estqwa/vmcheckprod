import * as React from 'react';
import { cn } from '@/lib/utils';

type CountdownTileProps = React.ComponentProps<'div'> & {
  value: string | number;
  label: React.ReactNode;
};

export function CountdownTile({ value, label, className, ...props }: CountdownTileProps) {
  return (
    <div
      className={cn(
        'flex min-w-[70px] flex-col items-center rounded-xl border border-border bg-muted/40 px-2 py-2.5 text-center',
        className
      )}
      {...props}
    >
      <div className="text-2xl font-extrabold tabular-nums text-foreground">{value}</div>
      <div className="mt-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}
