'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Rocket,
  ExternalLink,
  LayoutGrid,
  Workflow,
} from 'lucide-react';
import { runsApi, reportsApi, settingsApi, miroApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { SafetyScoreGauge } from '@/components/dashboard/SafetyScoreGauge';
import { ScoreSparkline } from '@/components/dashboard/ScoreSparkline';
import { DimensionCard } from '@/components/dashboard/DimensionCard';
import type { Dimension, SafetyReport } from '@/types/report';
import type { Run } from '@/types/run';

const DASHBOARD_DIMENSIONS: Exclude<Dimension, 'redteam'>[] = [
  'risk',
  'security',
  'hallucinations',
  'failures',
  'cost',
  'privacy',
  'observability',
  'performance',
  'resources',
];

function toOrigin(url?: string | null): string | null {
  const t = (url || '').trim();
  if (!t) return null;
  try {
    return new URL(t).origin;
  } catch {
    return t.replace(/\/$/, '');
  }
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

function SkeletonGauge() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="h-[184px] w-[184px] animate-pulse rounded-full bg-secondary" />
    </div>
  );
}

function SkeletonCard() {
  return (
    <Card className="animate-pulse p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-secondary" />
          <div className="h-4 w-20 rounded bg-secondary" />
        </div>
        <div className="h-5 w-14 rounded-full bg-secondary" />
      </div>
      <div className="mt-4 flex items-end justify-between">
        <div className="h-8 w-16 rounded bg-secondary" />
        <div className="h-4 w-16 rounded bg-secondary" />
      </div>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="rounded-2xl bg-secondary p-6">
        <Rocket className="h-12 w-12 text-primary" />
      </div>
      <h2 className="mt-6 text-2xl font-bold text-foreground">
        No analysis runs yet
      </h2>
      <p className="mt-2 max-w-md text-muted-foreground">
        Run your first safety analysis to see scores, findings, and
        recommendations across all dimensions.
      </p>
      <Link href="/runs/new">
        <Button size="lg" className="mt-6 gap-2">
          <Plus className="h-4 w-4" />
          Run New Analysis
        </Button>
      </Link>
    </div>
  );
}

function MiroWorkflowButton({ runId }: { runId: string }) {
  const [loading, setLoading] = useState(false);
  const [boardUrl, setBoardUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    if (boardUrl) {
      window.open(boardUrl, '_blank', 'noopener');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await miroApi.createBoard(runId);
      setBoardUrl(result.board_url);
      window.open(result.board_url, '_blank', 'noopener');
    } catch (e: any) {
      const msg =
        e?.response?.data?.detail || e?.message || 'Failed to create Miro workflow';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {error && (
        <span className="max-w-[220px] truncate text-xs text-red-400" title={error}>
          {error.length > 34 ? `${error.slice(0, 34)}...` : error}
        </span>
      )}
      <Button variant="outline" onClick={handleClick} disabled={loading}>
        {loading ? (
          <>
            <Rocket className="mr-2 h-4 w-4 animate-pulse" />
            Creating Miro workflow...
          </>
        ) : (
          <>
            <LayoutGrid className="mr-2 h-4 w-4" />
            {boardUrl ? 'Open Miro workflow' : 'Create Miro workflow'}
          </>
        )}
      </Button>
    </div>
  );
}

function N8nTriggerButton({ runId }: { runId?: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTrigger = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const result = await settingsApi.workflowWebhooks.trigger(runId);
      if (result.success) setMessage(result.message);
      else setError(result.message);
    } catch (e: any) {
      const msg =
        e?.response?.data?.detail || e?.message || 'Failed to trigger n8n workflow';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {error && (
        <span className="max-w-[220px] truncate text-xs text-red-400" title={error}>
          {error.length > 34 ? `${error.slice(0, 34)}...` : error}
        </span>
      )}
      {message && (
        <span className="max-w-[220px] truncate text-xs text-green-400" title={message}>
          {message}
        </span>
      )}
      <Button variant="outline" onClick={handleTrigger} disabled={loading}>
        {loading ? (
          <>
            <Workflow className="mr-2 h-4 w-4 animate-pulse" />
            Triggering...
          </>
        ) : (
          <>
            <Workflow className="mr-2 h-4 w-4" />
            Trigger n8n workflow
          </>
        )}
      </Button>
    </div>
  );
}

export default function DashboardPage() {
  const {
    data: runList,
    isLoading: runsLoading,
  } = useQuery({
    queryKey: ['runs', 'dashboard'],
    queryFn: () => runsApi.list(1, 10),
  });

  const latestRun: Run | undefined = runList?.runs?.[0];
  const latestCompletedRun = runList?.runs?.find(
    (r) => r.status === 'completed',
  );

  const {
    data: report,
    isLoading: reportLoading,
  } = useQuery({
    queryKey: ['report', latestCompletedRun?.id],
    queryFn: () => reportsApi.get(latestCompletedRun!.id),
    enabled: !!latestCompletedRun,
  });
  const { data: appSettings } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.get,
  });

  const sparklineData = useMemo(() => {
    if (!runList?.runs) return [];
    const completedRuns = runList.runs
      .filter((r) => r.status === 'completed' && r.report)
      .reverse();
    return completedRuns.map((r, i) => ({
      run: i + 1,
      score: r.report!.overall_score,
    }));
  }, [runList]);

  const previousScore = sparklineData.length >= 2
    ? sparklineData[sparklineData.length - 2].score
    : null;

  const currentScore = report?.overall_score ?? 0;
  const scoreDiff = previousScore !== null ? currentScore - previousScore : null;
  const n8nOrigin = useMemo(() => {
    return (
      toOrigin(appSettings?.n8n_base_url) ||
      toOrigin(process.env.NEXT_PUBLIC_N8N_APP_URL) ||
      null
    );
  }, [appSettings?.n8n_base_url]);

  const isLoading = runsLoading || (!!latestCompletedRun && reportLoading);
  const hasNoRuns = !runsLoading && (!runList?.runs?.length);

  if (hasNoRuns) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-8">
      {/* Hero Row */}
      <section className="flex flex-col items-start gap-8 lg:flex-row lg:items-center">
        <div className="flex flex-col items-center">
          {isLoading ? (
            <SkeletonGauge />
          ) : (
            <SafetyScoreGauge score={currentScore} />
          )}
          {latestCompletedRun && !isLoading && (
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Last run for{' '}
              <span className="font-medium text-foreground">
                {extractRepoName(latestCompletedRun)}@
                {latestCompletedRun.branch}
              </span>{' '}
              &middot; {relativeTime(latestCompletedRun.created_at)}
            </p>
          )}
        </div>

        {!isLoading && sparklineData.length > 1 && (
          <div className="flex items-center gap-4">
            <ScoreSparkline data={sparklineData} />
            {scoreDiff !== null && (
              <TrendIndicator diff={scoreDiff} />
            )}
          </div>
        )}
      </section>

      <Separator />

      {/* Integrations Quick Actions */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          Integrations
        </h2>
        <div className="flex flex-wrap gap-3">
          {latestCompletedRun ? (
            <>
              <MiroWorkflowButton runId={latestCompletedRun.id} />
              <Button variant="secondary" asChild>
                <a
                  href="https://miro.com/app/dashboard/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Miro dashboard
                </a>
              </Button>
            </>
          ) : (
            <Button variant="outline" asChild>
              <Link href="/runs">
                <LayoutGrid className="mr-2 h-4 w-4" />
                Run analysis to enable Miro
              </Link>
            </Button>
          )}

          {n8nOrigin ? (
            <>
              <N8nTriggerButton runId={latestCompletedRun?.id} />
              <Button variant="outline" asChild>
                <a href={n8nOrigin} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open n8n
                </a>
              </Button>
              <Button variant="secondary" asChild>
                <a
                  href={`${n8nOrigin}/executions`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Workflow className="mr-2 h-4 w-4" />
                  n8n executions
                </a>
              </Button>
            </>
          ) : (
            <Button variant="outline" asChild>
              <Link href="/settings">
                <Workflow className="mr-2 h-4 w-4" />
                Configure n8n URL
              </Link>
            </Button>
          )}
        </div>
      </section>

      <Separator />

      {/* Dimension Cards Grid */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          Dimension Scores
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {isLoading
            ? DASHBOARD_DIMENSIONS.map((d) => <SkeletonCard key={d} />)
            : DASHBOARD_DIMENSIONS.map((dimension) => {
                const result = report?.findings[dimension];
                return (
                  <DimensionCard
                    key={dimension}
                    dimension={dimension}
                    score={report?.dimension_scores[dimension] ?? 0}
                    worstSeverity={result?.worst_severity ?? 'info'}
                    findingCount={result?.finding_count ?? 0}
                    runId={latestCompletedRun?.id ?? ''}
                  />
                );
              })}
        </div>
      </section>

      <Separator />

      {/* Bottom Bar */}
      <section className="flex items-center justify-between">
        <Link href="/runs/new">
          <Button size="lg" className="gap-2">
            <Plus className="h-4 w-4" />
            Run New Analysis
          </Button>
        </Link>
        {latestRun && (
          <span className="text-sm text-muted-foreground">
            Last run: {relativeTime(latestRun.created_at)}
          </span>
        )}
      </section>
    </div>
  );
}

function extractRepoName(run: Run): string {
  if (run.repo_url) {
    const parts = run.repo_url.replace(/\.git$/, '').split('/');
    return parts.slice(-2).join('/');
  }
  return 'uploaded project';
}

function TrendIndicator({ diff }: { diff: number }) {
  const isPositive = diff >= 0;
  return (
    <div
      className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-semibold ${
        isPositive
          ? 'bg-green-500/15 text-green-400'
          : 'bg-red-500/15 text-red-400'
      }`}
    >
      {isPositive ? (
        <ArrowUpRight className="h-4 w-4" />
      ) : (
        <ArrowDownRight className="h-4 w-4" />
      )}
      {isPositive ? '+' : ''}
      {Math.round(diff)}
    </div>
  );
}
