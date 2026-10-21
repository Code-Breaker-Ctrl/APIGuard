import React, { useState } from 'react';
import { Copy, Check, GitBranch, Terminal, ShieldAlert, Sparkles } from 'lucide-react';
import type { Finding } from '../types';

interface FindingDetailProps {
  finding: Finding;
  onClose?: () => void;
  onOpenRemediation?: () => void;
}

export const FindingDetail: React.FC<FindingDetailProps> = ({ finding, onClose, onOpenRemediation }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyCurl = () => {
    navigator.clipboard.writeText(finding.repro_curl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-[#0b0e14] border border-[#1e2538] rounded-xl overflow-hidden shadow-xl text-xs font-mono">
      {/* Top Header */}
      <div className="h-11 px-5 bg-[#121622] border-b border-[#1d2538] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <ShieldAlert className="w-4 h-4 text-rose-400" />
          <span className="font-bold text-slate-100 text-sm">{finding.method} {finding.endpoint}</span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40">
            {finding.severity}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onOpenRemediation && (
            <button
              data-testid="ai-remediation-btn"
              onClick={onOpenRemediation}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition shadow"
            >
              <Sparkles className="w-3.5 h-3.5" /> AI Remediation
            </button>
          )}
          {onClose && (
            <button onClick={onClose} className="text-slate-400 hover:text-white text-xs px-2.5 py-1 rounded bg-slate-800">
              Close
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 p-5 overflow-y-auto space-y-5">
        
        {/* Why was this tested? (Graph Path & Hypothesis) */}
        <div className="p-3.5 rounded-lg bg-[#0e131d] border border-[#1e2638]">
          <div className="flex items-center gap-2 text-cyan-400 font-bold mb-2">
            <GitBranch className="w-3.5 h-3.5" />
            Why was this tested? (Graph Propagation Justification)
          </div>
          <div className="text-[11px] text-slate-300 space-y-1">
            <div>
              <span className="text-slate-500">DAG Path Traversal:</span>{' '}
              <code className="text-emerald-300 font-semibold">{finding.graph_path.join(' ')}</code>
            </div>
            <div>
              <span className="text-slate-500">Inferred Hypothesis:</span>{' '}
              <span className="text-slate-300">
                Rule: <code className="text-cyan-300">{finding.hypothesis?.rule?.rule_type || 'owner_only'}</code> | Provenance:{' '}
                <code className="text-amber-300">{finding.hypothesis?.provenance || 'propagated'}</code> | Confidence:{' '}
                <strong className="text-white">{finding.confidence}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Control vs Probe Side-by-Side Response Inspector */}
        <div className="rounded-lg border border-[#1f2738] bg-[#080b10] overflow-hidden">
          <div className="px-4 py-2.5 bg-[#0f1420] border-b border-[#1f2738] flex items-center justify-between text-[11px]">
            <span className="font-bold text-slate-200">Differential Payload Comparison</span>
            <span className="text-rose-400 font-bold">Latency Proof: Status 200 OK + Owner Data Leaked</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#1f2738]">
            {/* Control (Owner Alice) */}
            <div className="p-3 bg-[#06080d]">
              <div className="flex items-center justify-between mb-1.5 text-[10px] text-slate-400">
                <span className="font-semibold text-emerald-400">CONTROL: Owner Request ({finding.identities?.owner || 'Alice'})</span>
                <span className="px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300">HTTP 200 OK</span>
              </div>
              <pre className="p-2.5 rounded bg-[#0b0e14] border border-slate-800/80 text-[10px] text-slate-300 leading-relaxed overflow-x-auto max-h-52 scrollbar-thin">
                {JSON.stringify(finding.control_evidence?.body || { status: 'authorized' }, null, 2)}
              </pre>
            </div>

            {/* Probe (Adversary Bob) */}
            <div className="p-3 bg-[#11080b]">
              <div className="flex items-center justify-between mb-1.5 text-[10px] text-slate-400">
                <span className="font-semibold text-rose-400">PROBE: Adversary Request ({finding.identities?.probe || 'Bob'})</span>
                <span className="px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 font-bold">HTTP 200 OK (LEAK)</span>
              </div>
              <pre className="p-2.5 rounded bg-[#180a0f] border border-rose-900/40 text-[10px] text-rose-200 leading-relaxed overflow-x-auto max-h-52 scrollbar-thin">
                {JSON.stringify(finding.probe_evidence?.body || {}, null, 2)}
              </pre>
            </div>
          </div>
        </div>

        {/* Leaked Fields Badge List */}
        <div className="p-3 rounded-lg bg-rose-950/20 border border-rose-900/40">
          <div className="text-[11px] font-bold text-rose-400 mb-1.5">Confirmed Leaked Field Elements:</div>
          <div className="flex flex-wrap gap-1.5">
            {finding.diff_fields.map((fld, i) => (
              <span key={i} className="px-2 py-0.5 rounded bg-rose-900/60 text-rose-200 text-[10px] border border-rose-700/60">
                {fld}
              </span>
            ))}
          </div>
        </div>

        {/* Reproduce with cURL */}
        <div className="p-3 rounded-lg bg-[#0e121a] border border-[#1e2638]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              Reproduction cURL (Sanitized Credentials)
            </span>
            <button
              onClick={handleCopyCurl}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#1b2333] hover:bg-[#232c40] text-slate-200 text-[10px] border border-[#263147] transition"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy cURL'}</span>
            </button>
          </div>
          <code className="block p-2 rounded bg-black/60 border border-slate-800 text-[10px] text-slate-300 break-all select-all">
            {finding.repro_curl}
          </code>
        </div>

        {/* Reproduction Steps */}
        {finding.reproduction_steps && finding.reproduction_steps.length > 0 && (
          <div className="p-3 rounded-lg bg-[#0e121a] border border-[#1e2638]">
            <span className="text-[11px] font-bold text-slate-300 block mb-2">Step-by-Step Reproduction:</span>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-400">
              {finding.reproduction_steps.map((st, idx) => (
                <li key={idx} className="leading-relaxed">{st}</li>
              ))}
            </ol>
          </div>
        )}

      </div>
    </div>
  );
};
