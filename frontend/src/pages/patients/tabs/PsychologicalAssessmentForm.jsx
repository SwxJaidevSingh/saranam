import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Grid, Button, Typography, Alert, TextField, MenuItem,
  Slider, FormControlLabel, Checkbox, CircularProgress, Chip, IconButton,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import { saranamApi } from '../../../api/saranam';

const ASSESSMENT_TYPE = 'psychological';

const label = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const problemCategories = {
  emotional: ['worry_or_anxiety', 'sadness_or_depression', 'loss_of_interest_or_enjoyment', 'grief_or_loss', 'fear', 'lonliness', 'anger', 'changes_in_appearance', 'feeling_of_worthlessness_or_being_a_burden'],
  practical: ['taking_care_of_myself', 'taking_care_of_others', 'safety', 'work', 'school', 'housing/utilities', 'finances', 'insurances', 'transportation', 'child_care', 'having_enough_food', 'acess_to_medicine', 'treatment_decision'],
  spiritual: ['sense_of_meaning_or_purpose', 'changes_in_faith_or_beliefs', 'conflicts_between_beliefs_and_cancer_treatments', 'fear_of_death', 'relationship_with_the_sacred', 'ritual_or_dietary_needs'],
};

const distressColor = (val) => {
  if (val <= 3) return 'success.main';
  if (val <= 6) return 'warning.main';
  return 'error.main';
};

// ─── Counsellor procedure list (from ProceduresSection) ────────────────
const COUNSELLOR_PROCEDURES = [
  { key: 'act_informed_interventions', label: 'ACT informed interventions' },
  { key: 'bereavement_care', label: 'Bereavement care' },
  { key: 'breaking_bad_news', label: 'Breaking bad news' },
  { key: 'caregiver_emotional_support', label: 'Caregiver emotional support' },
  { key: 'cbt_informed_interventions', label: 'CBT informed interventions' },
  { key: 'collusion_management', label: 'Collusion management' },
  { key: 'counselling_intervention', label: 'Counselling intervention' },
  { key: 'diagnosis_and_prognosis_counselling', label: 'Diagnosis and Prognosis counselling' },
  { key: 'dignity_conserving_intervention', label: 'Dignity conserving intervention' },
  { key: 'distraction_technique', label: 'Distraction technique' },
  { key: 'end_of_life_counselling', label: 'End of life counselling' },
  { key: 'existential_meaning_centred_intervention', label: 'Existential/meaning centred intervention' },
  { key: 'family_counselling', label: 'Family counselling' },
  { key: 'grief_support', label: 'Grief support' },
  { key: 'journalling', label: 'Journalling' },
  { key: 'legacy_document_creation', label: 'Legacy document creation' },
  { key: 'memory_making', label: 'Memory making' },
  { key: 'others_counselling', label: 'Others' },
  { key: 'psychoeducation', label: 'Psychoeducation' },
  { key: 'relaxation_techniques', label: 'Relaxation techniques' },
  { key: 'sleep_hygiene', label: 'Sleep hygiene' },
  { key: 'supportive_psychotherapy', label: 'Supportive psychotherapy' },
];

const defaultData = () => ({
  patient_mood: '', patient_sleep: '', patient_disease_concerns: '',
  family_disease_concerns: '',
  problems_physical: [], problems_emotional: [], problems_social: [],
  problems_practical: [], problems_spiritual: [],
  distress_score: 0,
  family_support_notes: '',
  caregiver_mood: '', caregiver_burden: '',
  caregiver_concerns_about_patient: '', caregiver_personal_concerns: '',
  // zarit_q1_stress: 0, zarit_q2_time: 0, zarit_q3_strain: 0, zarit_q4_uncertain: 0,
  remarks: '',
});

// ─── MUI procedure checkbox group with custom-add ──────────────────────
function ProcedureCheckboxGroupMui({ procedures, selected, onChange }) {
  const [customInput, setCustomInput] = useState('');

  const predefinedKeys = procedures.map(p => p.key);
  const customEntries = selected.filter(s => !predefinedKeys.includes(s));

  const toggle = (key) => {
    const set = new Set(selected);
    if (set.has(key)) set.delete(key); else set.add(key);
    onChange([...set]);
  };

  const addCustom = () => {
    const value = customInput.trim();
    if (!value) return;
    if (selected.includes(value)) {
      setCustomInput('');
      return;
    }
    onChange([...selected, value]);
    setCustomInput('');
  };

  const removeCustom = (value) => {
    onChange(selected.filter(s => s !== value));
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0 }}>
        {procedures.map((p) => (
          <FormControlLabel key={p.key}
            control={
              <Checkbox size="small"
                checked={selected.includes(p.key)}
                onChange={() => toggle(p.key)} />
            }
            label={<Typography variant="body2">{p.label}</Typography>}
            sx={{ minWidth: 220 }}
          />
        ))}
      </Box>

      {customEntries.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
          {customEntries.map((entry) => (
            <Chip
              key={entry}
              label={entry}
              size="small"
              onDelete={() => removeCustom(entry)}
              deleteIcon={<CloseIcon fontSize="small" />}
            />
          ))}
        </Box>
      )}

      <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
        <TextField
          size="small"
          placeholder="Add custom procedure..."
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
          sx={{ flex: 1 }}
        />
        <Button size="small" variant="outlined" startIcon={<AddIcon fontSize="small" />} onClick={addCustom}>
          Add
        </Button>
      </Box>
    </Box>
  );
}

export default function PsychologicalAssessmentForm({ visitId, patientId, onSaved, showProcedures = true }) {
  const [data, setData] = useState(defaultData());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [hasSavedRow, setHasSavedRow] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Procedures (shared 'procedures' assessment record — counsellor slice)
  const [proceduresCounsellor, setProceduresCounsellor] = useState([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await saranamApi.getAssessment(visitId, ASSESSMENT_TYPE);
        if (active && res) {
          setData((prev) => ({ ...prev, ...res }));
          setHasSavedRow(true);
        }
      } catch { /* fresh form */ }

      try {
        const proc = await saranamApi.getAssessment(visitId, 'procedures');
        if (active && proc) {
          setProceduresCounsellor(proc.counsellor || []);
        }
      } catch { /* fresh */ }

      if (active) setLoading(false);
    };
    load();
    return () => { active = false; };
  }, [visitId]);

  const handleGenerateAiSummary = async () => {
    if (!hasSavedRow) {
      setError('Save the assessment first — the AI summary reads the saved record.');
      return;
    }
    setGenerating(true); setError('');
    try {
      const { summary } = await saranamApi.generateAssessmentSummary(visitId, ASSESSMENT_TYPE);
      setData((prev) => ({ ...prev, ai_summary: summary || '' }));
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to generate AI summary');
    } finally {
      setGenerating(false);
    }
  };

  const set = useCallback((field) => (e) => {
    const val = e?.target !== undefined ? e.target.value : e;
    setData((prev) => ({ ...prev, [field]: val }));
    setSuccess(false);
  }, []);

  const toggleProblem = useCallback((category, item) => () => {
    const key = `problems_${category}`;
    setData((prev) => {
      const list = prev[key] || [];
      const next = list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
      return { ...prev, [key]: next };
    });
    setSuccess(false);
  }, []);

  const handleSave = async () => {
    setSaving(true); setError(''); setSuccess(false);
    try {
      await saranamApi.saveAssessment(visitId, ASSESSMENT_TYPE, data);

      // Save procedures — merge with existing record so other categories aren't clobbered
      const currentProc = await saranamApi.getAssessment(visitId, 'procedures').catch(() => null);
      await saranamApi.saveAssessment(visitId, 'procedures', {
        nursing: currentProc?.nursing || [],
        physiotherapy: currentProc?.physiotherapy || [],
        counsellor: proceduresCounsellor,
        notes: currentProc?.notes || '',
      });

      setSuccess(true);
      setHasSavedRow(true);
      onSaved?.();
    } catch (err) {
      setError(err?.response?.data?.error || err?.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  // const zaritTotal = zaritQuestions.reduce((sum, q) => sum + (Number(data[q.key]) || 0), 0);
  // const zaritInterp = getZaritInterpretation(zaritTotal);

  if (loading) return <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>;

  const SectionHeader = ({ children }) => (
    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main', mt: 3, mb: 1 }}>
      {children}
    </Typography>
  );

  return (
    <Box>
      {success && <Alert severity="success" sx={{ mb: 2 }}>Assessment saved successfully.</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Patient Assessment */}
      <SectionHeader>Patient Wellbeing</SectionHeader>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            size="small"
            label="Patient Mood"
            placeholder="Describe the patient's emotional state..."
            multiline
            rows={2}
            value={data.patient_mood || ''}
            onChange={set('patient_mood')}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            size="small"
            label="Patient Sleep"
            placeholder="Describe sleep quality, disturbances, insomnia, etc."
            multiline
            rows={2}
            value={data.patient_sleep || ''}
            onChange={set('patient_sleep')}
          />
        </Grid>
      </Grid>

      <SectionHeader>Concerns About Disease</SectionHeader>

      <Box
        sx={{
          p: 2,
          borderRadius: 2,
          mb: 2,
        }}
      >
        <Grid container spacing={2}>
          <TextField
            fullWidth
            multiline
            rows={5}
            label="Patient Concerns"
            placeholder="Document the patient's concerns, fears, questions, uncertainties, or expectations regarding the illness and treatment."
            value={data.patient_disease_concerns || ''}
            onChange={set('patient_disease_concerns')}
          />
          <TextField
            fullWidth
            multiline
            rows={5}
            label="Family Concerns"
            placeholder="Document concerns, fears, questions, or expectations expressed by family members or caregivers."
            value={data.family_disease_concerns || ''}
            onChange={set('family_disease_concerns')}
          />
        </Grid>
      </Box>

      {/* Problem List */}
      <SectionHeader>Problem List</SectionHeader>
      {Object.entries(problemCategories).map(([cat, items]) => (
        <Box key={cat} sx={{ mb: 2, p: 1.5, borderRadius: 1, bgcolor: (theme) => theme.palette.action.hover }}>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>{label(cat)}</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0 }}>
            {items.map((item) => (
              <FormControlLabel key={item}
                control={
                  <Checkbox size="small"
                    checked={(data[`problems_${cat}`] || []).includes(item)}
                    onChange={toggleProblem(cat, item)} />
                }
                label={<Typography variant="body2">{label(item)}</Typography>}
                sx={{ minWidth: 160 }}
              />
            ))}
          </Box>
        </Box>
      ))}

      {/* Distress Thermometer */}
      <SectionHeader>Distress Thermometer</SectionHeader>
      <Box sx={{ px: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="caption" sx={{ color: 'success.main' }}>No distress (0)</Typography>
          <Typography variant="caption" sx={{ color: 'warning.main' }}>Moderate (5)</Typography>
          <Typography variant="caption" sx={{ color: 'error.main' }}>Extreme (10)</Typography>
        </Box>
        <Slider value={data.distress_score} onChange={(_, v) => set('distress_score')(v)}
          min={0} max={10} step={1} valueLabelDisplay="auto"
          marks={Array.from({ length: 11 }, (_, i) => ({ value: i, label: `${i}` }))}
          sx={{ '& .MuiSlider-thumb': { color: (theme) => theme.palette[distressColor(data.distress_score).split('.')[0]]?.[distressColor(data.distress_score).split('.')[1]] } }}
        />
      </Box>

      {/* Family Support */}
      <SectionHeader>Family Support</SectionHeader>
      <TextField fullWidth size="small" label="Family Support Notes" multiline rows={3}
        value={data.family_support_notes || ''} onChange={set('family_support_notes')} />

      {/* Caregiver Assessment */}
      <SectionHeader>Caregiver Assessment</SectionHeader>
      <Grid container spacing={2}>
        {['caregiver_mood', 'caregiver_burden', 'caregiver_concerns_about_patient', 'caregiver_personal_concerns'].map((f) => (
          <Grid item xs={12} sm={6} key={f}>
            <TextField fullWidth size="small" label={label(f)} multiline rows={2}
              value={data[f] || ''} onChange={set(f)} />
          </Grid>
        ))}
      </Grid>

      {/* Procedures */}
      {showProcedures && (
        <><SectionHeader>Procedures</SectionHeader><Box sx={{ mb: 2, p: 1.5, borderRadius: 1, bgcolor: (theme) => theme.palette.action.hover }}>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>Counsellor Services</Typography>
          <ProcedureCheckboxGroupMui
            procedures={COUNSELLOR_PROCEDURES}
            selected={proceduresCounsellor}
            onChange={setProceduresCounsellor} />
        </Box></>
      )}

      {/* Remarks */}
      <SectionHeader>Remarks</SectionHeader>
      <TextField fullWidth size="small" label="Remarks" multiline rows={3}
        value={data.remarks || ''} onChange={set('remarks')} />

      {/* AI Summary */}
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main' }}>
          Auto-Generated Summary (editable)
        </Typography>
        <Button
          size="small"
          variant="text"
          onClick={handleGenerateAiSummary}
          disabled={generating || !hasSavedRow}
          startIcon={generating ? <CircularProgress size={14} /> : <AutoAwesomeIcon fontSize="small" />}
          title={!hasSavedRow ? 'Save assessment first' : ''}
        >
          {generating ? 'Generating...' : 'Generate from assessment'}
        </Button>
      </Box>
      <TextField
        fullWidth size="small" multiline rows={4}
        placeholder="Click 'Generate from assessment' or type manually..."
        value={data.ai_summary || ''} onChange={set('ai_summary')}
      />

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="contained" onClick={handleSave} disabled={saving}
          startIcon={saving ? <CircularProgress size={18} /> : null}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </Box>
    </Box>
  );
}