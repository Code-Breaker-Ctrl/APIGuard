import React from 'react';
import { ShieldAlert, ChevronRight } from 'lucide-react';
import type { Finding } from '../types';

interface FindingsListProps {
  findings: Finding[];
  selectedFindingId: string | null;
  onSelectFinding: (finding: Finding) => void;
  showAllHistory?: boolean;
  onToggleHistory?: () => void;
}

export const FindingsList: React.FC<FindingsListProps> = ({
  findings,
  selectedFindingId,
  onSelectFinding,
  showAllHistory,
  onToggleHistory,
}) => {
  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
      <div className="h-11 px-4 bg-slate-900 border-b-2 border-slate-700 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-400" />
          <span className="panel-title">Findings</span>
          <span className={`text-base px-2 ${findings.length > 0 ? 'bg-rose-500 text-slate-950' : 'bg-slate-800 text-slate-500'}`}>
            {findings.length}
          </span>
        </div>
        {onToggleHistory && (
          <button
            onClick={onToggleHistory}
            className="btn-ghost"
            aria-pressed={showAllHistory}
            title={showAllHistory ? 'Showing all past findings' : 'Showing the current run'}
          >
            {showAllHistory ? 'History' : 'This run'}
          </button>
        )}
      </div>

      <div className="flex-1 p-3 overflow-y-auto space-y-2">
        {findings.length === 0 ? (
          <div className="p-5 text-center text-base text-slate-500">
            {showAllHistory ? 'No leaks recorded.' : 'No leaks found. The path is clear, Tarnished.'}
          </div>
        ) : (
          findings.map((f) => {
            const isSelected = f.id === selectedFindingId;
            return (
              <div
                key={f.id}
                data-testid="finding-card"
                onClick={() => onSelectFinding(f)}
                className={`finding-card p-2.5 border-2 cursor-pointer ${
                  isSelected ? 'border-rose-500 bg-rose-950' : 'border-slate-700 bg-slate-950 hover:border-emerald-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-base">
                    <span className="px-1.5 bg-rose-500 text-slate-950">{f.severity}</span>
                    <span className="text-slate-100">{f.method} {f.endpoint}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </div>
                <div className="text-sm text-slate-400 mt-1 truncate">
                  Leaked: <span className="text-rose-400">{f.diff_fields.join(', ')}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
