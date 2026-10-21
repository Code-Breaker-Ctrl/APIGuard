import { useState, useCallback, useEffect } from 'react';
import { apiClient } from '../api/client';
import type { ScanEvent, Finding } from '../types';

export function useScan() {
  const [isScanning, setIsScanning] = useState(false);
  const [events, setEvents] = useState<ScanEvent[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [nodeStates, setNodeStates] = useState<Record<string, 'idle' | 'probing' | 'vulnerable' | 'secure' | 'candidate'>>({});
  const [error, setError] = useState<string | null>(null);

  const loadFindings = useCallback(async () => {
    try {
      const data = await apiClient.getFindings();
      setFindings(data || []);
    } catch (err: any) {
      console.error('Failed to load findings:', err);
    }
  }, []);

  useEffect(() => {
    loadFindings();
  }, [loadFindings]);

  const startScan = useCallback(async (options: { dry_run?: boolean; budget?: number; enable_mutations?: boolean } = {}) => {
    setIsScanning(true);
    setEvents([]);
    setError(null);
    setNodeStates({});

    try {
      const { scan_id } = await apiClient.triggerScan(options);

      const unsubscribe = apiClient.subscribeScanEvents(
        scan_id,
        (event) => {
          setEvents((prev) => [...prev, event]);

          const opId = event.data?.operation_id || event.data?.candidate_id;

          if (event.event_type === 'request_sent' && opId) {
            setNodeStates((prev) => ({ ...prev, [opId]: 'probing' }));
          } else if (event.event_type === 'finding_confirmed') {
            const confirmedOp = event.data?.hypothesis?.operation_id || opId;
            if (confirmedOp) {
              setNodeStates((prev) => ({ ...prev, [confirmedOp]: 'vulnerable' }));
            }
            if (event.data && event.data.id) {
              setFindings((prev) => {
                const exists = prev.some((f) => f.id === event.data?.id);
                return exists ? prev : [...prev, event.data as Finding];
              });
            }
          } else if (event.event_type === 'hypothesis_propagated' && opId) {
            setNodeStates((prev) => ({ ...prev, [opId]: 'candidate' }));
          } else if (event.event_type === 'response_received' && opId) {
            const statusCode = event.data?.status_code;
            if (statusCode === 403 || statusCode === 404) {
              setNodeStates((prev) => (prev[opId] === 'vulnerable' ? prev : { ...prev, [opId]: 'secure' }));
            }
          }
        },
        () => {
          setIsScanning(false);
          loadFindings();
        },
        (err) => {
          console.error('SSE Error:', err);
          setIsScanning(false);
          loadFindings();
        }
      );

      return unsubscribe;
    } catch (err: any) {
      setIsScanning(false);
      setError(err.message || 'Failed to trigger scan');
    }
  }, [loadFindings]);

  const resetAll = useCallback(async () => {
    await apiClient.resetTarget();
    setEvents([]);
    setFindings([]);
    setNodeStates({});
  }, []);

  return {
    isScanning,
    events,
    findings,
    nodeStates,
    error,
    startScan,
    resetAll,
    loadFindings,
  };
}
