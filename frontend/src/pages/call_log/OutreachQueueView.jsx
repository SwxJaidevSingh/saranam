import { useState } from 'react';
import { CallLogCard } from './CallLogCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  PhoneOutgoing,
  PhoneIncoming,
  RefreshCw,
  Calendar as CalendarIcon,
  ClipboardList,
  ShieldCheck,
  User,
  Users,
  Mail
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScheduleDateTimePicker } from './ScheduleDateTimePicker';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

export function OutreachQueueView({
  patients,
  activeTab,
  loading,
  getCallStatus,
  activeCalls,
  onInitiateCall,
  onOpenSOP,
  onSchedule,
  onOpenEmail,
  scheduling = false,
  page,
  setPage,
  totalItems,
  itemsPerPage
}) {
  const [tempScheduleDate, setTempScheduleDate] = useState(null);
  const [scheduleTime, setScheduleTime] = useState('10:00');
  const [activeSchedulePatientId, setActiveSchedulePatientId] = useState(null);

  if (activeTab === "history") return null;

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  // const getStatusBadge = (status) => {
  //   switch (status) {
  //     case 'overdue': 
  //       return <Badge variant="destructive" className="animate-pulse">OVERDUE - 7D+</Badge>;
  //     case 'never': 
  //       return <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-200 uppercase font-bold text-[10px]">NEVER CONTACTED</Badge>;
  //     case 'scheduled':
  //       return <Badge variant="outline" className="text-blue-600 border-blue-200">SCHEDULED</Badge>;
  //     case 'recent':
  //       return <Badge variant="outline" className="text-emerald-600 border-emerald-200">CONTACTED TODAY</Badge>;
  //     default:
  //       return null;
  //   }
  // };

  return (
    <CallLogCard
      title="Patients"
      description="Priority Outreach Queue"
      isLoading={loading}
      footer={
        <div className="flex items-center justify-between w-full mt-4">
          <p className="text-xs text-muted-foreground font-medium">
            Showing {((page - 1) * itemsPerPage) + 1} to {Math.min(page * itemsPerPage, totalItems)} of {totalItems}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(prev => Math.max(1, prev - 1))}
              disabled={page === 1}
              className="rounded-xl font-bold"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
              disabled={page === totalPages || totalPages === 0}
              className="rounded-xl font-bold"
            >
              Next
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {patients.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground italic">No patients found.</div>
        ) : (
          patients.map(patient => {
            const status = getCallStatus(patient.last_call_date);
            const isCalling = activeCalls.some(c => c.patient.id === patient.id);

            return (
              <div key={patient.id} className="p-4 rounded-2xl border transition-all hover:border-primary/50 group flex items-center justify-between">
                <div className="flex gap-4">
                  <div className={`p-4 rounded-2xl transition-colors ${patient.status === 'Critical' ? 'bg-danger-100 text-danger-600' : 'bg-primary-50 text-primary-600 group-hover:bg-primary-100'}`}>
                    <PhoneOutgoing size={24} />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h4 className="font-extrabold text-xl tracking-tight">{patient.full_name || patient.name}</h4>
                      {/* {getStatusBadge(status)} */}
                    </div>
                    <div className="flex flex-col gap-1 text-sm text-muted-foreground font-medium">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1"><User size={14} /> Patient: {patient.phone}</span>
                        {/* {patient.primary_caregiver_phone && (
                          <>
                            <span className="opacity-30">•</span>
                            <span className="flex items-center gap-1 text-blue-600">
                              <Users size={14}/> Caregiver: {patient.primary_caregiver_phone} 
                              {patient.primary_caregiver_name && ` (${patient.primary_caregiver_name})`}
                            </span>
                          </>
                        )} */}
                      </div>
                      <div className="flex items-center gap-3">
                        {patient.geographic_cluster && (
                          <span className="bg-primary/5 text-primary px-2 py-0.5 rounded-lg text-[10px] uppercase font-bold border border-primary/10">
                            {patient.geographic_cluster}
                          </span>
                        )}
                        {/* {patient.bsc_status && (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 rounded-lg px-2 py-0.5 text-[10px] font-bold">
                            <ShieldCheck size={10} className="mr-1" /> BSC Verified
                          </Badge>
                        )} */}
                        {patient.is_scheduled_today && (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 rounded-lg px-2 py-0.5 text-[10px] font-bold">
                            <CalendarIcon size={10} className="mr-1" /> Scheduled Today
                          </Badge>
                        )}
                        <span className="flex items-center gap-1">
                          <CalendarIcon size={14} />
                          Last Sync: {patient.last_call_date ? new Date(patient.last_call_date).toLocaleDateString() : 'None'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="lg"
                    className="rounded-2xl px-4 border-primary/20 hover:bg-primary/5 text-primary"
                    onClick={() => onOpenSOP({ patient, agent: { name: 'Current Agent' } })}
                    title="Manual Documentation"
                  >
                    <ClipboardList size={20} />
                  </Button>
                  {onOpenEmail && (
                    <Button
                      variant="outline"
                      size="lg"
                      className="rounded-2xl px-4 border-sky-500/20 hover:bg-sky-500/5 text-sky-600"
                      onClick={() => onOpenEmail(patient)}
                      title="Send follow-up email"
                    >
                      <Mail size={20} />
                    </Button>
                  )}
                  <Popover
                    open={activeSchedulePatientId === patient.id}
                    onOpenChange={(open) => {
                      if (open) {
                        setActiveSchedulePatientId(patient.id);
                        setTempScheduleDate(null);
                        setScheduleTime('10:00');
                      } else {
                        setActiveSchedulePatientId(null);
                      }
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="lg"
                        className="rounded-2xl px-4 border-amber-500/20 hover:bg-amber-500/5 text-amber-600"
                        title="Schedule for Later"
                      >
                        <CalendarIcon size={20} />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-4" align="end">
                      <ScheduleDateTimePicker
                        selectedDate={tempScheduleDate}
                        onSelectDate={setTempScheduleDate}
                        scheduleTime={scheduleTime}
                        onScheduleTimeChange={setScheduleTime}
                        loading={scheduling}
                        onConfirm={async () => {
                          await onSchedule(patient.id, tempScheduleDate, scheduleTime);
                          setActiveSchedulePatientId(null);
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                  {patient.primary_caregiver_phone ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="lg"
                          disabled={isCalling}
                          className={cn(
                            "rounded-2xl px-8 font-bold transition-all",
                            isCalling ? "bg-amber-500 hover:bg-amber-600" : "shadow-lg shadow-primary/20"
                          )}
                        >
                          {isCalling ? (
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <PhoneIncoming className="h-4 w-4 mr-2" />
                          )}
                          {isCalling ? (
                            activeCalls.find(c => c.patient.id === patient.id)?.status === 'in-progress' ? "Connected" : "Dialing..."
                          ) : `Call Options`}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56 rounded-xl p-2">
                        <DropdownMenuLabel className="text-xs text-muted-foreground">Select Contact</DropdownMenuLabel>
                        <DropdownMenuItem
                          className="rounded-lg cursor-pointer py-3"
                          onClick={() => onInitiateCall(patient, 'patient')}
                        >
                          <div className="flex flex-col">
                            <span className="font-bold flex items-center gap-2"><User size={14} /> Call Patient</span>
                            <span className="text-[10px] text-muted-foreground">{patient.phone}</span>
                          </div>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="rounded-lg cursor-pointer py-3 text-blue-600 focus:text-blue-700"
                          onClick={() => onInitiateCall(patient, 'caregiver')}
                        >
                          <div className="flex flex-col">
                            <span className="font-bold flex items-center gap-2"><Users size={14} /> Call Caregiver</span>
                            <span className="text-[10px] opacity-70">{patient.primary_caregiver_phone} {patient.primary_caregiver_name && `(${patient.primary_caregiver_name})`}</span>
                          </div>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <Button
                      size="lg"
                      disabled={isCalling}
                      onClick={() => onInitiateCall(patient, 'patient')}
                      className={cn(
                        "rounded-2xl px-8 font-bold transition-all",
                        isCalling ? "bg-amber-500 hover:bg-amber-600" : "shadow-lg shadow-primary/20"
                      )}
                    >
                      {isCalling ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <PhoneIncoming className="h-4 w-4 mr-2" />
                      )}
                      {isCalling ? (
                        activeCalls.find(c => c.patient.id === patient.id)?.status === 'in-progress' ? "Connected" : "Dialing..."
                      ) : `Call`}
                    </Button>
                  )}
                </div>

              </div>
            );
          })
        )}
      </div>
    </CallLogCard>
  );
}
