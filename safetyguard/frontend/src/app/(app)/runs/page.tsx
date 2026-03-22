'use client';

import { useState, type MouseEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  Loader2,
  Plus,
  GitBranch,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  PlayCircle,
} from 'lucide-react';
import { miroApi, runsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { RunStatusBadge } from '@/components/shared/RunStatusBadge';
import { ScoreBar } from '@/components/shared/ScoreBar';
import { cn } from '@/lib/utils';

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 30) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

function truncateUrl(url: string, maxLen = 40): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.slice(1);
    if (path.length <= maxLen) return path;
    return path.slice(0, maxLen - 3) + '...';
  } catch {
    if (url.length <= maxLen) return url;
    return url.slice(0, maxLen - 3) + '...';
  }
}

const PAGE_SIZE = 20;

function MiroRunButton({ runId }: { runId: string }) {
  const [loading, setLoading] = useState(false);
  const [boardUrl, setBoardUrl] = useState<string | null>(null);

  const handleOpen = async (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (boardUrl) {
      window.open(boardUrl, '_blank', 'noopener');
      return;
    }
    setLoading(true);
    try {
      const result = await miroApi.createBoard(runId);
      setBoardUrl(result.board_url);
      window.open(result.board_url, '_blank', 'noopener');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 gap-1.5"
      onClick={handleOpen}
      disabled={loading}
      title="Create/open Miro board for this run"
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
      {boardUrl ? 'Open Miro' : 'Miro'}
    </Button>
  );
}

export default function RunsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['runs', page],
    queryFn: () => runsApi.list(page, PAGE_SIZE),
  });

  const runs = data?.runs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PlayCircle className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Runs</h1>
          {data && (
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {total} total
            </span>
          )}
        </div>
        <Button onClick={() => router.push('/dashboard')}>
          <Plus className="mr-2 h-4 w-4" />
          New Run
        </Button>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : isError ? (
        <div className="flex h-64 flex-col items-center justify-center text-muted-foreground">
          <p className="text-lg font-medium">Failed to load runs</p>
          <p className="mt-1 text-sm">Please try refreshing the page</p>
        </div>
      ) : runs.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center text-muted-foreground">
          <PlayCircle className="mb-4 h-16 w-16 opacity-20" />
          <p className="text-lg font-medium">No runs yet</p>
          <p className="mt-1 text-sm">Start a new analysis run to get started</p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Repository
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Branch
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Created
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Score
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {runs.map((run) => (
                  <tr
                    key={run.id}
                    onClick={() => {
                      if (run.status === 'completed') {
                        router.push(`/report/${run.id}`);
                      }
                    }}
                    className={cn(
                      'transition-colors',
                      run.status === 'completed'
                        ? 'cursor-pointer hover:bg-muted/30'
                        : 'cursor-default',
                    )}
                  >
                    <td className="px-4 py-3">
                      <RunStatusBadge status={run.status} />
                    </td>
                    <td className="px-4 py-3">
                      {run.repo_url ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm text-foreground">{truncateUrl(run.repo_url)}</span>
                          <ExternalLink className="h-3 w-3 text-muted-foreground" />
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Upload</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm text-foreground">{run.branch}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-muted-foreground">
                        {formatRelativeDate(run.created_at)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {run.status === 'completed' && run.report ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">
                            {Math.round(run.report.overall_score)}
                          </span>
                          <ScoreBar score={run.report.overall_score} className="w-20" />
                        </div>
                      ) : run.status === 'failed' ? (
                        <span className="text-xs text-red-400">Failed</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {run.status === 'completed' ? (
                        <div onClick={(e) => e.stopPropagation()}>
                          <MiroRunButton runId={run.id} />
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, total)} of {total}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-md text-sm transition-colors',
                          page === pageNum
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                        )}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
