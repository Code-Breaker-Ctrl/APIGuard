import React, { useState, useEffect } from 'react';
import { Upload, FileCode, AlertTriangle, RefreshCw, Check } from 'lucide-react';
import type { BackendNode, IdentityInfo } from '../types';
import { apiClient } from '../api/client';

interface SpecPanelProps {
  nodes: BackendNode[];
  onImportSpec: (file?: File, rawSpec?: string) => Promise<void>;
  isLoading: boolean;
}

export const SpecPanel: React.FC<SpecPanelProps> = ({ nodes, onImportSpec, isLoading }) => {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loadedFileName, setLoadedFileName] = useState<string>('demo_spec.yaml');
  const [identities, setIdentities] = useState<IdentityInfo[]>([]);

  useEffect(() => {
    apiClient.getIdentities()
      .then(setIdentities)
      .catch((err) => console.error('Failed to load identities:', err));
  }, []);

  const handleFileUpload = async (file: File) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await onImportSpec(file);
      setLoadedFileName(file.name);
      setSuccessMsg(`Loaded ${file.name} successfully! (8 endpoints mapped into DAG)`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to parse OpenAPI specification');
    }
  };

  const loadDemo = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await onImportSpec();
      setLoadedFileName('demo_spec.yaml');
      setSuccessMsg('Demo spec reloaded successfully');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to reload demo spec');
    }
  };

  const pickFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.yaml,.yml';
    input.onchange = (e: any) => {
      if (e.target.files && e.target.files[0]) handleFileUpload(e.target.files[0]);
    };
    input.click();
  };

  const operationNodes = nodes.filter((n) => n.type === 'operation');
  const players = identities.filter((i) => i.key === 'user_a' || i.key === 'user_b');

  return (
    <div className="flex flex-col h-full panel overflow-hidden">
      <div className="h-11 px-4 bg-slate-900 border-b-2 border-slate-700 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4 text-emerald-400" />
          <span className="panel-title">Spec</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 font-mono truncate max-w-[120px]" title={loadedFileName}>
            {loadedFileName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={pickFile} className="btn-ghost" title="Import an OpenAPI 3.x file (JSON / YAML)">
            <Upload className="w-4 h-4" />
          </button>
          <button onClick={loadDemo} disabled={isLoading} className="btn-ghost" title="Reload the demo spec">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex-1 p-4 overflow-y-auto space-y-5">
        {errorMsg && (
          <div className="p-2 bg-rose-950 border-2 border-rose-500 text-rose-200 text-sm flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-2 bg-emerald-950 border-2 border-emerald-500 text-emerald-200 text-sm flex items-start gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="space-y-2">
          <div className="text-sm text-slate-400 uppercase">Identities</div>
          {players.map((id) => (
            <div key={id.identity_id} className="flex items-center gap-2 text-base">
              <span className={`w-2 h-2 ${id.key === 'user_a' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
              <span className="text-slate-100">{id.username.split('@')[0]}</span>
              <span className="text-slate-500 text-sm">{id.key === 'user_a' ? 'owner' : 'attacker'}</span>
            </div>
          ))}
          {players.length === 0 && <div className="text-sm text-slate-500">Loading…</div>}
        </div>

        <div className="space-y-2">
          <div className="text-sm text-slate-400 uppercase">Endpoints ({operationNodes.length})</div>
          <div className="space-y-1.5">
            {operationNodes.map((op) => (
              <div key={op.id} className="flex items-center gap-2 text-base">
                <span className="w-14 shrink-0 text-emerald-400 text-sm">{op.metadata?.method}</span>
                <span className="text-slate-300 truncate">{op.metadata?.path}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
