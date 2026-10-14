/**
 * DoctorAssessmentForm — Saranam version
 * Adapted from OPD DoctorAssessmentSection with same Tailwind UI pattern
 */
import { useState, useEffect } from 'react';
import { Save, RefreshCw, Plus, Trash2, Loader2 } from 'lucide-react';
import saranamApi from '../../../api/saranam';
import AiSummaryBlock from './AiSummaryBlock';
import InvestigationsSection from './InvestigationSection';
import ProcedureCheckboxGroup from '../../../components/common/ProcedureCheckboxGroup';
import ActiveFocusVoiceMic from '../../../components/voice/ActiveFocusVoiceMic';

// ─── Helpers ──────────────────────────────────────────────────────────────
function SubSection({ title, children }) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-foreground border-b border-border pb-1">{title}</h4>
      {children}
    </div>
  );
}

function TextArea({ label, placeholder, value, onChange, rows = 3 }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <textarea
        rows={rows} placeholder={placeholder} value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm resize-none"
      />
    </div>
  );
}

function InputField({ label, placeholder, value, onChange }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <input
        type="text" placeholder={placeholder} value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
      />
    </div>
  );
}


function SelectField({ label, options, value, onChange }) {
  const isOtherSelected = value && !options.includes(value);
  const [showOther, setShowOther] = useState(isOtherSelected);

  const dropdownValue = showOther ? 'Other' : value;

  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <select
        value={dropdownValue}
        onChange={e => {
          if (e.target.value === 'Other') {
            setShowOther(true);
            onChange('');
          } else {
            setShowOther(false);
            onChange(e.target.value);
          }
        }}
        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
      >
        <option value="">Select...</option>
        {options.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
        <option value="Other">Other</option>
      </select>
      {showOther && (
        <input
          type="text"
          placeholder="Please specify"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full mt-2 px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
        />
      )}
    </div>
  );
}

const MEDICAL_PROCEDURES = [
  { key: 'ascites_tapping', label: 'Ascites Tapping' },
  { key: 'crisis_plan_for_breathlessness', label: 'Crisis plan for breathlessness' },
  { key: 'crisis_plan_for_fall', label: 'Crisis plan for fall' },
  { key: 'crisis_plan_for_hemorrhage', label: 'Crisis plan for hemorrhage' },
  { key: 'crisis_plan_for_maggots', label: 'Crisis plan for maggots' },
  { key: 'crisis_plan_for_syncope', label: 'Crisis plan for syncope' },
  { key: 'death_plan', label: 'Death plan' },
  { key: 'diagnosis_and_prognosis_counselling', label: 'Diagnosis and Prognosis counselling' },
  { key: 'dpm_referrals', label: 'DPM (Dept of Palliative Medicine) referrals' },
  { key: 'end_of_life_counselling', label: 'End of life counselling' },
  { key: 'enema', label: 'Enema' },
  { key: 'initial_assessment', label: 'Initial assessment' },
  { key: 'iv_injections', label: 'IV injections' },
  { key: 'medication_review', label: 'Medication review' },
  { key: 'medicines_prescribed', label: 'Medicines prescribed' },
  { key: 'referral_to_start_morphine', label: 'Referral to start morphine' },
  { key: 'reorientation_technique', label: 'Reorientation technique' },
];

// ═══════════════════════════════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════════════════════════════
export default function DoctorAssessmentForm({ visitId, patientId, onSaved, showProcedures = true }) {
  const [loading, setLoading] = useState(true);

  // Clinical history
  const [hpe, setHpe] = useState('');
  const [chiefComplaints, setChiefComplaints] = useState('');
  const [historyOfIllness, setHistoryOfIllness] = useState('');
  const [comorbidities, setComorbidities] = useState('');
  const [medicationHistory, setMedicationHistory] = useState('');
  const [familyHistory, setFamilyHistory] = useState('');

  // Investigations
  const [panelValues, setPanelValues] = useState({});
  const [othersItems, setOthersItems] = useState([]);
  const [previousInvestigations, setPreviousInvestigations] = useState('');
  const [investigationNotes, setInvestigationNotes] = useState('');

  // Personal history
  const [diet, setDiet] = useState('');
  const [appetite, setAppetite] = useState('');
  const [bowel, setBowel] = useState('');
  const [bladder, setBladder] = useState('');
  const [habits, setHabits] = useState('');

  //Procedures
  const [proceduresMedical, setProceduresMedical] = useState([]);

  // Systemic examination
  const [respiratory, setRespiratory] = useState('');
  const [cardiovascular, setCardiovascular] = useState('');
  const [perAbdomen, setPerAbdomen] = useState('');
  const [cns, setCns] = useState('');

  // Doctor's notes
  const [doctorNotes, setDoctorNotes] = useState('');

  // Diagnoses (ICD)
  const [diagnoses, setDiagnoses] = useState([]);

  const [aiSummary, setAiSummary] = useState('');
  const [hasSavedRow, setHasSavedRow] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { loadData(); }, [visitId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await saranamApi.getAssessment(visitId, 'doctor');
      if (data) {
        setHpe(data.hpe_report || '');
        setChiefComplaints(data.chief_complaints || '');
        setHistoryOfIllness(data.history_of_presenting_illness || '');
        setComorbidities(data.comorbidities || '');
        setMedicationHistory(data.medication_history || '');
        setPreviousInvestigations(data.previous_investigations || '');
        setPanelValues(data.investigation_panels || {});
        setOthersItems(data.investigation_others || []);
        setInvestigationNotes(data.investigation_notes || '');
        setFamilyHistory(data.family_history || '');
        setDiet(data.diet || '');
        setAppetite(data.appetite || '');
        setBowel(data.bowel || '');
        setBladder(data.bladder || '');

        const rawHabits = data.habits || '';
        if (rawHabits === 'None') {
          setHabitsData(prev => ({ ...prev, None: true }));
        } else {
          const parsed = rawHabits.split(',').map(h => h.trim()).filter(Boolean);
          const updates = {};
          parsed.forEach(entry => {
            const colonIdx = entry.indexOf(':');
            const name = colonIdx > -1 ? entry.slice(0, colonIdx).trim() : entry.trim();
            const details = colonIdx > -1 ? entry.slice(colonIdx + 1).trim() : '';
            const key = [...HABIT_OPTIONS, 'Other'].find(h => h === name) || 'Other';
            updates[key] = { checked: true, details };
          });
          setHabitsData(prev => ({ ...prev, ...updates }));
        }

        setRespiratory(data.exam_respiratory || '');
        setCardiovascular(data.exam_cardiovascular || '');
        setPerAbdomen(data.exam_per_abdomen || '');
        setCns(data.exam_cns || '');
        setDoctorNotes(data.doctor_notes || '');
        setAiSummary(data.ai_summary || '');
        setHasSavedRow(true);
        // Parse diagnosis from the diagnosis text field
        if (data.diagnosis) {
          setDiagnoses([{ code: '', name: data.diagnosis, type: 'primary', notes: '' }]);
        }
      }
      // Load procedures (shared record — medical slice)
      const proc = await saranamApi.getAssessment(visitId, 'procedures');
      if (proc) {
        setProceduresMedical(proc.medical || []);
      }
    } catch (err) {
      // No existing data
    } finally {
      setLoading(false);
    }
  };

  const DIET_OPTIONS = ['Veg', 'Non-Veg', 'Mixed'];
  const APPETITE_OPTIONS = ['Good', 'Fair', 'Poor', 'Anorexic', 'Reduced'];
  const HABIT_OPTIONS = ['Alcohol', 'Tobacco', 'Drugs', 'Smoking'];

  const [habitsData, setHabitsData] = useState({
    None: false,
    Alcohol: { checked: false, details: '' },
    Tobacco: { checked: false, details: '' },
    Drugs: { checked: false, details: '' },
    Smoking: { checked: false, details: '' },
    Other: { checked: false, details: '' },
  });

  const habitsList = habits.split(',').map(h => h.trim()).filter(Boolean);
  // const finalHabits = habitsList.includes('Other') && otherHabit.trim()
  //   ? [...habitsList.filter(h => h !== 'Other'), otherHabit.trim()].join(', ')
  //   : habitsList.join(', ');

  const toggleHabit = (habit) => {
    if (habit === 'None') {
      setHabitsData(prev => {
        const allUnchecked = Object.fromEntries(
          HABIT_OPTIONS.concat(['Other']).map(h => [h, { ...prev[h], checked: false }])
        );
        return { ...allUnchecked, None: !prev.None };
      });
      return;
    }
    setHabitsData(prev => ({
      ...prev,
      None: false,
      [habit]: { ...prev[habit], checked: !prev[habit].checked },
    }));
  };

  const updateHabitDetails = (habit, details) => {
    setHabitsData(prev => ({ ...prev, [habit]: { ...prev[habit], details } }));
  };

  // Serialize for save
  const finalHabits = habitsData.None
    ? 'None'
    : [...HABIT_OPTIONS, 'Other']
      .filter(h => habitsData[h].checked)
      .map(h => habitsData[h].details.trim() ? `${h}: ${habitsData[h].details.trim()}` : h)
      .join(', ');


  const handleSave = async () => {
    setSaving(true);

    console.log('handleSave called');
    console.log('panelValues:', panelValues);
    console.log('othersItems:', othersItems);
    try {
      const validDiagnoses = diagnoses.filter(d => d.name.trim());

      await saranamApi.saveAssessment(visitId, 'doctor', {
        diagnosis: validDiagnoses.map(d => `${d.code ? `[${d.code}] ` : ''}${d.name} (${d.type})${d.notes ? ` — ${d.notes}` : ''}`).join('; ') || '',
        hpe_report: hpe,
        chief_complaints: chiefComplaints,
        history_of_presenting_illness: historyOfIllness,
        comorbidities,
        medication_history: medicationHistory,
        investigation_panels: panelValues,
        investigation_others: othersItems,
        investigation_notes: investigationNotes,
        family_history: familyHistory,
        diet,
        appetite,
        bowel,
        bladder,
        habits: finalHabits,
        exam_respiratory: respiratory,
        exam_cardiovascular: cardiovascular,
        exam_per_abdomen: perAbdomen,
        exam_cns: cns,
        doctor_notes: doctorNotes,
        ai_summary: aiSummary,
      });

      const currentProc = await saranamApi.getAssessment(visitId, 'procedures').catch(() => null);
      await saranamApi.saveAssessment(visitId, 'procedures', {
        nursing: currentProc?.nursing || [],
        physiotherapy: currentProc?.physiotherapy,
        counsellor: currentProc?.counsellor || [],
        medical: proceduresMedical,
        notes: currentProc?.notes || '',
      });

      setSaved(true);
      setHasSavedRow(true);
      setTimeout(() => setSaved(false), 3000);
      if (onSaved) onSaved();
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to save doctor's assessment");
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

      {/* ── Clinical History ── */}
      <SubSection title="Clinical History">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TextArea label="Diagnosis" placeholder="Diagnosis details / histopathology report..." value={hpe} onChange={setHpe} />
          <TextArea label="Chief Complaints" placeholder="Main presenting complaints..." value={chiefComplaints} onChange={setChiefComplaints} />
        </div>
        <TextArea label="History of Presenting Illness" placeholder="Detailed history of the current illness, onset, duration, progression..." value={historyOfIllness} onChange={setHistoryOfIllness} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TextArea label="Comorbidities" placeholder="DM, HTN, Asthma, etc." value={comorbidities} onChange={setComorbidities} rows={2} />
          <TextArea label="Medication History" placeholder="Current and past medications..." value={medicationHistory} onChange={setMedicationHistory} rows={2} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TextArea label="Family History" placeholder="Relevant family medical history..." value={familyHistory} onChange={setFamilyHistory} rows={2} />
        </div>
      </SubSection>

      {/* ── Investigations ── */}
      <SubSection title="Investigations">
        <InvestigationsSection
          visitId={visitId}
          patientId={patientId}
          panelValues={panelValues}
          setPanelValues={setPanelValues}
          othersItems={othersItems}
          setOthersItems={setOthersItems}
          notes={investigationNotes}
          setNotes={setInvestigationNotes}
        />
      </SubSection>

      {/* ── Personal History ── */}
      <SubSection title="Personal History">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SelectField label="Diet" options={DIET_OPTIONS} value={diet} onChange={setDiet} />
          <SelectField label="Appetite" options={APPETITE_OPTIONS} value={appetite} onChange={setAppetite} />
          <InputField label="Bowel" placeholder="Normal / Constipation..." value={bowel} onChange={setBowel} />
          <InputField label="Bladder" placeholder="Normal / Retention..." value={bladder} onChange={setBladder} />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Habits</label>
          <div className="space-y-2">
            {/* None option */}
            <label className="flex items-center gap-1.5 text-sm text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={habitsData.None}
                onChange={() => toggleHabit('None')}
                className="h-4 w-4 rounded border-border"
              />
              None
            </label>
            {/* Each habit with detail input */}
            {[...HABIT_OPTIONS, 'Other'].map(h => (
              <div key={h} className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-sm text-foreground cursor-pointer w-24 flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={habitsData[h].checked}
                    onChange={() => toggleHabit(h)}
                    disabled={habitsData.None}
                    className="h-4 w-4 rounded border-border"
                  />
                  {h}
                </label>
                {habitsData[h].checked && (
                  <input
                    type="text"
                    placeholder={
                      h === 'Alcohol' ? 'e.g. Daily, 2 pegs' :
                        h === 'Tobacco' ? 'e.g. Chewing, 3x/day' :
                          h === 'Smoking' ? 'e.g. 10 cigarettes/day' :
                            h === 'Drugs' ? 'e.g. Cannabis occasionally' :
                              'Specify...'
                    }
                    value={habitsData[h].details}
                    onChange={e => updateHabitDetails(h, e.target.value)}
                    className="flex-1 px-3 py-1.5 border border-border rounded-lg bg-background text-foreground text-sm"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </SubSection>

      {/* ── Systemic Examination ── */}
      <SubSection title="Systemic Examination">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TextArea label="Respiratory System" placeholder="Findings on respiratory examination..." value={respiratory} onChange={setRespiratory} rows={2} />
          <TextArea label="Cardiovascular System" placeholder="Heart sounds, murmurs, JVP..." value={cardiovascular} onChange={setCardiovascular} rows={2} />
          <TextArea label="Per Abdomen" placeholder="Soft, non-tender, organomegaly..." value={perAbdomen} onChange={setPerAbdomen} rows={2} />
          <TextArea label="Central Nervous System" placeholder="Higher functions, reflexes, motor/sensory..." value={cns} onChange={setCns} rows={2} />
        </div>
      </SubSection>

      {/* ── Doctor's Notes ── */}
      <SubSection title="Doctor's Notes">
        <TextArea
          label="Clinical Notes / Impression"
          placeholder="Overall clinical impression, plan, advice to patient..."
          value={doctorNotes} onChange={setDoctorNotes} rows={4}
        />
        <AiSummaryBlock
          visitId={visitId}
          assessmentType="doctor"
          value={aiSummary}
          onChange={setAiSummary}
          hasSavedRow={hasSavedRow}
        />
      </SubSection>

      {/* --- Procedures--- */}
      {showProcedures && (
        <SubSection title="Procedures">
          <ProcedureCheckboxGroup
            title="Doctor Interventions"
            color="text-pink-700 dark:text-pink-300"
            procedures={MEDICAL_PROCEDURES}
            selected={proceduresMedical}
            onChange={setProceduresMedical}
          />
        </SubSection>
      )}

      {/* ── Save ── */}
      <div className="flex justify-end pt-2">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-50">
          {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saved ? 'Saved!' : "Save Doctor's Assessment"}
        </button>
      </div>
      <ActiveFocusVoiceMic />
    </div>
  );
}
