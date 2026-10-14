/**
 * PastRecordsTab — Comprehensive patient timeline showing all visits,
 * assessments, prescriptions, admissions, dispensing, and forms.
 */
import React, { useState, useEffect } from 'react';
import {
  Home, Stethoscope, BedDouble, Pill, FileText, User, ChevronDown,
  ChevronUp, Activity, Brain, Heart, Video, AlertTriangle, ClipboardList,
} from 'lucide-react';
import apiClient from '../../../api/client';
import PrescriptionVersionsModal from '../../../components/patients/PrescriptionVersionsModal';

const ICON_MAP = {
  home: Home, stethoscope: Stethoscope, bed: BedDouble, pill: Pill,
  file: FileText, user: User, video: Video, alert: AlertTriangle,
  clipboard: ClipboardList,
};

const TYPE_COLORS = {
  saranam_visit: { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-300', dot: 'bg-blue-500', label: 'Home Visit' },
  encounter: { bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-300', dot: 'bg-green-500', label: 'Visit' },
  ipd_admission: { bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-300', dot: 'bg-purple-500', label: 'IPD' },
  dispensing: { bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-300', dot: 'bg-amber-500', label: 'Dispensed' },
  form_submission: { bg: 'bg-slate-50 dark:bg-slate-800', border: 'border-slate-300', dot: 'bg-slate-400', label: 'Form' },
  patient_registered: { bg: 'bg-teal-50 dark:bg-teal-900/20', border: 'border-teal-300', dot: 'bg-teal-500', label: 'Registered' },
};

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function VitalsBadges({ vitals }) {
  if (!vitals || Object.values(vitals).every(v => v == null)) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {vitals.bp_systolic && <span className="px-2 py-0.5 text-[10px] font-medium bg-red-50 text-red-700 border border-red-200 rounded">BP {vitals.bp_systolic}/{vitals.bp_diastolic}</span>}
      {vitals.pr && <span className="px-2 py-0.5 text-[10px] font-medium bg-pink-50 text-pink-700 border border-pink-200 rounded">PR {vitals.pr}</span>}
      {vitals.spo2 && <span className="px-2 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded">SpO2 {vitals.spo2}%</span>}
      {vitals.temperature && <span className="px-2 py-0.5 text-[10px] font-medium bg-orange-50 text-orange-700 border border-orange-200 rounded">Temp {vitals.temperature}°C</span>}
      {vitals.rr && <span className="px-2 py-0.5 text-[10px] font-medium bg-green-50 text-green-700 border border-green-200 rounded">RR {vitals.rr}</span>}
      {vitals.grbs && <span className="px-2 py-0.5 text-[10px] font-medium bg-yellow-50 text-yellow-700 border border-yellow-200 rounded">GRBS {vitals.grbs}</span>}
    </div>
  );
}

function FieldRow({ label, value }) {
  if (value == null || value === '' || value === false) return null;
  if (typeof value === 'boolean') value = value ? 'Yes' : 'No';
  return (
    <div className="flex gap-1.5 text-[11px]">
      <span className="text-muted-foreground whitespace-nowrap">{label}:</span>
      <span className="text-foreground">{String(value)}</span>
    </div>
  );
}

function AssessmentSection({ icon: Icon, color, title, children }) {
  const hasContent = React.Children.toArray(children).some(c => c != null);
  if (!hasContent) return null;
  return (
    <div className="mt-2 border-l-2 pl-3 py-1" style={{ borderColor: color }}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-3.5 w-3.5" style={{ color }} />
        <span className="text-[11px] font-bold" style={{ color }}>{title}</span>
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function AssessmentSummary({ assessments }) {
  if (!assessments || Object.keys(assessments).length === 0) return null;
  const n = assessments.nursing;
  const d = assessments.doctor;
  const p = assessments.psychological;
  const ph = assessments.physiotherapy;
  const e = assessments.esas;
  const pp = assessments.pps;
  const tc = assessments.teleconsult;

  return (
    <div className="mt-2 space-y-1">
      {tc && (
        <AssessmentSection icon={Video} color="#3B82F6" title="Teleconsultation Details">
          <FieldRow 
            label="Consultation Type" 
            value={
              (Array.isArray(tc.consultation_types) && tc.consultation_types.length > 0)
                ? tc.consultation_types.join(', ')
                : ([
                    tc.doctor_consultation && 'Doctor',
                    tc.nursing_consultation && 'Nurse',
                    tc.counsellor_consultation && 'Counsellor',
                    tc.physiotherapy_consultation && 'Physiotherapist',
                    tc.social_worker_consultation && 'Social Worker',
                  ].filter(Boolean).join(', ') || 'Nurse')
            } 
          />
          <FieldRow label="Call Direction" value={tc.call_direction} />
          <FieldRow label="Call Type" value={tc.call_type} />
          <FieldRow label="Who Answered" value={tc.who_answered === 'other' && tc.other_relationship ? `Other (${tc.other_relationship})` : tc.who_answered?.replace(/_/g, ' ')} />
          <FieldRow label="Caller Name" value={tc.caller_name} />
          <FieldRow label="Caller Phone" value={tc.caller_phone} />
          <FieldRow label="Symptoms Discussed" value={tc.symptoms} />
          <FieldRow label="Advice & Action Plan" value={tc.advice} />
          <FieldRow label="Notes" value={tc.notes} />
        </AssessmentSection>
      )}

      {n && (

        <AssessmentSection icon={Heart} color="#EC4899" title="Nursing Assessment">
          <FieldRow label="Consciousness" value={n.consciousness} />
          <FieldRow label="Orientation" value={n.orientation} />
          <FieldRow label="ADL" value={n.adl} />
          <FieldRow label="Built" value={n.built} />
          <FieldRow label="Pain Score" value={n.pain_score != null ? `${n.pain_score}/10` : null} />
          <FieldRow label="Pain Details" value={n.pain_details} />
          <FieldRow label="Nausea/Vomiting" value={n.nausea_vomiting} />
          <FieldRow label="Dyspnea" value={n.dyspnea} />
          <FieldRow label="Bowel" value={n.bowel} />
          <FieldRow label="Bladder" value={n.bladder} />
          <FieldRow label="Wound Present" value={n.wound_present} />
          {n.wound_present && <>
            <FieldRow label="Wound Site" value={n.wound_site} />
            <FieldRow label="Wound Size" value={n.wound_size} />
            <FieldRow label="Wound Discharge" value={n.wound_discharge} />
          </>}
          <FieldRow label="Lymphedema" value={n.lymphedema_present} />
          <FieldRow label="Bed Sore" value={n.bed_sore_present} />
          {n.bed_sore_present && <FieldRow label="Braden Scale" value={n.braden_scale_score} />}
          <FieldRow label="Hygiene" value={n.hygiene_general} />
          <FieldRow label="Procedures Done" value={n.procedures_done} />
          <FieldRow label="Instructions" value={n.instructions_given} />
        </AssessmentSection>
      )}

      {d && (
        <AssessmentSection icon={Stethoscope} color="#22C55E" title="Doctor Assessment">
          <FieldRow label="Chief Complaints" value={d.chief_complaints} />
          <FieldRow label="HPI" value={d.history_of_presenting_illness} />
          <FieldRow label="Diagnosis" value={d.diagnosis} />
          <FieldRow label="Comorbidities" value={d.comorbidities} />
          <FieldRow label="Medication History" value={d.medication_history} />
          <FieldRow label="Diet" value={d.diet} />
          <FieldRow label="Appetite" value={d.appetite} />
          <FieldRow label="Exam - Respiratory" value={d.exam_respiratory} />
          <FieldRow label="Exam - CVS" value={d.exam_cardiovascular} />
          <FieldRow label="Exam - Abdomen" value={d.exam_per_abdomen} />
          <FieldRow label="Exam - CNS" value={d.exam_cns} />
          <FieldRow label="Doctor Notes" value={d.doctor_notes} />
        </AssessmentSection>
      )}

      {p && (
        <AssessmentSection icon={Brain} color="#8B5CF6" title="Psychological Assessment">
          <FieldRow label="Patient Mood" value={p.patient_mood} />
          <FieldRow label="Sleep" value={p.patient_sleep} />
          <FieldRow label="Disease Concerns" value={p.patient_disease_concerns} />
          <FieldRow label="Distress Score" value={p.distress_score != null ? `${p.distress_score}/10` : null} />
          <FieldRow label="Family Support" value={p.family_support_notes} />
          <FieldRow label="Caregiver Mood" value={p.caregiver_mood} />
          <FieldRow label="Caregiver Burden" value={p.caregiver_burden} />
          {p.zarit_total_score != null && <FieldRow label="Zarit Score" value={`${p.zarit_total_score}/16`} />}
          <FieldRow label="Remarks" value={p.remarks} />
        </AssessmentSection>
      )}

      {ph && (
        <AssessmentSection icon={Activity} color="#F97316" title="Physiotherapy Assessment">
          <FieldRow label="Pain VAS" value={ph.pain_vas_score != null ? `${ph.pain_vas_score}/10` : null} />
          <FieldRow label="Pain Area" value={ph.pain_area} />
          <FieldRow label="Pain Nature" value={ph.pain_nature} />
          <FieldRow label="Posture" value={ph.obs_posture} />
          <FieldRow label="Swelling" value={ph.obs_swelling} />
          <FieldRow label="ROM" value={ph.exam_rom} />
          <FieldRow label="MMT" value={ph.exam_mmt} />
          <FieldRow label="Balance" value={ph.exam_balance} />
          <FieldRow label="Functional Status" value={ph.exam_functional_status} />
          <FieldRow label="Physio Notes" value={ph.physio_notes} />
        </AssessmentSection>
      )}

      {e && (
        <AssessmentSection icon={Activity} color="#6366F1" title="ESAS-R Scores">
          <div className="flex flex-wrap gap-1.5">
            {['pain','tiredness','nausea','depression','anxiety','drowsiness','appetite','wellbeing','shortness_of_breath'].map(k => {
              const val = e[k];
              if (val == null) return null;
              const color = val <= 3 ? 'bg-green-100 text-green-700' : val <= 6 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';
              return (
                <span key={k} className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${color}`}>
                  {k.replace(/_/g, ' ')}: {val}/10
                </span>
              );
            })}
            {e.total_score != null && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-indigo-100 text-indigo-700">
                Total: {e.total_score}/100
              </span>
            )}
          </div>
        </AssessmentSection>
      )}

      {pp && (
        <AssessmentSection icon={Activity} color="#059669" title="PPS Score">
          <div className="flex items-center gap-2">
            <span className={`text-lg font-bold ${pp.pps_score >= 70 ? 'text-green-600' : pp.pps_score >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
              {pp.pps_score}%
            </span>
            <div className="flex flex-wrap gap-1">
              {pp.ambulation && <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded">{pp.ambulation}</span>}
              {pp.self_care && <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded">{pp.self_care}</span>}
              {pp.intake && <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded">{pp.intake}</span>}
              {pp.consciousness_level && <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded">{pp.consciousness_level}</span>}
            </div>
          </div>
          {pp.notes && <FieldRow label="Notes" value={pp.notes} />}
        </AssessmentSection>
      )}
    </div>
  );
}

function PrescriptionSummary({ prescription }) {
  if (!prescription) return null;
  const meds = prescription.medications || prescription.items || [];
  if (meds.length === 0 && !prescription.pharmacological) return null;
  return (
    <div className="mt-2">
      <div className="flex items-center gap-1.5 text-xs mb-1">
        <Pill className="h-3 w-3 text-amber-500" />
        <span className="font-medium text-muted-foreground">Prescription ({meds.length} medicines)</span>
      </div>
      <div className="space-y-0.5">
        {meds.slice(0, 5).map((m, i) => (
          <div key={i} className="text-[11px] text-foreground pl-5">
            {m.name || m.medicine_name} {m.dosage && `— ${m.dosage}`} {m.frequency && `— ${m.frequency}`}
          </div>
        ))}
        {meds.length > 5 && <div className="text-[11px] text-muted-foreground pl-5">+{meds.length - 5} more</div>}
      </div>
    </div>
  );
}

function TimelineEvent({ event }) {
  const [expanded, setExpanded] = useState(false);
  const colors = TYPE_COLORS[event.type] || TYPE_COLORS.form_submission;
  const IconComp = ICON_MAP[event.icon] || ClipboardList;
  const data = event.data || {};

  return (
    <div className="flex gap-3">
      {/* Timeline dot + line */}
      <div className="flex flex-col items-center">
        <div className={`w-8 h-8 rounded-full ${colors.dot} flex items-center justify-center flex-shrink-0`}>
          <IconComp className="h-4 w-4 text-white" />
        </div>
        <div className="w-0.5 flex-1 bg-border mt-1" />
      </div>

      {/* Content card */}
      <div className={`flex-1 mb-4 border ${colors.border} ${colors.bg} rounded-lg overflow-hidden`}>
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-left px-4 py-3 flex items-center justify-between hover:opacity-80 transition-opacity"
        >
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">{event.title}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/70 dark:bg-slate-700/70 text-muted-foreground border border-border">
                {data.visit_type === 'teleconsult' ? 'Teleconsultation' : colors.label}
              </span>

              {data.status && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                  data.status === 'completed' ? 'bg-green-100 text-green-700' :
                  data.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                  data.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  {data.status}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatDate(event.date)}
              {data.visit_location && ` · ${data.visit_location}`}
              {(() => {
                const cList = (Array.isArray(data.consultation_types) && data.consultation_types.length > 0)
                  ? data.consultation_types
                  : [
                      data.doctor_consultation && 'Doctor',
                      data.nursing_consultation && 'Nurse',
                      data.counsellor_consultation && 'Counsellor',
                      data.physiotherapy_consultation && 'Physiotherapist',
                      data.social_worker_consultation && 'Social Worker',
                    ].filter(Boolean);
                const text = cList.length > 0 ? cList.join(', ') : null;
                return text ? ` · ${text}` : null;
              })()}
              {data.encounter_type && ` · ${data.encounter_type}`}
              {data.provider_name && ` · ${data.provider_name}`}
            </p>
          </div>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>

        {expanded && (
          <div className="px-4 pb-3 border-t border-border/50 pt-2 text-sm space-y-1">
            {/* Saranam visit details */}
            {event.type === 'saranam_visit' && (
              <>
                <VitalsBadges vitals={data.vitals} />
                <AssessmentSummary assessments={data.assessments} />
                <PrescriptionSummary prescription={data.prescription} />
                {data.summary && <p className="text-xs mt-2 text-muted-foreground"><strong>Summary:</strong> {data.summary}</p>}
                {data.follow_up_advice && <p className="text-xs text-muted-foreground"><strong>Follow-up:</strong> {data.follow_up_advice}</p>}
              </>
            )}

            {/* Encounter details */}
            {event.type === 'encounter' && (
              <>
                {data.chief_complaint && <p className="text-xs"><strong>Chief Complaint:</strong> {data.chief_complaint}</p>}
                {data.diagnoses && (
                  <div className="text-xs">
                    <strong>Diagnoses:</strong>
                    {data.diagnoses.map((d, i) => (
                      <span key={i} className="ml-1">{d.text}{d.icd10 && ` (${d.icd10})`}{i < data.diagnoses.length - 1 ? ',' : ''}</span>
                    ))}
                  </div>
                )}
                <PrescriptionSummary prescription={data.prescription} />
                {data.lab_orders && (
                  <div className="text-xs mt-1">
                    <strong>Lab Orders:</strong> {data.lab_orders.items?.map(l => l.test).join(', ')}
                  </div>
                )}
                {data.notes && <p className="text-xs text-muted-foreground mt-1">{data.notes}</p>}
              </>
            )}

            {/* IPD admission */}
            {event.type === 'ipd_admission' && (
              <>
                {data.admission_diagnosis && <p className="text-xs"><strong>Admission Dx:</strong> {data.admission_diagnosis}</p>}
                {data.discharge_diagnosis && <p className="text-xs"><strong>Discharge Dx:</strong> {data.discharge_diagnosis}</p>}
                {data.discharge_summary && <p className="text-xs"><strong>Discharge Summary:</strong> {data.discharge_summary}</p>}
                {data.discharge_type && <p className="text-xs"><strong>Discharge Type:</strong> {data.discharge_type}</p>}
              </>
            )}

            {/* Dispensing */}
            {event.type === 'dispensing' && (
              <div className="text-xs">
                <p><strong>Medicine:</strong> {data.medicine_name}</p>
                <p><strong>Quantity:</strong> {data.quantity} · {data.dosage} · {data.frequency}</p>
              </div>
            )}

            {/* Form submission */}
            {event.type === 'form_submission' && (
              <div className="text-xs">
                <p><strong>Form:</strong> {data.form_name}</p>
                <p><strong>Status:</strong> {data.status} · {data.answer_count} answers</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PastRecordsTab({ patientId, patientName }) {
  const [events, setEvents] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [rxModalOpen, setRxModalOpen] = useState(false);

  useEffect(() => {
    if (patientId) loadHistory();
  }, [patientId]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/patients/${patientId}/full-history`);
      setEvents(res.data.events || []);
      setSummary(res.data.summary || {});
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = filter === 'all' ? events : events.filter(e => e.type === filter);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <>
        <div className="flex justify-end mb-3">
          <button onClick={() => setRxModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-white border border-blue-300 rounded-md hover:bg-blue-50">
            <FileText className="h-3.5 w-3.5" /> Prescription PDFs
          </button>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-border rounded-xl p-12 text-center">
          <ClipboardList className="h-12 w-12 mx-auto mb-3 text-slate-300" />
          <p className="text-muted-foreground font-medium">No records found</p>
          <p className="text-sm text-muted-foreground mt-1">Patient history will appear here as visits and assessments are recorded.</p>
        </div>
        <PrescriptionVersionsModal patientId={patientId} patientName={patientName}
          open={rxModalOpen} onClose={() => setRxModalOpen(false)} />
      </>
    );
  }

  return (
    <div className="space-y-4">
      {/* Prescription PDFs (versioned, re-downloadable) */}
      <div className="flex justify-end">
        <button onClick={() => setRxModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-white border border-blue-300 rounded-md hover:bg-blue-50">
          <FileText className="h-3.5 w-3.5" /> Prescription PDFs
        </button>
      </div>
      <PrescriptionVersionsModal patientId={patientId} patientName={patientName}
        open={rxModalOpen} onClose={() => setRxModalOpen(false)} />

      {/* Summary cards */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'all', label: 'All', count: events.length, color: 'bg-slate-100 text-slate-700' },
          { key: 'saranam_visit', label: 'Home Visits', count: summary.saranam_visits || 0, color: 'bg-blue-100 text-blue-700' },
          { key: 'encounter', label: 'OPD/Clinic', count: summary.encounters || 0, color: 'bg-green-100 text-green-700' },
          { key: 'ipd_admission', label: 'IPD', count: summary.ipd_admissions || 0, color: 'bg-purple-100 text-purple-700' },
          { key: 'dispensing', label: 'Medicines', count: summary.dispensings || 0, color: 'bg-amber-100 text-amber-700' },
          { key: 'form_submission', label: 'Forms', count: summary.forms || 0, color: 'bg-slate-100 text-slate-600' },
        ].filter(f => f.count > 0 || f.key === 'all').map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              filter === f.key ? f.color + ' ring-2 ring-offset-1 ring-current' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
            }`}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="pl-1">
        {filteredEvents.map((event, idx) => (
          <TimelineEvent key={`${event.type}-${idx}`} event={event} />
        ))}
      </div>
    </div>
  );
}
