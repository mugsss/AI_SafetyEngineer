'use client';

import { useState } from 'react';
import { ChevronDown, FileCode, ExternalLink, Wrench } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SeverityBadge } from '@/components/shared/SeverityBadge';
import { cn } from '@/lib/utils';
import type { Finding } from '@/types/report';

interface FindingCardProps {
  finding: Finding;
  className?: string;
}

const dimensionLabels: Record<string, string> = {
  risk: 'Risk',
  security: 'Security',
  hallucinations: 'Hallucinations',
  failures: 'Failures',
  cost: 'Cost',
  privacy: 'Privacy',
  observability: 'Observability',
  performance: 'Performance',
  resources: 'Resources',
  redteam: 'Red Team',
};

export function FindingCard({ finding, className }: FindingCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card
      className={cn(
        'cursor-pointer overflow-hidden transition-colors hover:border-primary/30',
        className,
      )}
      onClick={() => setExpanded((prev) => !prev)}
    >
      <div className="flex items-center justify-between gap-3 p-4">
        <div className="flex flex-1 items-center gap-3 overflow-hidden">
          <h4 className="truncate text-sm font-medium text-foreground">
            {finding.title}
          </h4>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {dimensionLabels[finding.dimension] ?? finding.dimension}
          </Badge>
          <SeverityBadge severity={finding.severity} />
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
              expanded && 'rotate-180',
            )}
          />
        </div>
      </div>

      {expanded && (
        <div className="overflow-hidden border-t border-border" onClick={(e) => e.stopPropagation()}>
          <div className="space-y-4 px-4 pb-4 pt-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {finding.description}
            </p>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <FileCode className="h-3.5 w-3.5" />
                Evidence
              </div>
              <div className="overflow-hidden rounded-md bg-background">
                <div className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-xs text-muted-foreground">
                  <span className="font-mono">{finding.evidence.file}</span>
                  {finding.evidence.line != null && (
                    <span className="text-primary">
                      Line {finding.evidence.line}
                    </span>
                  )}
                </div>
                <pre className="overflow-x-auto p-3 text-xs leading-relaxed">
                  <code className="font-mono text-foreground">
                    {finding.evidence.snippet}
                  </code>
                </pre>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Wrench className="h-3.5 w-3.5" />
                Suggested Fix
              </div>
              <p className="rounded-md border border-green-500/20 bg-green-500/5 p-3 text-sm text-green-400">
                {finding.suggested_fix}
              </p>
            </div>

            {finding.references && finding.references.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <ExternalLink className="h-3.5 w-3.5" />
                  References
                </div>
                <ul className="space-y-1">
                  {finding.references.map((ref, i) => (
                    <li key={i}>
                      <a
                        href={ref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary underline-offset-4 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {ref}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
