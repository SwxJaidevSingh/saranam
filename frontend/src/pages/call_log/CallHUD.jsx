import { useState } from 'react';
import { Phone, X, ChevronUp, ChevronDown, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';

export function CallHUD({ activeCalls, onEndCall, onOpenSOP }) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (activeCalls.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 w-full max-w-sm z-50">
      <div className="bg-slate-950 rounded-[2rem] shadow-2xl ring-1 ring-white/10 overflow-hidden border border-white/5">
        <div className="p-4 bg-slate-900/50 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-xs font-bold text-white uppercase tracking-widest">
              Live Sessions ({activeCalls.length})
            </span>
          </div>
          <button onClick={() => setIsExpanded(!isExpanded)} className="text-slate-400 hover:text-white transition-colors">
            {isExpanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
          </button>
        </div>

        {isExpanded && (
          <div className="max-h-64 overflow-y-auto divide-y divide-white/5">
            {activeCalls.map(call => (
              <div key={call.id} className="p-4 flex items-center gap-4 hover:bg-white/[0.02] transition-colors">
                <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary-400">
                  <Phone size={18} className="animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <h5 className="text-white font-bold text-sm truncate">{call.patient.name}</h5>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">
                    with {call.agent.name.split(' ')[0]}
                  </p>
                </div>
                <button 
                  onClick={() => onOpenSOP(call)}
                  className="p-2 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-xl transition-all"
                  title="Document Call (SOP)"
                >
                  <ClipboardList size={14} />
                </button>
                <button 
                  onClick={() => onEndCall(call.id)}
                  className="p-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl transition-all"
                  title="End Session"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
