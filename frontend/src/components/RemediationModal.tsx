import React, { useState, useEffect } from 'react';
import { X, Sparkles, Copy, Check, ShieldCheck, AlertTriangle, Code2, Play } from 'lucide-react';
import type { Finding, RemediationResponse } from '../types';
import { apiClient } from '../api/client';

interface RemediationModalProps {
  finding: Finding;
  onClose: () => void;
  onApplyReferenceFixAndRescan?: () => void;
}

export const RemediationModal: React.FC<RemediationModalProps> = ({
  finding,
  onClose,
  onApplyReferenceFixAndRescan,
}) => {
  const [data, setData] = useState<RemediationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedPatch, setCopiedPatch] = useState(false);
  const [copiedTest, setCopiedTest] = useState(false);
  const [isApplyingFix, setIsApplyingFix] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    apiClient.remediate(finding)
      .then(setData)
      .catch((err) => console.error('Remediation error:', err))
      .finally(() => setIsLoading(false));
  }, [finding]);

  const copyToClipboard = (text: string, isTest: boolean) => {
    navigator.clipboard.writeText(text);
    if (isTest) {
      setCopiedTest(true);
      setTimeout(() => setCopiedTest(false), 2000);
    } else {
      setCopiedPatch(true);
      setTimeout(() => setCopiedPatch(false), 2000);
    }
  };

  const handleApplyFix = async () => {
    if (!onApplyReferenceFixAndRescan) return;
    setIsApplyingFix(true);
    try {
      await apiClient.applyTargetPatch(true);
      onApplyReferenceFixAndRescan();
    } catch (err) {
      console.error('Failed to apply reference patch:', err);
      setIsApplyingFix(false);
    }
  };

  const isGemini = data?.mode === 'gemini';

  return (
    <div className="flex flex-col h-full bg-[#0b0e14] text-xs font-mono select-none">
      {/* Header */}
      <div className="h-12 px-5 bg-[#121622] border-b border-[#1f283d] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span className="font-bold text-slate-100 text-sm">
            AI Remediation Engine · Prompting Bonus Evaluation
          </span>
          {data && (
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
              isGemini
                ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                : 'bg-purple-950/60 border-purple-800 text-purple-300'
            }`}>
              {isGemini ? `LIVE GEMINI MODEL (${data.model})` : 'DETERMINISTIC OFFLINE TEMPLATE'}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 p-5 overflow-y-auto space-y-4">
        {isLoading ? (
          <div className="py-20 text-center text-slate-400 animate-pulse">
            Synthesizing graph-guided patch and test cases...
          </div>
        ) : !data ? (
          <div className="py-20 text-center text-slate-500">
            Failed to generate remediation patch.
          </div>
        ) : (
          <>
            {/* Target & Mode Banner */}
            <div className="p-3 rounded-lg bg-[#0e1422] border border-[#1e273b] flex items-center justify-between">
              <div>
                <span className="text-slate-400">Target Endpoint: </span>
                <span className="text-cyan-300 font-bold">{data.endpoint}</span>
                <span className="text-slate-500 ml-2">({finding.method})</span>
              </div>
              <div className="text-[10px] text-slate-400">
                Mode: <strong className="text-purple-300 capitalize">{data.mode.replace('_', ' ')}</strong>
                {data.model && <span className="text-slate-500 ml-1.5">({data.model})</span>}
              </div>
            </div>

            {/* Offline / Error explanation banner */}
            {data.error_reason && (
              <div className="p-2.5 rounded bg-amber-950/30 border border-amber-800/60 text-amber-200 text-[11px] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{data.error_reason}</span>
              </div>
            )}

            {/* Prompt Comparison Side-by-Side */}
            <div className="grid grid-cols-2 gap-4">
              {/* V1 Naive Prompt */}
              <div className="flex flex-col border border-rose-900/40 rounded-xl bg-[#0e1017] overflow-hidden">
                <div className="h-9 px-3 bg-rose-950/30 border-b border-rose-900/40 flex items-center justify-between text-rose-300 font-bold">
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> Naive Prompt (v1)
                  </span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-900/40 text-rose-300">
                    {isGemini ? 'Real Model Output (v1)' : 'Illustrative template, not model output'}
                  </span>
                </div>
                <div className="p-3 bg-[#07090e] border-b border-[#181d2a] text-[10px] text-slate-400 italic">
                  "{data.v1_prompt}"
                </div>
                <div className="p-3 flex-1 overflow-x-auto bg-[#0a0d14]">
                  <pre className="text-[11px] text-rose-200/90 font-mono leading-relaxed">
                    {data.v1_output}
                  </pre>
                </div>
              </div>

              {/* V2 Graph-Guided Prompt */}
              <div className="flex flex-col border border-emerald-900/40 rounded-xl bg-[#0e1017] overflow-hidden">
                <div className="h-9 px-3 bg-emerald-950/30 border-b border-emerald-900/40 flex items-center justify-between text-emerald-300 font-bold">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" /> Graph-Guided Prompt (v2)
                  </span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-900/40 text-emerald-300 font-bold">
                    {isGemini ? 'Real Model Output (v2)' : 'Illustrative template, not model output'}
                  </span>
                </div>
                <div className="p-3 bg-[#07090e] border-b border-[#181d2a] text-[10px] text-cyan-300/80 italic">
                  "{data.v2_prompt}"
                </div>
                <div className="p-3 flex-1 overflow-x-auto bg-[#0a0d14]">
                  <pre className="text-[11px] text-emerald-200/90 font-mono leading-relaxed">
                    {data.code_patch}
                  </pre>
                </div>
              </div>
            </div>

            {/* Explanation & Reasoning */}
            <div className="p-3.5 rounded-xl bg-[#0e1320] border border-[#1e2638] space-y-1.5">
              <div className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5 text-cyan-400" />
                Root-Cause Explanation & Remediation Rationale
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">{data.explanation}</p>
            </div>

            {/* Unit Test & Copy */}
            <div className="border border-[#1e2638] rounded-xl overflow-hidden bg-[#0d1017]">
              <div className="h-9 px-4 bg-[#121622] border-b border-[#1c2436] flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-300">
                  Verification Unit Test (Pytest / FastAPI TestClient)
                </span>
                <button
                  onClick={() => copyToClipboard(data.unit_test, true)}
                  className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/40 transition"
                >
                  {copiedTest ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copiedTest ? 'Copied Test' : 'Copy Test'}
                </button>
              </div>
              <div className="p-3 bg-[#080b11] overflow-x-auto">
                <pre className="text-[11px] text-cyan-200/90 font-mono">{data.unit_test}</pre>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="h-14 px-5 bg-[#0e121a] border-t border-[#1f283d] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          {onApplyReferenceFixAndRescan && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleApplyFix}
                disabled={isApplyingFix}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition disabled:opacity-50"
              >
                <Play className={`w-3 h-3 fill-black ${isApplyingFix ? 'animate-spin' : ''}`} />
                {isApplyingFix ? 'Applying Reference Fix...' : 'Apply reference fix & re-scan'}
              </button>
              <span className="text-[9px] text-slate-500 font-mono hidden md:inline">
                *Applies our reference fix to demo target via patched_mode; model patch is not auto-applied.
              </span>
            </div>
          )}
        </div>

        <button
          onClick={() => copyToClipboard(data?.code_patch || '', false)}
          disabled={!data}
          className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold transition disabled:opacity-50"
        >
          {copiedPatch ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copiedPatch ? 'Patch Copied!' : 'Copy Code Patch'}
        </button>
      </div>
    </div>
  );
};
