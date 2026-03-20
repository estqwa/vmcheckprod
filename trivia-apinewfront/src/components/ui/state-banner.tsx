import * as React from 'react';
import { designTokens } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

type BannerTone = keyof typeof designTokens.semantic.state;

type StateBannerProps = React.ComponentProps<'div'> & {
  tone?: BannerTone;
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
};

export function StateBanner({
  tone = 'info',
  title,
  description,
  icon,
  action,
  className,
  style,
  children,
  role,
  ...props
}: StateBannerProps) {
  const palette = designTokens.semantic.state[tone];
  const resolvedRole = role ?? (tone === 'danger' || tone === 'offline' ? 'alert' : 'status');

  return (
    <div
      role={resolvedRole}
      className={cn('rounded-xl border px-4 py-3', className)}
      style={{
        backgroundColor: palette.surface,
        borderColor: palette.border,
        color: palette.text,
        ...style,
      }}
      {...props}
    >
      <div className="flex items-start gap-3">
        {icon ? <div className="mt-0.5 shrink-0" style={{ color: palette.icon }}>{icon}</div> : null}
        <div className="min-w-0 flex-1">
          {title ? <p className="font-semibold leading-5">{title}</p> : null}
          {description ? (
            <p className={cn('text-sm leading-6 opacity-90', title ? 'mt-1' : null)}>{description}</p>
          ) : null}
          {children ? <div className={cn(title || description ? 'mt-3' : null)}>{children}</div> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}
