/**
 * PhysiotherapyAssessmentForm — Hospital Portal (baseline physiotherapy).
 *
 * Ported from frontend/src/pages/patients/tabs/PhysiotherapyAssessmentForm.jsx,
 * repointed at the portal baseline API. Receives the `physio` slice of the
 * baseline bundle and persists via onSave('physio', payload) → PUT /baseline/physio.
 *
 * Props: { data, editable, onSave }
 */
import { useState, useEffect } from 'react';
import { Save, RefreshCw } from 'lucide-react';

function SubSection({ title, children }) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-foreground border-b border-border pb-1">{title}</h4>
      {children}
    </div>
  );
}

function InputField({ label, placeholder, value, onChange, disabled }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <input type="text" placeholder={placeholder || label} value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm disabled:opacity-60" />
    </div>
  );
}

function TextArea({ label, placeholder, value, onChange, rows = 3, disabled }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <textarea rows={rows} placeholder={placeholder || label} value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm resize-none disabled:opacity-60" />
    </div>
  );
}

function PainSlider({ value, onChange, disabled }) {
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
        onChange={e => onChange(parseInt(e.target.value, 10))}
        disabled={disabled}
        className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-primary-600 disabled:opacity-60" />
      <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
        <span>0 None</span><span>3 Mild</span><span>6 Moderate</span><span>10 Severe</span>
      </div>
    </div>
  );
}

export default function PhysiotherapyAssessmentForm({ data, editable = false, onSave }) {
  const [painScore, setPainScore] = useState(0);
  const [painArea, setPainArea] = useState('');
  const [painNature, setPainNature] = useState('');

  const [obsBuilt, setObsBuilt] = useState('');
  const [obsPosture, setObsPosture] = useState('');
  const [obsSwelling, setObsSwelling] = useState('');
  const [obsDeformity, setObsDeformity] = useState('');
  const [obsWasting, setObsWasting] = useState('');

  const [palpTenderness, setPalpTenderness] = useState('');
  const [palpEdema, setPalpEdema] = useState('');
  const [palpScar, setPalpScar] = useState('');

  const [examRom, setExamRom] = useState('');
  const [examMmt, setExamMmt] = useState('');
  const [examTone, setExamTone] = useState('');
  const [examBalance, setExamBalance] = useState('');
  const [examFunctional, setExamFunctional] = useState('');

  const [physioNotes, setPhysioNotes] = useState('');
  const [aiSummary, setAiSummary] = useState('');

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    setPainScore(data.pain_vas_score || 0);
    setPainArea(data.pain_area || '');
    setPainNature(data.pain_nature || '');
    setObsBuilt(data.obs_built || '');
    setObsPosture(data.obs_posture || '');
    setObsSwelling(data.obs_swelling || '');
    setObsDeformity(data.obs_deformity || '');
    setObsWasting(data.obs_wasting || '');
    setPalpTenderness(data.palp_tenderness || '');
    setPalpEdema(data.palp_edema || '');
    setPalpScar(data.palp_scar || '');
    setExamRom(data.exam_rom || '');
    setExamMmt(data.exam_mmt || '');
    setExamTone(data.exam_tone || '');
    setExamBalance(data.exam_balance || '');
    setExamFunctional(data.exam_functional_status || '');
    setPhysioNotes(data.physio_notes || '');
    setAiSummary(data.ai_summary || '');
  }, [data]);

  const handleSave = async () => {
    if (!editable || !onSave) return;
    setSaving(true);
    try {
      await onSave('physio', {
        pain_vas_score: painScore,
        pain_area: painArea,
        pain_nature: painNature,
        obs_built: obsBuilt,
        obs_posture: obsPosture,
        obs_swelling: obsSwelling,
        obs_deformity: obsDeformity,
        obs_wasting: obsWasting,
        palp_tenderness: palpTenderness,
        palp_edema: palpEdema,
        palp_scar: palpScar,
        exam_rom: examRom,
        exam_mmt: examMmt,
        exam_tone: examTone,
        exam_balance: examBalance,
        exam_functional_status: examFunctional,
        physio_notes: physioNotes,
        ai_summary: aiSummary,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to save physiotherapy assessment');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <SubSection title="Pain Assessment">
        <PainSlider value={painScore} onChange={setPainScore} disabled={!editable} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
          <InputField label="Area of Pain" placeholder="Right shoulder, lower back..." value={painArea} onChange={setPainArea} disabled={!editable} />
          <InputField label="Nature of Pain" placeholder="Aching, burning, sharp, throbbing..." value={painNature} onChange={setPainNature} disabled={!editable} />
        </div>
      </SubSection>

      <SubSection title="On Observation">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <InputField label="Built" placeholder="Moderate" value={obsBuilt} onChange={setObsBuilt} disabled={!editable} />
          <InputField label="Posture" placeholder="Normal / Stooped" value={obsPosture} onChange={setObsPosture} disabled={!editable} />
          <InputField label="Swelling" placeholder="Present / Absent" value={obsSwelling} onChange={setObsSwelling} disabled={!editable} />
          <InputField label="Deformity" placeholder="Present / Absent" value={obsDeformity} onChange={setObsDeformity} disabled={!editable} />
          <InputField label="Wasting" placeholder="Present / Absent" value={obsWasting} onChange={setObsWasting} disabled={!editable} />
        </div>
      </SubSection>

      <SubSection title="On Palpation">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <InputField label="Tenderness" placeholder="Location, grade..." value={palpTenderness} onChange={setPalpTenderness} disabled={!editable} />
          <InputField label="Edema" placeholder="Present / Absent, pitting..." value={palpEdema} onChange={setPalpEdema} disabled={!editable} />
          <InputField label="Scar" placeholder="Location, type..." value={palpScar} onChange={setPalpScar} disabled={!editable} />
        </div>
      </SubSection>

      <SubSection title="On Examination">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TextArea label="ROM (Range of Motion)" placeholder="Active/passive ROM findings..." value={examRom} onChange={setExamRom} rows={2} disabled={!editable} />
          <TextArea label="MMT (Manual Muscle Testing)" placeholder="Muscle strength grades..." value={examMmt} onChange={setExamMmt} rows={2} disabled={!editable} />
          <TextArea label="Tone" placeholder="Normal / Hypertonia / Hypotonia..." value={examTone} onChange={setExamTone} rows={2} disabled={!editable} />
          <TextArea label="Balance" placeholder="Sitting / Standing balance..." value={examBalance} onChange={setExamBalance} rows={2} disabled={!editable} />
        </div>
        <TextArea label="Functional Status" placeholder="ADL ability, mobility level, transfer ability..." value={examFunctional} onChange={setExamFunctional} rows={2} disabled={!editable} />
      </SubSection>

      <SubSection title="Physiotherapist's Notes">
        <TextArea
          label="Clinical Notes / Treatment Plan"
          placeholder="Overall assessment, treatment goals, exercises prescribed, home program..."
          value={physioNotes} onChange={setPhysioNotes} rows={4} disabled={!editable}
        />
        <TextArea
          label="Summary (editable)"
          placeholder="Type a summary..."
          value={aiSummary} onChange={setAiSummary} rows={4} disabled={!editable}
        />
      </SubSection>

      {editable && (
        <div className="flex justify-end pt-2">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-50">
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saved ? 'Saved!' : 'Save Physiotherapy Assessment'}
          </button>
        </div>
      )}
    </div>
  );
}
