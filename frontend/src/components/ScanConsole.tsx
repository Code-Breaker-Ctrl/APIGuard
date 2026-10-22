import React, { useRef, useEffect, useState } from 'react';
import { Terminal, ArrowDownCircle } from 'lucide-react';
import type { ScanEvent } from '../types';

interface ScanConsoleProps {
  events: ScanEvent[];
  isScanning: boolean;
}

export const ScanConsole: React.FC<ScanConsoleProps> = ({ events, isScanning }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events, autoScroll]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 40;
    setAutoScroll(isAtBottom);
  };

  return (
    <div className="flex flex-col h-full bg-[#07090e] border border-[#1d2536] rounded-xl overflow-hidden shadow-lg">
      {/* Console Header */}
      <div className="h-10 px-4 bg-[#0d121c] border-b border-[#1c2434] flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-semibold text-slate-200">Execution Stream</span>
          {isScanning && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span> LIVE SSE
            </span>
          )}
        </div>
        {!autoScroll && (
          <button
            onClick={() => {
              setAutoScroll(true);
              if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }}
            className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/40"
          >
            <ArrowDownCircle className="w-3 h-3" /> Resume Auto-scroll
          </button>
        )}
      </div>

      {/* Terminal Lines Container */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 p-3 overflow-y-auto font-mono text-[11px] space-y-1.5 scrollbar-thin"
      >
        {events.length === 0 ? (
          <div className="text-slate-600 italic py-4 text-center">
            Awaiting scan initiation. Click "Run Execution Audit" to stream live events.
          </div>
        ) : (
          events.map((ev, index) => {
            const isAlert = ev.event_type === 'finding_confirmed';
            const isInconclusive = ev.event_type === 'test_inconclusive' || ev.message?.includes('test inconclusive');
            const isReq = ev.event_type === 'request_sent';
            const isRes = ev.event_type === 'response_received';

            let lineBg = '';
            let textColor = 'text-slate-300';

            if (isAlert) {
              lineBg = 'bg-rose-950/40 border-l-2 border-rose-500 p-1.5 rounded';
              textColor = 'text-rose-300 font-semibold';
            } else if (isInconclusive) {
              lineBg = 'bg-slate-900/60 border-l-2 border-slate-500 p-1.5 rounded';
              textColor = 'text-slate-400 font-mono';
            } else if (isReq) {
              textColor = 'text-slate-400';
            } else if (isRes) {
              const status = ev.data?.status_code;
              textColor = status === 200 ? 'text-amber-300' : status === 403 ? 'text-emerald-400' : 'text-slate-300';
            }

            return (
              <div key={index} className={`flex items-start gap-2 ${lineBg}`}>
                {/* Phase Chip */}
                {ev.phase && (
                  <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase shrink-0 ${
                    ev.phase === 'A' ? 'bg-cyan-950 text-cyan-300 border border-cyan-800' :
                    ev.phase === 'B' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                    'bg-rose-950 text-rose-300 border border-rose-800'
                  }`}>
                    Phase {ev.phase}
                  </span>
                )}

                {/* Identity Chip */}
                {ev.data?.identity && (
                  <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-300 font-mono shrink-0">
                    {ev.data.identity.includes('alice') ? 'Alice' : 'Bob'}
                  </span>
                )}

                {/* Status code chip */}
                {ev.data?.status_code !== undefined && (
                  <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold shrink-0 ${
                    ev.data.status_code === 200 ? 'bg-amber-500/20 text-amber-300' :
                    ev.data.status_code === 403 ? 'bg-emerald-500/20 text-emerald-300' :
                    'bg-slate-800 text-slate-400'
                  }`}>
                    {ev.data.status_code}
                  </span>
                )}

                <div className={`flex-1 break-all leading-relaxed ${textColor}`}>
                  {ev.message}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
