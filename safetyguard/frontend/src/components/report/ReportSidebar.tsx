'use client';

import { useMemo } from 'react';
import {
  LayoutDashboard,
  AlertTriangle,
  Shield,
  Brain,
  XCircle,
  DollarSign,
  Lock,
  Eye,
  Gauge,
  Server,
  Swords,
  Wrench,
  Bot,
  Network,
  Orbit,
  ExternalLink,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { isBuiltinDimension } from '@/types/report';
import type { SafetyReport } from '@/types/report';

export type ReportTab = string;

interface TabDefinition {
  id: string;
  label: string;
  icon: LucideIcon;
  dimension?: string;
  opensNewTab?: boolean;
}

const BUILTIN_TABS: TabDefinition[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'codemap', label: 'Code map', icon: Network },
  { id: 'physicsmap', label: 'Physics map', icon: Orbit, opensNewTab: true },
  { id: 'risk', label: 'Risk Severity', icon: AlertTriangle, dimension: 'risk' },
  { id: 'security', label: 'Security', icon: Shield, dimension: 'security' },
  { id: 'hallucinations', label: 'Hallucinations', icon: Brain, dimension: 'hallucinations' },
  { id: 'failures', label: 'Failure Resilience', icon: XCircle, dimension: 'failures' },
  { id: 'cost', label: 'Cost Efficiency', icon: DollarSign, dimension: 'cost' },
  { id: 'privacy', label: 'Privacy', icon: Lock, dimension: 'privacy' },
  { id: 'observability', label: 'Observability', icon: Eye, dimension: 'observability' },
  { id: 'performance', label: 'Performance', icon: Gauge, dimension: 'performance' },
  { id: 'resources', label: 'Resources', icon: Server, dimension: 'resources' },
  { id: 'redteam', label: 'Red Team', icon: Swords, dimension: 'redteam' },
];

const FIXES_TAB: TabDefinition = { id: 'fixes', label: 'Fixes', icon: Wrench };

function customDimLabel(key: string): string {
  const slug = key.startsWith('custom_') ? key.slice(7) : key;
  return slug
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

interface ReportSidebarProps {
  activeTab: ReportTab;
  onTabChange: (tab: ReportTab) => void;
  report?: SafetyReport;
  runId: string;
}

export function ReportSidebar({
  activeTab,
  onTabChange,
  report,
  runId,
}: ReportSidebarProps) {
  const tabs = useMemo(() => {
    const customTabs: TabDefinition[] = [];
    if (report) {
      const allKeys = new Set([
        ...Object.keys(report.findings ?? {}),
        ...Object.keys(report.dimension_scores ?? {}),
      ]);
      for (const key of allKeys) {
        if (!isBuiltinDimension(key) && key.startsWith('custom_')) {
          customTabs.push({
            id: key,
            label: customDimLabel(key),
            icon: Bot,
            dimension: key,
          });
        }
      }
      customTabs.sort((a, b) => a.label.localeCompare(b.label));
    }
    return [...BUILTIN_TABS, ...customTabs, FIXES_TAB];
  }, [report]);

  return (
    <aside className="flex min-h-0 w-56 shrink-0 flex-col border-r border-border bg-card/50">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Report Sections
        </h2>
      </div>
      <nav className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-2">
        <div className="flex flex-col gap-0.5">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            const dimensionResult =
              tab.dimension ? report?.findings?.[tab.dimension] : undefined;
            const findingCount = dimensionResult?.finding_count;
            const rawScore = tab.dimension
              ? report?.dimension_scores?.[tab.dimension]
              : undefined;
            const isRisk = tab.dimension === 'risk';
            const riskSeverity = dimensionResult?.risk_severity;
            const score = isRisk && riskSeverity != null ? riskSeverity : rawScore;
            const wasAnalyzed =
              tab.dimension != null &&
              report != null &&
              tab.dimension in (report.dimension_scores ?? {});

            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.opensNewTab) {
                    window.open(`/report/${runId}/physics-graph`, '_blank', 'noopener');
                    return;
                  }
                  onTabChange(tab.id as ReportTab);
                }}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-l-2 border-primary bg-primary/10 text-foreground'
                    : 'border-l-2 border-transparent text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate text-left">{tab.label}</span>
                {tab.opensNewTab && <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" />}
                {findingCount != null && findingCount > 0 && (
                  <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                    {findingCount}
                  </span>
                )}
                {tab.dimension && report && (
                  wasAnalyzed && score != null && (isRisk || (findingCount ?? 0) > 0) ? (
                    <span
                      className={cn(
                        'text-xs font-semibold tabular-nums',
                        isRisk
                          ? score <= 20
                            ? 'text-green-400'
                            : score <= 45
                              ? 'text-yellow-400'
                              : score <= 70
                                ? 'text-orange-400'
                                : 'text-red-400'
                          : score >= 70
                            ? 'text-green-400'
                            : score >= 40
                              ? 'text-yellow-400'
                              : 'text-red-400',
                      )}
                    >
                      {Math.round(score)}
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground/40">—</span>
                  )
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}

export { BUILTIN_TABS, customDimLabel };
export type { TabDefinition };
