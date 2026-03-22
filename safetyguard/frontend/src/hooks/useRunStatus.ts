'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { RunStatus } from '@/types/run';

interface StatusPayload {
  status: RunStatus;
  progress?: number;
  current_agent?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export function useRunStatus(runId: string | undefined) {
  const [status, setStatus] = useState<RunStatus>('pending');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const eventSourceRef = useRef<EventSource | null>(null);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!runId) return;

    const url = `${API_URL}/api/runs/${runId}/status`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    const onStatus = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as StatusPayload;
        if (data.status) setStatus(data.status);
        if (data.progress !== undefined) setProgress(data.progress);
        const hint =
          data.current_agent && data.current_agent !== 'done'
            ? data.current_agent
            : '';
        setMessage(hint || '');
        if (data.status === 'completed' || data.status === 'failed') {
          es.close();
        }
      } catch {
        // ignore malformed messages
      }
    };

    const onServerErrorEvent = (event: Event) => {
      if (!('data' in event) || typeof (event as MessageEvent).data !== 'string') {
        return;
      }
      try {
        const err = JSON.parse((event as MessageEvent).data) as {
          error?: string;
        };
        if (err?.error) setMessage(err.error);
      } catch {
        // ignore
      }
    };

    es.addEventListener('status', onStatus);
    es.addEventListener('error', onServerErrorEvent);
    es.onerror = () => {
      es.close();
    };

    return () => {
      es.removeEventListener('status', onStatus);
      es.removeEventListener('error', onServerErrorEvent);
      es.close();
      eventSourceRef.current = null;
    };
  }, [runId]);

  return { status, progress, message, disconnect };
}
