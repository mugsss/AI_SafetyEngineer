'use client';

import { Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RunStatus } from '@/types/run';

const statusConfig: Record<
  RunStatus,
  { label: string; icon: React.ElementType; className: string }
> = {
  pending: {
    label: 'Pending',
    icon: Clock,
    className: 'bg-muted text-muted-foreground border-border',
  },
  running: {
    label: 'Running',
    icon: Loader2,
    className: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle2,
    className: 'bg-green-500/15 text-green-400 border-green-500/30',
  },
  failed: {
    label: 'Failed',
    icon: XCircle,
    className: 'bg-red-500/15 text-red-400 border-red-500/30',
  },
};

interface RunStatusBadgeProps {
  status: RunStatus;
  className?: string;
}

export function RunStatusBadge({ status, className }: RunStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        config.className,
        className,
      )}
    >
      <Icon
        className={cn('h-3.5 w-3.5', status === 'running' && 'animate-spin')}
      />
      {config.label}
    </span>
  );
}
