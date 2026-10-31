import React, { useState, useEffect } from 'react';
import { BarChart3, RefreshCw, X, ShieldCheck, Zap, Info } from 'lucide-react';
import type { BenchmarkData } from '../types';
import { apiClient } from '../api/client';

type Variants = BenchmarkData['variants'];

// Precision is null when a scanner reported nothing, so those variants are skipped
const worstPrecision = (variants: Variants, who: 'graph_guided' | 'baseline') => {
  const values = Object.values(variants)
    .map((v) => v[who].precision)
    .filter((p): p is number => p !== null);
  return values.length > 0 ? Math.min(...values) : null;
};

const asPercent = (value: number | null) => (value === null ? 'n/a' : `${(value * 100).toFixed(0)}%`);

// The trade-off note quotes the measured numbers instead of typing them in
const tradeOffNote = (variants: Variants) => {
  const direct = variants.variant_a;
  const g = direct?.graph_guided.req_per_finding;
  const base = direct?.baseline.req_per_finding;
  const counts = g != null && base != null ? ` (${g.toFixed(1)} vs ${base.toFixed(1)} on the direct-defect variant)` : '';
  return `APIGuard sends more requests per finding${counts} because it also tests nested routes, such as the indirect defect the rules-only baseline never visits.`;
};

interface BenchmarkPanelProps {
  onClose: () => void;
}

export const BenchmarkPanel: React.FC<BenchmarkPanelProps> = ({ onClose }) => {
  const [data, setData] = useState<BenchmarkData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBenchmark = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.getLatestBenchmark();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'No benchmark results found. Run a benchmark suite to generate results.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunBenchmark = async () => {
    setIsRunning(true);
    setError(null);
    try {
      const res = await apiClient.runBenchmark();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to execute benchmark run.');
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    loadBenchmark();
  }, []);

  return (
    <div className="flex flex-col h-full bg-[#15100c] text-xs font-mono select-none">
      {/* Header */}
      <div className="h-12 px-5 bg-[#201a13] border-b border-[#372d22] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <BarChart3 className="w-4 h-4 text-cyan-400" />
          <span className="font-bold text-slate-100 text-sm">Empirical Benchmark & Controlled Ablation</span>
          <span className="px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/40 text-cyan-300 font-bold text-[10px]">
            MEASURED ON THE DEMO TARGET · HIDDEN ANSWER KEY
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRunBenchmark}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
            {isRunning ? 'Benchmarking 5 Variants...' : 'Run Live Benchmark'}
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 p-5 overflow-y-auto space-y-4">
        {isLoading ? (
          <div className="py-20 text-center text-slate-400 animate-pulse">
            Loading benchmark telemetry from backend...
          </div>
        ) : error && !data ? (
          <div className="py-20 text-center space-y-3">
            <div className="text-slate-400">{error}</div>
            <button
              onClick={handleRunBenchmark}
              className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition inline-flex items-center gap-2"
            >
              <Zap className="w-4 h-4" /> Execute Benchmark Suite Now
            </button>
          </div>
        ) : data ? (
          <>
            {/* Top Stat Summary Cards */}
            <div className="grid grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-[#1e1812] border border-[#382e23]">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">APIGuard Recall</div>
                <div className="text-2xl font-black text-emerald-400 mt-1">
                  {(data.aggregate_metrics.graph_guided.aggregate_recall * 100).toFixed(0)}%
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {data.aggregate_metrics.graph_guided.total_confirmed} / {data.aggregate_metrics.graph_guided.total_ground_truth} Defect Targets Detected
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#1e1812] border border-[#382e23]">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">Option A Baseline Recall</div>
                <div className="text-2xl font-black text-amber-400 mt-1">
                  {(data.aggregate_metrics.baseline.aggregate_recall * 100).toFixed(0)}%
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {data.aggregate_metrics.baseline.total_confirmed} / {data.aggregate_metrics.baseline.total_ground_truth} Defect Targets Detected
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#1e1812] border border-[#382e23]">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">Precision (Worst Variant)</div>
                <div className="text-2xl font-black text-cyan-400 mt-1">
                  {asPercent(worstPrecision(data.variants, 'graph_guided'))} <span className="text-xs font-normal text-slate-400">vs {asPercent(worstPrecision(data.variants, 'baseline'))} Base</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {data.variants.variant_secure ? `${data.variants.variant_secure.graph_guided.confirmed} False Positives on Secure Suite` : 'Secure variant not run'}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#1e1812] border border-[#382e23]">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">Reqs per Finding (Aggregate)</div>
                <div className="text-2xl font-black text-slate-200 mt-1">
                  {data.aggregate_metrics.graph_guided.requests_per_finding.toFixed(1)} <span className="text-xs font-normal text-slate-400">vs {data.aggregate_metrics.baseline.requests_per_finding.toFixed(1)} Base</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Target: {data.target}
                </div>
              </div>
            </div>

            {/* Honest Trade-Off Callout Note */}
            <div className="p-3 rounded-lg bg-[#1e1812] border border-cyan-900/40 text-[11px] text-slate-300 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-cyan-300">Efficiency & Coverage Trade-Off:</strong>{' '}
                {tradeOffNote(data.variants)}
              </div>
            </div>

            {/* Variants Comparison Table */}
            <div className="border border-[#342a20] rounded-xl overflow-hidden bg-[#17120e]">
              <div className="h-9 px-4 bg-[#201a13] border-b border-[#31281f] flex items-center justify-between text-[11px] font-bold text-slate-300">
                <span>Multi-Variant Ground Truth Evaluation</span>
                <span className="text-slate-500 font-normal">Generated: {data.timestamp}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="border-b border-[#31281f] bg-[#1c1610] text-slate-400 text-[10px] uppercase">
                      <th className="py-2.5 px-3">Variant Description</th>
                      <th className="py-2.5 px-3 text-center">Truth</th>
                      <th className="py-2.5 px-3 text-center text-amber-400">Base Found</th>
                      <th className="py-2.5 px-3 text-center text-amber-400">Base Recall</th>
                      <th className="py-2.5 px-3 text-center text-amber-400">Base Prec</th>
                      <th className="py-2.5 px-3 text-center text-amber-400">Base Req/Fnd</th>
                      <th className="py-2.5 px-3 text-center text-emerald-400">APIGuard Found</th>
                      <th className="py-2.5 px-3 text-center text-emerald-400">APIGuard Recall</th>
                      <th className="py-2.5 px-3 text-center text-emerald-400">APIGuard Prec</th>
                      <th className="py-2.5 px-3 text-center text-emerald-400">APIGuard Req/Fnd</th>
                      <th className="py-2.5 px-3 text-center text-cyan-400">Avg ms/Fnd</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2a221a]">
                    {Object.entries(data.variants).map(([vKey, vVal]) => {
                      const baseRecall = vVal.baseline.recall === null ? 'n/a' : `${(vVal.baseline.recall * 100).toFixed(0)}%`;
                      const graphRecall = vVal.graph_guided.recall === null ? 'n/a' : `${(vVal.graph_guided.recall * 100).toFixed(0)}%`;
                      const basePrecision = asPercent(vVal.baseline.precision);
                      const graphPrecision = asPercent(vVal.graph_guided.precision);
                      const baseRpf = vVal.baseline.req_per_finding !== null ? vVal.baseline.req_per_finding.toFixed(1) : 'n/a';
                      const graphRpf = vVal.graph_guided.req_per_finding !== null ? vVal.graph_guided.req_per_finding.toFixed(1) : 'n/a';

                      return (
                        <tr key={vKey} className="hover:bg-[#211b14] transition">
                          <td className="py-2.5 px-3 font-medium text-slate-200">
                            <div>{vVal.description}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{vKey}</div>
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-400">{vVal.ground_truth_count}</td>
                          <td className="py-2.5 px-3 text-center font-bold text-amber-300">{vVal.baseline.confirmed}</td>
                          <td className="py-2.5 px-3 text-center font-mono text-amber-300">{baseRecall}</td>
                          <td className="py-2.5 px-3 text-center font-mono text-amber-300">{basePrecision}</td>
                          <td className="py-2.5 px-3 text-center font-mono text-amber-300">{baseRpf}</td>
                          <td className="py-2.5 px-3 text-center font-bold text-emerald-300">{vVal.graph_guided.confirmed}</td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-300">{graphRecall}</td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-300">{graphPrecision}</td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-300">{graphRpf}</td>
                          <td className="py-2.5 px-3 text-center font-mono text-cyan-300">
                            {vVal.graph_guided.avg_ms_per_finding ? `${vVal.graph_guided.avg_ms_per_finding}ms` : 'n/a'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Ablation Study Cards */}
            {data.ablations && (
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                  Controlled Ablations & Evidence
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(data.ablations).map(([aKey, aVal]: [string, any]) => (
                    <div key={aKey} className="p-3.5 rounded-xl bg-[#1c1611] border border-[#352b21] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-100 text-[11px]">{aVal.name}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          aVal.recall === 0 ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                        }`}>
                          Recall: {(aVal.recall * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">{aVal.note}</p>
                      <div className="text-[10px] text-slate-500 font-mono pt-1 border-t border-[#2c231b] flex justify-between">
                        <span>Requests: {aVal.requests}</span>
                        <span>Duration: {aVal.duration_ms}ms</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
};
