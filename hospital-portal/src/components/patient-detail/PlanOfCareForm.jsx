/**
 * PlanOfCareForm — Hospital Portal (baseline plan of care).
 *
 * Ported from frontend/src/pages/patients/tabs/PlanOfCareForm.jsx. The main app
 * delegates to a heavy PrescriptionBuilder (inventory lookups, ICD search,
 * jsPDF generation, provider resolution). For the portal we keep the same data
 * model — non-pharmacological intervention, pharmacological notes, and a
 * medications table — but render a self-contained Tailwind editor so the portal
 * does not pull in @mui/*, jspdf, inventory or provider APIs.
 *
 * Persists via onSave('plan-of-care', payload) → PUT /baseline/plan-of-care.
 *
 * Props: { data, editable, onSave }
 */
import { useState, useEffect } from 'react';
import { Save, RefreshCw, Plus, Trash2 } from 'lucide-react';

const emptyMed = () => ({ name: '', dose: '', frequency: '', duration: '', route: '', notes: '' });

function MedicationRows({ items, setItems, disabled }) {
  const addRow = () => setItems((p) => [...p, emptyMed()]);
  const removeRow = (i) => setItems((p) => p.filter((_, idx) => idx !== i));
  const update = (i, field, val) => setItems((p) => p.map((row, idx) => (idx === i ? { ...row, [field]: val } : row)));

  return (
    <div className="space-y-2">
      {items.map((row, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 items-end p-3 bg-muted/20 rounded-lg border border-border">
          <div className="col-span-3">
            <label className="block text-xs text-muted-foreground mb-1">Medication *</label>
            <input type="text" placeholder="e.g. Morphine" value={row.name} onChange={(e) => update(i, 'name', e.target.value)}
              disabled={disabled}
              className="w-full px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm disabled:opacity-60" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-muted-foreground mb-1">Dose</label>
            <input type="text" placeholder="10 mg" value={row.dose} onChange={(e) => update(i, 'dose', e.target.value)}
              disabled={disabled}
              className="w-full px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm disabled:opacity-60" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-muted-foreground mb-1">Frequency</label>
            <input type="text" placeholder="BD / TDS" value={row.frequency} onChange={(e) => update(i, 'frequency', e.target.value)}
              disabled={disabled}
              className="w-full px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm disabled:opacity-60" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-muted-foreground mb-1">Duration</label>
            <input type="text" placeholder="5 days" value={row.duration} onChange={(e) => update(i, 'duration', e.target.value)}
              disabled={disabled}
              className="w-full px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm disabled:opacity-60" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-muted-foreground mb-1">Route</label>
            <input type="text" placeholder="PO / SC" value={row.route} onChange={(e) => update(i, 'route', e.target.value)}
              disabled={disabled}
              className="w-full px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm disabled:opacity-60" />
          </div>
          {!disabled && (
            <div className="col-span-1 flex items-end pb-0.5">
              <button onClick={() => removeRow(i)} className="p-1.5 text-red-500 hover:bg-red-900/20 rounded">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      ))}
      {!disabled && (
        <button onClick={addRow} className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300">
          <Plus className="h-4 w-4" /> Add Medication
        </button>
      )}
      {disabled && items.length === 0 && (
        <p className="text-sm text-muted-foreground italic">No medications recorded.</p>
      )}
    </div>
  );
}

function SubSection({ title, children }) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-foreground border-b border-border pb-1">{title}</h4>
      {children}
    </div>
  );
}

export default function PlanOfCareForm({ data, editable = false, onSave }) {
  const [nonPharma, setNonPharma] = useState('');
  const [pharma, setPharma] = useState('');
  const [diagnosisText, setDiagnosisText] = useState('');
  const [icd10, setIcd10] = useState('');
  const [medications, setMedications] = useState([]);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    setNonPharma(data.intervention_non_pharmacological || '');
    setPharma(data.intervention_pharmacological || '');
    setDiagnosisText(data.diagnosis_text || '');
    setIcd10(data.icd10_diagnosis || '');
    setMedications(Array.isArray(data.medications) ? data.medications : []);
  }, [data]);

  const handleSave = async () => {
    if (!editable || !onSave) return;
    setSaving(true);
    try {
      await onSave('plan-of-care', {
        intervention_non_pharmacological: nonPharma,
        intervention_pharmacological: pharma,
        diagnosis_text: diagnosisText,
        icd10_diagnosis: icd10,
        medications,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert(err?.response?.data?.error || err?.response?.data?.message || 'Failed to save plan of care');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <SubSection title="Diagnosis">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Diagnosis</label>
            <input type="text" placeholder="Working diagnosis..." value={diagnosisText} onChange={(e) => setDiagnosisText(e.target.value)}
              disabled={!editable}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm disabled:opacity-60" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">ICD-10 Code</label>
            <input type="text" placeholder="C50.9" value={icd10} onChange={(e) => setIcd10(e.target.value)}
              disabled={!editable}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm disabled:opacity-60" />
          </div>
        </div>
      </SubSection>

      <SubSection title="Pharmacological Management (Prescription)">
        <MedicationRows items={medications} setItems={setMedications} disabled={!editable} />
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Pharmacological Notes</label>
          <textarea rows={3} placeholder="Titration plan, breakthrough doses, monitoring..."
            value={pharma} onChange={(e) => setPharma(e.target.value)}
            disabled={!editable}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm resize-none disabled:opacity-60" />
        </div>
      </SubSection>

      <SubSection title="Non-Pharmacological Management">
        <textarea rows={4} placeholder="Counselling, positioning, wound care, physiotherapy advice, family education..."
          value={nonPharma} onChange={(e) => setNonPharma(e.target.value)}
          disabled={!editable}
          className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm resize-none disabled:opacity-60" />
      </SubSection>

      {editable && (
        <div className="flex justify-end pt-2">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-50">
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saved ? 'Saved!' : 'Save Plan of Care'}
          </button>
        </div>
      )}
    </div>
  );
}
