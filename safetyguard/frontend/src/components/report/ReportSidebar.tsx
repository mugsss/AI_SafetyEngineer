'use client';

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
  type LucideIcon,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { SafetyReport } from '@/types/report';
import type { Dimension } from '@/types/report';

export type ReportTab =
  | 'overview'
  | Dimension
  | 'fixes';

interface TabDefinition {
  id: ReportTab;
  label: string;
  icon: LucideIcon;
  dimension?: Dimension;
}

const tabs: TabDefinition[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'risk', label: 'Risk', icon: AlertTriangle, dimension: 'risk' },
  { id: 'security', label: 'Security', icon: Shield, dimension: 'security' },
  { id: 'hallucinations', label: 'Hallucinations', icon: Brain, dimension: 'hallucinations' },
  { id: 'failures', label: 'Failures', icon: XCircle, dimension: 'failures' },
  { id: 'cost', label: 'Cost', icon: DollarSign, dimension: 'cost' },
  { id: 'privacy', label: 'Privacy', icon: Lock, dimension: 'privacy' },
  { id: 'observability', label: 'Observability', icon: Eye, dimension: 'observability' },
  { id: 'performance', label: 'Performance', icon: Gauge, dimension: 'performance' },
  { id: 'resources', label: 'Resources', icon: Server, dimension: 'resources' },
  { id: 'redteam', label: 'Red Team', icon: Swords, dimension: 'redteam' },
  { id: 'fixes', label: 'Fixes', icon: Wrench },
];

interface ReportSidebarProps {
  activeTab: ReportTab;
  onTabChange: (tab: ReportTab) => void;
  report?: SafetyReport;
}

export function ReportSidebar({
  activeTab,
  onTabChange,
  report,
}: ReportSidebarProps) {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-card/50">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Report Sections
        </h2>
      </div>
      <ScrollArea className="flex-1">
        <nav className="flex flex-col gap-0.5 p-2">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            const dimensionResult =
              tab.dimension ? report?.findings?.[tab.dimension] : undefined;
            const findingCount = dimensionResult?.finding_count;
            const score = tab.dimension
              ? report?.dimension_scores?.[tab.dimension]
              : undefined;
            const wasAnalyzed =
              tab.dimension != null &&
              report != null &&
              tab.dimension in (report.dimension_scores ?? {});

            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-l-2 border-primary bg-primary/10 text-foreground'
                    : 'border-l-2 border-transparent text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">{tab.label}</span>
                {findingCount != null && findingCount > 0 && (
                  <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                    {findingCount}
                  </span>
                )}
                {tab.dimension && report && (
                  wasAnalyzed && score != null ? (
                    <span
                      className={cn(
                        'text-xs font-semibold tabular-nums',
                        score >= 70
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
        </nav>
      </ScrollArea>
    </aside>
  );
}

export { tabs };
export type { TabDefinition };
