import React, { useState, useEffect } from 'react';
import { Upload, FileCode, AlertTriangle, Users, RefreshCw } from 'lucide-react';
import type { BackendNode, IdentityInfo } from '../types';
import { apiClient } from '../api/client';

interface SpecPanelProps {
  nodes: BackendNode[];
  onImportSpec: (file?: File, rawSpec?: string) => Promise<void>;
  isLoading: boolean;
}

export const SpecPanel: React.FC<SpecPanelProps> = ({ nodes, onImportSpec, isLoading }) => {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [identities, setIdentities] = useState<IdentityInfo[]>([]);

  useEffect(() => {
    apiClient.getIdentities()
      .then(setIdentities)
      .catch((err) => console.error('Failed to load identities:', err));
  }, []);

  const handleFileUpload = async (file: File) => {
    setErrorMsg(null);
    try {
      await onImportSpec(file);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to parse OpenAPI specification');
    }
  };

  const loadDemo = async () => {
    setErrorMsg(null);
    try {
      await onImportSpec();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to reload demo spec');
    }
  };

  const operationNodes = nodes.filter((n) => n.type === 'operation');

  return (
    <div className="flex flex-col h-full bg-[#0d1017] border border-[#1e2536] rounded-xl overflow-hidden shadow-lg text-xs font-mono">
      {/* Panel Header */}
      <div className="h-10 px-4 bg-[#121622] border-b border-[#1d2538] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileCode className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-semibold text-slate-200">OpenAPI Spec & Target</span>
        </div>
        <button
          onClick={loadDemo}
          disabled={isLoading}
          className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/40 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} /> Load Demo
        </button>
      </div>

      <div className="flex-1 p-3.5 overflow-y-auto space-y-4">
        {/* Upload Box */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              handleFileUpload(e.dataTransfer.files[0]);
            }
          }}
          className={`p-3.5 rounded-lg border-2 border-dashed text-center transition cursor-pointer ${
            dragOver ? 'border-cyan-400 bg-cyan-950/20' : 'border-[#263147] bg-[#090c12] hover:border-slate-600'
          }`}
          onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json,.yaml,.yml';
            input.onchange = (e: any) => {
              if (e.target.files && e.target.files[0]) handleFileUpload(e.target.files[0]);
            };
            input.click();
          }}
        >
          <Upload className="w-5 h-5 mx-auto text-slate-400 mb-1" />
          <div className="text-[11px] font-semibold text-slate-200">Drop OpenAPI 3.x File Here</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Supports JSON / YAML with $ref schemas</div>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="p-2.5 rounded bg-rose-950/40 border border-rose-900/60 text-rose-300 text-[11px] flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Seeded Identities Card */}
        <div className="p-3 rounded-lg bg-[#0e121a] border border-[#1e2538] space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-300 font-bold">
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-emerald-400" /> Test Identities
            </span>
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">Target Dynamic</span>
          </div>
          <div className="space-y-1.5 text-[10px]">
            {identities.map((id) => (
              <div key={id.identity_id} className="p-1.5 rounded bg-[#07090e] border border-[#181f2e] flex items-center justify-between">
                <div>
                  <span className={`font-bold ${id.key === 'user_a' ? 'text-emerald-400' : id.key === 'user_b' ? 'text-rose-400' : 'text-blue-400'}`}>
                    {id.username.split('@')[0]} ({id.role}):
                  </span>{' '}
                  <span className="text-slate-300">{id.username}</span>
                </div>
                <span className="text-[9px] text-slate-500 font-mono">[REDACTED]</span>
              </div>
            ))}
            {identities.length === 0 && (
              <div className="text-[10px] text-slate-500 italic">Loading identities from backend...</div>
            )}
          </div>
        </div>

        {/* Endpoint Inventory */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Endpoint Inventory ({operationNodes.length})
          </div>
          <div className="space-y-1 max-h-56 overflow-y-auto scrollbar-thin">
            {operationNodes.map((op) => (
              <div
                key={op.id}
                className="p-1.5 rounded bg-[#090c12] border border-[#181f2e] flex items-center justify-between text-[10px]"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className="px-1 py-0.2 rounded bg-slate-800 text-slate-300 font-bold">
                    {op.metadata?.method}
                  </span>
                  <span className="text-slate-300 truncate">{op.metadata?.path}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};
