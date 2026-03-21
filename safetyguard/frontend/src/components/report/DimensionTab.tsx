'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScoreBar } from '@/components/shared/ScoreBar';
import { FindingCard } from '@/components/report/FindingCard';
import { cn } from '@/lib/utils';
import type { DimensionResult, Severity } from '@/types/report';

const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

const severityFilterStyles: Record<Severity, { active: string; inactive: string }> = {
  critical: {
    active: 'bg-red-500/20 text-red-400 border-red-500/40',
    inactive: 'text-muted-foreground border-border hover:border-red-500/30',
  },
  high: {
    active: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
    inactive: 'text-muted-foreground border-border hover:border-orange-500/30',
  },
  medium: {
    active: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
    inactive: 'text-muted-foreground border-border hover:border-yellow-500/30',
  },
  low: {
    active: 'bg-green-500/20 text-green-400 border-green-500/40',
    inactive: 'text-muted-foreground border-border hover:border-green-500/30',
  },
  info: {
    active: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
    inactive: 'text-muted-foreground border-border hover:border-blue-500/30',
  },
};

interface DimensionTabProps {
  name: string;
  data: DimensionResult;
  className?: string;
}

export function DimensionTab({ name, data, className }: DimensionTabProps) {
  const [activeSeverities, setActiveSeverities] = useState<Set<Severity>>(
    new Set(),
  );

  const toggleSeverity = (severity: Severity) => {
    setActiveSeverities((prev) => {
      const next = new Set(prev);
      if (next.has(severity)) {
        next.delete(severity);
      } else {
        next.add(severity);
      }
      return next;
    });
  };

  const filteredFindings = useMemo(() => {
    if (activeSeverities.size === 0) return data.findings;
    return data.findings.filter((f) => activeSeverities.has(f.severity));
  }, [data.findings, activeSeverities]);

  return (
    <div className={cn('space-y-6', className)}>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-foreground">{name}</h2>
            <p className="text-sm text-muted-foreground">{data.summary}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span
              className={cn(
                'text-3xl font-bold tabular-nums',
                data.score >= 70
                  ? 'text-green-400'
                  : data.score >= 40
                    ? 'text-yellow-400'
                    : 'text-red-400',
              )}
            >
              {Math.round(data.score)}
            </span>
            <span className="text-xs text-muted-foreground">/ 100</span>
          </div>
        </div>
        <ScoreBar score={data.score} showLabel={false} height="h-2" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        {SEVERITY_ORDER.map((severity) => {
          const isActive = activeSeverities.has(severity);
          const styles = severityFilterStyles[severity];
          return (
            <Button
              key={severity}
              variant="outline"
              size="sm"
              onClick={() => toggleSeverity(severity)}
              className={cn(
                'h-7 rounded-full px-3 text-xs capitalize',
                isActive ? styles.active : styles.inactive,
              )}
            >
              {severity}
            </Button>
          );
        })}
        {activeSeverities.size > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveSeverities(new Set())}
            className="h-7 px-2 text-xs text-muted-foreground"
          >
            Clear
          </Button>
        )}
      </div>

      {filteredFindings.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {activeSeverities.size > 0
              ? 'No findings match the selected severity filters.'
              : 'No findings in this dimension.'}
          </p>
        </div>
      ) : (
        <motion.div
          className="space-y-3"
          initial="hidden"
          animate="visible"
          variants={{
            visible: { transition: { staggerChildren: 0.05 } },
          }}
        >
          {filteredFindings.map((finding) => (
            <motion.div
              key={finding.id}
              variants={{
                hidden: { opacity: 0, y: 8 },
                visible: { opacity: 1, y: 0 },
              }}
            >
              <FindingCard finding={finding} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
