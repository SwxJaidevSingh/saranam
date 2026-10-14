/**
 * NursingAssessmentForm — Saranam version
 * Adapted from OPD NursingAssessmentSection with same UI pattern:
 * toggle button groups, pain slider, checkboxes, auto-summary
 */
import { useState, useEffect, useRef } from 'react';
import { Save, RefreshCw, Sparkles, Loader2 } from 'lucide-react';
import saranamApi from '../../../api/saranam';
import ProcedureCheckboxGroup from '../../../components/common/ProcedureCheckboxGroup';
import ActiveFocusVoiceMic from '../../../components/voice/ActiveFocusVoiceMic';
// import VoiceMicButton from "../../voice/VoiceMicButton";

// ─── Section wrapper ──────────────────────────────────────────────────────
function SubSection({ title, children }) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-foreground border-b border-border pb-1">{title}</h4>
      {children}
    </div>
  );
}

// ─── Vital input field ────────────────────────────────────────────────────
function VitalInput({ label, unit, placeholder, value, onChange, type = "number" }) {
  return (
    <div>
      <label className="block text-xs text-muted-foreground mb-1">
        {label} <span className="text-muted-foreground/50">{unit}</span>
      </label>
      <input type={type} step={type === "number" ? "any" : undefined} placeholder={placeholder} value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-2.5 py-1.5 border border-border rounded-lg bg-background text-foreground text-sm" />
    </div>
  );
}

// ─── Pain slider ──────────────────────────────────────────────────────────
function PainSlider({ value, onChange, disabled }) {
  const score = value ?? 0;
  const color = score <= 3 ? 'text-green-500' : score <= 6 ? 'text-yellow-500' : 'text-red-500';
  const label = score === 0 ? 'None' : score <= 3 ? 'Mild' : score <= 6 ? 'Moderate' : 'Severe';
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-muted-foreground">Pain Score (0-10)</label>
        <span className={`text-sm font-bold ${color}`}>{score}/10 — {label}</span>
      </div>
      <input
        type="range" min="0" max="10" value={score}
        onChange={e => onChange(parseInt(e.target.value))}
        disabled={disabled}
        className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-primary-600 disabled:opacity-60"
      />
      <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
        <span>0 None</span><span>3 Mild</span><span>6 Moderate</span><span>10 Severe</span>
      </div>
    </div>
  );
}

const NURSING_PROCEDURES = [
  { key: 'administration_of_medications', label: 'Administration of medications' },
  { key: 'ambulation_and_positioning', label: 'Ambulation and Positioning' },
  { key: 'application_of_buprenorphine_patches', label: 'Application of buprenorphine patches' },
  { key: 'application_of_fentanyl_patches', label: 'Application of fentanyl patches' },
  { key: 'ascitic_tapping', label: 'Ascitic tapping' },
  { key: 'bed_bath', label: 'Bed bath' },
  { key: 'bereavement_care', label: 'Bereavement care' },
  { key: 'bladder_irrigation', label: 'Bladder irrigation' },
  { key: 'blood_collection_for_investigation', label: 'Blood collection for investigation' },
  { key: 'breathing_exercises', label: 'Breathing exercises' },
  { key: 'change_of_subcutaneous_port', label: 'Change of subcutaneous port' },
  { key: 'chest_physiotherapy', label: 'Chest physiotherapy' },
  { key: 'colostomy_care', label: 'Colostomy care' },
  { key: 'crisis_plan_for_breathlessness', label: 'Crisis plan for breathlessness' },
  { key: 'crisis_plan_for_fall', label: 'Crisis plan for fall' },
  { key: 'crisis_plan_for_hemorrhage', label: 'Crisis plan for hemorrhage' },
  { key: 'crisis_plan_for_maggots', label: 'Crisis plan for maggots' },
  { key: 'crisis_plan_for_syncope', label: 'Crisis plan for syncope' },
  { key: 'diagnosis_and_prognosis_counselling', label: 'Diagnosis and Prognosis counselling' },
  { key: 'end_of_life_counselling', label: 'End of life counselling' },
  { key: 'enema', label: 'Enema' },
  { key: 'fj_peg_tube_care', label: 'FJ/PEG tube care' },
  { key: 'foleys_catheter_care', label: 'Foleys catheter care' },
  { key: 'foleys_catheter_insertion', label: 'Foleys catheter insertion' },
  { key: 'grbs_monitoring', label: 'GRBS monitoring' },
  { key: 'iv_cannulation', label: 'IV cannulation' },
  { key: 'lymphedema_care', label: 'Lymphedema care' },
  { key: 'maggot_dressing', label: 'Maggot dressing' },
  { key: 'medication_prescribed_under_supervision', label: 'Medication prescribed under supervision' },
  { key: 'medication_review', label: 'Medication review' },
  { key: 'nebulization', label: 'Nebulization' },
  { key: 'ng_tube_care', label: 'NG tube care' },
  { key: 'ng_tube_insertion', label: 'NG tube insertion' },
  { key: 'oral_care', label: 'Oral care' },
  { key: 'others_nursing', label: 'Others' },
  { key: 'pain_management', label: 'Pain management' },
  { key: 'perineal_care', label: 'Perineal care' },
  { key: 'personal_hygiene_care', label: 'Personal hygiene care' },
  { key: 'pigtail_dressing', label: 'Pigtail dressing' },
  { key: 'pr_examination_manual_evacuation', label: 'PR examination and manual evacuation' },
  { key: 'pressure_sore_management', label: 'Pressure sore management' },
  { key: 'rom_exercises', label: 'ROM exercises' },
  { key: 'sitz_bath', label: 'Sitz bath' },
  { key: 'skin_hygiene', label: 'Skin hygiene' },
  { key: 'steam_inhalation', label: 'Steam inhalation' },
  { key: 'tracheostomy_care', label: 'Tracheostomy care' },
  { key: 'vitals_monitoring', label: 'Vitals monitoring' },
  { key: 'wound_care', label: 'Wound care' },
];

const SYMPTOM_TEXT_FIELDS = [
  { key: 'apetite', label: 'Apetite' },
  { key: 'sleep', label: 'Sleep' },
  { key: 'diet', label: 'Diet' },
  { key: 'bowel', label: 'Bowel' },
  { key: 'bladder', label: 'Bladder' },
  { key: 'other_symptoms', label: 'Other Symptoms' },
];

// ═══════════════════════════════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════════════════════════════
export default function NursingAssessmentForm({ visitId, patientId, onSaved }) {
  const [loading, setLoading] = useState(true);

  const [vitals, setVitals] = useState({
    pr: '', bp_systolic: '', bp_diastolic: '', rr: '', spo2: '', temperature: '', grbs: '',
  });

  const [gpe, setGpe] = useState({
    consciousness: '', orientation: '', adl: '', built: '', hygiene_general: '',
  });
  const [generalExamination, setGeneralExamination] = useState('');
  const [pain, setPain] = useState({ pain_score: 0, pain_details: '' });
  const [symptoms, setSymptoms] = useState({
    apetite: '', sleep: '', diet: '', feeding_tube: false,
    urinary_catheter: false, tracheostomy: false, lymphedema: false,
    bed_sore: '', bowel: '', bladder: '', dyspnea: '',
    stoma: '', other_symptoms: '', remarks: '',
  });
  const [hygieneNotes, setHygieneNotes] = useState('');
  const [procedures, setProcedures] = useState('');
  const [futurePlans, setFuturePlans] = useState('');
  const [summary, setSummary] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hasSavedRow, setHasSavedRow] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [proceduresNursing, setProceduresNursing] = useState([]);

  useEffect(() => { loadData(); }, [visitId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await saranamApi.getAssessment(visitId, 'nursing');
      const visitData = await saranamApi.getVisit(visitId);
      const proc = await saranamApi.getAssessment(visitId, 'procedures');
      if (proc) {
        setProceduresNursing(proc.nursing || []);
      }
      if (visitData) {
        setVitals({
          pr: visitData.vitals_pr ?? '',
          bp_systolic: visitData.vitals_bp_systolic ?? '',
          bp_diastolic: visitData.vitals_bp_diastolic ?? '',
          rr: visitData.vitals_rr ?? '',
          spo2: visitData.vitals_spo2 ?? '',
          temperature: visitData.vitals_temperature ?? '',
          grbs: visitData.vitals_grbs ?? '',
        });
      }
      if (data) {
        setGeneralExamination(data.general_examination || '');
        setPain({ pain_score: data.pain_score || 0, pain_details: data.pain_details || '' });
        setSymptoms({
          apetite: data.apetite || '',
          sleep: data.sleep || '',
          diet: data.diet || '',
          feeding_tube: data.device_feeding_tube?.present || false,
          urinary_catheter: data.device_urinary_catheter?.present || false,
          tracheostomy: data.device_tracheostomy?.present || false,
          lymphedema: data.lymphedema_present || false,
          bed_sore: data.bed_sore_present ? `Braden: ${data.braden_scale_score || ''}` : '',
          bowel: data.bowel || '', bladder: data.bladder || '',
          dyspnea: data.dyspnea || '', stoma: '', other_symptoms: '', remarks: '',
        });
        setHygieneNotes(data.hygiene_notes || '');
        setProcedures(data.procedures_done || '');
        setFuturePlans(data.future_plans || '');
        setSummary(data.ai_summary || '');
        setHasSavedRow(true);
      }
    } catch (err) {
      // No existing data — fresh form
    } finally {
      setLoading(false);
    }
  };

  const handleAutoGenerate = async () => {
    if (!hasSavedRow) {
      alert('Save the assessment first — the AI summary reads the saved record.');
      return;
    }
    setGenerating(true);
    try {
      const { summary: text } = await saranamApi.generateAssessmentSummary(visitId, 'nursing');
      setSummary(text || '');
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to generate AI summary');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saranamApi.saveAssessment(visitId, 'nursing', {
        consciousness: gpe.consciousness,
        orientation: gpe.orientation,
        adl: gpe.adl,
        built: gpe.built,
        hygiene_general: gpe.hygiene_general,
        pain_score: pain.pain_score,
        pain_details: pain.pain_details,
        apetite: symptoms.apetite,
        sleep: symptoms.sleep,
        diet: symptoms.diet,
        bowel: symptoms.bowel,
        bladder: symptoms.bladder,
        general_examination: generalExamination,
        device_feeding_tube: { present: symptoms.feeding_tube },
        device_urinary_catheter: { present: symptoms.urinary_catheter },
        device_tracheostomy: { present: symptoms.tracheostomy },
        device_stoma: { present: false },
        lymphedema_present: symptoms.lymphedema,
        bed_sore_present: !!symptoms.bed_sore,
        hygiene_notes: hygieneNotes,
        procedures_done: procedures,
        future_plans: futurePlans,
        ai_summary: summary,
      });

      const numOrNull = (v) => v === '' ? null : Number(v);
      await saranamApi.updateVisit(visitId, {
        vitals_pr: numOrNull(vitals.pr),
        vitals_bp_systolic: numOrNull(vitals.bp_systolic),
        vitals_bp_diastolic: numOrNull(vitals.bp_diastolic),
        vitals_rr: numOrNull(vitals.rr),
        vitals_spo2: numOrNull(vitals.spo2),
        vitals_temperature: vitals.temperature === '' ? null : vitals.temperature,
        vitals_grbs: numOrNull(vitals.grbs),
      });

      setSaved(true);
      setHasSavedRow(true);
      setTimeout(() => setSaved(false), 3000);
      if (onSaved) onSaved();
      const currentProc = await saranamApi.getAssessment(visitId, 'procedures').catch(() => null);
      await saranamApi.saveAssessment(visitId, 'procedures', {
        nursing: proceduresNursing,
        physiotherapy: currentProc?.physiotherapy || [],
        counsellor: currentProc?.counsellor || [],
        notes: currentProc?.notes || '',
      });
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to save nursing assessment');
    } finally {
      setSaving(false);
    }
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
      <SubSection title="General Physical Examination">
        <textarea
          rows={4}
          placeholder="Consciousness, orientation, ADL, built, hygiene..."
          value={generalExamination}
          onChange={e => setGeneralExamination(e.target.value)}
          className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm resize-none"
        />
      </SubSection>

      {/* ── Vital Signs ── */}
      <SubSection title="Vital Signs">
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <VitalInput label="PR" unit="bpm" placeholder="72" value={vitals.pr} onChange={v => setVitals(p => ({ ...p, pr: v }))} />
          <VitalInput label="BP Sys" unit="mmHg" placeholder="120" value={vitals.bp_systolic} onChange={v => setVitals(p => ({ ...p, bp_systolic: v }))} />
          <VitalInput label="BP Dia" unit="mmHg" placeholder="80" value={vitals.bp_diastolic} onChange={v => setVitals(p => ({ ...p, bp_diastolic: v }))} />
          <VitalInput label="RR" unit="/min" placeholder="16" value={vitals.rr} onChange={v => setVitals(p => ({ ...p, rr: v }))} />
          <VitalInput label="SpO2" unit="%" placeholder="98" value={vitals.spo2} onChange={v => setVitals(p => ({ ...p, spo2: v }))} />
          <VitalInput label="Temp" unit="°F" placeholder="98.6" type="text" value={vitals.temperature} onChange={v => setVitals(p => ({ ...p, temperature: v }))} />
          <VitalInput label="GRBS" unit="mg/dL" placeholder="110" value={vitals.grbs} onChange={v => setVitals(p => ({ ...p, grbs: v }))} />
        </div>
      </SubSection>

      {/* ── Pain Assessment ── */}
      <SubSection title="Pain Assessment">
        <PainSlider value={pain.pain_score} onChange={v => setPain(p => ({ ...p, pain_score: v }))} />
        <div className="mt-2">
          <label className="block text-xs text-muted-foreground mb-1">Pain Description</label>
          <input type="text" placeholder="Location, nature, aggravating/relieving factors..."
            value={pain.pain_details} onChange={e => setPain(p => ({ ...p, pain_details: e.target.value }))}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" />
        </div>
      </SubSection>

      {/* ── Hygiene Assessment ── */}
      <SubSection title="Hygiene Assessment">
        <label className="block text-xs font-medium text-muted-foreground mb-1">Hygiene Notes</label>
        <textarea rows={3} placeholder="Environmental, oral, and skin hygiene observations..."
          value={hygieneNotes}
          onChange={e => setHygieneNotes(e.target.value)}
          className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm resize-none" />
      </SubSection>

      <SubSection title="Procedures">
        <ProcedureCheckboxGroup
          title="Nursing Procedures"
          color="text-blue-700 dark:text-blue-300"
          procedures={NURSING_PROCEDURES}
          selected={proceduresNursing}
          onChange={setProceduresNursing}
        />
      </SubSection>

      {/* ── Visit Summary ── */}
      <SubSection title="Visit Summary">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Procedures & Instructions Given</label>
            <textarea rows={3} placeholder="Procedures performed, instructions given..."
              value={procedures} onChange={e => setProcedures(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm resize-none" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Future Plans & Suggestions</label>
            <textarea rows={3} placeholder="Recommendations, follow-up plans..."
              value={futurePlans} onChange={e => setFuturePlans(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm resize-none" />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-muted-foreground">Auto-Generated Summary (editable)</label>
            <button type="button" onClick={handleAutoGenerate}
              disabled={generating || !hasSavedRow}
              title={!hasSavedRow ? 'Save assessment first' : ''}
              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed">
              {generating
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Sparkles className="h-3.5 w-3.5" />}
              {generating ? 'Generating...' : 'Generate from assessment'}
            </button>
          </div>
          <textarea rows={4} placeholder="Click 'Generate from assessment' or type manually..."
            value={summary} onChange={e => setSummary(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm resize-none" />
        </div>
      </SubSection>

      {/* ── Save ── */}
      <div className="flex justify-end pt-2">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-50">
          {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saved ? 'Saved!' : 'Save Nursing Assessment'}
        </button>
      </div>

      <ActiveFocusVoiceMic />
    </div>
  );
}