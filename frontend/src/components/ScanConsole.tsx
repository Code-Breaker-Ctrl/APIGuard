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
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
  };

  return (
    <div className="flex flex-col h-full panel overflow-hidden">
      <div className="h-11 px-4 bg-slate-900 border-b-2 border-slate-700 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span className="panel-title">Event Stream</span>
          {isScanning && <span className="text-sm text-amber-400 animate-pulse">● live</span>}
        </div>
        {!autoScroll && (
          <button
            onClick={() => {
              setAutoScroll(true);
              if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }}
            className="btn-ghost"
            title="Resume auto-scroll"
          >
            <ArrowDownCircle className="w-4 h-4" />
          </button>
        )}
      </div>

      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 p-3 overflow-y-auto space-y-1">
        {events.length === 0 ? (
          <div className="text-slate-500 py-6 text-center text-base">
            Rest at a site of grace.<br />Begin the audit to stream events.
          </div>
        ) : (
          events.map((ev, index) => {
            const isAlert = ev.event_type === 'finding_confirmed';
            const isInconclusive = ev.event_type === 'test_inconclusive' || ev.message?.includes('test inconclusive');
            const status = ev.data?.status_code;

            let tone = 'text-slate-300';
            let frame = '';
            if (isAlert) {
              tone = 'text-rose-300';
              frame = 'bg-rose-950 border-l-4 border-rose-500 pl-2 py-1';
            } else if (isInconclusive) {
              tone = 'text-slate-500';
            } else if (ev.event_type === 'request_sent') {
              tone = 'text-slate-400';
            } else if (ev.event_type === 'response_received') {
              tone = status === 200 ? 'text-amber-300' : status === 403 ? 'text-emerald-400' : 'text-slate-300';
            }

            return (
              <div key={index} className={`flex items-start gap-2 text-base leading-tight ${frame}`}>
                {status !== undefined && (
                  <span className={`shrink-0 w-9 text-center text-sm ${
                    status === 200 ? 'bg-amber-400 text-slate-950' :
                    status === 403 ? 'bg-emerald-400 text-slate-950' :
                    'bg-slate-700 text-slate-200'
                  }`}>
                    {status}
                  </span>
                )}
                <div className={`flex-1 break-all ${tone}`}>{ev.message}</div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
