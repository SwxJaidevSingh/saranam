import { CallLogCard } from './CallLogCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { User, PhoneOff, PhoneForwarded, Radio, Signal } from 'lucide-react';
import { cn } from '@/lib/utils';
import callLogsApi from '@/api/call-log.js';
import { useToast } from '@/hooks/useToast';

export function StaffSidebar({
  agents,
  setAgents,
  loading,
  page,
  setPage,
  totalItems,
  itemsPerPage
}) {
  const { showToast } = useToast();
  const availableCount = agents.filter((a) => a.active && !a.busy).length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const toggleAgentDuty = async (id) => {
    const agent = agents.find(a => a.id === id);
    if (!agent) return;

    const newStatus = !agent.active;

    try {
      // Optimistic update
      setAgents(prev => prev.map(a =>
        a.id === id ? { ...a, active: newStatus } : a
      ));

      // Persistent update
      await callLogsApi.updateAgentStatus(id, newStatus);
    } catch (error) {
      setAgents(prev => prev.map(a =>
        a.id === id ? { ...a, active: !newStatus } : a
      ));
      const errorMsg = error.response?.data?.error || error.message;
      showToast(errorMsg || 'Could not update on-duty status.', 'error');
    }
  };

  return (
    <CallLogCard
      title="Staff Registry"
      description="Active care providers"
      isLoading={loading}

      headerAction={<Badge variant="outline" className="rounded-lg font-bold bg-primary/5 text-primary border-primary/20">{availableCount} Ready</Badge>}
      footer={
        <div className="flex items-center justify-between w-full">
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
            Page {page} / {totalPages || 1}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs font-bold rounded-xl"
              onClick={() => setPage(prev => Math.max(1, prev - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs font-bold rounded-xl"
              onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
              disabled={page === totalPages || totalPages === 0}
            >
              Next
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        {agents.map(agent => (
          <div
            key={agent.id}
            className={cn(
              "p-4 rounded-2xl border transition-all flex items-center justify-between group",
              agent.active ? "bg-white border-border shadow-sm ring-1 ring-black/5" : "bg-muted/30 border-transparent opacity-60"
            )}
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-colors",
                  agent.active ? "bg-primary text-white" : "bg-slate-200 text-slate-500"
                )}>
                  {(agent.name || agent.full_name || 'S').charAt(0)}
                </div>
                {agent.active && (
                  <div className={cn(
                    "absolute -bottom-1 -right-1 w-4 h-4 border-2 border-white rounded-full shadow-sm",
                    agent.busy ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
                  )} />
                )}
              </div>
              <div className="min-w-0">
                <p className="font-extrabold text-sm leading-tight text-foreground truncate">{agent.name || agent.full_name || 'Staff'}</p>
                {agent.specialization && (
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{agent.specialization}</p>
                )}

                <div className="flex items-center gap-2 mt-0.5">
                  <span className={cn(
                    "text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md",
                    agent.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                  )}>
                    {agent.active ? "On Duty" : "Off"}
                  </span>
                  {agent.busy && (
                    <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700">
                      Busy
                    </span>
                  )}
                </div>
              </div>
            </div>

            <Button
              variant={agent.active ? "ghost" : "outline"}
              size="icon"
              className={cn(
                "h-9 w-9 rounded-xl transition-all",
                agent.active ? "text-danger hover:bg-danger/10" : "text-primary hover:bg-primary/10"
              )}
              onClick={() => toggleAgentDuty(agent.id)}
            >
              {agent.active ? <PhoneOff size={18} /> : <PhoneForwarded size={18} />}
            </Button>
          </div>
        ))}

        {agents.length === 0 && !loading && (
          <div className="py-12 text-center">
            <User className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground italic font-medium">No staff members found.</p>
          </div>
        )}

        {availableCount === 0 && agents.length > 0 && !loading && (
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 flex items-center gap-3">
            <Signal size={14} className="text-amber-600 animate-pulse" />
            <p className="text-[10px] font-bold text-amber-700 uppercase tracking-tight">Full busy / offline</p>
          </div>
        )}
      </div>
    </CallLogCard>
  );
}
