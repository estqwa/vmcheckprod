'use client';

import * as React from 'react';
import Link from 'next/link';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';

type HeaderTone = NonNullable<React.ComponentProps<typeof StatusBadge>['tone']>;

type QuizFlowHeaderStatus = {
  text: React.ReactNode;
  icon?: React.ReactNode;
  tone?: HeaderTone;
};

type QuizFlowHeaderStat = {
  label: React.ReactNode;
  value: React.ReactNode;
  valueClassName?: string;
};

type QuizFlowHeaderProps = {
  sticky?: boolean;
  status?: QuizFlowHeaderStatus | null;
  alerts?: React.ReactNode;
  stats?: QuizFlowHeaderStat[];
};

export function QuizFlowHeader({ sticky = false, status, alerts, stats = [] }: QuizFlowHeaderProps) {
  const gridClassName = stats.length === 3 ? 'grid-cols-3' : stats.length === 2 ? 'grid-cols-2' : 'grid-cols-1';

  return (
    <header
      className={cn(
        'border-b border-border/50 bg-white/80 backdrop-blur-sm',
        sticky ? 'sticky top-0 z-40' : null
      )}
    >
      <div className="container mx-auto max-w-6xl px-4 py-3">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="flex min-w-0 items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary">
                <span className="text-lg font-bold text-white">Q</span>
              </div>
              <span className="min-w-0 truncate text-base font-bold text-foreground sm:text-lg">QazaQuiz</span>
            </Link>

            <div className="shrink-0">
              <LanguageSwitcher />
            </div>
          </div>

          {status || alerts ? (
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              {status ? (
                <StatusBadge tone={status.tone} icon={status.icon} className="px-3 py-1.5 text-xs font-semibold">
                  {status.text}
                </StatusBadge>
              ) : null}
              {alerts}
            </div>
          ) : null}

          {stats.length > 0 ? (
            <div className={cn('grid gap-2 rounded-2xl border border-border/60 bg-secondary/30 p-2', gridClassName)}>
              {stats.map((stat, index) => (
                <div key={index} className="min-w-0 rounded-xl bg-white/80 px-3 py-2 text-center">
                  <p className={cn('text-lg font-bold leading-tight', stat.valueClassName)}>{stat.value}</p>
                  <p className="mt-1 break-words text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-[11px]">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
