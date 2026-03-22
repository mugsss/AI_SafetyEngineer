'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { RunStatus } from '@/types/run';
import { getBackendOriginForStreams } from '@/lib/api';

interface RunStatusEvent {
  run_id: string;
  status: RunStatus;
  progress?: number;
  message?: string;
}

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
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
      return;
    }

    const url = `${getBackendOriginForStreams()}/api/runs/${runId}/status`;

    let es: EventSource;
    try {
      es = new EventSource(url);
    } catch {
      setMessage('Live status unavailable in this browser.');
      return;
    }

    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as RunStatusEvent & { error?: string };
        if (data.error) {
          setMessage(data.error);
          setStatus('failed');
          es.close();
          eventSourceRef.current = null;
          return;
        }
        setStatus(data.status);
        if (data.progress !== undefined) setProgress(data.progress);
        if (data.message !== undefined) setMessage(data.message);

        if (data.status === 'completed' || data.status === 'failed') {
          es.close();
          eventSourceRef.current = null;
        }
      } catch {
        // ignore malformed messages
      }
    };

    es.onerror = () => {
      try {
        es.close();
      } catch {
        /* ignore */
      }
      eventSourceRef.current = null;
    };

    return () => {
      try {
        es.close();
      } catch {
        /* ignore */
      }
      eventSourceRef.current = null;
    };
  }, [runId]);

  return { status, progress, message, disconnect };
}
