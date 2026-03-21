'use client';

import { useRouter } from 'next/navigation';
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
import { Card } from '@/components/ui/card';
import { SeverityBadge } from '@/components/shared/SeverityBadge';
import { cn } from '@/lib/utils';
import type { Dimension, Severity } from '@/types/report';

const dimensionMeta: Record<
  Exclude<Dimension, 'redteam'>,
  { icon: LucideIcon; label: string }
> = {
  risk: { icon: AlertTriangle, label: 'Risk' },
  security: { icon: Shield, label: 'Security' },
  hallucinations: { icon: Brain, label: 'Hallucinations' },
  failures: { icon: Zap, label: 'Failures' },
  cost: { icon: DollarSign, label: 'Cost' },
  privacy: { icon: Lock, label: 'Privacy' },
  observability: { icon: Eye, label: 'Observability' },
  performance: { icon: Gauge, label: 'Performance' },
  resources: { icon: HardDrive, label: 'Resources' },
};

const severityGlow: Record<Severity, string> = {
  critical: '0 0 20px hsl(0 84% 60% / 0.35)',
  high: '0 0 20px hsl(25 95% 55% / 0.35)',
  medium: '0 0 20px hsl(48 96% 53% / 0.30)',
  low: '0 0 20px hsl(142 71% 45% / 0.25)',
  info: '0 0 20px hsl(199 89% 48% / 0.25)',
};

function getScoreColor(score: number): string {
  if (score >= 70) return 'text-green-400';
  if (score >= 40) return 'text-yellow-400';
  return 'text-red-400';
}

interface DimensionCardProps {
  dimension: Exclude<Dimension, 'redteam'>;
  score: number;
  worstSeverity: Severity;
  findingCount: number;
  runId: string;
}

export function DimensionCard({
  dimension,
  score,
  worstSeverity,
  findingCount,
  runId,
}: DimensionCardProps) {
  const router = useRouter();
  const meta = dimensionMeta[dimension];
  const Icon = meta.icon;

  return (
    <Card
      className={cn(
        'group cursor-pointer p-5 transition-all duration-300',
        'hover:border-primary/40',
      )}
      style={{
        // @ts-expect-error -- CSS custom property for hover glow
        '--hover-glow': severityGlow[worstSeverity],
      }}
      onClick={() => router.push(`/report/${runId}?tab=${dimension}`)}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow =
          severityGlow[worstSeverity];
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-secondary p-2">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <span className="text-sm font-medium text-foreground">
            {meta.label}
          </span>
        </div>
        <SeverityBadge severity={worstSeverity} />
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div>
          <span className={cn('text-3xl font-bold', getScoreColor(score))}>
            {Math.round(score)}
          </span>
          <span className="ml-1 text-sm text-muted-foreground">/100</span>
        </div>
        <span className="text-sm text-muted-foreground">
          {findingCount} {findingCount === 1 ? 'issue' : 'issues'}
        </span>
      </div>
    </Card>
  );
}
