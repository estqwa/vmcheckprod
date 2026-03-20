import * as React from 'react';
import { cn } from '@/lib/utils';

type EmptyStateProps = React.ComponentProps<'div'> & {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  children,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center',
        className
      )}
      {...props}
    >
      {icon ? <div className="text-muted-foreground">{icon}</div> : null}
      <h3 className={cn('text-base font-semibold text-foreground', icon ? 'mt-4' : null)}>{title}</h3>
      {description ? <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p> : null}
      {children}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
