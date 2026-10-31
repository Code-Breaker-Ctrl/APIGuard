import React from 'react';
import { X, Play, ShieldAlert, Cpu } from 'lucide-react';
import type { DryRunResponse } from '../types';

interface DryRunModalProps {
  data: DryRunResponse | null;
  isLoading: boolean;
  onClose: () => void;
  onExecuteLive: () => void;
  budget?: number;
  onBudgetChange?: (newBudget: number) => void;
}

export const DryRunModal: React.FC<DryRunModalProps> = ({
  data,
  isLoading,
  onClose,
  onExecuteLive,
  budget,
  onBudgetChange,
}) => {
  return (
    <div className="flex flex-col h-full bg-slate-950 text-xs font-mono select-none">
      {/* Header */}
      <div className="h-12 px-5 bg-slate-900 border-b border-slate-700 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <Cpu className="w-4 h-4 text-amber-400" />
          <span className="font-bold text-slate-100 text-sm">Dry-Run Execution Plan Preview</span>
          <span className="px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/40 text-amber-300 font-bold text-[10px]">
            SAFE MODE · 0 REQUESTS SENT
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 p-5 overflow-y-auto space-y-4">
        {isLoading ? (
          <div className="py-16 text-center text-slate-400 animate-pulse">
            Calculating dependency DAG test sequences and request budget...
          </div>
        ) : !data ? (
          <div className="py-16 text-center text-slate-500">
            No dry-run plan available.
          </div>
        ) : (
          <>
            {/* Budget Metrics Card */}
            <div className="grid grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-700">
                <div className="text-[10px] text-slate-400 uppercase flex items-center justify-between">
                  <span>Request Budget</span>
                  {onBudgetChange && <span className="text-[9px] text-slate-500">editable</span>}
                </div>
                {onBudgetChange ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      min={5}
                      max={500}
                      step={5}
                      value={budget ?? data.total_budget}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val > 0) onBudgetChange(Math.min(val, 500));
                      }}
                      className="w-16 px-1.5 py-0.5 bg-slate-800 border border-slate-600 text-emerald-400 font-bold text-lg text-center focus:outline-none focus:border-emerald-400"
                    />
                    <span className="text-slate-400 text-xs">requests</span>
                  </div>
                ) : (
                  <div className="text-xl font-bold text-slate-100 mt-1">{data.total_budget} requests</div>
                )}
              </div>
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-700">
                <div className="text-[10px] text-slate-400 uppercase">Planned Requests</div>
                <div className="text-xl font-bold text-cyan-400 mt-1">{data.total_planned} requests</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-700">
                <div className="text-[10px] text-slate-400 uppercase">Remaining Requests</div>
                <div className="text-xl font-bold text-emerald-400 mt-1">{data.budget_remaining} requests</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-700">
                <div className="text-[10px] text-slate-400 uppercase">Mutating Tests</div>
                <div className="text-xl font-bold mt-1">
                  {data.mutations_enabled ? (
                    <span className="text-amber-400">ENABLED</span>
                  ) : (
                    <span className="text-slate-400">DISABLED (SAFE)</span>
                  )}
                </div>
              </div>
            </div>

            {/* Honest Warning Box */}
            <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-800/40 text-amber-200/90 text-[11px] flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Dry-Run Mode:</strong> The engine synthesized the full multi-identity execution plan using OpenAPI DAG traversal without sending any network traffic to the target.
              </span>
            </div>

            {/* Plan Table */}
            <div className="border border-slate-700 rounded-xl overflow-hidden bg-slate-950">
              <div className="h-9 px-4 bg-slate-900 border-b border-slate-700 flex items-center justify-between text-[11px] font-bold text-slate-300">
                <span>Sequence Steps ({data.planned_steps.length})</span>
                <span className="text-slate-500 font-normal">Order: Setup → Control → Adversary Probe</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="border-b border-slate-700 bg-slate-900 text-slate-400 text-[10px] uppercase">
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Phase</th>
                      <th className="py-2.5 px-3">Method</th>
                      <th className="py-2.5 px-3">Target Endpoint</th>
                      <th className="py-2.5 px-3">Identity</th>
                      <th className="py-2.5 px-3">Purpose</th>
                      <th className="py-2.5 px-3">Cleanup</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {data.planned_steps.map((step, idx) => (
                      <tr key={step.step_id || idx} className="hover:bg-slate-900/50 transition">
                        <td className="py-2 px-3 text-slate-500">{idx + 1}</td>
                        <td className="py-2 px-3">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            step.phase === 'A' ? 'bg-blue-950 text-blue-300 border border-blue-800/40' : 'bg-rose-950 text-rose-300 border border-rose-800/40'
                          }`}>
                            {step.phase === 'A' ? 'OWNER SETUP' : 'PROBE (BOLA)'}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            step.method === 'GET' ? 'bg-blue-900/40 text-blue-300' :
                            step.method === 'POST' ? 'bg-emerald-900/40 text-emerald-300' :
                            step.method === 'PATCH' ? 'bg-amber-900/40 text-amber-300' :
                            'bg-rose-900/40 text-rose-300'
                          }`}>
                            {step.method}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-200 font-bold">{step.url}</td>
                        <td className="py-2 px-3">
                          <span className="text-slate-300">
                            {step.identity.includes('aman') || step.identity === 'user_a' ? 'aman (Owner)' : 'taaran (Attacker)'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-400 capitalize">{step.purpose.replace(/_/g, ' ')}</td>
                        <td className="py-2 px-3">
                          {step.cleanup ? (
                            <span className="text-amber-400">Yes</span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="h-14 px-5 bg-slate-900 border-t border-slate-700 flex items-center justify-between shrink-0">
        <button
          onClick={onClose}
          className="px-4 py-1.5 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 transition"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            onClose();
            onExecuteLive();
          }}
          className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold transition shadow-lg shadow-emerald-500/20"
        >
          <Play className="w-3.5 h-3.5 fill-black" />
          Execute Live Audit Now
        </button>
      </div>
    </div>
  );
};
