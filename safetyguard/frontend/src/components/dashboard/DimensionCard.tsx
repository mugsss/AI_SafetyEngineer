'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Shield,
  AlertTriangle,
  Brain,
  Zap,
  DollarSign,
  Lock,
  Eye,
  Gauge,
  HardDrive,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { SeverityBadge } from '@/components/shared/SeverityBadge';
import { cn } from '@/lib/utils';
import type { Dimension, Severity } from '@/types/report';

const dimensionMeta: Record<
  Exclude<Dimension, 'redteam'>,
  { icon: LucideIcon; label: string; color: string; bg: string }
> = {
  risk:           { icon: AlertTriangle, label: 'Risk Severity',  color: 'text-orange-400', bg: 'bg-orange-500/10' },
  security:       { icon: Shield,        label: 'Security',       color: 'text-red-400',    bg: 'bg-red-500/10' },
  hallucinations: { icon: Brain,         label: 'Hallucinations', color: 'text-purple-400', bg: 'bg-purple-500/10' },
  failures:       { icon: Zap,           label: 'Failure Resilience', color: 'text-amber-400',  bg: 'bg-amber-500/10' },
  cost:           { icon: DollarSign,    label: 'Cost Efficiency', color: 'text-emerald-400',bg: 'bg-emerald-500/10' },
  privacy:        { icon: Lock,          label: 'Privacy',        color: 'text-violet-400', bg: 'bg-violet-500/10' },
  observability:  { icon: Eye,           label: 'Observability',  color: 'text-cyan-400',   bg: 'bg-cyan-500/10' },
  performance:    { icon: Gauge,         label: 'Performance',    color: 'text-blue-400',   bg: 'bg-blue-500/10' },
  resources:      { icon: HardDrive,     label: 'Resources',      color: 'text-teal-400',   bg: 'bg-teal-500/10' },
};

function getScoreColor(score: number): string {
  if (score >= 70) return 'bg-green-500';
  if (score >= 40) return 'bg-yellow-500';
  return 'bg-red-500';
}

function getScoreTextColor(score: number): string {
  if (score >= 70) return 'text-green-400';
  if (score >= 40) return 'text-yellow-400';
  return 'text-red-400';
}

interface DimensionCardProps {
  dimension: Exclude<Dimension, 'redteam'>;
  score: number;
  worstSeverity: Severity;
  findingCount: number;
  /** When empty, the card is display-only (no navigation). */
  runId?: string;
  index?: number;
}

export function DimensionCard({
  dimension,
  score,
  worstSeverity,
  findingCount,
  runId,
  index = 0,
}: DimensionCardProps) {
  const router = useRouter();
  const meta = dimensionMeta[dimension];
  const Icon = meta.icon;
  const pct = Math.min(Math.max(score, 0), 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4, ease: 'easeOut' }}
      className={cn(
        'group rounded-xl border border-border bg-card p-5',
        runId &&
          'cursor-pointer transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5',
      )}
      onClick={() => {
        if (!runId) return;
        router.push(`/report/${runId}?tab=${dimension}`);
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn('rounded-lg p-2', meta.bg)}>
            <Icon className={cn('h-4 w-4', meta.color)} />
          </div>
          <span className="text-sm font-semibold text-foreground">{meta.label}</span>
        </div>
        <SeverityBadge severity={worstSeverity} />
      </div>

      <div className="mt-4 flex items-end justify-between">
        <span className={cn('text-3xl font-bold tabular-nums', getScoreTextColor(score))}>
          {Math.round(score)}
        </span>
        <span className="text-xs text-muted-foreground">
          {findingCount} {findingCount === 1 ? 'finding' : 'findings'}
        </span>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <motion.div
          className={cn('h-full rounded-full', getScoreColor(score))}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ delay: index * 0.05 + 0.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </motion.div>
  );
}
