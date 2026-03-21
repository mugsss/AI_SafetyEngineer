'use client';

import { useQuery } from '@tanstack/react-query';
import { runsApi } from '@/lib/api';
import type { Run } from '@/types/run';

export function useRun(runId: string | undefined) {
  return useQuery<Run>({
    queryKey: ['run', runId],
    queryFn: () => runsApi.get(runId!),
    enabled: !!runId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status === 'running' || data?.status === 'pending') {
        return 5000;
      }
      return false;
    },
  });
}
