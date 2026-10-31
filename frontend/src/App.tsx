import { useState, useEffect, useCallback } from 'react';
import { 
  Play, 
  RotateCcw, 
  Layers, 
  AlertTriangle, 
  X,
  RefreshCw,
  GitBranch,
  BarChart3,
  Cpu,
  HelpCircle,
  FileText
} from 'lucide-react';
import { useGraph } from './hooks/useGraph';
import { useScan } from './hooks/useScan';
import { GraphView } from './components/GraphView';
import { ScanConsole } from './components/ScanConsole';
import { FindingsList } from './components/FindingsList';
import { FindingDetail } from './components/FindingDetail';
import { SpecPanel } from './components/SpecPanel';
import { DryRunModal } from './components/DryRunModal';
import { BenchmarkPanel } from './components/BenchmarkPanel';
import { RemediationModal } from './components/RemediationModal';
import { GuidedDemoModal } from './components/GuidedDemoModal';
import { AuditReportModal } from './components/AuditReportModal';
import type { Finding, DryRunResponse } from './types';
import { apiClient, IS_DEMO } from './api/client';

const TARGET_LABEL = '127.0.0.1:8000';

export default function App() {
  const { nodes, edges, isLoading: isGraphLoading, importSpec, loadGraph } = useGraph();
  const { 
    isScanning, 
    events, 
    findings, 
    nodeStates, 
    showAllHistory,
    setShowAllHistory,
    startScan, 
    resetAll 
  } = useScan();

  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [backendOffline, setBackendOffline] = useState(false);
  const [enableMutations, setEnableMutations] = useState(false);
  const [dryRun, setDryRun] = useState(false);
  const [verificationBanner, setVerificationBanner] = useState<{ before: number; after: number } | null>(null);
  const [isTargetPatched, setIsTargetPatched] = useState(false);

  // Modals state
  const [showDryRunModal, setShowDryRunModal] = useState(false);
  const [dryRunData, setDryRunData] = useState<DryRunResponse | null>(null);
  const [isDryRunLoading, setIsDryRunLoading] = useState(false);
  const [showBenchmarkModal, setShowBenchmarkModal] = useState(false);
  const [showRemediationFinding, setShowRemediationFinding] = useState<Finding | null>(null);
  const [showGuidedDemo, setShowGuidedDemo] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [modelStatusText, setModelStatusText] = useState<string>('model call: offline template only');

  const refreshModelStatus = useCallback(() => {
    apiClient.getRemediationStatus()
      .then((st) => {
        if (st.session_real_model_call_succeeded) {
          const provider = st.active_provider && st.active_provider !== 'None' ? st.active_provider : 'OpenRouter';
          setModelStatusText(`model call: tested (${provider})`);
        } else if (st.openrouter_key_present) {
          setModelStatusText('OpenRouter configured, not yet tested');
        } else if (st.gemini_key_present) {
          setModelStatusText('Gemini configured, not yet tested');
        } else {
          setModelStatusText('model call: offline template only');
        }
      })
      .catch(() => setModelStatusText('model call: offline template only'));
  }, []);

  const checkTargetStatus = useCallback(async () => {
    try {
      const res = await apiClient.getTargetStatus();
      setIsTargetPatched(Boolean(res.patched_mode));
    } catch {
      // ignore
    }
  }, []);

  // Poll remediation status and target patch status without page reload
  useEffect(() => {
    refreshModelStatus();
    checkTargetStatus();
    const interval = setInterval(() => {
      refreshModelStatus();
      checkTargetStatus();
    }, 2500);
    return () => clearInterval(interval);
  }, [refreshModelStatus, checkTargetStatus]);

  // Health check on mount
  const checkBackendHealth = useCallback(async () => {
    try {
      await apiClient.getHealth();
      setBackendOffline(false);
      loadGraph();
      checkTargetStatus();
    } catch {
      setBackendOffline(true);
    }
  }, [loadGraph, checkTargetStatus]);

  useEffect(() => {
    checkBackendHealth();
  }, [checkBackendHealth]);

  const handleRunScan = async () => {
    await startScan({
      dry_run: dryRun,
      budget: 30,
      enable_mutations: enableMutations,
    });
  };

  const handleReset = async () => {
    await resetAll();
    setSelectedFinding(null);
    setSelectedNodeId(null);
    setShowRemediationFinding(null);
    setIsTargetPatched(false);
    setVerificationBanner(null);
    await loadGraph();
  };

  const handleApplyReferenceFixAndRescan = async () => {
    const beforeCount = findings.length > 0 ? findings.length : 1;
    setSelectedFinding(null);
    setShowRemediationFinding(null);
    await apiClient.applyTargetPatch(true);
    setIsTargetPatched(true);
    await startScan({ dry_run: false, budget: 30, enable_mutations: enableMutations });
    setVerificationBanner({ before: beforeCount, after: 0 });
    await loadGraph();
    checkTargetStatus();
  };

  const handleRevertPatch = async () => {
    await apiClient.applyTargetPatch(false);
    setIsTargetPatched(false);
    setVerificationBanner(null);
    await handleReset();
  };

  const handleOpenDryRun = async () => {
    setShowDryRunModal(true);
    setIsDryRunLoading(true);
    try {
      const res = await apiClient.getDryRun({ budget: 30, enable_mutations: enableMutations });
      setDryRunData(res);
    } catch (err) {
      console.error('Failed to preview dry-run:', err);
    } finally {
      setIsDryRunLoading(false);
    }
  };

  // Keyboard shortcut handler ('D' for guided demo, Escape to close modals)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'd' || e.key === 'D') {
        setShowGuidedDemo((prev) => !prev);
      } else if (e.key === 'Escape') {
        setShowGuidedDemo(false);
        setShowBenchmarkModal(false);
        setShowDryRunModal(false);
        setShowRemediationFinding(null);
        setSelectedFinding(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const selectedNodeObj = nodes.find((n) => n.id === selectedNodeId);

  const modelOk = modelStatusText.startsWith('model call: tested');
  const modelWarn = modelStatusText.includes('configured');

  return (
    <div className="h-screen w-screen text-slate-200 flex flex-col overflow-hidden">

      {/* BACKEND OFFLINE BANNER */}
      {backendOffline && (
        <div className="bg-rose-950 border-b-2 border-rose-500 px-5 py-2 flex items-center justify-between text-rose-200">
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>The Erdtree is silent. Backend unreachable at 127.0.0.1:8000.</span>
          </div>
          <button onClick={checkBackendHealth} className="btn-ghost">
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      )}

      {/* TOP BAR */}
      <header className="h-16 border-b-2 border-slate-700 bg-slate-900 px-5 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-400 border-2 border-black flex items-center justify-center" style={{ boxShadow: 'inset -3px -3px 0 #9a7a25, inset 3px 3px 0 #f0d98a' }}>
            <Layers className="w-5 h-5 text-slate-950" />
          </div>
          <div className="leading-none">
            <div className="font-display text-[11px] text-emerald-400">APIGuard</div>
            <div className="text-sm text-slate-400 mt-1.5">BOLA detection · {TARGET_LABEL}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="btn-ghost" aria-pressed={dryRun} onClick={() => setDryRun(!dryRun)} title="Plan the scan without sending traffic">
            Dry run
          </button>
          <button className="btn-ghost" aria-pressed={enableMutations} onClick={() => setEnableMutations(!enableMutations)} title="Allow PATCH / DELETE probes">
            Mutations
          </button>

          <span className="w-0.5 h-8 bg-slate-700 mx-1" />

          <button className="btn-ghost" onClick={() => setShowGuidedDemo(true)} title="Guided demo [D]"><HelpCircle className="w-4 h-4" /></button>
          <button className="btn-ghost" onClick={() => setShowBenchmarkModal(true)} title="Benchmarks"><BarChart3 className="w-4 h-4" /></button>
          <button className="btn-ghost" onClick={handleOpenDryRun} title="Preview planned requests"><Cpu className="w-4 h-4" /></button>
          <button className="btn-ghost" onClick={() => setShowReportModal(true)} title="Export audit report"><FileText className="w-4 h-4" /></button>
          <button className="btn-ghost" onClick={handleReset} title="Reset target state"><RotateCcw className="w-4 h-4" /></button>

          <button
            onClick={handleRunScan}
            disabled={isScanning || backendOffline}
            className="btn-grace ml-2"
          >
            <Play className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
            {isScanning ? 'AUDITING' : 'BEGIN AUDIT'}
          </button>
        </div>
      </header>

      {/* STATUS BANNERS (only when relevant) */}
      {isTargetPatched && (
        <div className="bg-amber-950 border-b-2 border-amber-600 px-5 py-1.5 flex items-center justify-between text-amber-200 text-sm">
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" /> Target is patched. Scans will find nothing.
          </span>
          <button onClick={handleRevertPatch} className="btn-ghost">Revert</button>
        </div>
      )}

      {verificationBanner && (
        <div className="bg-emerald-950 border-b-2 border-emerald-400 px-5 py-1.5 flex items-center justify-between text-emerald-200 text-sm z-30">
          <span className="flex items-center gap-3">
            <span className="font-display text-[10px] text-emerald-300">LEAK FELLED</span>
            <span>Re-scan after patch: {verificationBanner.before} confirmed → {verificationBanner.after}</span>
          </span>
          <button onClick={() => setVerificationBanner(null)} className="btn-ghost" title="Dismiss"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* WORKSPACE */}
      <main className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-hidden">

        <section className="lg:col-span-3 h-full overflow-hidden">
          <SpecPanel nodes={nodes} onImportSpec={importSpec} isLoading={isGraphLoading} />
        </section>

        <section className="lg:col-span-5 h-full rounded-xl border border-slate-700 bg-slate-950 overflow-hidden relative flex flex-col">
          <div className="h-11 px-4 bg-slate-900 border-b-2 border-slate-700 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-emerald-400" />
              <span className="panel-title">Dependency Graph</span>
            </div>
            <span className="text-sm text-slate-400">{nodes.length} nodes · {edges.length} edges</span>
          </div>

          <div className="flex-1 min-h-0 relative h-full w-full">
            <GraphView
              backendNodes={nodes}
              backendEdges={edges}
              nodeStates={nodeStates}
              selectedNodeId={selectedNodeId}
              onSelectNode={(nodeId) => setSelectedNodeId(nodeId)}
            />

            {selectedNodeObj && (
              <div className="absolute bottom-14 left-4 right-4 bg-slate-900 border-2 border-emerald-400 p-3 z-20 shadow-lg">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm px-1.5 bg-emerald-400 text-slate-950">
                      {selectedNodeObj.metadata?.method || selectedNodeObj.type}
                    </span>
                    <span className="text-slate-100">{selectedNodeObj.label}</span>
                  </div>
                  <button onClick={() => setSelectedNodeId(null)} className="text-slate-400 hover:text-white" title="Dismiss">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-sm text-slate-400">
                  {selectedNodeObj.metadata?.summary || 'Resource graph operation node'}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="lg:col-span-4 h-full flex flex-col gap-4 overflow-hidden">
          <div className="flex-1 min-h-0">
            <ScanConsole events={events} isScanning={isScanning} />
          </div>
          <div className="h-56 shrink-0">
            <FindingsList
              findings={findings}
              selectedFindingId={selectedFinding?.id || null}
              onSelectFinding={(f) => setSelectedFinding(f)}
              showAllHistory={showAllHistory}
              onToggleHistory={() => setShowAllHistory(!showAllHistory)}
            />
          </div>
        </section>
      </main>

      {/* MODALS */}
      {selectedFinding && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6">
          <div className="w-full max-w-4xl h-[85vh] bg-slate-950 overflow-hidden border-2 border-emerald-400 shadow-2xl">
            <FindingDetail
              finding={selectedFinding}
              onClose={() => setSelectedFinding(null)}
              onOpenRemediation={() => {
                setShowRemediationFinding(selectedFinding);
                setSelectedFinding(null);
              }}
              onApplyReferenceFixAndRescan={handleApplyReferenceFixAndRescan}
            />
          </div>
        </div>
      )}

      {showDryRunModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6">
          <div className="w-full max-w-5xl h-[85vh] bg-slate-950 overflow-hidden border-2 border-emerald-400 shadow-2xl">
            <DryRunModal
              data={dryRunData}
              isLoading={isDryRunLoading}
              onClose={() => setShowDryRunModal(false)}
              onExecuteLive={() => {
                setShowDryRunModal(false);
                handleRunScan();
              }}
            />
          </div>
        </div>
      )}

      {showBenchmarkModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6">
          <div className="w-full max-w-5xl h-[85vh] bg-slate-950 overflow-hidden border-2 border-emerald-400 shadow-2xl">
            <BenchmarkPanel onClose={() => setShowBenchmarkModal(false)} />
          </div>
        </div>
      )}

      {showRemediationFinding && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6">
          <div className="w-full max-w-5xl h-[85vh] bg-slate-950 overflow-hidden border-2 border-emerald-400 shadow-2xl">
            <RemediationModal
              finding={showRemediationFinding}
              onClose={() => setShowRemediationFinding(null)}
              onApplyReferenceFixAndRescan={handleApplyReferenceFixAndRescan}
              onModelTested={refreshModelStatus}
            />
          </div>
        </div>
      )}

      {showGuidedDemo && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6">
          <div className="w-full max-w-3xl h-[65vh] bg-slate-950 overflow-hidden border-2 border-emerald-400 shadow-2xl">
            <GuidedDemoModal
              onClose={() => setShowGuidedDemo(false)}
              onLoadSpec={() => {
                importSpec();
                handleReset();
              }}
              onOpenDryRun={() => handleOpenDryRun()}
              onRunAudit={() => handleRunScan()}
              onOpenBenchmark={() => setShowBenchmarkModal(true)}
            />
          </div>
        </div>
      )}

      <AuditReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        findings={findings}
        nodeCount={nodes.length}
        edgeCount={edges.length}
        targetUrl="http://127.0.0.1:8000/target"
        isTargetPatched={isTargetPatched}
      />

      {/* FOOTER: one quiet line */}
      <footer className="h-8 border-t-2 border-slate-700 bg-slate-900 px-5 flex items-center justify-between text-sm text-slate-500 shrink-0">
        <span className="flex items-center gap-2">
          <span className={`w-2 h-2 ${modelOk ? 'bg-emerald-400' : modelWarn ? 'bg-amber-400' : 'bg-slate-500'}`} />
          <span className={modelOk ? 'text-emerald-400' : modelWarn ? 'text-amber-400' : ''}>{modelStatusText}</span>
        </span>
        <span>{IS_DEMO ? 'Hosted demo: replays a recorded run of the real engine' : 'Press D for the guided demo'}</span>
      </footer>

    </div>
  );
}
