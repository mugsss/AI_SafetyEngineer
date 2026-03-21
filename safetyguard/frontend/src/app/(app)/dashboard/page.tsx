'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Rocket,
  Activity,
  ShieldCheck,
  Clock,
  GitBranch,
  ExternalLink,
  TrendingUp,
  AlertTriangle,
  Network,
  FlaskConical,
  ListChecks,
  AlertCircle,
} from 'lucide-react';
import { runsApi, reportsApi, formatApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  GlassmorphismMinimalMetricsBlock,
  type GlassMetricItem,
} from '@/components/ui/glassmorphism-minimal-metrics-block-shadcnui';
import { SafetyScoreGauge } from '@/components/dashboard/SafetyScoreGauge';
import { ScoreSparkline } from '@/components/dashboard/ScoreSparkline';
import { DimensionCard } from '@/components/dashboard/DimensionCard';
import { RunStatusBadge } from '@/components/shared/RunStatusBadge';
import type { Dimension, DimensionResult } from '@/types/report';
import type { Run } from '@/types/run';
import { cn } from '@/lib/utils';

const DASHBOARD_DIMENSIONS: Exclude<Dimension, 'redteam'>[] = [
  'security', 'risk', 'hallucinations', 'privacy',
  'failures', 'cost', 'performance', 'observability', 'resources',
];

/** API JSON may omit or null nested fields — never assume shape matches TS types at runtime. */
function safeFindingsRecord(
  report: { findings?: Record<string, DimensionResult> | null } | undefined,
): Record<string, DimensionResult> {
  const f = report?.findings;
  if (!f || typeof f !== 'object') return {};
  return f;
}

function safeDimensionScores(
  report: { dimension_scores?: Partial<Record<Dimension, number>> | null } | undefined,
): Partial<Record<Dimension, number>> {
  const s = report?.dimension_scores;
  if (!s || typeof s !== 'object') return {};
  return s;
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
}

function extractRepoName(run: Run): string {
  if (run.repo_url) {
    const parts = run.repo_url.replace(/\.git$/, '').split('/');
    return parts.slice(-2).join('/');
  }
  return 'uploaded project';
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-secondary/80', className)} />;
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="relative">
        <div className="absolute inset-0 animate-pulse rounded-3xl bg-primary/10 blur-xl" />
        <div className="relative rounded-2xl border border-border bg-card p-8">
          <Rocket className="mx-auto h-14 w-14 text-primary" />
        </div>
      </div>
      <h2 className="mt-8 text-2xl font-bold text-foreground">No analysis runs yet</h2>
      <p className="mt-3 max-w-md text-muted-foreground">
        Run your first safety analysis to see scores, findings, and recommendations across all 10 dimensions.
      </p>
      <Link href="/runs/new">
        <Button size="lg" className="mt-8 gap-2 px-8">
          <Plus className="h-4 w-4" />
          Run First Analysis
        </Button>
      </Link>
    </div>
  );
}

function RecentRunRow({ run }: { run: Run }) {
  const repoName = extractRepoName(run);

  return (
    <div>
      <Link
        href={run.status === 'completed' ? `/report/${run.id}` : `/runs`}
        className="flex items-center gap-4 rounded-xl px-4 py-3 transition-colors hover:bg-secondary/50"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary/80">
          <GitBranch className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">{repoName}</span>
            <span className="shrink-0 text-xs text-muted-foreground">@{run.branch ?? '—'}</span>
          </div>
          <p className="text-xs text-muted-foreground">{relativeTime(run.created_at)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {run.status === 'completed' && run.report && (
            <span className={cn(
              'text-sm font-bold tabular-nums',
              run.report.overall_score >= 70 ? 'text-green-400' :
              run.report.overall_score >= 40 ? 'text-yellow-400' : 'text-red-400'
            )}>
              {Math.round(run.report.overall_score)}
            </span>
          )}
          <RunStatusBadge status={run.status} />
        </div>
      </Link>
    </div>
  );
}

function buildGlassMetrics(params: {
  currentScore: number;
  scoreDiff: number | null;
  totalRuns: number;
  runningCount: number;
  totalFindings: number;
  criticalCount: number;
  isLoading: boolean;
}): GlassMetricItem[] {
  const {
    currentScore,
    scoreDiff,
    totalRuns,
    runningCount,
    totalFindings,
    criticalCount,
    isLoading,
  } = params;

  if (isLoading) {
    return [
      { label: 'Safety score', value: '…', delta: '…', description: 'Loading latest report…' },
      { label: 'Scans in workspace', value: '…', delta: '…', description: 'Fetching workspace stats…' },
      { label: 'Open findings', value: '…', delta: '…', description: 'Aggregating dimensions…' },
      { label: 'Critical findings', value: '…', delta: '…', description: 'Checking severities…' },
    ];
  }

  const scoreDelta =
    scoreDiff !== null
      ? `${scoreDiff >= 0 ? '+' : ''}${Math.round(scoreDiff)}`
      : 'baseline';

  return [
    {
      label: 'Safety score',
      value: String(Math.round(currentScore)),
      delta: scoreDelta,
      description: 'weighted posture vs. last completed scan',
    },
    {
      label: 'Scans in workspace',
      value: String(totalRuns),
      delta: runningCount > 0 ? `${runningCount} in flight` : 'queue idle',
      description: 'repo & upload analyses tracked here',
    },
    {
      label: 'Open findings',
      value: String(totalFindings),
      delta: totalFindings > 0 ? 'triage' : 'none open',
      description: 'across security, privacy, hallucinations & more',
    },
    {
      label: 'Critical findings',
      value: String(criticalCount),
      delta: criticalCount === 0 ? 'clear' : 'escalate',
      description:
        criticalCount === 0
          ? 'no critical items in the latest report'
          : 'blockers to resolve before release',
    },
  ];
}

export default function DashboardPage() {
  const { data: runList, isLoading: runsLoading, error: runsError } = useQuery({
    queryKey: ['runs', 'dashboard'],
    queryFn: () => runsApi.list(1, 10),
    retry: 1,
  });

  const latestCompletedRun = runList?.runs?.find((r) => r.status === 'completed');

  const {
    data: report,
    isLoading: reportLoading,
    error: reportError,
  } = useQuery({
    queryKey: ['report', latestCompletedRun?.id],
    queryFn: () => reportsApi.get(latestCompletedRun!.id),
    enabled: !!latestCompletedRun,
    retry: 1,
  });

  const findingsRec = useMemo(() => safeFindingsRecord(report), [report]);
  const scoresRec = useMemo(() => safeDimensionScores(report), [report]);

  const sparklineData = useMemo(() => {
    if (!runList?.runs) return [];
    return runList.runs
      .filter((r) => r.status === 'completed' && r.report)
      .reverse()
      .map((r, i) => ({ run: i + 1, score: r.report!.overall_score }));
  }, [runList]);

  const previousScore = sparklineData.length >= 2
    ? sparklineData[sparklineData.length - 2].score
    : null;
  const currentScore = report?.overall_score ?? 0;
  const scoreDiff = previousScore !== null ? currentScore - previousScore : null;

  const totalFindings = useMemo(() => {
    return Object.values(findingsRec).reduce((sum, d) => sum + (d?.finding_count ?? 0), 0);
  }, [findingsRec]);

  const criticalCount = useMemo(() => {
    return Object.values(findingsRec).reduce((sum, d) => {
      const list = Array.isArray(d?.findings) ? d.findings : [];
      return sum + list.filter((f) => f?.severity === 'critical').length;
    }, 0);
  }, [findingsRec]);

  const highSeverityCount = useMemo(() => {
    return Object.values(findingsRec).reduce((sum, d) => {
      const list = Array.isArray(d?.findings) ? d.findings : [];
      return sum + list.filter((f) => f?.severity === 'high' || f?.severity === 'critical').length;
    }, 0);
  }, [findingsRec]);

  const isLoading = runsLoading || (!!latestCompletedRun && reportLoading);
  const hasNoRuns = !runsLoading && !runList?.runs?.length;
  const recentRuns = runList?.runs?.slice(0, 5) ?? [];
  const runningCount = recentRuns.filter((r) => r.status === 'running').length;

  const glassMetrics = useMemo(
    () =>
      buildGlassMetrics({
        currentScore,
        scoreDiff,
        totalRuns: runList?.total ?? 0,
        runningCount,
        totalFindings,
        criticalCount,
        isLoading,
      }),
    [currentScore, scoreDiff, runList?.total, runningCount, totalFindings, criticalCount, isLoading],
  );

  if (hasNoRuns) return <EmptyState />;

  const listError = runsError ? formatApiError(runsError) : null;
  const reportErrMsg = reportError ? formatApiError(reportError) : null;

  return (
    <div className="space-y-10">
      {(listError || reportErrMsg) && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="space-y-1">
            {listError && <p>Runs: {listError}</p>}
            {reportErrMsg && latestCompletedRun && (
              <p>
                Report for run <span className="font-mono text-xs">{latestCompletedRun.id}</span>: {reportErrMsg}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          {latestCompletedRun ? (
            <>
              Latest scan:{' '}
              <span className="font-medium text-foreground">{extractRepoName(latestCompletedRun)}</span>
              <span className="text-muted-foreground"> · branch </span>
              <span className="font-mono text-xs text-foreground/90">
                {latestCompletedRun.branch ?? '—'}
              </span>
              <span className="text-muted-foreground"> · {relativeTime(latestCompletedRun.created_at)}</span>
            </>
          ) : (
            'Complete a scan to populate scores, dimensional risk, and evidence-backed findings.'
          )}
        </p>

        {(criticalCount > 0 || highSeverityCount > 0) && !isLoading && report && (
          <div
            className={cn(
              'flex flex-col gap-3 rounded-2xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
              criticalCount > 0
                ? 'border-destructive/45 bg-destructive/10'
                : 'border-amber-500/35 bg-amber-500/10',
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border',
                  criticalCount > 0
                    ? 'border-destructive/40 bg-destructive/15 text-destructive'
                    : 'border-amber-500/35 bg-amber-500/15 text-amber-200',
                )}
              >
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {criticalCount > 0
                    ? `${criticalCount} critical finding${criticalCount === 1 ? '' : 's'} need ownership`
                    : `${highSeverityCount} high-severity finding${highSeverityCount === 1 ? '' : 's'} to review`}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Triage in the full report, then track fixes in your next scan.
                </p>
              </div>
            </div>
            {latestCompletedRun && (
              <Button asChild size="sm" variant="secondary" className="shrink-0 gap-1.5">
                <Link href={`/report/${latestCompletedRun.id}`}>
                  Open report
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </Button>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline" className="rounded-full border-border/60 bg-background/40">
            <Link href="/runs/new" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              New scan
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="rounded-full border-border/60 bg-background/40">
            <Link href="/runs" className="gap-1.5">
              <ListChecks className="h-3.5 w-3.5" />
              All runs
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="rounded-full border-border/60 bg-background/40">
            <Link href="/simulator" className="gap-1.5">
              <Network className="h-3.5 w-3.5" />
              Simulator
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="rounded-full border-border/60 bg-background/40">
            <Link href="/playground" className="gap-1.5">
              <FlaskConical className="h-3.5 w-3.5" />
              Playground
            </Link>
          </Button>
        </div>
      </div>

      <div className="-mx-4 rounded-3xl border border-border/40 bg-muted/15 px-3 py-2 md:-mx-6 md:px-8">
        <GlassmorphismMinimalMetricsBlock
          metrics={glassMetrics}
          badge="Scan intelligence"
          heading="Operational clarity for AI systems under review"
          subheading="Track posture, pipeline load, and severity mix across security, privacy, hallucinations, red-team, and reliability — without drowning in noise."
          footerTitle="From signal to remediation"
          footerDescription="Jump into the dimensional report for evidence, suggested fixes, and what to re-test on the next scan."
          ctaText="Queue new scan"
          ctaHref="/runs/new"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Card className="flex flex-col items-center justify-center rounded-3xl border-border/60 bg-background/60 p-6 backdrop-blur-sm">
            <p className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Latest safety score
            </p>
            {isLoading ? (
              <SkeletonBlock className="h-56 w-56 rounded-full" />
            ) : (
              <SafetyScoreGauge score={currentScore} />
            )}
            {scoreDiff !== null && !isLoading && (
              <div className="mt-4 flex items-center gap-1.5">
                <TrendIndicator diff={scoreDiff} />
                <span className="text-xs text-muted-foreground">vs. previous run</span>
              </div>
            )}
          </Card>
        </div>

        <div className="lg:col-span-3">
          <Card className="flex h-full min-h-[280px] flex-col rounded-3xl border-border/60 bg-background/60 p-6 backdrop-blur-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">Score history</p>
              </div>
              {sparklineData.length > 0 && (
                <span className="text-xs text-muted-foreground">{sparklineData.length} runs</span>
              )}
            </div>
            <div className="flex-1">
              {isLoading ? (
                <SkeletonBlock className="h-full min-h-[160px] w-full rounded-xl" />
              ) : sparklineData.length > 1 ? (
                <ScoreSparkline data={sparklineData} />
              ) : (
                <div className="flex h-full min-h-[160px] flex-col items-center justify-center text-center">
                  <Activity className="h-8 w-8 text-muted-foreground/40" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    Complete more runs to see your score trend
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      <section>
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Dimensional risk</h2>
          </div>
          {latestCompletedRun && (
            <Link
              href={`/report/${latestCompletedRun.id}`}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              View full report <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {isLoading ? (
            DASHBOARD_DIMENSIONS.map((d) => <SkeletonBlock key={d} className="h-32 rounded-2xl" />)
          ) : !latestCompletedRun ? (
            <p className="col-span-full rounded-2xl border border-border/60 bg-card/40 px-4 py-8 text-center text-sm text-muted-foreground">
              No completed analysis yet. When a run finishes, dimension scores and findings will appear here.
            </p>
          ) : (
            DASHBOARD_DIMENSIONS.map((dimension, i) => {
              const result = findingsRec[dimension];
              return (
                <DimensionCard
                  key={dimension}
                  dimension={dimension}
                  score={scoresRec[dimension] ?? 0}
                  worstSeverity={result?.worst_severity ?? 'info'}
                  findingCount={result?.finding_count ?? 0}
                  runId={latestCompletedRun.id}
                  index={i}
                />
              );
            })
          )}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Scan activity</h2>
          </div>
          <Link href="/runs" className="text-xs font-medium text-primary hover:underline">
            View all runs
          </Link>
        </div>
        <Card className="divide-y divide-border/60 overflow-hidden rounded-3xl border-border/60 bg-background/40 p-1 backdrop-blur-sm">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <SkeletonBlock className="h-9 w-9 shrink-0 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <SkeletonBlock className="h-3 w-32" />
                  <SkeletonBlock className="h-2.5 w-20" />
                </div>
                <SkeletonBlock className="h-5 w-16 rounded-full" />
              </div>
            ))
          ) : recentRuns.length > 0 ? (
            recentRuns.map((run) => <RecentRunRow key={run.id} run={run} />)
          ) : (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">No recent activity</div>
          )}
        </Card>
      </section>

      <div className="flex flex-col items-stretch justify-between gap-4 rounded-3xl border border-dashed border-border/60 bg-background/30 px-6 py-5 backdrop-blur-sm sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-semibold text-foreground">Kick off another safety scan</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Point at a Git repository or upload an archive — we evaluate AI risk across your stack.
          </p>
        </div>
        <Button asChild className="gap-2 shrink-0">
          <Link href="/runs/new">
            <Plus className="h-4 w-4" />
            New run
          </Link>
        </Button>
      </div>
    </div>
  );
}

function TrendIndicator({ diff }: { diff: number }) {
  const isPositive = diff >= 0;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 text-xs font-semibold',
        isPositive ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400',
      )}
    >
      {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {isPositive ? '+' : ''}
      {Math.round(diff)}
    </span>
  );
}
