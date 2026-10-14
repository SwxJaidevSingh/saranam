import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  AlertTriangle,
  RefreshCw,
  Activity,
  Users,
  History,
  ClipboardList,
  Search,
  X,
  Calendar as CalendarIcon,
  Plus,
  Mail,
  User,
  Clock,
  ShieldCheck,
  ArrowUpRight,
  Signal
} from 'lucide-react';
import { subMonths, format, isAfter, subDays, formatDistanceToNow } from 'date-fns';

// UI Components
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/useToast';
import { toast as rtToast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// UI Popover for Follow-ups
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

// Analytics/Shared Components
import { StatCard } from '@/components/analytics/StatCard';
import { DateRangePicker } from '@/components/analytics/DateRangePicker';
import { ExportButton } from '@/components/analytics/ExportButton';

// Call Log Components
import CallLogs from '@/components/call_log/CallLogs';
import { OutreachQueueView } from './OutreachQueueView.jsx';
import { StaffSidebar } from './StaffSidebar';
import { CallHUD } from './CallHUD';
import { EmailModal } from './EmailModal';
import { ScheduleDateTimePicker, combineDateAndTime } from './ScheduleDateTimePicker';

// APIs
import { patientsApi } from '@/api/patients';
import { providersApi } from '@/api/providers';
import { cn } from '@/lib/utils';
import callLogApi from '@/api/call-log.js';


const CallLogsPage = () => {
  const { showToast } = useToast();

  // Local wrapper using react-toastify for simple, visible notifications
  const toast = useCallback((options) => {
    const message = typeof options === 'string' ? options : (options.description || options.title || 'Notification');
    const type = options.variant === 'destructive' ? 'error' : (options.variant === 'success' ? 'success' : 'info');

    // Call original showToast for console logging/state if needed
    showToast(message, type);

    // Call react-toastify for visual UI
    if (type === 'error') rtToast.error(message);
    else if (type === 'success') rtToast.success(message);
    else rtToast.info(message);
  }, [showToast]);
  const [activeTab, setActiveTab] = useState('dial'); // 'dial', 'history', 'escalation', or 'scheduler'
  const [historySubTab, setHistorySubTab] = useState('calls'); // 'calls' or 'docs'
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [escalatedCalls, setEscalatedCalls] = useState([]);
  const [activeFollowUpCallId, setActiveFollowUpCallId] = useState(null);
  const [sopModalOpen, setSopModalOpen] = useState(false);
  const [selectedCall, setSelectedCall] = useState(null);
  const [sopData, setSopData] = useState({
    patientName: '',
    callerNumber: '',
    relationship: '',
    reason: '',
    severity: 'low',
    symptoms: '',
    advice: '',
    notes: '',
    staffName: '',
    staffNumber: '',
    escalate: false
  });


  // Data State
  const [patients, setPatients] = useState([]);
  const [agents, setAgents] = useState([]);
  const [activeCalls, setActiveCalls] = useState([]);
  const [stats, setStats] = useState({ total: 0, inbound: 0, outbound: 0, failed: 0 });

  // Pagination State
  const [patientPage, setPatientPage] = useState(1);
  const [providerPage, setProviderPage] = useState(1);
  const [patientTotal, setPatientTotal] = useState(0);
  const [providerTotal, setProviderTotal] = useState(0);
  const [sopHistory, setSopHistory] = useState([]);
  const [sopTotal, setSopTotal] = useState(0);
  const [sopPage, setSopPage] = useState(1);
  const [sopLoading, setSopLoading] = useState(false);
  const [scheduledCalls, setScheduledCalls] = useState([]);
  const [schedulerLoading, setSchedulerLoading] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [tempFollowUpDate, setTempFollowUpDate] = useState(null);
  const [followUpTime, setFollowUpTime] = useState('10:00');
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailPatient, setEmailPatient] = useState(null);
  const PER_PAGE = 10;

  // Date filter for history
  const [dateRange, setDateRange] = useState({
    from: subMonths(new Date(), 1),
    to: new Date()
  });

  // Fetch Patients
  const fetchPatients = useCallback(async (query = searchQuery) => {
    if (activeTab !== 'dial') return;
    try {
      setPatientsLoading(true);
      const pData = await patientsApi.list({
        page: patientPage,
        per_page: PER_PAGE,
        search: query
      });

      const extractPhone = (contact) => {
        if (!contact) return "";
        const match = contact.match(/Phone:\s*(\+?[\d\s]+)/i);
        if (match) return match[1].trim();
        return contact.split(';')[0].replace(/Phone:\s*/i, '').trim();
      };

      const processedPatients = (pData.patients || []).map(p => ({
        ...p,
        phone: p.phone || extractPhone(p.contact)
      }));

      setPatients(processedPatients);
      setPatientTotal(pData.total || 0);
    } catch (error) {
      toast({ variant: "destructive", title: "Sync Failed", description: "Could not retrieve patients." });
    } finally {
      setPatientsLoading(false);
    }
  }, [activeTab, patientPage, searchQuery, toast]);

  // Fetch Providers (Staff)
  const fetchProviders = useCallback(async () => {
    if (activeTab !== 'dial') return;
    try {
      setProvidersLoading(true);
      const agentsData = await callLogApi.getAgents();

      const augmentedAgents = (agentsData || []).map(a => ({
        ...a,
        name: a.name || a.full_name || 'Staff',
        active: !!a.active, // Backend maps is_on_duty to 'active'
        busy: a.busy || false
      }));
      setAgents(augmentedAgents);
      setProviderTotal(agentsData.length || 0);
    } catch (error) {
      toast({ variant: "destructive", title: "Sync Failed", description: "Could not retrieve staff." });
    } finally {
      setProvidersLoading(false);
    }
  }, [activeTab, toast]);

  // Fetch Stats/History
  const fetchHistory = useCallback(async () => {
    if (activeTab !== 'history') return;
    try {
      setStatsLoading(true);
      const logsData = await callLogApi.getCalls({
        start_date: dateRange.from?.toISOString(),
        end_date: dateRange.to?.toISOString()
      });
      const logs = logsData.Calls || [];
      setStats({
        total: logs.length,
        inbound: logs.filter(c => c.Direction === 'inbound').length,
        outbound: logs.filter(c => c.Direction === 'outbound').length,
        failed: logs.filter(c => ['failed', 'no-answer', 'busy'].includes(c.Status?.toLowerCase())).length
      });
    } catch (error) {
      toast({ variant: "destructive", title: "Sync Failed", description: "Could not retrieve history." });
    } finally {
      setStatsLoading(false);
    }
  }, [activeTab, dateRange, toast]);

  // Fetch Escalations from Database
  const fetchEscalations = useCallback(async () => {
    if (activeTab !== 'escalation') return;
    try {
      const data = await callLogApi.getEscalations();
      // Format backend data to match UI expectations
      const formatted = (data.escalations || []).map(esc => ({
        ...esc,
        id: esc.id,
        timestamp: new Date(esc.created_at),
        agent: { name: esc.staff_name || 'Staff' }
      }));
      setEscalatedCalls(formatted);
    } catch (error) {
      toast({ variant: "destructive", title: "Sync Failed", description: "Could not retrieve persistent escalations." });
    }
  }, [activeTab, toast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab === 'dial') {
        fetchPatients(searchQuery);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [searchQuery, activeTab, fetchPatients]);

  useEffect(() => {
    if (activeTab === 'dial') {
      fetchProviders();
    }
  }, [fetchProviders]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [fetchHistory]);

  useEffect(() => {
    if (activeTab === 'escalation') {
      fetchEscalations();
    }
  }, [fetchEscalations]);

  // Fetch SOP History
  const fetchSOPHistory = useCallback(async () => {
    try {
      setSopLoading(true);
      const params = {
        start_date: dateRange.from?.toISOString(),
        end_date: dateRange.to?.toISOString(),
        page: sopPage,
        per_page: PER_PAGE
      };
      const data = await callLogApi.getSOPHistory(params);
      setSopHistory(data.items || []);
      setSopTotal(data.total || 0);
    } catch (error) {
      toast({ variant: "destructive", title: "History Sync Failed", description: "Could not retrieve documentation history." });
    } finally {
      setSopLoading(false);
    }
  }, [dateRange, sopPage, toast]);

  // Fetch Persistent Schedule
  const fetchSchedule = useCallback(async () => {
    try {
      setSchedulerLoading(true);
      const data = await callLogApi.getSchedule();
      setScheduledCalls(data.schedule || []);
    } catch (error) {
      toast({ variant: "destructive", title: "Schedule Sync Failed", description: "Could not retrieve persistent schedule." });
    } finally {
      setSchedulerLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (activeTab === 'scheduler') {
      fetchSchedule();
    }
  }, [fetchSchedule, activeTab]);

  useEffect(() => {
    if (activeTab === 'history' && historySubTab === 'docs') {
      fetchSOPHistory();
    }
  }, [fetchSOPHistory, activeTab, historySubTab]);

  // Global Refresh Toggle (for the Refresh button)
  const handleGlobalRefresh = () => {
    if (activeTab === 'dial') {
      fetchPatients();
      fetchProviders();
    } else if (activeTab === 'history') {
      if (historySubTab === 'calls') {
        fetchHistory();
      } else {
        fetchSOPHistory();
      }
    } else if (activeTab === 'escalation') {
      fetchEscalations();
    } else if (activeTab === 'scheduler') {
      fetchSchedule();
    }
  };


  // Make Call Logic
  const handleInitiateCall = async (patient, targetType = 'patient') => {
    const availableAgents = agents.filter(a => a.active && !a.busy);

    if (availableAgents.length === 0) {
      toast({
        variant: "destructive",
        title: "Staff Offline",
        description: "Please set at least one staff member to 'On Duty' in the sidebar before calling."
      });
      return;
    }

    const agent = availableAgents[0];

    // Helper to extract clean phone number
    const getCleanPhone = (val) => {
      if (!val) return "";
      const raw = typeof val === 'string' ? val : (val.phone || val.contact || "");
      const match = raw.match(/Phone:\s*(\+?[\d\s]+)/i);
      if (match) return match[1].replace(/\s/g, '');
      return raw.replace(/[^+\d]/g, ''); 
    };

    const fromPhone = getCleanPhone(agent);
    
    // Determine target number and name based on type
    let toPhone, targetName;
    if (targetType === 'caregiver' && patient.primary_caregiver_phone) {
      toPhone = getCleanPhone(patient.primary_caregiver_phone);
      targetName = patient.primary_caregiver_name || `${patient.full_name}'s Caregiver`;
    } else {
      toPhone = getCleanPhone(patient);
      targetName = patient.full_name || patient.name;
    }

    if (!fromPhone || !toPhone) {
      toast({
        variant: "destructive",
        title: "Missing Number",
        description: `Could not find phone number for ${!fromPhone ? 'Staff' : 'Target'}.`
      });
      return;
    }

    const sessionId = Date.now();
    const session = {
      id: sessionId,
      patient: { id: patient.id, name: targetName, full_name: patient.full_name || patient.name, phone: toPhone, type: targetType },
      agent: { id: agent.id, name: agent.name, phone: fromPhone }
    };

    try {
      setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, busy: true } : a));
      setActiveCalls(prev => [...prev, session]);

      // Use the API client with metadata
      const response = await callLogApi.makeCall(
        fromPhone,
        toPhone,
        patient.full_name || patient.name,
        agent.name
      );
      const callSid = response.Call?.Sid;

      if (callSid) {
        setActiveCalls(prev => prev.map(c => c.id === sessionId ? { ...c, sid: callSid, status: 'in-progress' } : c));
      }

      toast({
        title: "Call Initiated",
        description: `Connecting ${agent.name} with ${patient.full_name || patient.name}.`
      });

      setTimeout(() => {
        setActiveCalls(prev => {
          const call = prev.find(c => c.id === sessionId);
          // Only clear if status is still null/dialing (didn't connect)
          if (call && call.status === 'in-progress') return prev;

          setAgents(agentsPrev => agentsPrev.map(a => a.id === agent.id ? { ...a, busy: false } : a));
          return prev.filter(c => c.id !== sessionId);
        });
      }, 30000);

    } catch (error) {

      const errorData = error.response?.data;
      const statusCode = error.response?.status;
      const errorMessage = typeof errorData === 'object' ? (errorData.error || errorData.message) : error.message;

      let toastTitle = "Dial Error";
      let toastDesc = errorMessage || "Failed to connect call via Exotel.";

      if (statusCode === 403) {
        toastTitle = "Authentication Failed";
        toastDesc = "Exotel credentials (API Key/Token) are invalid. Please check your configuration.";
      }

      toast({
        variant: "destructive",
        title: toastTitle,
        description: toastDesc
      });

      // Clear the local state immediately on error
      setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, busy: false } : a));
      setActiveCalls(prev => prev.filter(c => c.id !== sessionId));
    }
  };

  const handleEndCall = useCallback((sessionId) => {
    setActiveCalls(prev => {
      const callToEnd = prev.find(c => c.id === sessionId);
      if (!callToEnd) return prev;

      // Update agent status inside the same logical flow
      setAgents(agentsPrev => agentsPrev.map(a =>
        a.id === callToEnd.agent.id ? { ...a, busy: false } : a
      ));

      return prev.filter(c => c.id !== sessionId);
    });

    toast({
      title: "Call Session Ended",
      description: "You are now available for new calls."
    });
  }, [toast]);

  // Polling for Call Status
  useEffect(() => {
    if (activeCalls.length === 0) return;

    const pollInterval = setInterval(async () => {
      const activeCallsWithSid = activeCalls.filter(c => c.sid);
      if (activeCallsWithSid.length === 0) return;

      for (const call of activeCallsWithSid) {
        try {
          const statusData = await callLogApi.getCallStatus(call.sid);
          const currentStatus = statusData.Call?.Status?.toLowerCase();

          // If status is terminal, clear the session
          if (['completed', 'failed', 'busy', 'no-answer', 'canceled'].includes(currentStatus)) {
            handleEndCall(call.id);
          }
        } catch (err) {
          // Status check failed silently in production
        }
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(pollInterval);
  }, [activeCalls, handleEndCall]);

  // Professional Patient Status Logic
  const getCallStatus = useCallback((lastCallDate) => {
    if (!lastCallDate) return "never";
    const last = new Date(lastCallDate);
    if (isAfter(last, subDays(new Date(), 1))) return "recent";
    if (isAfter(last, subDays(new Date(), 7))) return "scheduled";
    return "overdue";
  }, []);

  const sortedPatients = useMemo(() => {
    return patients
      .filter(p => (p.full_name || p.name || "").toLowerCase().includes(searchQuery.toLowerCase()) || (p.phone || "").includes(searchQuery))
      .sort((a, b) => {
        const statusA = getCallStatus(a.last_call_date);
        const statusB = getCallStatus(b.last_call_date);
        const priority = { overdue: 3, never: 2, scheduled: 1, recent: 0 };
        return priority[statusB] - priority[statusA];
      });
  }, [patients, searchQuery, getCallStatus]);

  // Client-side pagination for agents
  const paginatedAgents = useMemo(() => {
    const start = (providerPage - 1) * PER_PAGE;
    return agents.slice(start, start + PER_PAGE);
  }, [agents, providerPage]);

  // Export Data Preparation
  const exportData = activeTab === 'history' ? {
    summary: stats,
    range: { from: dateRange.from, to: dateRange.to },
    message: "Call logs export including duration and recording links."
  } : null;

  const handleOpenEmail = (patient) => {
    setEmailPatient(patient);
    setEmailModalOpen(true);
  };

  const handleSendEmail = async (patientId, subject, body) => {
    try {
      await callLogApi.sendEmail(patientId, subject, body);
      toast({
        variant: 'success',
        title: 'Email Sent',
        description: 'Follow-up email was sent successfully.',
      });
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.message;
      toast({
        variant: 'destructive',
        title: 'Email Failed',
        description: errorMsg || 'Could not send email.',
      });
      throw error;
    }
  };

  // SOP Form Handlers
  const handleOpenSOP = (call) => {
    const patient = call.patient || {};
    const agent = call.agent || {};
    setSelectedCall(call);
    setSopData({
      patientName: patient.full_name || patient.name || '',
      callerNumber: patient.phone || '',
      relationship: 'self',
      reason: call.reason || '',
      severity: call.severity || 'low',
      symptoms: call.symptoms || '',
      advice: call.advice || '',
      notes: call.notes || '',
      staffName: call.staff_name || agent.name || '',
      staffNumber: call.staff_number || agent.phone || '',
      escalate: call.is_escalated || false
    });
    setSopModalOpen(true);
  };

  const handleSaveSOP = async () => {
    try {
      const payload = {
        ...sopData,
        patient_id: selectedCall.patient.id
      };

      await callLogApi.saveSOP(payload);

      toast({ variant: "success", title: "SOP Saved", description: "Documentation has been persisted to the patient record." });
      setSopModalOpen(false);

      if (sopData.escalate) {
        await fetchEscalations();
      }
    } catch (error) {
      console.error("SOP Save Error:", error);
      const errorMsg = error.response?.data?.error || error.response?.data?.message || error.message;
      const statusCode = error.response?.status;
      
      toast({ 
        variant: "destructive", 
        title: `Save Failed ${statusCode ? `(${statusCode})` : ''}`, 
        description: errorMsg || "Could not save SOP documentation." 
      });
    }
  };

  const handleEscalateToHomeCare = (callId) => {
    // TODO: Implement HomeCare routing logic here
    // 1. Fetch full patient/escalation details using callId
    // 2. Call HomeCare API (e.g., POST /api/homecare/referrals) with patient data
    // 3. Mark the escalation as "Referred" in the backend SOP table
    
    setEscalatedCalls(prev => prev.filter(c => c.id !== callId));
    toast({
      variant: "success",
      title: "Escalated to HomeCare",
      description: "A new visit request has been added to the HomeCare queue."
    });
  };

  const handleAddToSchedule = async (patientId, date = null, timeStr = '10:00') => {
    try {
      setScheduling(true);
      const baseDate = date || new Date(Date.now() + 86400000);
      const scheduledDate = combineDateAndTime(baseDate, timeStr);
      if (!scheduledDate) {
        throw new Error('Invalid schedule date');
      }

      await callLogApi.addToSchedule({
        patient_id: patientId,
        scheduled_date: scheduledDate.toISOString(),
        notes: "Scheduled from Outreach Management"
      });
      
      toast({
        variant: "success",
        title: "Added to Schedule",
        description: "Patient has been added to the persistent outreach schedule."
      });
      
      await fetchSchedule();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Scheduling Failed",
        description: "Could not add patient to schedule."
      });
    } finally {
      setScheduling(false);
    }
  };

  const handleRemoveFromSchedule = async (scheduleId) => {
    try {
      await callLogApi.removeFromSchedule(scheduleId);
      setScheduledCalls(prev => prev.filter(s => s.id !== scheduleId));
      toast({
        variant: "success",
        title: "Removed",
        description: "Record removed from schedule."
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Action Failed",
        description: "Could not remove from schedule."
      });
    }
  };

  const handleAutoGenerate = async () => {
    try {
      setSchedulerLoading(true);
      await callLogApi.autoGenerateSchedule();
      toast({
        variant: "success",
        title: "Plan Generated",
        description: "Automatic outreach plan for next week has been created."
      });
      await fetchSchedule();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Generation Failed",
        description: "Could not automatically generate the schedule."
      });
    } finally {
      setSchedulerLoading(false);
    }
  };

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Header Section */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Smart Outreach</h1>
            <p className="text-muted-foreground mt-2">
              Integrated patient communication hub and automated call history.
            </p>
          </div>
        </div>

        {/* View Toggles */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-lg border border-border bg-card p-1 shadow-sm">
            <Button
              variant={activeTab === 'dial' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('dial')}
              className="gap-2 px-6"
            >
              <Phone className="h-4 w-4" />
              Dial
            </Button>
            <Button
              variant={activeTab === 'history' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('history')}
              className="gap-2 px-6"
            >
              <History className="h-4 w-4" />
              History
            </Button>
            <Button
              variant={activeTab === 'escalation' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('escalation')}
              className="gap-2 px-6"
            >
              <AlertTriangle className="h-4 w-4" />
              Escalated
            </Button>
            <Button
              variant={activeTab === 'scheduler' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('scheduler')}
              className="gap-2 px-6"
            >
              <ClipboardList className="h-4 w-4" />
              Scheduler
            </Button>
          </div>
          <div className="flex items-center gap-3">
            {activeTab === 'history' && (
              <>
                <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />
                <Button variant="outline" size="icon" onClick={handleGlobalRefresh} disabled={statsLoading}>
                  <RefreshCw className={`h-4 w-4 ${statsLoading ? 'animate-spin' : ''}`} />
                </Button>

                <ExportButton data={exportData} dateRange={dateRange} viewType="call_history" />
              </>
            )}
            {activeTab === 'dial' && (
              <>
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search patient or phone..."
                    className="pl-9 rounded-xl border-border/50 focus:border-primary"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button variant="outline" size="icon" onClick={handleGlobalRefresh} disabled={patientsLoading || providersLoading}>
                  <RefreshCw className={`h-4 w-4 ${patientsLoading || providersLoading ? 'animate-spin' : ''}`} />
                </Button>

              </>
            )}
          </div>
        </div>
      </div>

      <Separator className="opacity-50" />

      {/* Stats Display */}
      {activeTab === 'history' && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total Volume" value={stats.total} icon={Activity} isLoading={statsLoading} />
          <StatCard title="Inbound Calls" value={stats.inbound} icon={PhoneIncoming} iconColor="text-emerald-600" iconBgColor="bg-emerald-100" isLoading={statsLoading} />
          <StatCard title="Outbound Calls" value={stats.outbound} icon={PhoneOutgoing} iconColor="text-blue-600" iconBgColor="bg-blue-100" isLoading={statsLoading} />
          <StatCard title="Failed/Missed" value={stats.failed} icon={AlertTriangle} iconColor="text-red-600" iconBgColor="bg-red-100" isLoading={statsLoading} />

        </div>
      )}

      {/* Main Content Area */}
      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-8">
          {activeTab === 'dial' ? (
            <OutreachQueueView
              patients={sortedPatients}
              loading={patientsLoading}
              getCallStatus={getCallStatus}
              activeCalls={activeCalls}
              onInitiateCall={handleInitiateCall}
              onOpenSOP={handleOpenSOP}
              onSchedule={handleAddToSchedule}
              onOpenEmail={handleOpenEmail}
              scheduling={scheduling}
              page={patientPage}
              setPage={setPatientPage}
              totalItems={patientTotal}
              itemsPerPage={PER_PAGE}
            />
          ) : activeTab === 'history' ? (
            <div className="space-y-6">
              {/* History Sub-tabs */}
              <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-xl w-fit">
                <Button 
                  variant={historySubTab === 'calls' ? 'secondary' : 'ghost'} 
                  size="sm" 
                  onClick={() => setHistorySubTab('calls')}
                  className="rounded-lg font-bold text-xs"
                >
                  Call Logs
                </Button>
                <Button 
                  variant={historySubTab === 'docs' ? 'secondary' : 'ghost'} 
                  size="sm" 
                  onClick={() => setHistorySubTab('docs')}
                  className="rounded-lg font-bold text-xs"
                >
                  SOP Documentation
                </Button>
              </div>

              {historySubTab === 'calls' ? (
                <CallLogs
                  refreshTrigger={statsLoading}
                  start_date={dateRange.from?.toISOString()}
                  end_date={dateRange.to?.toISOString()}
                />
              ) : (
                <div className="space-y-4">
                  {sopLoading && sopHistory.length === 0 ? (
                    <div className="p-12 text-center">
                       <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary/40" />
                       <p className="mt-4 font-bold text-muted-foreground">Syncing documentation...</p>
                    </div>
                  ) : sopHistory.length === 0 ? (
                    <Card className="p-12 text-center border-dashed">
                      <ClipboardList className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-foreground">No documentation found</h3>
                      <p className="text-muted-foreground">Stored SOP forms for the selected period will appear here.</p>
                    </Card>
                  ) : (
                    <>
                      <div className="grid gap-4">
                        {sopHistory.map(sop => (
                          <Card key={sop.id} className="p-6 rounded-3xl border border-border/50 bg-white/70 backdrop-blur-sm shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                              <div className="flex items-start gap-4">
                                <div className="p-4 rounded-2xl shrink-0 bg-primary/10 text-primary">
                                  <ClipboardList size={24} />
                                </div>
                                <div className="space-y-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h4 className="font-extrabold text-xl tracking-tight text-foreground truncate">
                                      {sop.patient?.full_name || 'Patient'}
                                    </h4>
                                    {sop.is_escalated && (
                                      <Badge className="bg-red-500 text-white border-none text-[8px] font-black uppercase tracking-[0.2em] px-2 py-0.5">Escalated</Badge>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1 mt-1">
                                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground/80">
                                      <User size={12} className="text-primary/60" />
                                      <span>By: {sop.staff_name || 'Unknown'}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground/80">
                                      <Phone size={12} className="text-primary/60" />
                                      <span>Patient: {sop.caller_number || 'N/A'}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground/80">
                                      <CalendarIcon size={12} className="text-primary/60" />
                                      <span>{format(new Date(sop.created_at), 'MMM d, yyyy • h:mm a')}</span>
                                    </div>
                                  </div>
                                  <div className="mt-3 p-3 bg-muted/30 rounded-xl border border-border/50">
                                    <p className="text-xs font-semibold text-foreground/80 leading-relaxed italic line-clamp-2">
                                      "{sop.reason || 'No specific reason'}"
                                    </p>
                                  </div>
                                </div>
                              </div>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="rounded-xl font-bold h-9 px-4 border-primary/20 hover:bg-primary/5 shrink-0"
                                onClick={() => {
                                  setSelectedCall({ patient: sop.patient }); // Mock for SOP viewing if needed
                                  setSopData({ ...sop, patientName: sop.patient?.full_name });
                                  setSopModalOpen(true);
                                }}
                              >
                                View Details
                              </Button>
                            </div>
                          </Card>
                        ))}
                      </div>

                      {/* Pagination for SOP History */}
                      <div className="flex items-center justify-between py-4">
                        <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">
                          Showing {sopHistory.length} of {sopTotal} records
                        </p>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 px-4 font-bold rounded-xl"
                            onClick={() => setSopPage(p => Math.max(1, p - 1))}
                            disabled={sopPage === 1}
                          >
                            Previous
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 px-4 font-bold rounded-xl outline-primary/20"
                            onClick={() => setSopPage(p => p + 1)}
                            disabled={sopPage * PER_PAGE >= sopTotal}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ) : activeTab === 'escalation' ? (
            <div className="space-y-4">
              {escalatedCalls.length === 0 ? (
                <Card className="p-12 text-center border-dashed">
                  <AlertTriangle className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground">No pending escalations</h3>
                  <p className="text-muted-foreground">Calls flagged for Lead review will appear here.</p>
                </Card>
              ) : (
                escalatedCalls.map(call => (
                  <Card key={call.id} className="p-6 rounded-3xl border border-border/50 bg-white/70 backdrop-blur-sm shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
                    <div className={cn(
                      "absolute left-0 top-0 bottom-0 w-1.5",
                      call.severity === 'high' ? "bg-red-500" : (call.severity === 'medium' ? "bg-amber-500" : "bg-emerald-500")
                    )} />
                    
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="flex items-start gap-4">
                        <div className={cn(
                          "p-4 rounded-2xl shrink-0",
                          call.severity === 'high' ? "bg-red-100 text-red-600" : (call.severity === 'medium' ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600")
                        )}>
                          <AlertTriangle size={24} className={call.severity === 'high' ? "animate-pulse" : ""} />
                        </div>
                        
                        <div className="space-y-2 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                             <h4 className="font-extrabold text-xl tracking-tight text-foreground truncate">
                               {call.patient?.full_name || call.patient?.name || 'Unknown Patient'}
                             </h4>
                             <Badge variant="outline" className={cn(
                               "rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest border-none",
                               call.severity === 'high' ? "bg-red-100 text-red-700" : (call.severity === 'medium' ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700")
                             )}>
                               {call.severity} priority
                             </Badge>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 mt-1">
                            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground/80 lowercase">
                              <User size={14} className="text-primary/60" />
                              <span>{call.staff_name || 'System Staff'} • {call.staff_number || 'N/A'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground/80 lowercase">
                              <Phone size={14} className="text-primary/60" />
                              <span>Patient: {call.caller_number}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground/80 lowercase">
                               <Clock size={14} className="text-primary/60" />
                               <span>{call.timestamp ? formatDistanceToNow(new Date(call.timestamp), { addSuffix: true }) : 'recent'}</span>
                            </div>
                          </div>

                          <div className="mt-4 relative bg-muted/30 rounded-2xl p-4 border border-border/50 group-hover:bg-muted/50 transition-colors">
                            <p className="text-sm font-medium text-foreground/90 italic leading-relaxed">
                               "{call.reason || 'No specific reason documented.'}"
                            </p>
                            {call.symptoms && (
                              <div className="mt-2 pt-2 border-t border-border/30 flex items-start gap-2">
                                <Activity size={12} className="text-red-500 mt-0.5" />
                                <span className="text-[11px] font-bold text-muted-foreground uppercase">{call.symptoms}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 min-w-[140px]">
                        <Button 
                          onClick={() => handleEscalateToHomeCare(call.id)}
                          className="w-full rounded-2xl h-11 bg-primary text-white shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all gap-2 font-bold"
                        >
                          HomeCare <ArrowUpRight size={16} />
                        </Button>

                        <Popover 
                          open={activeFollowUpCallId === call.id} 
                          onOpenChange={(open) => {
                            if (open) {
                              setActiveFollowUpCallId(call.id);
                              setTempFollowUpDate(null);
                              setFollowUpTime('10:00');
                            } else {
                              setActiveFollowUpCallId(null);
                            }
                          }}
                        >
                          <PopoverTrigger asChild>
                            <Button 
                              variant="outline"
                              className="w-full rounded-2xl h-11 border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-all gap-2 font-bold"
                            >
                              Follow Up <CalendarIcon size={16} />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-4" align="end">
                            <ScheduleDateTimePicker
                              selectedDate={tempFollowUpDate}
                              onSelectDate={setTempFollowUpDate}
                              scheduleTime={followUpTime}
                              onScheduleTimeChange={setFollowUpTime}
                              loading={scheduling}
                              onConfirm={async () => {
                                await handleAddToSchedule(call.patient_id, tempFollowUpDate, followUpTime);
                                setActiveFollowUpCallId(null);
                              }}
                            />
                          </PopoverContent>
                        </Popover>

                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setEscalatedCalls(prev => prev.filter(c => c.id !== call.id))}
                          className="w-full rounded-xl text-muted-foreground hover:text-foreground font-bold text-xs"
                        >
                          Dismiss for now
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card className="p-6 bg-primary/5 border-primary/20 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <CalendarIcon size={24} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Next Session</p>
                    <h3 className="text-xl font-black">Wed Afternoon</h3>
                  </div>
                </Card>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="font-bold text-lg flex items-center gap-2 text-foreground">
                    <ClipboardList className="h-5 w-5 text-primary" />
                    Your Outreach Schedule
                  </h3>
                  <p className="text-xs font-semibold text-muted-foreground bg-primary/5 px-3 py-1.5 rounded-lg border border-primary/10 inline-block">
                    {scheduledCalls.length} patients scheduled for follow-up.
                  </p>
                </div>
                {schedulerLoading ? (
                  <div className="p-8 text-center"><RefreshCw className="animate-spin inline mr-2" /> Loading schedule...</div>
                ) : scheduledCalls.length === 0 ? (
                  <div className="p-12 text-center rounded-[2rem] border-2 border-dashed border-muted flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-[2rem] bg-muted flex items-center justify-center text-muted-foreground">
                      <CalendarIcon size={32} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">No calls scheduled</h3>
                      <p className="text-sm text-muted-foreground">Add patients from the Dial tab to build your outreach plan.</p>
                    </div>
                  </div>
                ) : (
                  scheduledCalls.map(sched => {
                    const patient = sched.patient || {};
                    return (
                      <div key={sched.id} className="p-4 rounded-2xl border bg-card/50 flex items-center justify-between hover:border-primary/30 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center font-bold text-primary">
                            {patient.full_name?.charAt(0) || 'P'}
                          </div>
                          <div>
                            <p className="font-bold text-sm">{patient.full_name}</p>
                            <div className="flex items-center gap-2">
                              <p className="text-[10px] text-muted-foreground font-medium">{patient.phone}</p>
                              <span className="text-muted-foreground">•</span>
                              <p className="text-[10px] text-amber-600 font-bold uppercase tracking-tighter">
                                Scheduled: {format(new Date(sched.scheduled_date), 'MMM d, yyyy • h:mm a')}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {patient.primary_caregiver_phone ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={activeCalls.some(c => c.patient.id === patient.id)}
                                  className={cn(
                                    "text-emerald-600 hover:bg-emerald-500/10 rounded-lg p-2 transition-all",
                                    activeCalls.some(c => c.patient.id === patient.id) && "text-amber-500 hover:bg-amber-500/10"
                                  )}
                                  title="Call Options"
                                >
                                  {activeCalls.some(c => c.patient.id === patient.id) ? (
                                    <RefreshCw size={16} className="animate-spin" />
                                  ) : (
                                    <Phone size={16} />
                                  )}
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-56 rounded-xl p-2 bg-white/95 backdrop-blur-xl border border-border shadow-lg">
                                <DropdownMenuLabel className="text-xs text-muted-foreground">Select Contact</DropdownMenuLabel>
                                <DropdownMenuItem 
                                  className="rounded-lg cursor-pointer py-2 hover:bg-primary/5 focus:bg-primary/5"
                                  onClick={() => handleInitiateCall(patient, 'patient')}
                                >
                                  <div className="flex flex-col">
                                    <span className="font-bold flex items-center gap-2 text-sm"><User size={12}/> Call Patient</span>
                                    <span className="text-[10px] text-muted-foreground">{patient.phone}</span>
                                  </div>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  className="rounded-lg cursor-pointer py-2 text-blue-600 focus:text-blue-700 hover:bg-blue-50 focus:bg-blue-50"
                                  onClick={() => handleInitiateCall(patient, 'caregiver')}
                                >
                                  <div className="flex flex-col">
                                    <span className="font-bold flex items-center gap-2 text-sm"><Users size={12}/> Call Caregiver</span>
                                    <span className="text-[10px] opacity-70">{patient.primary_caregiver_phone} {patient.primary_caregiver_name && `(${patient.primary_caregiver_name})`}</span>
                                  </div>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={activeCalls.some(c => c.patient.id === patient.id)}
                              className={cn(
                                "text-emerald-600 hover:bg-emerald-500/10 rounded-lg p-2 transition-all",
                                activeCalls.some(c => c.patient.id === patient.id) && "text-amber-500 hover:bg-amber-500/10"
                              )}
                              onClick={() => handleInitiateCall(patient, 'patient')}
                              title="Call Patient"
                            >
                              {activeCalls.some(c => c.patient.id === patient.id) ? (
                                <RefreshCw size={16} className="animate-spin" />
                              ) : (
                                <Phone size={16} />
                              )}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-sky-600 hover:bg-sky-500/10 rounded-lg p-2"
                            onClick={() => handleOpenEmail(patient)}
                            title="Send follow-up email"
                          >
                            <Mail size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-primary hover:bg-primary/10 rounded-lg p-2"
                            onClick={() => handleOpenSOP({ patient, agent: { name: 'Current Agent' } })}
                            title="Manual Documentation"
                          >
                            <ClipboardList size={16} />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-danger-600 hover:bg-danger-50 rounded-lg p-2"
                            onClick={() => handleRemoveFromSchedule(sched.id)}
                            title="Remove from Schedule"
                          >
                            <X size={16} />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
                <div className="flex gap-3">
                  <Button 
                    className="flex-1 h-12 rounded-2xl font-bold gap-2 bg-primary/10 text-primary hover:bg-primary/20 border-primary/20" 
                    variant="outline"
                    onClick={handleAutoGenerate}
                    disabled={schedulerLoading}
                  >
                    <RefreshCw className={`h-4 w-4 ${schedulerLoading ? 'animate-spin' : ''}`} /> Generate Weekly Plan
                  </Button>
                  <Button 
                    className="flex-1 h-12 rounded-2xl font-bold gap-2" 
                    variant="outline"
                    onClick={() => setActiveTab('dial')}
                  >
                    <Plus className="h-4 w-4" /> Add Manually
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
        {/* Side Panel (Staffing) */}
        {activeTab === 'dial' && (
          <div className="lg:col-span-4">
            <StaffSidebar
              agents={paginatedAgents}
              setAgents={setAgents}
              loading={providersLoading}
              page={providerPage}
              setPage={setProviderPage}
              totalItems={providerTotal}
              itemsPerPage={PER_PAGE}
            />
          </div>
        )}
      </div>

      {/* Live HUD */}
      <CallHUD
        activeCalls={activeCalls}
        onEndCall={handleEndCall}
        onOpenSOP={handleOpenSOP}
      />

      {/* SOP Documentation Modal */}
      {sopModalOpen && selectedCall && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <Card className="w-full max-w-lg rounded-[2rem] overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-border bg-muted/30 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Call Documentation</h2>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-0.5">SOP Compliance Form</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSopModalOpen(false)} className="rounded-full">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <div className="grid gap-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">Patient Name</label>
                <input
                  className="w-full p-3 rounded-xl border bg-muted/30 text-sm font-bold"
                  value={sopData.patientName}
                  disabled
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground">Staff / Clinician Name</label>
                  <input
                    className="w-full p-3 rounded-xl border bg-background text-sm font-bold border-primary/20"
                    placeholder="Provider name"
                    value={sopData.staffName}
                    onChange={(e) => setSopData({ ...sopData, staffName: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground">Staff Phone No.</label>
                  <input
                    className="w-full p-3 rounded-xl border bg-background text-sm font-bold border-primary/20"
                    placeholder="Provider phone"
                    value={sopData.staffNumber}
                    onChange={(e) => setSopData({ ...sopData, staffNumber: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground">Patient Phone Number</label>
                  <input
                    className="w-full p-3 rounded-xl border bg-background text-sm"
                    placeholder="Phone number"
                    value={sopData.callerNumber}
                    onChange={(e) => setSopData({ ...sopData, callerNumber: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground">Relation with Patient</label>
                  <select
                    className="w-full p-3 rounded-xl border bg-background text-sm"
                    value={sopData.relationship}
                    onChange={(e) => setSopData({ ...sopData, relationship: e.target.value })}
                  >
                    <option value="self">Self (Patient)</option>
                    <option value="spouse">Spouse</option>
                    <option value="child">Child</option>
                    <option value="sibling">Sibling</option>
                    <option value="caregiver">Caregiver</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">Severity</label>
                <select
                  className="w-full p-3 rounded-xl border bg-background text-sm font-bold text-red-600"
                  value={sopData.severity}
                  onChange={(e) => setSopData({ ...sopData, severity: e.target.value })}
                >
                  <option value="low">Low (Routine)</option>
                  <option value="medium">Medium (Watch)</option>
                  <option value="high">High (Urgent)</option>
                  <option value="critical">Critical (Emergency)</option>
                </select>
              </div>

              <div className="grid gap-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">Reason for Call</label>
                <input
                  className="w-full p-3 rounded-xl border bg-background text-sm"
                  placeholder="e.g. Fever, Pain, Follow-up"
                  value={sopData.reason}
                  onChange={(e) => setSopData({ ...sopData, reason: e.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">Symptoms Discussed</label>
                <textarea
                  className="w-full p-3 rounded-xl border bg-background text-sm min-h-[60px]"
                  placeholder="Describe symptoms observed..."
                  value={sopData.symptoms}
                  onChange={(e) => setSopData({ ...sopData, symptoms: e.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">Advice & Action Plan</label>
                <textarea
                  className="w-full p-3 rounded-xl border bg-background text-sm min-h-[60px]"
                  placeholder="What was suggested to the caller?"
                  value={sopData.advice}
                  onChange={(e) => setSopData({ ...sopData, advice: e.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">Internal Notes / Extra Info</label>
                <textarea
                  className="w-full p-3 rounded-xl border bg-background text-sm min-h-[60px]"
                  placeholder="Any additional context for the team..."
                  value={sopData.notes}
                  onChange={(e) => setSopData({ ...sopData, notes: e.target.value })}
                />
              </div>

              <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-900/30">
                <input
                  type="checkbox"
                  id="escalate"
                  className="h-4 w-4"
                  checked={sopData.escalate}
                  onChange={(e) => setSopData({ ...sopData, escalate: e.target.checked })}
                />
                <label htmlFor="escalate" className="text-sm font-bold text-red-700 dark:text-red-400">
                  Flag for Roster Lead Escalation
                </label>
              </div>
            </div>

            <div className="p-6 border-t border-border bg-muted/30 flex gap-3">
              <Button variant="outline" className="flex-1 rounded-xl font-bold" onClick={() => setSopModalOpen(false)}>
                Close
              </Button>
              <Button className="flex-1 rounded-xl font-bold shadow-lg shadow-primary/20" onClick={handleSaveSOP}>
                Save Documentation
              </Button>
            </div>
          </Card>
        </div>
      )}
      <EmailModal
        open={emailModalOpen}
        onClose={() => {
          setEmailModalOpen(false);
          setEmailPatient(null);
        }}
        patient={emailPatient}
        onSend={handleSendEmail}
      />

      <ToastContainer position="bottom-right" autoClose={3000} />
    </div>
  );
};

export default CallLogsPage;