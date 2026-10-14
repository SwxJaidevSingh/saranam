import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Clock,
  Stethoscope,
  Activity,
  FileText,
  FlaskConical,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Plus,
  Trash2,
  Save,
  ChevronDown,
  ChevronUp,
  MapPin,
  Navigation,
  Home,
} from 'lucide-react';
import homecareApi from '../../api/homecare';
import {
  FREQUENCY_OPTIONS, ROUTE_OPTIONS as SHARED_ROUTE_OPTIONS, DOSAGE_AMOUNTS,
  INSTRUCTION_OPTIONS, MEDICINE_TYPE_OPTIONS, DOSAGE_FORM_OPTIONS,
  DURATION_OPTIONS as SHARED_DURATION_OPTIONS, normalizeFrequency,
} from '../../constants/prescription';
import DownloadReportButton from '../../components/common/DownloadReportButton';
import NursingAssessmentSection from '../opd/NursingAssessmentSection';
import HomeCareAssessmentSection from './HomeCareAssessmentSection';
import GPSCheckInSection from './GPSCheckInSection';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  scheduled:       { label: 'Scheduled',       color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200',     step: 0 },
  confirmed:       { label: 'Confirmed',       color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200',     step: 0 },
  checked_in:      { label: 'Checked In',      color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200', step: 2 },
  vitals_recorded: { label: 'Vitals Recorded', color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200', step: 2 },
  in_consultation: { label: 'In Session',      color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200', step: 2 },
  completed:       { label: 'Completed',       color: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200',  step: 3 },
  no_show:         { label: 'No Show',         color: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200',         step: -1 },
  cancelled:       { label: 'Cancelled',       color: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',        step: -1 },
};

const STEPS = [
  { key: 'navigate',    label: 'Navigate',    icon: Navigation },
  { key: 'gps-checkin', label: 'GPS Check-In', icon: MapPin },
  { key: 'assessment',  label: 'Assessment',   icon: Activity },
  { key: 'complete',    label: 'Complete',     icon: CheckCircle },
];

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.scheduled;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function formatDate(iso) {
  if (!iso) return '\u2014';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDOB(dob) {
  if (!dob) return null;
  const d = new Date(dob);
  const age = Math.floor((Date.now() - d) / (365.25 * 24 * 3600 * 1000));
  return `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} (${age}y)`;
}

// Determine step based on visit status and GPS check-in status
function getStep(visit) {
  const status = visit.status;
  const hasGpsCheckIn = !!visit.service_metadata?.gps_checkin;

  if (['no_show', 'cancelled'].includes(status)) return -1;
  if (status === 'completed') return 3;
  if (['in_consultation', 'vitals_recorded'].includes(status)) return 2;
  if (status === 'checked_in') return hasGpsCheckIn ? 2 : 1;
  // scheduled/confirmed
  if (hasGpsCheckIn) return 2;
  return 0;
}

// ──────────────────────────────────────────────────────────────────────────────
// Progress stepper
// ──────────────────────────────────────────────────────────────────────────────
function ProgressStepper({ currentStep }) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, i) => {
        const Icon = step.icon;
        const done = currentStep > i;
        const active = currentStep === i;
        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-colors
                ${done   ? 'bg-success-600 border-success-600 text-white' :
                  active ? 'bg-primary-600 border-primary-600 text-white' :
                           'bg-background border-border text-muted-foreground'}`}>
                <Icon className="w-4 h-4" />
              </div>
              <span className={`mt-1 text-xs font-medium hidden sm:block
                ${done || active ? 'text-foreground' : 'text-muted-foreground'}`}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-0.5 w-8 sm:w-16 mx-1 transition-colors
                ${currentStep > i ? 'bg-success-600' : 'bg-border'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Section wrapper
// ──────────────────────────────────────────────────────────────────────────────
function Section({ title, icon: Icon, children, defaultOpen = true, badge }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden shadow-sm">
      <button
        className="w-full px-6 py-4 flex items-center justify-between border-b border-border bg-muted/30 hover:bg-muted/50 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
          <span className="font-semibold text-foreground text-sm">{title}</span>
          {badge && (
            <span className="ml-2 px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs rounded-full">
              {badge}
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="p-6">{children}</div>}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Prescription section
// ──────────────────────────────────────────────────────────────────────────────
const FREQ_OPTIONS = FREQUENCY_OPTIONS;
const ROUTE_OPTIONS = SHARED_ROUTE_OPTIONS;
const DURATION_OPTIONS = SHARED_DURATION_OPTIONS;

function PrescriptionSection({ visit, onSaved }) {
  const existingRx = visit.prescription;
  const [items, setItems] = useState(
    (existingRx?.items || []).map(i => {
      let durDisplay = i.duration || '7 days';
      if (typeof i.duration === 'number') {
        const unit = i.duration_unit || 'days';
        durDisplay = unit === 'ongoing' ? 'Ongoing' : `${i.duration} ${unit}`;
      }
      return {
        medicine_name: i.medicine_name || '',
        dosage: i.dosage || '',
        frequency: normalizeFrequency(i.frequency) || 'OD',
        duration: durDisplay,
        route: i.route || 'oral',
        instructions: i.instructions || '',
        dosage_morning: i.dosage_morning || '0',
        dosage_afternoon: i.dosage_afternoon || '0',
        dosage_night: i.dosage_night || '0',
        sos: !!i.sos,
        medicine_type: i.medicine_type || '',
        dosage_form: i.dosage_form || '',
        warning_signs: i.warning_signs || '',
      };
    })
  );
  const [notes, setNotes] = useState(existingRx?.notes || '');
  const [saving, setSaving] = useState(false);
  const isClosed = ['completed', 'no_show', 'cancelled'].includes(visit.status);

  const addRow = () => setItems(p => [...p, {
    medicine_name: '', dosage: '', frequency: 'OD', duration: '7 days', route: 'oral', instructions: '',
    dosage_morning: '0', dosage_afternoon: '0', dosage_night: '0',
    sos: false, medicine_type: '', dosage_form: '', warning_signs: '',
  }]);
  const removeRow = (i) => setItems(p => p.filter((_, idx) => idx !== i));
  const update = (i, field, val) => setItems(p => p.map((row, idx) => idx === i ? { ...row, [field]: val } : row));

  const handleSave = async () => {
    if (items.some(i => !i.medicine_name.trim())) {
      alert('All items must have a medicine name');
      return;
    }
    setSaving(true);
    try {
      const parsedItems = items.map(item => {
        const dur = item.duration || '';
        let duration = null;
        let duration_unit = 'days';
        if (dur === 'Ongoing') {
          duration = 0;
          duration_unit = 'ongoing';
        } else {
          const match = dur.match(/^(\d+)\s*(.+)$/);
          if (match) {
            duration = parseInt(match[1]);
            duration_unit = match[2].trim();
          }
        }
        return { ...item, duration, duration_unit };
      });
      await homecareApi.savePrescription(visit.id, { items: parsedItems, notes });
      onSaved();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save prescription');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      {items.length === 0 && !isClosed && (
        <p className="text-sm text-muted-foreground">No medications added yet.</p>
      )}
      {items.map((row, i) => (
        <div key={i} className="p-3 bg-muted/20 rounded-lg border border-border space-y-2">
          {/* Row 1 */}
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-4">
              <label className="block text-xs text-muted-foreground mb-1">Medicine *</label>
              <input type="text" placeholder="e.g. Paracetamol 500mg" value={row.medicine_name} onChange={e => update(i, 'medicine_name', e.target.value)} disabled={isClosed}
                className="w-full px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm disabled:opacity-60" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-muted-foreground mb-1">Dosage Form</label>
              <select value={row.dosage_form} onChange={e => update(i, 'dosage_form', e.target.value)} disabled={isClosed}
                className="w-full px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm disabled:opacity-60">
                <option value="">Select</option>
                {DOSAGE_FORM_OPTIONS.filter(o => o.value).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-muted-foreground mb-1">Frequency</label>
              <select value={row.frequency} onChange={e => update(i, 'frequency', e.target.value)} disabled={isClosed}
                className="w-full px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm disabled:opacity-60">
                <option value="">Select</option>
                {FREQ_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="col-span-1">
              <label className="block text-xs text-muted-foreground mb-1">SOS</label>
              <div className="flex items-center h-[34px]">
                <input type="checkbox" checked={!!row.sos} onChange={e => update(i, 'sos', e.target.checked)} disabled={isClosed}
                  className="h-4 w-4 border border-border rounded bg-background text-primary-600 disabled:opacity-60" />
              </div>
            </div>
            <div className="col-span-1">
              <label className="block text-xs text-muted-foreground mb-1">Route</label>
              <select value={row.route} onChange={e => update(i, 'route', e.target.value)} disabled={isClosed}
                className="w-full px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm disabled:opacity-60">
                <option value="">Select</option>
                {ROUTE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-muted-foreground mb-1">Medicine Type</label>
              <select value={row.medicine_type} onChange={e => update(i, 'medicine_type', e.target.value)} disabled={isClosed}
                className="w-full px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm disabled:opacity-60">
                <option value="">Select</option>
                {MEDICINE_TYPE_OPTIONS.filter(o => o.value).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          {/* Row 2 */}
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-2">
              <label className="block text-xs text-muted-foreground mb-1">Duration</label>
              <select value={row.duration} onChange={e => update(i, 'duration', e.target.value)} disabled={isClosed}
                className="w-full px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm disabled:opacity-60">
                {DURATION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-muted-foreground mb-1">Instructions</label>
              <select value={row.instructions} onChange={e => update(i, 'instructions', e.target.value)} disabled={isClosed}
                className="w-full px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm disabled:opacity-60">
                <option value="">Select</option>
                {INSTRUCTION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="col-span-1">
              <label className="block text-xs text-muted-foreground mb-1">Morning</label>
              <select value={row.dosage_morning || '0'} onChange={e => update(i, 'dosage_morning', e.target.value)} disabled={isClosed}
                className="w-full px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm disabled:opacity-60">
                {DOSAGE_AMOUNTS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="col-span-1">
              <label className="block text-xs text-muted-foreground mb-1">Afternoon</label>
              <select value={row.dosage_afternoon || '0'} onChange={e => update(i, 'dosage_afternoon', e.target.value)} disabled={isClosed}
                className="w-full px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm disabled:opacity-60">
                {DOSAGE_AMOUNTS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="col-span-1">
              <label className="block text-xs text-muted-foreground mb-1">Night</label>
              <select value={row.dosage_night || '0'} onChange={e => update(i, 'dosage_night', e.target.value)} disabled={isClosed}
                className="w-full px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm disabled:opacity-60">
                {DOSAGE_AMOUNTS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="col-span-4">
              <label className="block text-xs text-muted-foreground mb-1">Warning Signs</label>
              <input type="text" placeholder="e.g. Stop if rash appears" value={row.warning_signs || ''} onChange={e => update(i, 'warning_signs', e.target.value)} disabled={isClosed}
                className="w-full px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm disabled:opacity-60" />
            </div>
            {!isClosed && (
              <div className="col-span-1 flex items-end pb-0.5">
                <button onClick={() => removeRow(i)} className="p-1.5 text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Prescription Notes</label>
        <textarea rows={2} placeholder="Additional notes for the prescription..." value={notes} onChange={e => setNotes(e.target.value)} disabled={isClosed}
          className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm disabled:opacity-60 resize-none" />
      </div>
      {!isClosed && (
        <div className="flex justify-between">
          <button onClick={addRow} className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700">
            <Plus className="h-4 w-4" /> Add Medicine
          </button>
          {items.length > 0 && (
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm disabled:opacity-50">
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Prescription
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Lab Orders section
// ──────────────────────────────────────────────────────────────────────────────
function LabOrdersSection({ visit, onSaved }) {
  const existingOrder = visit.lab_order;
  const [items, setItems] = useState(
    (existingOrder?.items || []).map(i => ({
      test_name: i.test_name || '',
      urgency: i.urgency || 'routine',
      notes: i.notes || '',
    }))
  );
  const [orderNotes, setOrderNotes] = useState(existingOrder?.notes || '');
  const [saving, setSaving] = useState(false);
  const isClosed = ['completed', 'no_show', 'cancelled'].includes(visit.status);

  const addRow = () => setItems(p => [...p, { test_name: '', urgency: 'routine', notes: '' }]);
  const removeRow = (i) => setItems(p => p.filter((_, idx) => idx !== i));
  const update = (i, field, val) => setItems(p => p.map((row, idx) => idx === i ? { ...row, [field]: val } : row));

  const handleSave = async () => {
    if (items.some(i => !i.test_name.trim())) {
      alert('All tests must have a name');
      return;
    }
    setSaving(true);
    try {
      await homecareApi.saveLabOrder(visit.id, { items, notes: orderNotes });
      onSaved();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save lab orders');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      {items.length === 0 && !isClosed && (
        <p className="text-sm text-muted-foreground">No lab tests ordered yet.</p>
      )}
      {items.map((row, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 items-end p-3 bg-muted/20 rounded-lg border border-border">
          <div className="col-span-5">
            <label className="block text-xs text-muted-foreground mb-1">Test Name *</label>
            <input type="text" placeholder="e.g. CBC, CRP, X-ray" value={row.test_name} onChange={e => update(i, 'test_name', e.target.value)} disabled={isClosed}
              className="w-full px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm disabled:opacity-60" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-muted-foreground mb-1">Urgency</label>
            <select value={row.urgency} onChange={e => update(i, 'urgency', e.target.value)} disabled={isClosed}
              className="w-full px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm disabled:opacity-60">
              <option value="routine">Routine</option>
              <option value="urgent">Urgent</option>
              <option value="stat">STAT</option>
            </select>
          </div>
          <div className="col-span-4">
            <label className="block text-xs text-muted-foreground mb-1">Notes</label>
            <input type="text" placeholder="Any special instructions" value={row.notes} onChange={e => update(i, 'notes', e.target.value)} disabled={isClosed}
              className="w-full px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm disabled:opacity-60" />
          </div>
          {!isClosed && (
            <div className="col-span-1 flex justify-end">
              <button onClick={() => removeRow(i)} className="p-1.5 text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      ))}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Order Notes</label>
        <textarea rows={2} placeholder="Clinical context or special instructions..." value={orderNotes} onChange={e => setOrderNotes(e.target.value)} disabled={isClosed}
          className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm disabled:opacity-60 resize-none" />
      </div>
      {!isClosed && (
        <div className="flex justify-between">
          <button onClick={addRow} className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700">
            <Plus className="h-4 w-4" /> Add Test
          </button>
          {items.length > 0 && (
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm disabled:opacity-50">
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Lab Orders
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Complete visit panel
// ──────────────────────────────────────────────────────────────────────────────
function CompleteVisitSection({ visit, onSaved }) {
  const [followUp, setFollowUp] = useState(visit.follow_up_required || false);
  const [followUpDate, setFollowUpDate] = useState(visit.follow_up_scheduled_at ? visit.follow_up_scheduled_at.split('T')[0] : '');
  const [notes, setNotes] = useState(visit.post_appointment_notes || '');
  const [saving, setSaving] = useState(false);
  const isCompleted = visit.status === 'completed';

  const handleComplete = async () => {
    if (!window.confirm('Mark this visit as completed?')) return;
    setSaving(true);
    try {
      await homecareApi.completeVisit(visit.id, {
        follow_up_required: followUp,
        follow_up_date: followUp && followUpDate ? followUpDate : null,
        final_notes: notes,
      });
      onSaved();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to complete visit');
    } finally {
      setSaving(false);
    }
  };

  if (isCompleted) {
    return (
      <div className="flex items-center gap-3 p-4 bg-success-50 dark:bg-success-900/20 rounded-lg border border-success-200 dark:border-success-800">
        <CheckCircle className="h-6 w-6 text-success-600 dark:text-success-400 flex-shrink-0" />
        <div className="flex-1">
          <p className="font-semibold text-success-800 dark:text-success-200">Visit Completed</p>
          {visit.post_appointment_notes && (
            <p className="text-sm text-success-700 dark:text-success-300 mt-0.5">{visit.post_appointment_notes}</p>
          )}
          {visit.follow_up_required && visit.follow_up_scheduled_at && (
            <p className="text-sm text-success-700 dark:text-success-300 mt-0.5">
              Follow-up: {new Date(visit.follow_up_scheduled_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          )}
        </div>
        <DownloadReportButton visit={visit} visitType="HOME_CARE" />
      </div>
    );
  }

  const canComplete = ['in_consultation', 'vitals_recorded', 'checked_in'].includes(visit.status);

  return (
    <div className="space-y-4">
      {!canComplete && (
        <div className="flex items-center gap-2 p-3 bg-warning-50 dark:bg-warning-900/20 rounded-lg border border-warning-200 dark:border-warning-800 text-sm text-warning-700 dark:text-warning-300">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          Patient must be checked in before completing the visit.
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Post-visit Notes</label>
        <textarea rows={2} placeholder="Summary, instructions given, care plan updates..." value={notes} onChange={e => setNotes(e.target.value)} disabled={!canComplete}
          className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm disabled:opacity-60 resize-none" />
      </div>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <input type="checkbox" id="followup" checked={followUp} onChange={e => setFollowUp(e.target.checked)} disabled={!canComplete} className="h-4 w-4 rounded border-border" />
          <label htmlFor="followup" className="text-sm font-medium text-foreground">Schedule follow-up</label>
        </div>
        {followUp && (
          <div className="ml-7 space-y-2">
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'After 3 days', days: 3 },
                { label: 'After 7 days', days: 7 },
                { label: 'After 15 days', days: 15 },
                { label: 'After 1 month', days: 30 },
                { label: 'After 2 months', days: 60 },
                { label: 'After 3 months', days: 90 },
              ].map(opt => {
                const d = new Date();
                d.setDate(d.getDate() + opt.days);
                const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                const isActive = followUpDate === dateStr;
                return (
                  <button key={opt.days} type="button" onClick={() => setFollowUpDate(dateStr)}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-colors
                      ${isActive ? 'bg-primary-600 text-white border-primary-600' : 'bg-background text-foreground border-border hover:bg-accent'}`}>
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Or pick a date:</span>
              <input type="date" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)} min={new Date().toISOString().split('T')[0]}
                className="px-3 py-1.5 border border-border rounded-lg bg-background text-foreground text-sm" />
              {followUpDate && (
                <span className="text-xs text-muted-foreground">
                  ({new Date(followUpDate).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })})
                </span>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="flex justify-end">
        <button onClick={handleComplete} disabled={saving || !canComplete}
          className="flex items-center gap-2 px-5 py-2 bg-success-600 text-white rounded-lg hover:bg-success-700 text-sm font-medium disabled:opacity-50">
          {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
          Complete Visit
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Main page
// ──────────────────────────────────────────────────────────────────────────────
export default function HomeCareVisitDetail() {
  const { visitId } = useParams();

  const [visit, setVisit] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadVisit = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await homecareApi.getVisit(visitId);
      setVisit(data);
      setError(null);
    } catch (err) {
      setError('Failed to load visit details');
    } finally {
      setIsLoading(false);
    }
  }, [visitId]);

  useEffect(() => { loadVisit(); }, [loadVisit]);

  const handleNoShow = async () => {
    if (!window.confirm('Mark this patient as no-show?')) return;
    setActionLoading(true);
    try {
      await homecareApi.markNoShow(visitId);
      await loadVisit();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to mark no-show');
    } finally {
      setActionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading visit...</p>
        </div>
      </div>
    );
  }

  if (error || !visit) {
    return (
      <div className="p-6">
        <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg p-4 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-danger-600" />
          <span className="text-danger-800 dark:text-danger-200">{error || 'Visit not found'}</span>
        </div>
        <Link to="/homecare/queue" className="mt-4 inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700">
          <ArrowLeft className="h-4 w-4" /> Back to Queue
        </Link>
      </div>
    );
  }

  const isActive = !['completed', 'no_show', 'cancelled'].includes(visit.status);
  const step = getStep(visit);
  const patientAddress = visit.patient_address || visit.service_metadata?.patient_location?.address || visit.notes;

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      {/* Back link */}
      <Link to="/homecare/queue" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Queue
      </Link>

      {/* Patient info bar */}
      <div className="bg-card rounded-lg border border-border p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
              <span className="text-xl font-bold text-primary-700 dark:text-primary-300">
                {visit.patient_name?.charAt(0) || '?'}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-foreground">{visit.patient_name || 'Unknown Patient'}</h1>
                <StatusBadge status={visit.status} />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-sm text-muted-foreground">
                {visit.patient_dob && (
                  <span className="flex items-center gap-1">
                    <User className="h-3.5 w-3.5" />
                    {formatDOB(visit.patient_dob)}
                    {visit.patient_gender && ` \u00B7 ${visit.patient_gender}`}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDate(visit.start_time)}
                </span>
                {visit.provider_name && (
                  <span className="flex items-center gap-1">
                    <Stethoscope className="h-3.5 w-3.5" />
                    {visit.provider_name}
                    {visit.provider_specialization && ` \u00B7 ${visit.provider_specialization}`}
                  </span>
                )}
                {visit.encounter_number && (
                  <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                    #{visit.encounter_number}
                  </span>
                )}
              </div>
              {patientAddress && (
                <p className="mt-1.5 text-sm text-foreground flex items-start gap-1">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <span><span className="text-muted-foreground">Address: </span>{patientAddress}</span>
                </p>
              )}
              {visit.chief_complaint && (
                <p className="mt-1 text-sm text-foreground">
                  <span className="text-muted-foreground">Chief complaint: </span>
                  {visit.chief_complaint}
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          {isActive && (
            <div className="flex gap-2 flex-shrink-0">
              {['scheduled', 'confirmed'].includes(visit.status) && (
                <button onClick={handleNoShow} disabled={actionLoading}
                  className="flex items-center gap-1.5 px-3 py-2 border border-danger-300 dark:border-danger-700 text-danger-600 dark:text-danger-400 rounded-lg text-sm hover:bg-danger-50 dark:hover:bg-danger-900/20 disabled:opacity-50">
                  No Show
                </button>
              )}
              <button onClick={loadVisit} className="p-2 border border-border rounded-lg hover:bg-accent" title="Refresh">
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          )}
        </div>

        {/* Progress stepper */}
        {visit.status !== 'cancelled' && visit.status !== 'no_show' && (
          <div className="mt-5 pt-4 border-t border-border flex justify-center">
            <ProgressStepper currentStep={step} />
          </div>
        )}
      </div>

      {/* Navigation & GPS Check-In -- always visible for active visits */}
      {isActive && (
        <Section title="Navigation & GPS Check-In" icon={Navigation} defaultOpen={step < 2}>
          <GPSCheckInSection visit={visit} onCheckInSuccess={loadVisit} />
        </Section>
      )}

      {/* Nursing Assessment -- unlocked after check-in */}
      {step >= 2 && (
        <Section title="Nursing Assessment" icon={Activity} badge={visit.vitals?.length > 0 ? 'Recorded' : null}>
          <NursingAssessmentSection key={`na-${visit.vitals?.[0]?.updated_at || 'new'}`} visit={visit} onSaved={loadVisit} apiOverride={homecareApi} />
        </Section>
      )}

      {/* Home Care Assessment -- replaces Physio/Doctor Assessment */}
      {step >= 2 && (
        <>
          <Section
            title="Home Care Assessment"
            icon={Home}
            badge={visit.diagnoses?.length > 0 ? `${visit.diagnoses.length} dx` : null}
            defaultOpen={step >= 2}
          >
            <HomeCareAssessmentSection key={`hca-${visit.service_metadata?.homecare_assessment ? 'saved' : 'new'}-${visit.updated_at}`} visit={visit} onSaved={loadVisit} />
          </Section>

          <Section
            title="Prescription"
            icon={FileText}
            badge={visit.prescription?.items?.length > 0 ? `${visit.prescription.items.length} med${visit.prescription.items.length !== 1 ? 's' : ''}` : null}
            defaultOpen={false}
          >
            <PrescriptionSection visit={visit} onSaved={loadVisit} />
          </Section>


          <Section
            title="Lab Orders"
            icon={FlaskConical}
            badge={visit.lab_order?.items?.length > 0 ? `${visit.lab_order.items.length} test${visit.lab_order.items.length !== 1 ? 's' : ''}` : null}
            defaultOpen={false}
          >
            <LabOrdersSection visit={visit} onSaved={loadVisit} />
          </Section>
        </>
      )}

      {/* Complete visit */}
      {step >= 2 && (
        <Section title="Complete Visit" icon={CheckCircle} defaultOpen={step >= 3}>
          <CompleteVisitSection visit={visit} onSaved={loadVisit} />
        </Section>
      )}

      {/* Pre-check-in placeholder */}
      {step < 2 && visit.status !== 'cancelled' && visit.status !== 'no_show' && (
        <div className="bg-card rounded-lg border border-border p-8 text-center shadow-sm">
          <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-lg font-medium text-foreground">Waiting for GPS Check-In</p>
          <p className="text-muted-foreground text-sm mt-1">Navigate to the patient and complete GPS check-in to unlock the assessment</p>
        </div>
      )}
    </div>
  );
}
