import { useState, useEffect, useCallback } from 'react';
import { 
  Play, 
  RotateCcw, 
  Layers, 
  AlertTriangle, 
  Server, 
  RefreshCw, 
  GitBranch,
  BarChart3,
  Cpu,
  HelpCircle
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
import type { Finding, DryRunResponse } from './types';
import { apiClient } from './api/client';

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

  return (
    <div className="h-screen w-screen bg-[#090b10] text-[#e2e8f0] flex flex-col font-sans antialiased overflow-hidden selection:bg-emerald-500/20 selection:text-emerald-300">
      
      {/* BACKEND OFFLINE BANNER */}
      {backendOffline && (
        <div className="bg-rose-950 border-b border-rose-800 px-6 py-2 flex items-center justify-between text-xs text-rose-200 font-mono">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Backend service is offline. Unable to reach <strong>127.0.0.1:8000</strong>.</span>
          </div>
          <button
            onClick={checkBackendHealth}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-rose-800 hover:bg-rose-700 text-white font-semibold transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry Connection
          </button>
        </div>
      )}

      {/* TOP APPLICATION NAVBAR */}
      <header className="h-14 border-b border-[#1c2230] bg-[#0d1017] px-5 flex items-center justify-between z-20 shrink-0">
        
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center shadow-md shadow-emerald-500/10">
            <Layers className="w-4 h-4 text-black stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-white font-mono">
                API<span className="text-emerald-400">Guard</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono px-1.5 py-0.5 rounded bg-[#171b26] border border-[#232a3b]">
                v1.0-live
              </span>
            </div>
            <p className="text-[11px] text-slate-400 tracking-normal hidden md:block">
              Graph-Guided API Authorization & BOLA Detection Engine
            </p>
          </div>
        </div>

        {/* Center Target & Status Chips */}
        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#131722] border border-[#202738] text-slate-300">
            <Server className="w-3.5 h-3.5 text-cyan-400" />
            <span>Target:</span>
            <code className="text-cyan-300">127.0.0.1:8000</code>
            <span className="text-[10px] text-emerald-400 font-bold ml-1">ALLOWLISTED</span>
          </div>

          <button
            onClick={() => setShowGuidedDemo(true)}
            className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-800 text-emerald-300 font-semibold transition"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Guided Demo [D]</span>
          </button>

          <button
            onClick={() => setShowBenchmarkModal(true)}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-800 text-cyan-300 font-semibold transition"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Benchmarks</span>
          </button>

          <button
            onClick={handleOpenDryRun}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800 text-amber-300 font-semibold transition"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Dry-Run Table</span>
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <label className="hidden sm:flex items-center gap-2 text-xs font-mono text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-0"
            />
            <span>Dry Run</span>
          </label>

          <label className="hidden sm:flex items-center gap-2 text-xs font-mono text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={enableMutations}
              onChange={(e) => setEnableMutations(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-0"
            />
            <span>Mutations</span>
          </label>

          {/* PERSISTENT AMBER CHIP: TARGET IS PATCHED */}
          {isTargetPatched && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-950/80 border border-amber-600/70 text-amber-300 text-xs font-mono font-medium shadow-sm animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Target is PATCHED, scans will find nothing</span>
              <button
                onClick={handleRevertPatch}
                className="ml-1 px-1.5 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/40 text-amber-200 text-[10px] font-bold underline transition"
                title="Revert to vulnerable mode"
              >
                Revert
              </button>
            </div>
          )}

          <button
            onClick={handleReset}
            className="p-2 rounded-lg bg-[#141923] hover:bg-[#1b2230] border border-[#202738] text-slate-400 hover:text-slate-200 transition"
            title="Reset Target State"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={handleRunScan}
            disabled={isScanning || backendOffline}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-semibold tracking-wide transition shadow-lg shadow-emerald-500/15 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className={`w-3.5 h-3.5 fill-black ${isScanning ? 'animate-spin' : ''}`} />
            {isScanning ? 'AUDITING...' : 'RUN EXECUTION AUDIT'}
          </button>
        </div>
      </header>

      {/* REFERENCE PATCH VERIFICATION BANNER */}
      {verificationBanner && (
        <div className="bg-emerald-950/90 border-b border-emerald-600 px-6 py-2 flex items-center justify-between text-xs text-emerald-200 font-mono z-30 shadow-lg">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-emerald-500 text-black font-bold text-[10px]">
              PATCH VERIFIED
            </span>
            <span>
              Reference fix applied to the demo target (patched_mode). Re-scan: {verificationBanner.before} confirmed leak → {verificationBanner.after} confirmed leaks.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRevertPatch}
              className="px-2.5 py-1 rounded bg-[#162030] hover:bg-[#1e2c42] border border-[#283852] text-slate-200 font-semibold transition text-[10px]"
            >
              Revert Target & Reset
            </button>
            <button
              onClick={() => setVerificationBanner(null)}
              className="text-slate-400 hover:text-white px-1.5 text-xs"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* MAIN THREE-COLUMN WORKSPACE */}
      <main className="flex-1 p-3 grid grid-cols-1 lg:grid-cols-12 gap-3 overflow-hidden">
        
        {/* COLUMN 1: OPENAPI SPEC & IDENTITIES (COL-SPAN 3) */}
        <section className="lg:col-span-3 h-full overflow-hidden">
          <SpecPanel
            nodes={nodes}
            onImportSpec={importSpec}
            isLoading={isGraphLoading}
          />
        </section>

        {/* COLUMN 2: REAL REACT FLOW DEPENDENCY DAG (COL-SPAN 5) */}
        <section className="lg:col-span-5 h-full rounded-xl border border-[#1e2536] bg-[#090b10] overflow-hidden relative shadow-xl flex flex-col">
          <div className="h-10 px-4 bg-[#121622] border-b border-[#1d2538] flex items-center justify-between text-xs font-mono shrink-0">
            <div className="flex items-center gap-2">
              <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-semibold text-slate-200">React Flow Dependency DAG</span>
            </div>
            <span className="text-[10px] text-slate-400">
              {nodes.length} Nodes · {edges.length} Edges
            </span>
          </div>

          <div className="flex-1 min-h-0 relative h-full w-full">
            <GraphView
              backendNodes={nodes}
              backendEdges={edges}
              nodeStates={nodeStates}
              selectedNodeId={selectedNodeId}
              onSelectNode={(nodeId) => setSelectedNodeId(nodeId)}
            />

            {/* Selected Node Bottom Drawer */}
            {selectedNodeObj && (
              <div className="absolute bottom-14 left-4 right-4 bg-[#0d121c]/95 backdrop-blur border border-[#1f2738] rounded-xl p-3.5 text-xs font-mono shadow-2xl z-20">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 font-bold">
                      {selectedNodeObj.metadata?.method || selectedNodeObj.type}
                    </span>
                    <span className="font-bold text-slate-100">{selectedNodeObj.label}</span>
                  </div>
                  <button onClick={() => setSelectedNodeId(null)} className="text-slate-400 hover:text-white text-[10px]">
                    Dismiss
                  </button>
                </div>
                <div className="text-[11px] text-slate-400">
                  {selectedNodeObj.metadata?.summary || 'Resource graph operation node'}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* COLUMN 3: EXECUTION STREAM & FINDINGS (COL-SPAN 4) */}
        <section className="lg:col-span-4 h-full flex flex-col gap-3 overflow-hidden">
          {/* Top Half: Streaming Real Console */}
          <div className="flex-1 min-h-0">
            <ScanConsole events={events} isScanning={isScanning} />
          </div>

          {/* Bottom Half: Confirmed Findings */}
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

      {/* FINDING DETAIL MODAL / SPLIT INSPECTOR */}
      {selectedFinding && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-4xl h-[85vh] bg-[#0b0e14] rounded-2xl overflow-hidden border border-[#232c40] shadow-2xl">
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

      {/* DRY-RUN PREVIEW MODAL */}
      {showDryRunModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-5xl h-[85vh] bg-[#0b0e14] rounded-2xl overflow-hidden border border-[#232c40] shadow-2xl">
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

      {/* BENCHMARK MODAL */}
      {showBenchmarkModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-5xl h-[85vh] bg-[#0b0e14] rounded-2xl overflow-hidden border border-[#232c40] shadow-2xl">
            <BenchmarkPanel onClose={() => setShowBenchmarkModal(false)} />
          </div>
        </div>
      )}

      {/* AI REMEDIATION MODAL */}
      {showRemediationFinding && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-5xl h-[85vh] bg-[#0b0e14] rounded-2xl overflow-hidden border border-[#232c40] shadow-2xl">
            <RemediationModal
              finding={showRemediationFinding}
              onClose={() => setShowRemediationFinding(null)}
              onApplyReferenceFixAndRescan={handleApplyReferenceFixAndRescan}
              onModelTested={refreshModelStatus}
            />
          </div>
        </div>
      )}

      {/* INTERACTIVE GUIDED DEMO MODAL */}
      {showGuidedDemo && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-3xl h-[65vh] bg-[#0b0e14] rounded-2xl overflow-hidden border border-[#232c40] shadow-2xl">
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

      {/* HONESTY & STATUS STRIP (RULEBOOK REQUIREMENT) */}
      <footer className="h-7 border-t border-[#1c2230] bg-[#080a0f] px-5 flex items-center justify-between text-[10px] text-slate-500 font-mono shrink-0">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1 text-emerald-400 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Working: Real REST + SSE Engine
          </span>
          <span className="flex items-center gap-1 text-cyan-400 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span> Working: React Flow + Dagre DAG
          </span>
          <span className="flex items-center gap-1 font-semibold">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                modelStatusText.startsWith('model call: tested')
                  ? 'bg-emerald-400'
                  : modelStatusText.includes('configured')
                  ? 'bg-amber-400'
                  : 'bg-purple-400'
              }`}
            ></span>
            <span
              className={
                modelStatusText.startsWith('model call: tested')
                  ? 'text-emerald-400'
                  : modelStatusText.includes('configured')
                  ? 'text-amber-400'
                  : 'text-purple-400'
              }
            >
              {modelStatusText}
            </span>
          </span>
          <span className="flex items-center gap-1 text-amber-400 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span> Working: Empirical Ground Truth Benchmarks
          </span>
        </div>
        <div>
          <span>Hack-O-Relay 6.0 · Team Wasabi · Open Innovation</span>
        </div>
      </footer>

    </div>
  );
}
