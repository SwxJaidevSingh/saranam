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
} from 'lucide-react';
import physioApi from '../../api/physiotherapy';
import {
  FREQUENCY_OPTIONS, ROUTE_OPTIONS as SHARED_ROUTE_OPTIONS, DOSAGE_AMOUNTS,
  INSTRUCTION_OPTIONS, MEDICINE_TYPE_OPTIONS, DOSAGE_FORM_OPTIONS,
  DURATION_OPTIONS as SHARED_DURATION_OPTIONS, normalizeFrequency,
} from '../../constants/prescription';
import NursingAssessmentSection from '../opd/NursingAssessmentSection';
import DownloadReportButton from '../../components/common/DownloadReportButton';
import PhysioAssessmentSection from './PhysioAssessmentSection';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  scheduled:       { label: 'Scheduled',       color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200',     step: 0 },
  confirmed:       { label: 'Confirmed',        color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200',     step: 0 },
  checked_in:      { label: 'Checked In',       color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200', step: 1 },
  vitals_recorded: { label: 'Vitals Recorded',  color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200', step: 2 },
  in_consultation: { label: 'In Session',       color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200', step: 3 },
  completed:       { label: 'Completed',        color: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200',  step: 4 },
  no_show:         { label: 'No Show',          color: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200',         step: -1 },
  cancelled:       { label: 'Cancelled',        color: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',        step: -1 },
};

const STEPS = [
  { key: 'checkin',      label: 'Check In',    icon: User },
  { key: 'vitals',       label: 'Assessment',  icon: Activity },
  { key: 'consultation', label: 'Session',     icon: Stethoscope },
  { key: 'complete',     label: 'Complete',    icon: CheckCircle },
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

// ──────────────────────────────────────────────────────────────────────────────
// Progress stepper
// ──────────────────────────────────────────────────────────────────────────────
function ProgressStepper({ status }) {
  const currentStep = STATUS_CONFIG[status]?.step ?? 0;
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, i) => {
        const Icon = step.icon;
        const done = currentStep > i;
        const active = currentStep === i;
        return (
          <div key={step.key} className="flex items-center">
            <div className={`flex flex-col items-center`}>
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
  const [nonPharma, setNonPharma] = useState(existingRx?.non_pharmacological || visit.service_metadata?.physio_assessment?.non_pharmacological || '');
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
      await physioApi.savePrescription(visit.id, { items: parsedItems, notes, non_pharmacological: nonPharma });
      onSaved();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save prescription');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-semibold text-foreground mb-1 border-b border-border pb-1">Non-Pharmacological Management</label>
        <textarea
          rows={3}
          placeholder="Exercise program, modalities (TENS, ultrasound), bracing, ergonomic advice, lifestyle modifications..."
          value={nonPharma}
          onChange={e => setNonPharma(e.target.value)}
          disabled={isClosed}
          className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm disabled:opacity-60 resize-none mt-1"
        />
      </div>

      <div className="text-xs font-semibold text-foreground border-b border-border pb-1">Pharmacological Management</div>

      {items.length === 0 && !isClosed && (
        <p className="text-sm text-muted-foreground">No medications added yet.</p>
      )}
      {items.map((row, i) => (
        <div key={i} className="p-3 bg-muted/20 rounded-lg border border-border space-y-2">
          {/* Row 1 */}
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-4">
              <label className="block text-xs text-muted-foreground mb-1">Medicine *</label>
              <input type="text" placeholder="e.g. Diclofenac 50mg" value={row.medicine_name} onChange={e => update(i, 'medicine_name', e.target.value)} disabled={isClosed}
                className="w-full px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm disabled:opacity-60" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-muted-foreground mb-1">Dosage Form</label>
              <select value={row.dosage_form} onChange={e => update(i, 'dosage_form', e.target.value)} disabled={isClosed}
                className="w-full px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm disabled:opacity-60">
                <option value="">Select</option>
                {DOSAGE_FORM_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-muted-foreground mb-1">Frequency</label>
              <select value={row.frequency} onChange={e => update(i, 'frequency', e.target.value)} disabled={isClosed}
                className="w-full px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm disabled:opacity-60">
                {FREQ_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="col-span-1">
              <label className="block text-xs text-muted-foreground mb-1">SOS</label>
              <div className="flex items-center h-[34px]">
                <input type="checkbox" checked={row.sos} onChange={e => update(i, 'sos', e.target.checked)} disabled={isClosed}
                  className="h-4 w-4 rounded border-border text-primary-600" />
              </div>
            </div>
            <div className="col-span-1">
              <label className="block text-xs text-muted-foreground mb-1">Route</label>
              <select value={row.route} onChange={e => update(i, 'route', e.target.value)} disabled={isClosed}
                className="w-full px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm disabled:opacity-60">
                {ROUTE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-muted-foreground mb-1">Medicine Type</label>
              <select value={row.medicine_type} onChange={e => update(i, 'medicine_type', e.target.value)} disabled={isClosed}
                className="w-full px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm disabled:opacity-60">
                <option value="">Select</option>
                {MEDICINE_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          {/* Row 2 */}
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-2">
              <label className="block text-xs text-muted-foreground mb-1">Duration</label>
              <select value={row.duration} onChange={e => update(i, 'duration', e.target.value)} disabled={isClosed}
                className="w-full px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm disabled:opacity-60">
                {DURATION_OPTIONS.map(o => <option key={o}>{o}</option>)}
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
              <label className="block text-xs text-muted-foreground mb-1">Morn</label>
              <select value={row.dosage_morning} onChange={e => update(i, 'dosage_morning', e.target.value)} disabled={isClosed}
                className="w-full px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm disabled:opacity-60">
                {DOSAGE_AMOUNTS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="col-span-1">
              <label className="block text-xs text-muted-foreground mb-1">Aftn</label>
              <select value={row.dosage_afternoon} onChange={e => update(i, 'dosage_afternoon', e.target.value)} disabled={isClosed}
                className="w-full px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm disabled:opacity-60">
                {DOSAGE_AMOUNTS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="col-span-1">
              <label className="block text-xs text-muted-foreground mb-1">Night</label>
              <select value={row.dosage_night} onChange={e => update(i, 'dosage_night', e.target.value)} disabled={isClosed}
                className="w-full px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm disabled:opacity-60">
                {DOSAGE_AMOUNTS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="col-span-4">
              <label className="block text-xs text-muted-foreground mb-1">Warning Signs</label>
              <input type="text" placeholder="e.g. Stop if rash appears" value={row.warning_signs} onChange={e => update(i, 'warning_signs', e.target.value)} disabled={isClosed}
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
      await physioApi.saveLabOrder(visit.id, { items, notes: orderNotes });
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
      await physioApi.completeVisit(visit.id, {
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
        <DownloadReportButton visit={visit} visitType="PHYSIOTHERAPY" />
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
        <label className="block text-xs font-medium text-muted-foreground mb-1">Post-session Notes</label>
        <textarea rows={2} placeholder="Summary, advice given, home exercise program..." value={notes} onChange={e => setNotes(e.target.value)} disabled={!canComplete}
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
export default function PhysioVisitDetail() {
  const { visitId } = useParams();

  const [visit, setVisit] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadVisit = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await physioApi.getVisit(visitId);
      setVisit(data);
      setError(null);
    } catch (err) {
      setError('Failed to load visit details');
    } finally {
      setIsLoading(false);
    }
  }, [visitId]);

  useEffect(() => { loadVisit(); }, [loadVisit]);

  const handleCheckIn = async () => {
    setActionLoading(true);
    try {
      await physioApi.checkIn(visitId);
      await loadVisit();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to check in');
    } finally {
      setActionLoading(false);
    }
  };

  const handleNoShow = async () => {
    if (!window.confirm('Mark this patient as no-show?')) return;
    setActionLoading(true);
    try {
      await physioApi.markNoShow(visitId);
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
        <Link to="/physiotherapy/queue" className="mt-4 inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700">
          <ArrowLeft className="h-4 w-4" /> Back to Queue
        </Link>
      </div>
    );
  }

  const canCheckIn = ['scheduled', 'confirmed'].includes(visit.status);
  const isActive = !['completed', 'no_show', 'cancelled'].includes(visit.status);
  const step = STATUS_CONFIG[visit.status]?.step ?? 0;

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      {/* Back link */}
      <Link to="/physiotherapy/queue" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
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
              {visit.chief_complaint && (
                <p className="mt-2 text-sm text-foreground">
                  <span className="text-muted-foreground">Chief complaint: </span>
                  {visit.chief_complaint}
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          {isActive && (
            <div className="flex gap-2 flex-shrink-0">
              {canCheckIn && (
                <>
                  <button onClick={handleCheckIn} disabled={actionLoading}
                    className="flex items-center gap-1.5 px-3 py-2 bg-success-600 dark:bg-success-700 text-white rounded-lg text-sm hover:bg-success-700 disabled:opacity-50">
                    <User className="h-4 w-4" /> Check In
                  </button>
                  <button onClick={handleNoShow} disabled={actionLoading}
                    className="flex items-center gap-1.5 px-3 py-2 border border-danger-300 dark:border-danger-700 text-danger-600 dark:text-danger-400 rounded-lg text-sm hover:bg-danger-50 dark:hover:bg-danger-900/20 disabled:opacity-50">
                    No Show
                  </button>
                </>
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
            <ProgressStepper status={visit.status} />
          </div>
        )}
      </div>

      {/* Nursing Assessment -- unlocked after check-in */}
      {step >= 1 && (
        <Section title="Nursing Assessment" icon={Activity} badge={visit.vitals?.length > 0 ? 'Recorded' : null}>
          <NursingAssessmentSection key={`na-${visit.vitals?.[0]?.updated_at || 'new'}`} visit={visit} onSaved={loadVisit} apiOverride={physioApi} />
        </Section>
      )}

      {/* Physiotherapy Assessment -- replaces Doctor's Assessment */}
      {step >= 1 && (
        <>
          <Section
            title="Physiotherapy Assessment"
            icon={Stethoscope}
            badge={visit.diagnoses?.length > 0 ? `${visit.diagnoses.length} dx` : null}
            defaultOpen={step >= 2}
          >
            <PhysioAssessmentSection key={`pa-${visit.service_metadata?.physio_assessment ? 'saved' : 'new'}-${visit.updated_at}`} visit={visit} onSaved={loadVisit} />
          </Section>

          <Section
            title="Plan of Care / Prescription"
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
      {step >= 1 && (
        <Section title="Complete Visit" icon={CheckCircle} defaultOpen={step >= 3}>
          <CompleteVisitSection visit={visit} onSaved={loadVisit} />
        </Section>
      )}

      {/* Pre-check-in placeholder */}
      {step < 1 && visit.status !== 'cancelled' && visit.status !== 'no_show' && (
        <div className="bg-card rounded-lg border border-border p-8 text-center shadow-sm">
          <User className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-lg font-medium text-foreground">Waiting for Check-In</p>
          <p className="text-muted-foreground text-sm mt-1">Use the Check In button above to begin this visit</p>
        </div>
      )}
    </div>
  );
}
