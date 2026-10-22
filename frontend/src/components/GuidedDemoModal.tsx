import React, { useState } from 'react';
import { X, Play, ArrowRight, ShieldCheck, GitBranch, Cpu, Sparkles, CheckCircle2 } from 'lucide-react';

interface GuidedDemoModalProps {
  onClose: () => void;
  onLoadSpec: () => void;
  onOpenDryRun: () => void;
  onRunAudit: () => void;
  onOpenBenchmark: () => void;
}

export const GuidedDemoModal: React.FC<GuidedDemoModalProps> = ({
  onClose,
  onLoadSpec,
  onOpenDryRun,
  onRunAudit,
  onOpenBenchmark,
}) => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: '1. Ingest OpenAPI 3.x Specification & DAG Construction',
      icon: <GitBranch className="w-5 h-5 text-cyan-400" />,
      tagline: 'Deterministic schema parsing without invented properties',
      description:
        'APIGuard ingests standard OpenAPI 3.x YAML/JSON specs and parses them with openapi-spec-validator. It maps endpoints to resource entities, identifies producer operations (e.g., POST /projects creates {project_id}), and builds a typed resource DAG using Dagre layout.',
      actionLabel: 'Reload Spec & Reset State',
      action: () => onLoadSpec(),
    },
    {
      title: '2. Safe Dry-Run Sequence Planning',
      icon: <Cpu className="w-5 h-5 text-amber-400" />,
      tagline: 'Multi-identity test sequencing with zero network traffic',
      description:
        'Before probing the target, the TestPlanner analyzes parameter dependencies and allocates request budgets. Mutating HTTP verbs (PATCH/DELETE) are blocked by default unless explicitly allowed. The Dry-Run table previews every planned setup, control, and probe step.',
      actionLabel: 'Preview Dry-Run Table',
      action: () => {
        onClose();
        onOpenDryRun();
      },
    },
    {
      title: '3. Real Execution Audit & Graph Propagation',
      icon: <Play className="w-5 h-5 text-emerald-400 fill-emerald-400" />,
      tagline: 'Real HTTP requests against 127.0.0.1 with live SSE telemetry',
      description:
        'Watch the terminal stream live HTTP requests. User A (Alice) establishes resource state; the engine observes authorization on GET /projects/{id} and propagates candidate ownership rules along DAG edges to adjacent endpoints. When Alice’s export endpoint is probed with Bob’s token, HTTP 200 OK leaks confidential billing data, triggering a CONFIRMED finding.',
      actionLabel: 'Trigger Live Audit',
      action: () => {
        onClose();
        onRunAudit();
      },
    },
    {
      title: '4. Scientific Benchmark & Ground Truth Verification',
      icon: <ShieldCheck className="w-5 h-5 text-purple-400" />,
      tagline: 'Measurable empirical claims vs Option A Baseline & Ablations',
      description:
        'Review the empirical benchmark across 5 target variants. Notice how the baseline achieves 0% recall on Defect B (indirect BOLA on export) while APIGuard reaches 100% recall. In our ablation, disabling propagation missed the indirect defect (1 defect, 1 target API).',
      actionLabel: 'Open Benchmark Panel',
      action: () => {
        onClose();
        onOpenBenchmark();
      },
    },
  ];

  const active = steps[currentStep];

  return (
    <div className="flex flex-col h-full bg-[#0b0e14] text-xs font-mono select-none">
      {/* Header */}
      <div className="h-12 px-5 bg-[#121622] border-b border-[#1f283d] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span className="font-bold text-slate-100 text-sm">Interactive Hackathon Guided Demo</span>
          <span className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/40 text-emerald-300 font-bold text-[10px]">
            PRESS [D] ANYTIME
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="grid grid-cols-4 gap-1 p-2 bg-[#080a0f] border-b border-[#181f2f]">
        {steps.map((s, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentStep(idx)}
            className={`py-2 px-3 rounded-lg text-left transition flex items-center gap-2 ${
              idx === currentStep
                ? 'bg-[#151c2c] border border-cyan-600/50 text-white'
                : idx < currentStep
                ? 'bg-[#0f1420] text-emerald-300 border border-[#1b2336]'
                : 'bg-transparent text-slate-500 border border-transparent'
            }`}
          >
            {idx < currentStep ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] shrink-0 ${
                idx === currentStep ? 'bg-cyan-500 text-black font-bold' : 'bg-slate-800 text-slate-400'
              }`}>
                {idx + 1}
              </span>
            )}
            <span className="truncate text-[10px] font-semibold">{s.title.split('.')[1]}</span>
          </button>
        ))}
      </div>

      {/* Body Content */}
      <div className="flex-1 p-6 flex flex-col justify-between overflow-y-auto">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#141b29] border border-[#232f48] flex items-center justify-center">
              {active.icon}
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">{active.title}</h2>
              <p className="text-xs text-cyan-400 font-semibold">{active.tagline}</p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#0f1422] border border-[#1e283d] text-slate-300 text-[12px] leading-relaxed">
            {active.description}
          </div>

          <div className="p-3.5 rounded-lg bg-slate-900/40 border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>
              💡 <strong>Judge Cross-Questioning Tip:</strong> Judges will ask if findings are real or simulated. State clearly that every finding is confirmed via differential HTTP analysis against live uvicorn sockets.
            </span>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-4 flex items-center justify-between border-t border-[#182030] mt-4">
          <div className="text-[10px] text-slate-500">
            Step {currentStep + 1} of {steps.length}
          </div>
          <div className="flex items-center gap-3">
            {currentStep > 0 && (
              <button
                onClick={() => setCurrentStep((prev) => prev - 1)}
                className="px-3.5 py-1.5 rounded-lg border border-[#232c3f] text-slate-300 hover:bg-[#161d2c] transition"
              >
                Previous
              </button>
            )}
            <button
              onClick={active.action}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold transition shadow-lg shadow-emerald-500/20"
            >
              <span>{active.actionLabel}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
