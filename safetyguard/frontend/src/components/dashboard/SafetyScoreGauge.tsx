'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SafetyScoreGaugeProps {
  score: number;
  size?: number;
  className?: string;
}

function getScoreColor(score: number) {
  if (score >= 70) return { stroke: '#22c55e', glow: 'rgba(34, 197, 94, 0.3)', label: 'text-green-400' };
  if (score >= 40) return { stroke: '#eab308', glow: 'rgba(234, 179, 8, 0.3)', label: 'text-yellow-400' };
  return { stroke: '#ef4444', glow: 'rgba(239, 68, 68, 0.3)', label: 'text-red-400' };
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
  const clampedScore = Math.min(Math.max(score, 0), 100);
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
          <motion.circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={colors.stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
            style={{ filter: `drop-shadow(0 0 8px ${colors.glow})` }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className={cn('text-5xl font-bold tabular-nums', colors.label)}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.6, ease: 'easeOut' }}
          >
            {Math.round(clampedScore)}
          </motion.span>
          <motion.span
            className="mt-1 text-sm font-medium text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.4 }}
          >
            {getScoreLabel(clampedScore)}
          </motion.span>
        </div>
      </div>
    </div>
  );
}
