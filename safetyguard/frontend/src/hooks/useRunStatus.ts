'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getToken } from '@/lib/auth';
import type { RunStatus } from '@/types/run';

interface RunStatusEvent {
  run_id: string;
  status: RunStatus;
  progress?: number;
  message?: string;
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

    const token = getToken();
    const url = `${API_URL}/runs/${runId}/status/stream?token=${encodeURIComponent(token ?? '')}`;

    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data: RunStatusEvent = JSON.parse(event.data);
        setStatus(data.status);
        if (data.progress !== undefined) setProgress(data.progress);
        if (data.message !== undefined) setMessage(data.message);

        if (data.status === 'completed' || data.status === 'failed') {
          es.close();
        }
      } catch {
        // ignore malformed messages
      }
    };

    es.onerror = () => {
      es.close();
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [runId]);

  return { status, progress, message, disconnect };
}
