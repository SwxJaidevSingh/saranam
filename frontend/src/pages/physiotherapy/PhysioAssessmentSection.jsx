import { useState } from 'react';
import { Save, RefreshCw, Plus, Trash2 } from 'lucide-react';
import physioApi from '../../api/physiotherapy';

// ---- Sub-section wrapper ----
function SubSection({ title, children }) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-foreground border-b border-border pb-1">{title}</h4>
      {children}
    </div>
  );
}

function TextArea({ label, placeholder, value, onChange, disabled, rows = 3 }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <textarea
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm disabled:opacity-60 resize-none"
      />
    </div>
  );
}

function TextField({ label, placeholder, value, onChange, disabled }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm disabled:opacity-60"
      />
    </div>
  );
}

// ---- Pain VAS slider ----
function PainSlider({ value, onChange, disabled }) {
  const score = value ?? 0;
  const color = score <= 3 ? 'text-success-600' : score <= 6 ? 'text-warning-600' : 'text-danger-600';
  const label = score === 0 ? 'None' : score <= 3 ? 'Mild' : score <= 6 ? 'Moderate' : 'Severe';
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-muted-foreground">VAS Pain Score (0-10)</label>
        <span className={`text-sm font-bold ${color}`}>{score}/10 &mdash; {label}</span>
      </div>
      <input
        type="range"
        min="0"
        max="10"
        value={score}
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

// ---- Diagnosis rows ----
function DiagnosisRows({ items, setItems, disabled }) {
  const addRow = () => setItems(p => [...p, { diagnosis_code: '', diagnosis_name: '', diagnosis_type: 'primary', notes: '' }]);
  const removeRow = (i) => setItems(p => p.filter((_, idx) => idx !== i));
  const update = (i, field, val) => setItems(p => p.map((row, idx) => idx === i ? { ...row, [field]: val } : row));

  return (
    <div className="space-y-2">
      {items.map((row, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 items-end p-3 bg-muted/20 rounded-lg border border-border">
          <div className="col-span-2">
            <label className="block text-xs text-muted-foreground mb-1">ICD Code</label>
            <input type="text" placeholder="M54.5" value={row.diagnosis_code} onChange={e => update(i, 'diagnosis_code', e.target.value)} disabled={disabled}
              className="w-full px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm disabled:opacity-60" />
          </div>
          <div className="col-span-4">
            <label className="block text-xs text-muted-foreground mb-1">Diagnosis *</label>
            <input type="text" placeholder="e.g. Low back pain" value={row.diagnosis_name} onChange={e => update(i, 'diagnosis_name', e.target.value)} disabled={disabled}
              className="w-full px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm disabled:opacity-60" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-muted-foreground mb-1">Type</label>
            <select value={row.diagnosis_type} onChange={e => update(i, 'diagnosis_type', e.target.value)} disabled={disabled}
              className="w-full px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm disabled:opacity-60">
              <option value="primary">Primary</option>
              <option value="secondary">Secondary</option>
              <option value="differential">Differential</option>
              <option value="provisional">Provisional</option>
            </select>
          </div>
          <div className="col-span-3">
            <label className="block text-xs text-muted-foreground mb-1">Notes</label>
            <input type="text" placeholder="Optional" value={row.notes} onChange={e => update(i, 'notes', e.target.value)} disabled={disabled}
              className="w-full px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm disabled:opacity-60" />
          </div>
          {!disabled && (
            <div className="col-span-1 flex items-end pb-0.5">
              <button onClick={() => removeRow(i)} className="p-1.5 text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      ))}
      {!disabled && (
        <button onClick={addRow} className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700">
          <Plus className="h-4 w-4" /> Add Diagnosis
        </button>
      )}
    </div>
  );
}

// =====================================================================
// Main Physiotherapy Assessment Component
// =====================================================================
export default function PhysioAssessmentSection({ visit, onSaved }) {
  const existingPhysioData = visit.service_metadata?.physio_assessment || {};

  // ---- Pain Assessment ----
  const [painScore, setPainScore] = useState(existingPhysioData.pain_assessment?.vas_score ?? 0);
  const [areaOfPain, setAreaOfPain] = useState(existingPhysioData.pain_assessment?.area_of_pain || '');
  const [natureOfPain, setNatureOfPain] = useState(existingPhysioData.pain_assessment?.nature_of_pain || '');

  // ---- On Observation ----
  const [built, setBuilt] = useState(existingPhysioData.on_observation?.built || '');
  const [posture, setPosture] = useState(existingPhysioData.on_observation?.posture || '');
  const [swelling, setSwelling] = useState(existingPhysioData.on_observation?.swelling || '');
  const [deformity, setDeformity] = useState(existingPhysioData.on_observation?.deformity || '');
  const [wasting, setWasting] = useState(existingPhysioData.on_observation?.wasting || '');

  // ---- On Palpation ----
  const [tenderness, setTenderness] = useState(existingPhysioData.on_palpation?.tenderness || '');
  const [edema, setEdema] = useState(existingPhysioData.on_palpation?.edema || '');
  const [scar, setScar] = useState(existingPhysioData.on_palpation?.scar || '');

  // ---- On Examination ----
  const [rom, setRom] = useState(existingPhysioData.on_examination?.rom || '');
  const [mmt, setMmt] = useState(existingPhysioData.on_examination?.mmt || '');
  const [tone, setTone] = useState(existingPhysioData.on_examination?.tone || '');
  const [balance, setBalance] = useState(existingPhysioData.on_examination?.balance || '');
  const [functionalStatus, setFunctionalStatus] = useState(existingPhysioData.on_examination?.functional_status || '');

  // ---- Physiotherapist's Notes ----
  const [physioNotes, setPhysioNotes] = useState(existingPhysioData.physio_notes || '');

  // ---- Diagnoses (ICD) ----
  const [diagnoses, setDiagnoses] = useState(
    (visit.diagnoses || []).map(d => ({
      diagnosis_code: d.icd10_code || d.diagnosis_code || '',
      diagnosis_name: d.diagnosis_text || d.diagnosis_name || '',
      diagnosis_type: d.diagnosis_type || 'primary',
      notes: d.notes || '',
    }))
  );

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const isClosed = ['completed', 'no_show', 'cancelled'].includes(visit.status);

  const handleSave = async () => {
    const validDiagnoses = diagnoses.filter(d => d.diagnosis_name.trim());

    setSaving(true);
    try {
      // Save physio assessment
      const assessmentPayload = {
        pain_assessment: {
          vas_score: painScore,
          area_of_pain: areaOfPain,
          nature_of_pain: natureOfPain,
        },
        on_observation: { built, posture, swelling, deformity, wasting },
        on_palpation: { tenderness, edema, scar },
        on_examination: { rom, mmt, tone, balance, functional_status: functionalStatus },
        physio_notes: physioNotes,
      };
      await physioApi.savePhysioAssessment(visit.id, assessmentPayload);

      // Save diagnoses (ICD entries)
      if (validDiagnoses.length > 0) {
        const diagPayload = validDiagnoses.map(d => ({
          diagnosis_text: d.diagnosis_name,
          icd10_code: d.diagnosis_code || null,
          diagnosis_type: d.diagnosis_type,
          notes: d.notes || null,
        }));
        await physioApi.saveDiagnoses(visit.id, diagPayload);
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      onSaved();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save physiotherapy assessment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* ---- Diagnoses ---- */}
      <SubSection title="Diagnosis (ICD Codes)">
        <DiagnosisRows items={diagnoses} setItems={setDiagnoses} disabled={isClosed} />
      </SubSection>

      {/* ---- Pain Assessment ---- */}
      <SubSection title="Pain Assessment">
        <PainSlider
          value={painScore}
          onChange={setPainScore}
          disabled={isClosed}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
          <TextField
            label="Area of Pain"
            placeholder="e.g. Lower back, left knee, cervical spine..."
            value={areaOfPain}
            onChange={setAreaOfPain}
            disabled={isClosed}
          />
          <TextField
            label="Nature of Pain"
            placeholder="e.g. Sharp, dull, radiating, burning..."
            value={natureOfPain}
            onChange={setNatureOfPain}
            disabled={isClosed}
          />
        </div>
      </SubSection>

      {/* ---- On Observation ---- */}
      <SubSection title="On Observation">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <TextField label="Built" placeholder="e.g. Mesomorph, thin, obese..." value={built} onChange={setBuilt} disabled={isClosed} />
          <TextField label="Posture" placeholder="e.g. Kyphotic, lordotic, scoliotic..." value={posture} onChange={setPosture} disabled={isClosed} />
          <TextField label="Swelling" placeholder="e.g. Present over left knee, absent..." value={swelling} onChange={setSwelling} disabled={isClosed} />
          <TextField label="Deformity" placeholder="e.g. Valgus deformity, none..." value={deformity} onChange={setDeformity} disabled={isClosed} />
          <TextField label="Wasting" placeholder="e.g. Quadriceps wasting, absent..." value={wasting} onChange={setWasting} disabled={isClosed} />
        </div>
      </SubSection>

      {/* ---- On Palpation ---- */}
      <SubSection title="On Palpation">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <TextField label="Tenderness" placeholder="e.g. Grade II over L4-L5..." value={tenderness} onChange={setTenderness} disabled={isClosed} />
          <TextField label="Edema" placeholder="e.g. Pitting edema present, absent..." value={edema} onChange={setEdema} disabled={isClosed} />
          <TextField label="Scar" placeholder="e.g. Surgical scar over right knee..." value={scar} onChange={setScar} disabled={isClosed} />
        </div>
      </SubSection>

      {/* ---- On Examination ---- */}
      <SubSection title="On Examination">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TextArea
            label="ROM (Range of Motion)"
            placeholder="e.g. Knee flexion: 0-110 degrees, Hip flexion: 0-90 degrees..."
            value={rom}
            onChange={setRom}
            disabled={isClosed}
            rows={3}
          />
          <TextArea
            label="MMT (Manual Muscle Testing)"
            placeholder="e.g. Quadriceps: Grade 4/5, Hamstrings: Grade 3/5..."
            value={mmt}
            onChange={setMmt}
            disabled={isClosed}
            rows={3}
          />
          <TextArea
            label="Tone"
            placeholder="e.g. Normal, hypertonic, hypotonic, spasticity grade..."
            value={tone}
            onChange={setTone}
            disabled={isClosed}
            rows={3}
          />
          <TextArea
            label="Balance"
            placeholder="e.g. Static balance: fair, Dynamic balance: poor..."
            value={balance}
            onChange={setBalance}
            disabled={isClosed}
            rows={3}
          />
          <TextArea
            label="Functional Status"
            placeholder="e.g. Independent ambulation with walker, requires assistance for ADL..."
            value={functionalStatus}
            onChange={setFunctionalStatus}
            disabled={isClosed}
            rows={3}
          />
        </div>
      </SubSection>

      {/* ---- Physiotherapist's Notes ---- */}
      <SubSection title="Physiotherapist's Notes">
        <TextArea
          label="Clinical Notes / Treatment Plan"
          placeholder="Overall clinical impression, treatment goals, modalities planned, home exercise program..."
          value={physioNotes}
          onChange={setPhysioNotes}
          disabled={isClosed}
          rows={4}
        />
      </SubSection>

      {/* ---- Save ---- */}
      {!isClosed && (
        <div className="flex justify-end pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-50"
          >
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saved ? 'Saved!' : 'Save Physiotherapy Assessment'}
          </button>
        </div>
      )}
    </div>
  );
}
