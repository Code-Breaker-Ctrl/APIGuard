import React, { useState, useEffect } from 'react';
import { X, Sparkles, Copy, Check, ShieldCheck, AlertTriangle, Code2, Play, Terminal, CheckCircle2 } from 'lucide-react';
import type { Finding, RemediationResponse } from '../types';
import { apiClient } from '../api/client';

interface RemediationModalProps {
  finding: Finding;
  onClose: () => void;
  onApplyReferenceFixAndRescan?: () => void;
  onModelTested?: () => void;
}

export const RemediationModal: React.FC<RemediationModalProps> = ({
  finding,
  onClose,
  onApplyReferenceFixAndRescan,
  onModelTested,
}) => {
  const [data, setData] = useState<RemediationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedPatch, setCopiedPatch] = useState(false);
  const [copiedTest, setCopiedTest] = useState(false);
  const [isApplyingFix, setIsApplyingFix] = useState(false);

  // Test model button state
  const [isTestingModel, setIsTestingModel] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const fetchRemediation = () => {
    setIsLoading(true);
    apiClient.remediate(finding)
      .then((res) => {
        setData(res);
        if (res.is_real && onModelTested) {
          onModelTested();
        }
      })
      .catch((err) => {
        console.error('Remediation error:', err);
        // Resilient fallback: render offline template so screen is never blank if Wi-Fi drops
        setData({
          finding_id: finding.id,
          endpoint: finding.endpoint,
          source: 'offline_template',
          provider: 'offline',
          model: 'Offline template',
          badge_text: 'Offline template (illustrative, not model output)',
          v1_prompt: `Fix this BOLA security bug in our API: endpoint ${finding.method} ${finding.endpoint} allows unauthorized users to read data.`,
          v1_output: `# [Illustrative template, not model output]\n# Common pitfall: Authentication-only check (fails to verify tenant resource ownership)\n\n@app.${finding.method.toLowerCase()}("${finding.endpoint}")\ndef export_project_billing(project_id: str, current_user: User = Depends(get_current_user)):\n    # Vulnerable: Only verifies caller is authenticated, not tenant ownership\n    if not current_user:\n        raise HTTPException(status_code=401, detail="Unauthorized")\n    return execute_export(project_id)`,
          v2_prompt: `Context: Graph-Guided BOLA Engine detected authorization defect on ${finding.method} ${finding.endpoint}.\nResource: ${finding.resource_type || 'Project'}. Leaked owner-specific fields: ${finding.diff_fields.join(', ')}.\nGenerate a secure FastAPI route fix verifying tenant ownership, and provide a pytest unit test.`,
          v2_output: `# [Illustrative template, not model output]\n# Reference fix: Resource-level owner verification\n\n@app.${finding.method.toLowerCase()}("${finding.endpoint}")\ndef export_project_billing(project_id: str, current_user: User = Depends(get_current_user)):\n    project = get_project_by_id(project_id)\n    if not project:\n        raise HTTPException(status_code=404, detail="Not Found")\n    # 2. Enforce Graph-Inferred Owner-Only Authorization Policy\n    if project.owner_id != current_user.id and current_user.role != "admin":\n        raise HTTPException(status_code=403, detail="Forbidden: You do not own this project export")\n    return execute_authorized_export(project)\n\n# Verification Test:\ndef test_bola_remediation_blocked():\n    client = TestClient(app)\n    response = client.get("${finding.endpoint.replace('{project_id}', 'proj_42')}", headers={"Authorization": "Bearer " + taaran_token})\n    assert response.status_code == 403`,
          code_patch: `@app.${finding.method.toLowerCase()}("${finding.endpoint}")\ndef export_project_billing(project_id: str, current_user: User = Depends(get_current_user)):\n    project = get_project_by_id(project_id)\n    if not project:\n        raise HTTPException(status_code=404, detail="Not Found")\n    if project.owner_id != current_user.id and current_user.role != "admin":\n        raise HTTPException(status_code=403, detail="Forbidden: You do not own this project export")\n    return execute_authorized_export(project)`,
          explanation: `The target endpoint ${finding.endpoint} failed to check ownership. In the parent endpoint, GET /projects/{project_id} checked owner_id. The fix propagates this check.`,
          unit_test: `def test_bola_remediation_blocked():\n    client = TestClient(app)\n    response = client.get("${finding.endpoint.replace('{project_id}', 'proj_42')}", headers={"Authorization": "Bearer " + taaran_token})\n    assert response.status_code == 403`,
          error_reason: 'Network call delayed; displaying reference remediation template',
          is_real: 0
        });
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchRemediation();
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

  const handleTestModel = async () => {
    setIsTestingModel(true);
    setTestResult(null);
    try {
      const res = await apiClient.testModel();
      if (res.success) {
        setTestResult({
          success: true,
          message: `${res.provider}: ${res.model} connection OK (${res.duration_ms}ms)`,
        });
        if (onModelTested) onModelTested();
        // Re-fetch remediation since live model is confirmed working
        fetchRemediation();
      } else {
        setTestResult({
          success: false,
          message: res.error || 'Connection failed',
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Model test request failed',
      });
    } finally {
      setIsTestingModel(false);
    }
  };

  const isRealModel = data?.source === 'real';
  const isCachedReal = data?.source === 'cached_real';

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
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                isRealModel
                  ? 'bg-emerald-950/70 border-emerald-700 text-emerald-300'
                  : isCachedReal
                  ? 'bg-blue-950/70 border-blue-700 text-blue-300'
                  : 'bg-amber-950/70 border-amber-800 text-amber-300 font-medium'
              }`}
            >
              {data.badge_text.toUpperCase()}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Test model button */}
          <button
            type="button"
            onClick={handleTestModel}
            disabled={isTestingModel}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#162033] hover:bg-[#1e2c45] border border-[#2b3c5e] text-cyan-300 hover:text-white transition disabled:opacity-50 cursor-pointer text-[10px]"
            title="Perform a minimal test call to verify LLM connection"
          >
            <Terminal className="w-3 h-3 text-cyan-400" />
            <span>{isTestingModel ? 'Testing model...' : 'Test model'}</span>
          </button>

          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Test Result Toast Banner if available */}
      {testResult && (
        <div
          className={`px-5 py-2 flex items-center justify-between text-[11px] border-b ${
            testResult.success
              ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
              : 'bg-rose-950/60 border-rose-800 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {testResult.success ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            )}
            <span>{testResult.message}</span>
          </div>
          <button
            onClick={() => setTestResult(null)}
            className="text-slate-400 hover:text-white text-xs cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 p-5 overflow-y-auto space-y-4">
        {isLoading ? (
          <div className="py-20 text-center text-slate-400 animate-pulse">
            Synthesizing graph-guided patch and test cases via LLM provider...
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
                Source: <strong className="text-purple-300 capitalize">{data.provider}</strong>
                {data.model && <span className="text-slate-500 ml-1.5">({data.model})</span>}
              </div>
            </div>

            {/* Error / Fallback explanation banner */}
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
                    {data.is_real ? 'Real Model Output (v1)' : 'Illustrative template, not model output'}
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
                    {data.is_real ? 'Real Model Output (v2)' : 'Illustrative template, not model output'}
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
                  className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/40 transition cursor-pointer"
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
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition disabled:opacity-50 cursor-pointer"
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
          className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold transition disabled:opacity-50 cursor-pointer"
        >
          {copiedPatch ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copiedPatch ? 'Patch Copied!' : 'Copy Code Patch'}
        </button>
      </div>
    </div>
  );
};
