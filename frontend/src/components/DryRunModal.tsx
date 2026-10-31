import React from 'react';
import { X, Play, ShieldAlert, Cpu } from 'lucide-react';
import type { DryRunResponse } from '../types';

interface DryRunModalProps {
  data: DryRunResponse | null;
  isLoading: boolean;
  onClose: () => void;
  onExecuteLive: () => void;
}

export const DryRunModal: React.FC<DryRunModalProps> = ({
  data,
  isLoading,
  onClose,
  onExecuteLive,
}) => {
  return (
    <div className="flex flex-col h-full bg-[#15100c] text-xs font-mono select-none">
      {/* Header */}
      <div className="h-12 px-5 bg-[#201a13] border-b border-[#372d22] flex items-center justify-between shrink-0">
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
            Calculating dependency DAG test sequences and prerequisite budget...
          </div>
        ) : !data ? (
          <div className="py-16 text-center text-slate-500">
            No dry-run plan available.
          </div>
        ) : (
          <>
            {/* Budget Metrics Card */}
            <div className="grid grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-[#1d1711] border border-[#342a20]">
                <div className="text-[10px] text-slate-400 uppercase">Allocated Budget</div>
                <div className="text-xl font-bold text-slate-100 mt-1">{data.total_budget} reqs</div>
              </div>
              <div className="p-3 rounded-lg bg-[#1d1711] border border-[#342a20]">
                <div className="text-[10px] text-slate-400 uppercase">Planned Operations</div>
                <div className="text-xl font-bold text-cyan-400 mt-1">{data.total_planned} reqs</div>
              </div>
              <div className="p-3 rounded-lg bg-[#1d1711] border border-[#342a20]">
                <div className="text-[10px] text-slate-400 uppercase">Remaining Budget</div>
                <div className="text-xl font-bold text-emerald-400 mt-1">{data.budget_remaining} reqs</div>
              </div>
              <div className="p-3 rounded-lg bg-[#1d1711] border border-[#342a20]">
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
                <strong>Dry-Run Mode:</strong> The engine synthesized the full multi-identity execution plan using OpenAPI DAG traversal without sending any network traffic to the target socket.
              </span>
            </div>

            {/* Plan Table */}
            <div className="border border-[#342a20] rounded-xl overflow-hidden bg-[#17120e]">
              <div className="h-9 px-4 bg-[#201a13] border-b border-[#31281f] flex items-center justify-between text-[11px] font-bold text-slate-300">
                <span>Sequence Steps ({data.planned_steps.length})</span>
                <span className="text-slate-500 font-normal">Order: Setup $\to$ Control $\to$ Adversary Probe</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="border-b border-[#31281f] bg-[#1c1610] text-slate-400 text-[10px] uppercase">
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Phase</th>
                      <th className="py-2.5 px-3">Method</th>
                      <th className="py-2.5 px-3">Target Endpoint</th>
                      <th className="py-2.5 px-3">Identity</th>
                      <th className="py-2.5 px-3">Purpose</th>
                      <th className="py-2.5 px-3">Cleanup</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2a221a]">
                    {data.planned_steps.map((s, idx) => (
                      <tr key={s.step_id} className="hover:bg-[#211b14] transition">
                        <td className="py-2.5 px-3 text-slate-500">{idx + 1}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-1.5 py-0.2 rounded font-bold text-[9px] ${
                            s.phase === 'A' ? 'bg-cyan-950 text-cyan-300' : 'bg-rose-950 text-rose-300'
                          }`}>
                            Phase {s.phase}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-slate-200">{s.method}</span>
                        </td>
                        <td className="py-2.5 px-3 text-cyan-300 font-mono">{s.url}</td>
                        <td className="py-2.5 px-3">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                            s.identity.includes('aman') || s.identity.includes('alice') ? 'bg-emerald-950/60 text-emerald-300' : 'bg-rose-950/60 text-rose-300'
                          }`}>
                            {s.identity}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-300 capitalize">{s.purpose.replace('_', ' ')}</td>
                        <td className="py-2.5 px-3">
                          {s.cleanup ? (
                            <span className="text-emerald-400 font-bold text-[10px]">Auto-Cleanup</span>
                          ) : (
                            <span className="text-slate-500 text-[10px]">Read-Only</span>
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
      <div className="h-14 px-5 bg-[#1a140f] border-t border-[#372d22] flex items-center justify-between shrink-0">
        <button
          onClick={onClose}
          className="px-4 py-1.5 rounded-lg border border-[#3c3226] text-slate-300 hover:bg-[#2d251c] transition"
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
