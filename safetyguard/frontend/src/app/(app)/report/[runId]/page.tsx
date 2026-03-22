'use client';

import { useState, useMemo, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { miroApi } from '@/lib/api';

import { useRun } from '@/hooks/useRun';
import { useReport } from '@/hooks/useReport';
import { useRunStatus } from '@/hooks/useRunStatus';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { RunStatusBadge } from '@/components/shared/RunStatusBadge';
import { SeverityBadge } from '@/components/shared/SeverityBadge';
import { ScoreBar } from '@/components/shared/ScoreBar';
import { ReportSidebar, type ReportTab } from '@/components/report/ReportSidebar';
import { DimensionTab } from '@/components/report/DimensionTab';
import { FindingCard } from '@/components/report/FindingCard';
import { CodeGraphView } from '@/components/code-graph/CodeGraphView';
import { cn } from '@/lib/utils';
import type { Dimension, Finding, Severity, SafetyReport } from '@/types/report';

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

const dimensionLabels: Record<string, string> = {
  risk: 'Risk Severity',
  security: 'Security',
  hallucinations: 'Hallucinations',
  failures: 'Failure Resilience',
  cost: 'Cost Efficiency',
  privacy: 'Privacy',
  observability: 'Observability',
  performance: 'Performance',
  resources: 'Resources',
  redteam: 'Red Team',
};

function isValidTab(value: string): value is ReportTab {
  const valid = new Set<string>([
    'overview',
    'codemap',
    'risk',
    'security',
    'hallucinations',
    'failures',
    'cost',
    'privacy',
    'observability',
    'performance',
    'resources',
    'redteam',
    'fixes',
  ]);
  return valid.has(value);
}

// ---------------------------------------------------------------------------
// Overview Tab
// ---------------------------------------------------------------------------

function OverviewTab({
  report,
  onTabChange,
}: {
  report: SafetyReport;
  onTabChange: (tab: ReportTab) => void;
}) {
  const allFindings = useMemo(() => {
    const findings: Finding[] = [];
    for (const dim of Object.values(report.findings)) {
      findings.push(...dim.findings);
    }
    return findings.sort(
      (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
    );
  }, [report]);

  const topIssues = allFindings.slice(0, 10);

  const dimEntries = Object.entries(report.dimension_scores) as [Dimension, number][];
  const dimCount = dimEntries.length;

  return (
    <div className="space-y-8">
      <div className={cn(
        'grid gap-3',
        dimCount === 1 ? 'grid-cols-1 w-48' :
        dimCount === 2 ? 'grid-cols-2 w-72' :
        dimCount <= 4 ? 'grid-cols-2 sm:grid-cols-4' :
        'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
      )}>
          {dimEntries.map(([dim, score]) => {
            const isRisk = dim === 'risk';
            const dimResult = report.findings?.[dim];
            const riskSeverity = dimResult?.risk_severity;
            const severityLabel = dimResult?.severity_label;
            const displayValue = isRisk && riskSeverity != null ? riskSeverity : score;
            const displayLabel = dimensionLabels[dim] ?? dim;
            const noFindings = (dimResult?.finding_count ?? 0) === 0;

            // Risk: high value = bad; others: high value = good
            const valueColor = isRisk
              ? displayValue <= 20 ? 'text-green-400'
                : displayValue <= 45 ? 'text-yellow-400'
                : displayValue <= 70 ? 'text-orange-400'
                : 'text-red-400'
              : noFindings && score === 100
                ? 'text-muted-foreground'
                : score >= 70 ? 'text-green-400'
                : score >= 40 ? 'text-yellow-400'
                : 'text-red-400';

            return (
              <Card
                key={dim}
                className="cursor-pointer transition-colors hover:border-primary/30"
                onClick={() => onTabChange(dim)}
              >
                <CardContent className="flex flex-col items-center gap-2 p-4">
                  {noFindings && !isRisk ? (
                    <>
                      <span className="text-2xl font-bold tabular-nums text-muted-foreground/40">—</span>
                      <span className="text-center text-xs text-muted-foreground leading-tight">{displayLabel}</span>
                      <div className="h-1 w-full rounded-full bg-border/40" />
                    </>
                  ) : (
                    <>
                      <span className={cn('text-2xl font-bold tabular-nums', valueColor)}>
                        {Math.round(displayValue)}
                      </span>
                      <span className="text-center text-xs text-muted-foreground leading-tight">{displayLabel}</span>
                      {isRisk && severityLabel && (
                        <span className={cn(
                          'rounded-md border px-1.5 py-0.5 text-[10px] font-semibold',
                          severityLabel === 'Low'      ? 'border-green-500/30  bg-green-500/10  text-green-400'  :
                          severityLabel === 'Medium'   ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400' :
                          severityLabel === 'High'     ? 'border-orange-500/30 bg-orange-500/10 text-orange-400' :
                                                         'border-red-500/30    bg-red-500/10    text-red-400',
                        )}>
                          {severityLabel}
                        </span>
                      )}
                      <ScoreBar score={isRisk ? (100 - displayValue) : score} height="h-1" className="w-full" />
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
      </div>

      {report.executive_summary && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Executive Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {report.executive_summary}
            </p>
          </CardContent>
        </Card>
      )}

      {topIssues.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Top Issues</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Dimension</th>
                    <th className="px-4 py-2 font-medium">Severity</th>
                    <th className="px-4 py-2 font-medium">Title</th>
                  </tr>
                </thead>
                <tbody>
                  {topIssues.map((finding) => (
                    <tr
                      key={finding.id}
                      className="cursor-pointer border-b border-border last:border-0 hover:bg-accent/50"
                      onClick={() =>
                        onTabChange(finding.dimension as ReportTab)
                      }
                    >
                      <td className="px-4 py-2.5">
                        <Badge variant="secondary" className="text-xs">
                          {dimensionLabels[finding.dimension] ??
                            finding.dimension}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        <SeverityBadge severity={finding.severity} />
                      </td>
                      <td className="px-4 py-2.5 text-foreground">
                        {finding.title}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Red Team Tab
// ---------------------------------------------------------------------------

function RedTeamTab({ report }: { report: SafetyReport }) {
  const redteamData = report.findings.redteam;

  if (!redteamData || redteamData.findings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
        <CheckCircle2 className="mb-3 h-10 w-10 text-green-400" />
        <p className="text-sm text-muted-foreground">
          No red team findings. The system passed all adversarial tests.
        </p>
      </div>
    );
  }

  const hasCritical = redteamData.findings.some(
    (f) => f.severity === 'critical',
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-foreground">Red Team</h2>
          <p className="text-sm text-muted-foreground">{redteamData.summary}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className={cn(
              'text-3xl font-bold tabular-nums',
              redteamData.score >= 70
                ? 'text-green-400'
                : redteamData.score >= 40
                  ? 'text-yellow-400'
                  : 'text-red-400',
            )}
          >
            {Math.round(redteamData.score)}
          </span>
          <span className="text-xs text-muted-foreground">/ 100</span>
        </div>
      </div>

      {hasCritical && (
        <div className="flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-400" />
          <div>
            <p className="text-sm font-semibold text-red-400">
              Jailbreak Detected
            </p>
            <p className="text-xs text-red-400/80">
              Critical adversarial vulnerabilities were found during red team
              testing.
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Prompt / Title</th>
                  <th className="px-4 py-2 font-medium">Response / Evidence</th>
                  <th className="px-4 py-2 font-medium">Severity</th>
                  <th className="px-4 py-2 font-medium">Safe?</th>
                </tr>
              </thead>
              <tbody>
                {redteamData.findings.map((finding) => {
                  const isSafe =
                    finding.severity === 'info' || finding.severity === 'low';
                  return (
                    <tr
                      key={finding.id}
                      className={cn(
                        'border-b border-border last:border-0',
                        !isSafe && 'bg-red-500/10',
                      )}
                    >
                      <td className="max-w-[200px] px-4 py-2.5">
                        <span className="line-clamp-2 text-foreground">
                          {finding.title}
                        </span>
                      </td>
                      <td className="max-w-[300px] px-4 py-2.5">
                        <span className="line-clamp-2 font-mono text-xs text-muted-foreground">
                          {finding.evidence.snippet}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <SeverityBadge severity={finding.severity} />
                      </td>
                      <td className="px-4 py-2.5">
                        {isSafe ? (
                          <CheckCircle2 className="h-4 w-4 text-green-400" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-400" />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fixes Tab
// ---------------------------------------------------------------------------

function FixesTab({ report }: { report: SafetyReport }) {
  const allFixes = useMemo(() => {
    const fixes: (Finding & { priority: number })[] = [];
    for (const dim of Object.values(report.findings)) {
      for (const finding of dim.findings) {
        if (finding.suggested_fix) {
          fixes.push({ ...finding, priority: 0 });
        }
      }
    }
    fixes.sort((a, b) => {
      const sevDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
      if (sevDiff !== 0) return sevDiff;
      return a.dimension.localeCompare(b.dimension);
    });
    return fixes.map((f, i) => ({ ...f, priority: i + 1 }));
  }, [report]);

  if (allFixes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
        <CheckCircle2 className="mb-3 h-10 w-10 text-green-400" />
        <p className="text-sm text-muted-foreground">
          No fixes needed. All dimensions passed safety checks.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-foreground">
          Recommended Fixes
        </h2>
        <p className="text-sm text-muted-foreground">
          Aggregated fixes from all dimensions, sorted by severity.
        </p>
      </div>

      <div className="space-y-3">
        {allFixes.map((fix) => (
          <Card key={fix.id}>
            <CardContent className="flex items-start gap-4 p-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {fix.priority}
              </span>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {fix.title}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {dimensionLabels[fix.dimension] ?? fix.dimension}
                  </Badge>
                  <SeverityBadge severity={fix.severity} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {fix.suggested_fix}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Running State
// ---------------------------------------------------------------------------

function RunningState({
  runId,
  progress,
  message,
}: {
  runId: string;
  progress: number;
  message: string;
}) {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-xl border border-border bg-card p-8">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <div className="space-y-2 text-center">
          <h3 className="text-lg font-semibold text-foreground">
            Analysis In Progress
          </h3>
          <p className="text-sm text-muted-foreground">
            Run <span className="font-mono text-xs">{runId}</span> is being
            analyzed.
          </p>
        </div>
        <div className="w-full space-y-2">
          <Progress value={progress} className="h-2" />
          <div className="flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:items-start sm:justify-between">
            <span className="text-left leading-relaxed">
              {message || 'Connecting for live progress…'}
            </span>
            <span className="shrink-0 tabular-nums">{Math.round(progress)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error / Loading states
// ---------------------------------------------------------------------------

function LoadingState() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-center">
        <XCircle className="h-10 w-10 text-red-400" />
        <p className="text-sm text-muted-foreground">{message}</p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ReportPage() {
  const params = useParams<{ runId: string }>();
  const searchParams = useSearchParams();
  const runId = params.runId;

  const initialTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<ReportTab>(() => {
    if (initialTab && isValidTab(initialTab)) return initialTab;
    return 'overview';
  });

  const {
    data: run,
    isLoading: runLoading,
    error: runError,
  } = useRun(runId);

  const isRunning =
    run?.status === 'pending' || run?.status === 'running';

  const { status, progress, message } = useRunStatus(
    isRunning ? runId : undefined,
  );

  const isCompleted =
    run?.status === 'completed' || status === 'completed';

  const {
    data: report,
    isLoading: reportLoading,
    error: reportError,
  } = useReport(isCompleted ? runId : undefined);

  useEffect(() => {
    if (initialTab && isValidTab(initialTab)) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  if (runLoading) return <LoadingState />;

  if (runError) {
    return (
      <ErrorState
        message={
          runError instanceof Error
            ? runError.message
            : 'Failed to load run data.'
        }
      />
    );
  }

  if (!run) {
    return <ErrorState message="Run not found." />;
  }

  if (run.status === 'failed') {
    return (
      <ErrorState
        message={run.error_message ?? 'The analysis run failed.'}
      />
    );
  }

  if (isRunning && !isCompleted) {
    return <RunningState runId={runId} progress={progress} message={message} />;
  }

  if (reportLoading) return <LoadingState />;

  if (reportError) {
    return (
      <ErrorState
        message={
          reportError instanceof Error
            ? reportError.message
            : 'Failed to load report data.'
        }
      />
    );
  }

  if (!report) {
    return <ErrorState message="Report not found." />;
  }

  return (
    <div className="flex min-h-0 h-[calc(100vh-theme(spacing.16))] -m-6">
      <ReportSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        report={report}
        runId={runId}
      />
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
        <div className="p-6">
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/">
                <ArrowLeft className="mr-1 h-4 w-4" />
                Back
              </Link>
            </Button>
            <Separator orientation="vertical" className="h-5" />
            <h1 className="text-lg font-semibold text-foreground">
              Safety Report
            </h1>
            <RunStatusBadge status={run.status} />
            <div className="ml-auto flex min-w-0 max-w-full flex-shrink-0 flex-wrap items-center justify-end gap-2">
              {run.repo_url && (
                <span className="max-w-[min(100%,28rem)] truncate text-xs text-muted-foreground">
                  {run.repo_url}
                </span>
              )}
              <MiroButton runId={runId} />
            </div>
          </div>

          <TabContent
            activeTab={activeTab}
            report={report}
            onTabChange={setActiveTab}
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Miro Board Button
// ---------------------------------------------------------------------------

function MiroButton({ runId }: { runId: string }) {
  const [loading, setLoading] = useState(false);
  const [boardUrl, setBoardUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await miroApi.createBoard(runId);
      setBoardUrl(result.board_url);
      window.open(result.board_url, '_blank', 'noopener');
    } catch (e: any) {
      const msg =
        e?.response?.data?.detail || e?.message || 'Failed to create Miro board';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (boardUrl) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="shrink-0 gap-1.5"
        onClick={() => window.open(boardUrl, '_blank', 'noopener')}
      >
        <ExternalLink className="h-3.5 w-3.5" />
        Open in Miro
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {error && (
        <span className="max-w-[200px] truncate text-xs text-red-400 sm:max-w-xs" title={error}>
          {error.length > 40 ? error.slice(0, 40) + '…' : error}
        </span>
      )}
      <Button
        variant="outline"
        size="sm"
        className="shrink-0 gap-1.5"
        onClick={handleCreate}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M17.392 0H13.9L15.673 4.783L10.838 0H7.347L9.678 6.67L4.843 0H1.352L6.3 12L1.352 24H4.843L9.678 17.33L7.347 24H10.838L15.673 19.217L13.9 24H17.392L22.34 12L17.392 0Z" />
          </svg>
        )}
        {loading ? 'Creating…' : 'View in Miro'}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab Content Router
// ---------------------------------------------------------------------------

function TabContent({
  activeTab,
  report,
  onTabChange,
}: {
  activeTab: ReportTab;
  report: SafetyReport;
  onTabChange: (tab: ReportTab) => void;
}) {
  if (activeTab === 'overview') {
    return <OverviewTab report={report} onTabChange={onTabChange} />;
  }

  if (activeTab === 'codemap') {
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-foreground">Repository code map</h2>
          <p className="text-sm text-muted-foreground">
            Import relationships between source files. Use semantic search to highlight retrieval paths used by Graph RAG.
          </p>
        </div>
        <CodeGraphView
          runId={report.run_id}
          graph={report.code_graph ?? undefined}
          codeIndexStatus={report.code_index_status}
          codeIndexError={report.code_index_error}
        />
      </div>
    );
  }

  if (activeTab === 'redteam') {
    return <RedTeamTab report={report} />;
  }

  if (activeTab === 'fixes') {
    return <FixesTab report={report} />;
  }

  const dimensionData = report.findings[activeTab as Dimension];
  if (!dimensionData) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
        <p className="text-sm font-medium text-muted-foreground">
          {dimensionLabels[activeTab] ?? activeTab} was not included in this run.
        </p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          Enable this agent when creating a new analysis to see findings here.
        </p>
      </div>
    );
  }

  return (
    <DimensionTab
      name={dimensionLabels[activeTab] ?? activeTab}
      data={dimensionData}
    />
  );
}
