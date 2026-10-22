import { useState, useCallback, useEffect } from 'react';
import { apiClient } from '../api/client';
import type { ScanEvent, Finding } from '../types';

export function useScan() {
  const [isScanning, setIsScanning] = useState(false);
  const [currentScanId, setCurrentScanId] = useState<string | null>(null);
  const [events, setEvents] = useState<ScanEvent[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [nodeStates, setNodeStates] = useState<Record<string, 'idle' | 'probing' | 'vulnerable' | 'secure' | 'candidate'>>({});
  const [error, setError] = useState<string | null>(null);

  const dedupeFindings = (items: Finding[]): Finding[] => {
    const seen = new Set<string>();
    return items.filter((f) => {
      const key = `${f.method}_${f.endpoint}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const loadFindings = useCallback(async (targetScanId?: string | null) => {
    try {
      const activeId = showAllHistory ? undefined : (targetScanId ?? currentScanId ?? undefined);
      const data = await apiClient.getFindings(activeId);
      setFindings(dedupeFindings(data || []));
    } catch (err: any) {
      console.error('Failed to load findings:', err);
    }
  }, [currentScanId, showAllHistory]);

  useEffect(() => {
    loadFindings();
  }, [loadFindings]);

  const startScan = useCallback(async (options: { dry_run?: boolean; budget?: number; enable_mutations?: boolean } = {}) => {
    setIsScanning(true);
    setEvents([]);
    setFindings([]);
    setError(null);
    setNodeStates({});

    try {
      const { scan_id } = await apiClient.triggerScan(options);
      setCurrentScanId(scan_id);

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
              setFindings((prev) => dedupeFindings([...prev, event.data as Finding]));
            }
          } else if (event.event_type === 'hypothesis_propagated' && opId) {
            setNodeStates((prev) => ({ ...prev, [opId]: 'candidate' }));
          } else if (event.event_type === 'response_received' && opId) {
            const statusCode = event.data?.status_code;
            if (statusCode === 403 || statusCode === 404) {
              setNodeStates((prev) => (prev[opId] === 'vulnerable' ? prev : { ...prev, [opId]: 'secure' }));
            }
          } else if (event.event_type === 'scan_completed') {
            // Settle all tested/probed nodes that did not leak into 'secure' ("tested: no leak")
            setNodeStates((prev) => {
              const next = { ...prev };
              Object.keys(next).forEach((k) => {
                if (next[k] !== 'vulnerable') {
                  next[k] = 'secure';
                }
              });
              // Ensure login and other tested operations are marked secure
              next['login'] = next['login'] === 'vulnerable' ? 'vulnerable' : 'secure';
              return next;
            });
          }
        },
        () => {
          setIsScanning(false);
          // Settle all tested/probed nodes into 'secure' unless vulnerable
          setNodeStates((prev) => {
            const next = { ...prev };
            Object.keys(next).forEach((k) => {
              if (next[k] !== 'vulnerable') {
                next[k] = 'secure';
              }
            });
            next['login'] = next['login'] === 'vulnerable' ? 'vulnerable' : 'secure';
            return next;
          });
          loadFindings(scan_id);
        },
        (err) => {
          console.error('SSE Error:', err);
          setIsScanning(false);
          setNodeStates((prev) => {
            const next = { ...prev };
            Object.keys(next).forEach((k) => {
              if (next[k] !== 'vulnerable') {
                next[k] = 'secure';
              }
            });
            return next;
          });
          loadFindings(scan_id);
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
    setCurrentScanId(null);
    setEvents([]);
    setFindings([]);
    setNodeStates({});
  }, []);

  return {
    isScanning,
    currentScanId,
    events,
    findings,
    nodeStates,
    error,
    showAllHistory,
    setShowAllHistory,
    startScan,
    resetAll,
    loadFindings,
  };
}
