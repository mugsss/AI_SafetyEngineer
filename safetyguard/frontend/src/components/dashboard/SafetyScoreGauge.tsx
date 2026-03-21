'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SafetyScoreGaugeProps {
  score: number;
  size?: number;
  className?: string;
}

function getScoreColor(score: number): string {
  if (score >= 70) return '#22c55e';
  if (score >= 40) return '#eab308';
  return '#ef4444';
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
  size = 200,
  className,
}: SafetyScoreGaugeProps) {
  const radius = (size - 20) / 2;
  const circumference = Math.PI * radius;
  const clampedScore = Math.min(Math.max(score, 0), 100);
  const offset = circumference - (clampedScore / 100) * circumference;
  const color = getScoreColor(clampedScore);

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <svg
        width={size}
        height={size / 2 + 20}
        viewBox={`0 0 ${size} ${size / 2 + 20}`}
      >
        <path
          d={`M 10 ${size / 2 + 10} A ${radius} ${radius} 0 0 1 ${size - 10} ${size / 2 + 10}`}
          fill="none"
          stroke="hsl(var(--secondary))"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <motion.path
          d={`M 10 ${size / 2 + 10} A ${radius} ${radius} 0 0 1 ${size - 10} ${size / 2 + 10}`}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
        <text
          x={size / 2}
          y={size / 2 - 5}
          textAnchor="middle"
          className="fill-foreground text-4xl font-bold"
          style={{ fontSize: size * 0.18 }}
        >
          {Math.round(clampedScore)}
        </text>
        <text
          x={size / 2}
          y={size / 2 + 18}
          textAnchor="middle"
          className="fill-muted-foreground text-sm"
          style={{ fontSize: size * 0.07 }}
        >
          {getScoreLabel(clampedScore)}
        </text>
      </svg>
    </div>
  );
}
