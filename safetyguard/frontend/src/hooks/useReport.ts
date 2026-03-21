'use client';

import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '@/lib/api';
import type { SafetyReport } from '@/types/report';

export function useReport(runId: string | undefined) {
  return useQuery<SafetyReport>({
    queryKey: ['report', runId],
    queryFn: () => reportsApi.get(runId!),
    enabled: !!runId,
    staleTime: 1000 * 60 * 5,
  });
}
