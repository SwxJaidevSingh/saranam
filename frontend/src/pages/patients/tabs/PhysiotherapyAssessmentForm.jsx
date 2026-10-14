/**
 * PhysiotherapyAssessmentForm — Saranam version
 * Same Tailwind UI pattern as OPD Physiotherapy Assessment
 */
import { useState, useEffect } from 'react';
import { Save, RefreshCw, Loader2 } from 'lucide-react';
import saranamApi from '../../../api/saranam';
import AiSummaryBlock from './AiSummaryBlock';
import ProcedureCheckboxGroup from '../../../components/common/ProcedureCheckboxGroup';

function SubSection({ title, children }) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-foreground border-b border-border pb-1">{title}</h4>
      {children}
    </div>
  );
}

function InputField({ label, placeholder, value, onChange }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <input type="text" placeholder={placeholder || label} value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" />
    </div>
  );
}

function TextArea({ label, placeholder, value, onChange, rows = 3 }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <textarea rows={rows} placeholder={placeholder || label} value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm resize-none" />
    </div>
  );
}

function PainSlider({ value, onChange }) {
  const score = value ?? 0;
  const color = score <= 3 ? 'text-green-500' : score <= 6 ? 'text-yellow-500' : 'text-red-500';
  const label = score === 0 ? 'None' : score <= 3 ? 'Mild' : score <= 6 ? 'Moderate' : 'Severe';
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-muted-foreground">VAS Pain Score (0-10)</label>
        <span className={`text-sm font-bold ${color}`}>{score}/10 — {label}</span>
      </div>
      <input type="range" min="0" max="10" value={score}
        onChange={e => onChange(parseInt(e.target.value))}
        className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-primary-600" />
      <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
        <span>0 None</span><span>3 Mild</span><span>6 Moderate</span><span>10 Severe</span>
      </div>
    </div>
  );
}

// ─── Physiotherapy procedure list (from ProceduresSection) ────────────────
const PHYSIO_PROCEDURES = [
  { key: 'adl_exercises', label: 'ADL exercises' },
  { key: 'adl_modifications', label: 'ADL modifications' },
  { key: 'ambulation_and_positioning', label: 'Ambulation and Positioning' },
  { key: 'brace_support_prescription', label: 'Brace support/prescription' },
  { key: 'breathing_exercises', label: 'Breathing exercises' },
  { key: 'caregiver_education_physio', label: 'Caregiver education' },
  { key: 'chest_physiotherapy', label: 'Chest physiotherapy' },
  { key: 'contracture_stiffness_management', label: 'Contracture and stiffness management' },
  { key: 'core_strengthening_exercises', label: 'Core strengthening exercises' },
  { key: 'lymphedema_bandaging', label: 'Lymphedema bandaging' },
  { key: 'lymphedema_drainage', label: 'Lymphedema drainage' },
  { key: 'lymphedema_exercises', label: 'Lymphedema exercises' },
  { key: 'others_physio', label: 'Others' },
  { key: 'referral_for_regular_physiotherapy', label: 'Referral for regular physiotherapy' },
  { key: 'rom_exercises', label: 'ROM exercises' },
  { key: 'spirometry', label: 'Spirometry' },
];

export default function PhysiotherapyAssessmentForm({ visitId, patientId, onSaved, showProcedures = true }) {
  const [loading, setLoading] = useState(true);

  // Palpation
  const [palpTenderness, setPalpTenderness] = useState('');
  const [palpScar, setPalpScar] = useState('');

  // Lymphedema
  const [lymphedemaPresent, setLymphedemaPresent] = useState(false);
  const [lymphedemaSite, setLymphedemaSite] = useState('');
  const [lymphedemaMeasurements, setLymphedemaMeasurements] = useState('');
  const [lymphedemaPain, setLymphedemaPain] = useState(false);

  // Examination
  const [generalExam, setGeneralExam] = useState('');
  const [localExam, setLocalExam] = useState('');
  const [sysExam, setSysExam] = useState('');
  const [examFunctional, setExamFunctional] = useState('');

  // Notes
  const [physioNotes, setPhysioNotes] = useState('');

  // Procedures (shared 'procedures' assessment record — physiotherapy slice)
  const [exerciseReview, setExerciseReview] = useState('');
  const [proceduresPhysio, setProceduresPhysio] = useState([]);

  const [aiSummary, setAiSummary] = useState('');
  const [hasSavedRow, setHasSavedRow] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { loadData(); }, [visitId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await saranamApi.getAssessment(visitId, 'physiotherapy');
      if (data) {
        setPalpTenderness(data.palp_tenderness || '');
        setLymphedemaPresent(data.palp_lymphedema_present || false);
        setLymphedemaSite(data.palp_lymphedema_site || '');
        setLymphedemaMeasurements(data.palp_lymphedema_measurements || '');
        setLymphedemaPain(data.palp_lymphedema_pain || false);
        setPalpScar(data.palp_scar || '');
        setGeneralExam(data.general_examination || '');
        setLocalExam(data.exam_local_status || '');
        setSysExam(data.sys_examination || '');
        setExamFunctional(data.exam_functional_status || '');
        setPhysioNotes(data.physio_notes || '');
        setAiSummary(data.ai_summary || '');
        setHasSavedRow(true);
      }

      // Load procedures (shared record — physiotherapy slice)
      const proc = await saranamApi.getAssessment(visitId, 'procedures');
      if (proc) {
        setProceduresPhysio(proc.physiotherapy || []);
        setExerciseReview(proc.exercise_review || '');
      }
    } catch (err) { /* fresh form */ }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saranamApi.saveAssessment(visitId, 'physiotherapy', {
        palp_tenderness: palpTenderness,
        palp_lymphedema_present: lymphedemaPresent,
        palp_lymphedema_site: lymphedemaSite,
        palp_lymphedema_measurements: lymphedemaMeasurements,
        palp_lymphedema_pain: lymphedemaPain,
        palp_scar: palpScar,
        general_examination: generalExam,
        exam_local_status: localExam,
        sys_examination: sysExam,
        exam_functional_status: examFunctional,
        physio_notes: physioNotes,
        ai_summary: aiSummary,
      });

      // Save procedures — merge with existing record so other categories aren't clobbered
      const currentProc = await saranamApi.getAssessment(visitId, 'procedures').catch(() => null);
      await saranamApi.saveAssessment(visitId, 'procedures', {
        nursing: currentProc?.nursing || [],
        physiotherapy: proceduresPhysio,
        counsellor: currentProc?.counsellor || [],
        medical: currentProc?.medical || [],
        notes: currentProc?.notes || '',
        exercise_review: exerciseReview,
      });

      setSaved(true);
      setHasSavedRow(true);
      setTimeout(() => setSaved(false), 3000);
      if (onSaved) onSaved();
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to save physiotherapy assessment');
    } finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── General Examination ── */}
      <SubSection title="Examination">
        <TextArea label="General Examination" placeholder="General examination findings..." value={generalExam} onChange={setGeneralExam} rows={4} />
        <TextArea label="Functional Status" placeholder="Mobility, ADL, functional limitations..." value={examFunctional} onChange={setExamFunctional} rows={4} />
        <TextArea label="Local Examination" placeholder="Local findings, ROM, MMT, tone, balance..." value={localExam} onChange={setLocalExam} rows={4} />
        <TextArea label="Systemic Examination" placeholder="Systemic findings..." value={sysExam} onChange={setSysExam} rows={4} />
      </SubSection>

      {/* ── On Palpation ── */}
      <SubSection title="On Palpation">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <InputField label="Tenderness" placeholder="Location, grade..." value={palpTenderness} onChange={setPalpTenderness} />
          <InputField label="Scar" placeholder="Location, type..." value={palpScar} onChange={setPalpScar} />
        </div>
        <div className="space-y-3">

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={lymphedemaPresent}
              onChange={(e) => setLymphedemaPresent(e.target.checked)}
              className="rounded border-border"
            />
            <span>Lymphedema Present</span>
          </label>

          {lymphedemaPresent && (
            <div className="ml-6 mt-2 space-y-3 border-l-2 border-border pl-4">

              <TextArea
                label="Site of Lymphedema"
                placeholder="e.g. Left arm, Right leg..."
                value={lymphedemaSite}
                onChange={setLymphedemaSite}
              />

              <TextArea
                label="Measurements"
                placeholder="e.g. Mid-calf 34 cm"
                value={lymphedemaMeasurements}
                onChange={setLymphedemaMeasurements}
              />

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={lymphedemaPain}
                  onChange={(e) => setLymphedemaPain(e.target.checked)}
                  className="rounded border-border"
                />
                <span>Pain Present</span>
              </label>

            </div>
          )}

        </div>
      </SubSection>


      {/* ── Procedures ── */}
      {showProcedures && (
        <SubSection title="Procedures">
          <ProcedureCheckboxGroup
            title="Physiotherapist Services"
            color="text-purple-700 dark:text-purple-300"
            procedures={PHYSIO_PROCEDURES}
            selected={proceduresPhysio}
            onChange={setProceduresPhysio}
          />
          <div className="mt-3">
            <TextArea
              label="Exercise Review"
              placeholder="Document patient's exercise compliance, technique, progression, tolerance, home exercise programme, etc."
              value={exerciseReview}
              onChange={setExerciseReview}
              rows={4}
            />
          </div>
        </SubSection>
      )}

      {/* ── Physiotherapist's Notes ── */}
      <SubSection title="Physiotherapist's Notes">
        <TextArea
          label="Clinical Notes / Treatment Plan"
          placeholder="Overall assessment, treatment goals, exercises prescribed, home program..."
          value={physioNotes} onChange={setPhysioNotes} rows={4}
        />
        <AiSummaryBlock
          visitId={visitId}
          assessmentType="physiotherapy"
          value={aiSummary}
          onChange={setAiSummary}
          hasSavedRow={hasSavedRow}
        />
      </SubSection>

      {/* ── Save ── */}
      <div className="flex justify-end pt-2">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-50">
          {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saved ? 'Saved!' : 'Save Physiotherapy Assessment'}
        </button>
      </div>
    </div>
  );
}