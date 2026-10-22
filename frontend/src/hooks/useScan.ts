import { useState, useCallback, useEffect } from 'react';
import { apiClient } from '../api/client';
import type { ScanEvent, Finding, NodeState } from '../types';

export function useScan() {
  const [isScanning, setIsScanning] = useState(false);
  const [currentScanId, setCurrentScanId] = useState<string | null>(null);
  const [events, setEvents] = useState<ScanEvent[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [nodeStates, setNodeStates] = useState<Record<string, NodeState>>({});
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
      if (showAllHistory) {
        // User toggled History -> fetch all past findings from database
        const data = await apiClient.getFindings();
        setFindings(dedupeFindings(data || []));
      } else {
        const activeId = targetScanId ?? currentScanId;
        if (!activeId) {
          // No scan has run yet in this session -> Current Run shows 0 / empty
          setFindings([]);
          return;
        }
        const data = await apiClient.getFindings(activeId);
        setFindings(dedupeFindings(data || []));
      }
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

      const setupOps = new Set<string>(['login', 'createProject']);
      const testedNoLeakOps = new Set<string>();
      const inconclusiveOps = new Set<string>();
      const vulnerableOps = new Set<string>();

      const applyFinalStates = () => {
        setNodeStates((prev) => {
          const next: Record<string, NodeState> = { ...prev };
          // 1. Setup operations
          setupOps.forEach((id) => { next[id] = 'setup'; });
          next['login'] = 'setup';
          next['createProject'] = 'setup';

          // 2. Inconclusive operations (owner control failed)
          inconclusiveOps.forEach((id) => {
            if (!vulnerableOps.has(id)) {
              next[id] = 'inconclusive';
            }
          });

          // 3. Only show "TESTED: NO LEAK" when owner succeeded AND non-owner denied
          testedNoLeakOps.forEach((id) => {
            if (!vulnerableOps.has(id) && !inconclusiveOps.has(id)) {
              next[id] = 'secure';
            }
          });

          // 4. Vulnerable operations
          vulnerableOps.forEach((id) => {
            next[id] = 'vulnerable';
          });

          return next;
        });
      };

      const unsubscribe = apiClient.subscribeScanEvents(
        scan_id,
        (event) => {
          setEvents((prev) => [...prev, event]);

          const opId = event.data?.operation_id || event.data?.candidate_id;
          const purpose = event.data?.purpose || (event.message?.includes('[SETUP]') ? 'setup' : '');

          if (purpose === 'setup' || opId === 'login' || opId === 'createProject') {
            if (opId) setupOps.add(opId);
          }

          if (event.event_type === 'test_inconclusive' || event.message?.includes('test inconclusive') || event.message?.includes('control failed')) {
            if (opId) {
              inconclusiveOps.add(opId);
              testedNoLeakOps.delete(opId);
              setNodeStates((prev) => ({ ...prev, [opId]: 'inconclusive' }));
            }
          } else if (event.event_type === 'request_sent' && opId) {
            if (setupOps.has(opId) || purpose === 'setup') {
              setNodeStates((prev) => ({ ...prev, [opId]: 'setup' }));
            } else if (!vulnerableOps.has(opId) && !inconclusiveOps.has(opId) && !testedNoLeakOps.has(opId)) {
              setNodeStates((prev) => ({ ...prev, [opId]: 'probing' }));
            }
          } else if (event.event_type === 'finding_confirmed') {
            const confirmedOp = event.data?.hypothesis?.operation_id || opId;
            if (confirmedOp) {
              vulnerableOps.add(confirmedOp);
              testedNoLeakOps.delete(confirmedOp);
              inconclusiveOps.delete(confirmedOp);
              setNodeStates((prev) => ({ ...prev, [confirmedOp]: 'vulnerable' }));
            }
            if (event.data && event.data.id) {
              setFindings((prev) => dedupeFindings([...prev, event.data as Finding]));
            }
          } else if (event.event_type === 'probe_denied') {
            if (opId && !inconclusiveOps.has(opId) && !vulnerableOps.has(opId)) {
              testedNoLeakOps.add(opId);
              setNodeStates((prev) => ({ ...prev, [opId]: 'secure' }));
            }
          } else if (event.event_type === 'hypothesis_propagated' && opId) {
            if (!setupOps.has(opId) && !vulnerableOps.has(opId) && !testedNoLeakOps.has(opId) && !inconclusiveOps.has(opId)) {
              setNodeStates((prev) => ({ ...prev, [opId]: 'candidate' }));
            }
          } else if (event.event_type === 'response_received' && opId) {
            if (setupOps.has(opId) || purpose === 'setup') {
              setNodeStates((prev) => ({ ...prev, [opId]: 'setup' }));
            }
          } else if (event.event_type === 'scan_completed') {
            applyFinalStates();
          }
        },
        () => {
          setIsScanning(false);
          applyFinalStates();
          loadFindings(scan_id);
        },
        (err) => {
          console.error('SSE Error:', err);
          setIsScanning(false);
          applyFinalStates();
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
