import React from 'react';
import { ShieldAlert, ChevronRight } from 'lucide-react';
import type { Finding } from '../types';

interface FindingsListProps {
  findings: Finding[];
  selectedFindingId: string | null;
  onSelectFinding: (finding: Finding) => void;
}

export const FindingsList: React.FC<FindingsListProps> = ({
  findings,
  selectedFindingId,
  onSelectFinding,
}) => {
  return (
    <div className="flex flex-col h-full bg-[#0d1017] border border-[#1e2536] rounded-xl overflow-hidden shadow-lg">
      <div className="h-10 px-4 bg-[#121622] border-b border-[#1d2538] flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
          <span className="font-semibold text-slate-200">Confirmed Findings</span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded bg-rose-950/60 text-rose-300 border border-rose-800/40 font-bold">
          {findings.length} Flagged
        </span>
      </div>

      <div className="flex-1 p-3 overflow-y-auto space-y-2.5">
        {findings.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 font-mono">
            Zero confirmed vulnerabilities detected yet.
          </div>
        ) : (
          findings.map((f) => {
            const isSelected = f.id === selectedFindingId;
            return (
              <div
                key={f.id}
                onClick={() => onSelectFinding(f)}
                className={`p-3 rounded-lg border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-rose-500 bg-rose-950/30 ring-1 ring-rose-500'
                    : 'border-[#1e2538] bg-[#090c12] hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 font-bold font-mono">
                      {f.severity}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono">
                      {f.status.toUpperCase()}
                    </span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                </div>

                <div className="text-xs font-bold text-slate-200 font-mono mt-1">
                  {f.method} {f.endpoint}
                </div>

                <div className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                  Leaked: <span className="text-rose-400 font-mono">{f.diff_fields.join(', ')}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
