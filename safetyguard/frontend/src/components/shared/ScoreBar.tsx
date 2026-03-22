'use client';

import { cn } from '@/lib/utils';

interface ScoreBarProps {
  score: number;
  max?: number;
  height?: string;
  showLabel?: boolean;
  className?: string;
}

function getScoreColor(score: number): string {
  if (score >= 70) return 'bg-green-500';
  if (score >= 40) return 'bg-yellow-500';
  return 'bg-red-500';
}

function getScoreTrackColor(score: number): string {
  if (score >= 70) return 'bg-green-500/20';
  if (score >= 40) return 'bg-yellow-500/20';
  return 'bg-red-500/20';
}

export function ScoreBar({
  score,
  max = 100,
  height = 'h-2',
  showLabel = false,
  className,
}: ScoreBarProps) {
  const pct = Math.min(Math.max((score / max) * 100, 0), 100);

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div
        className={cn(
          'relative w-full overflow-hidden rounded-full',
          height,
          getScoreTrackColor(score),
        )}
      >
        <div
          className={cn('absolute inset-y-0 left-0 rounded-full', getScoreColor(score))}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className="min-w-[2.5rem] text-right text-sm font-medium text-foreground">
          {Math.round(score)}
        </span>
      )}
    </div>
  );
}
