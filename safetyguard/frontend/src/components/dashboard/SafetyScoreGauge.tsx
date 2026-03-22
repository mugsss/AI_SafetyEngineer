'use client';

import { cn } from '@/lib/utils';

interface SafetyScoreGaugeProps {
  score: number;
  size?: number;
  className?: string;
}

function getScoreColor(score: number) {
  if (score >= 70) return { stroke: '#22c55e', label: 'text-green-400' };
  if (score >= 40) return { stroke: '#eab308', label: 'text-yellow-400' };
  return { stroke: '#ef4444', label: 'text-red-400' };
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Fair';
  if (score >= 30) return 'Poor';
  return 'Critical';
}

export function SafetyScoreGauge({
  score,
  size = 220,
  className,
}: SafetyScoreGaugeProps) {
  const strokeWidth = 12;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const raw = Number(score);
  const clampedScore = Number.isFinite(raw) ? Math.min(Math.max(raw, 0), 100) : 0;
  const progress = (clampedScore / 100) * circumference;
  const offset = circumference - progress;
  const colors = getScoreColor(clampedScore);
  const center = size / 2;

  return (
    <div className={cn('relative flex flex-col items-center', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="hsl(var(--secondary))"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={colors.stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('text-5xl font-bold tabular-nums', colors.label)}>
            {Math.round(clampedScore)}
          </span>
          <span className="mt-1 text-sm font-medium text-muted-foreground">
            {getScoreLabel(clampedScore)}
          </span>
        </div>
      </div>
    </div>
  );
}
