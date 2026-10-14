/**
 * PrescriptionBuilder — Shared Tailwind prescription UI.
 * Used by both VisitDetailView (follow-up) and PlanOfCareForm (baseline).
 *
 * Props:
 *   medications     - array of medication objects
 *   setMedications  - setState function for medications
 *   rxNotes         - pharmacological notes string
 *   setRxNotes      - setState for notes
 *   onSave          - async save handler
 *   saving          - boolean
 *   saved           - boolean
 *   onDownloadPDF   - optional PDF download handler
 *   patientId       - optional, for dispense link
 *   saveLabel       - optional, button text (default "Save Prescription")
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Trash2, Pill, Download, Package, Save, RefreshCw, CheckCircle, Loader2, ChevronDown } from 'lucide-react';
import { searchMedicines } from '../../api/medicineSearch';
import providersApi from '../../api/providers';
import {
  FREQUENCY_OPTIONS, ROUTE_OPTIONS,
  INSTRUCTION_OPTIONS, MEDICINE_TYPE_OPTIONS, DOSAGE_FORM_OPTIONS,
  DURATION_UNIT_OPTIONS, TIME_DOSAGE_SLOTS, TDS_SLOTS, SCHEDULE_MODES,
  normalizeFrequency, formatDosageForm, toPrescriptionDosageForm,
} from '../../constants/prescription';
import { searchICD10, ICD10_CODES } from '../../constants/icd10';

// ─── Tiny helper components ──────────────────────────────────────
function SmallInput({ label, placeholder, value, onChange, type = 'text' }) {
  return (
    <div>
      <label className="block text-[10px] text-muted-foreground mb-0.5">{label}</label>
      <input type={type} placeholder={placeholder} value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-2 py-1.5 border border-border rounded-md bg-background text-foreground text-xs" />
    </div>
  );
}

function SmallSelect({ label, value, onChange, options }) {
  return (
    <div>
      <label className="block text-[10px] text-muted-foreground mb-0.5">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-2 py-1.5 border border-border rounded-md bg-background text-foreground text-xs">
        <option value="">Select</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function MedicineSearch({ value, onNameChange, onSelect }) {
  const [options, setOptions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  const search = useCallback(async (query) => {
    if (!query || query.length < 2) { setOptions([]); return; }
    setLoading(true);
    try {
      setOptions(await searchMedicines(query, 10));
      setShowDropdown(true);
    } catch { setOptions([]); }
    finally { setLoading(false); }
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    onNameChange(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  };

  const handleSelect = (med) => {
    onSelect(med);
    setShowDropdown(false);
  };

  useEffect(() => {
    const handler = (e) => { if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setShowDropdown(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-[10px] text-muted-foreground mb-0.5">Medicine Name</label>
      <input type="text" placeholder="Type to search..." value={value}
        onChange={handleChange}
        onFocus={() => { if (options.length > 0) setShowDropdown(true); }}
        className="w-full px-2 py-1.5 border border-border rounded-md bg-background text-foreground text-xs" />
      {loading && <Loader2 className="absolute right-2 top-5 h-3 w-3 animate-spin text-muted-foreground" />}
      {showDropdown && options.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
          {options.map((med) => (
            <button key={med.id} type="button" onClick={() => handleSelect(med)}
              className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors border-b border-border last:border-0">
              <div className="text-xs font-medium">{med.name || med.generic_name}</div>
              <div className="text-[10px] text-muted-foreground">
                {med.strength && `${med.strength} • `}{formatDosageForm(med.dosage_form)}{med.brand_name && ` • ${med.brand_name}`}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Empty medication row factory ────────────────────────────────
const emptyMed = () => ({
  name: '', strength: '', dosage_value: '', dosage_unit: '', frequency: '', route: 'oral',
  duration: '', duration_unit: 'days', quantity: '', instructions: '',
  dosage_morning: '0', dosage_afternoon: '0', dosage_night: '0',
  dosage_6am: '0', dosage_10am: '0', dosage_2pm: '0', dosage_6pm: '0', dosage_10pm: '0',
  sos: false, medicine_type: '', dosage_form: '', warning_signs: '',
  schedule_mode: 'opioid',     // meeting §5.2 (2026-04-14)
  custom_timings: null,        // [{time, dose}, ...] when mode === 'custom'
});

const DOSAGE_UNIT_OPTIONS = [
  { value: 'mg', label: 'mg' },
  { value: 'mcg', label: 'mcg' },
  { value: 'g', label: 'g' },
  { value: 'ml', label: 'ml' },
  { value: 'mg/ml', label: 'mg/ml' },
];

// ─── Visit Type options for prescription context ────────────────
const VISIT_TYPE_OPTIONS = [
  { value: 'initial_assessment', label: 'Initial Assessment (Baseline)' },
  { value: 'follow_up', label: 'Follow-up Visit' },
];

// ─── Doctor Info Section with Provider Dropdown ─────────────────
function DoctorInfoSection({ doctorInfo, setDoctorInfo }) {
  const [providers, setProviders] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [uploadingSignature, setUploadingSignature] = useState(false);

  useEffect(() => {
    setLoadingProviders(true);
    providersApi.list({ per_page: 100 })
      .then(res => setProviders(res.providers || []))
      .catch(() => { })
      .finally(() => setLoadingProviders(false));
  }, []);

  const handleProviderSelect = (e) => {
    const id = e.target.value;
    setSelectedProviderId(id);
    if (!id) return;
    const p = providers.find(p => p.id === id);
    if (p) {
      setDoctorInfo({
        name: p.full_name || '',
        qualification: p.qualification || '',
        designation: p.designation || '',
        kmc_number: p.license_number || '',
        signature_image: p.signature_image || '',
        provider_id: p.id,
      });
    }
  };

  // Re-select the provider from a restored snapshot (after reload) so the
  // signature is re-loaded from the provider — the snapshot only keeps the
  // provider reference, not the large signature image.
  useEffect(() => {
    if (!providers.length || selectedProviderId) return;
    const pid = doctorInfo?.provider_id;
    if (!pid) return;
    setSelectedProviderId(pid);
    const p = providers.find(p => p.id === pid);
    if (p && !doctorInfo?.signature_image && p.signature_image) {
      setDoctorInfo(prev => ({ ...prev, signature_image: p.signature_image }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providers, doctorInfo?.provider_id]);

  const handleSignatureUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProviderId) return;
    setUploadingSignature(true);
    try {
      const res = await providersApi.uploadSignature(selectedProviderId, file);
      setDoctorInfo(prev => ({ ...prev, signature_image: res.signature_image }));
      // Update the local providers cache so subsequent selections use the new signature
      setProviders(prev => prev.map(p => p.id === selectedProviderId
        ? { ...p, signature_image: res.signature_image }
        : p));
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to upload signature');
    } finally {
      setUploadingSignature(false);
      e.target.value = ''; // allow re-upload of same file
    }
  };

  return (
    <div className="border border-border rounded-lg p-3 space-y-2 bg-slate-50 dark:bg-slate-900/30">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-medium text-muted-foreground">Prescribing Doctor</label>
        <select
          onChange={handleProviderSelect}
          value={selectedProviderId}
          className="px-2 py-1 border border-border rounded-md bg-background text-foreground text-xs"
        >
          <option value="">Select from providers...</option>
          {providers.map(p => (
            <option key={p.id} value={p.id}>{p.full_name}{p.qualification ? ` (${p.qualification})` : ''}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <SmallInput label="Doctor Name" placeholder="Dr. Anvita" value={doctorInfo?.name || ''} onChange={v => setDoctorInfo(prev => ({ ...prev, name: v }))} />
        <SmallInput label="Qualification" placeholder="MBBS, MD" value={doctorInfo?.qualification || ''} onChange={v => setDoctorInfo(prev => ({ ...prev, qualification: v }))} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <SmallInput label="Designation" placeholder="Senior Consultant" value={doctorInfo?.designation || ''} onChange={v => setDoctorInfo(prev => ({ ...prev, designation: v }))} />
        <SmallInput label="KMC Reg. Number" placeholder="KMC/12345" value={doctorInfo?.kmc_number || ''} onChange={v => setDoctorInfo(prev => ({ ...prev, kmc_number: v }))} />
      </div>

      {/* Signature — uploaded once per doctor, embedded in prescription PDFs (meeting §5.4) */}
      <div className="flex items-center gap-3 pt-1">
        <div className="flex-shrink-0">
          {doctorInfo?.signature_image ? (
            <img
              src={doctorInfo.signature_image}
              alt="Signature"
              className="h-12 w-28 object-contain border border-border rounded bg-white"
            />
          ) : (
            <div className="h-12 w-28 border border-dashed border-border rounded bg-white flex items-center justify-center text-[10px] text-muted-foreground">
              No signature
            </div>
          )}
        </div>
        <div className="flex-1">
          <label className="block text-[10px] text-muted-foreground mb-0.5">Signature</label>
          {selectedProviderId ? (
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-white border border-blue-300 rounded-md hover:bg-blue-50 transition-colors cursor-pointer">
                {uploadingSignature ? (
                  <><Loader2 className="h-3 w-3 animate-spin" /> Uploading…</>
                ) : (
                  <>Upload signature</>
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleSignatureUpload}
                  disabled={uploadingSignature}
                  className="hidden"
                />
              </label>
              <span className="text-[10px] text-muted-foreground">
                PNG / JPG on white background, &lt; 5 MB
              </span>
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground italic">
              Select a provider above to upload or replace their signature.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Schedule Timing Editor — 3-mode UI per medicine ───────────
// Mode 'opioid' → the classic 6/10/2/6/10 slot grid (TIME_DOSAGE_SLOTS).
// Mode 'tds'    → 3-slot Morning / Afternoon / Night (reuses legacy columns).
// Mode 'custom' → dynamic list of {time, dose} pairs in med.custom_timings.
function ScheduleTimingEditor({ med, onChange }) {
  const mode = med.schedule_mode || 'opioid';
  const timings = Array.isArray(med.custom_timings) ? med.custom_timings : [];

  const addCustomRow = () => {
    onChange('custom_timings', [...timings, { time: '', dose: '1' }]);
  };
  const updateCustomRow = (i, field, value) => {
    const next = timings.map((t, ix) => ix === i ? { ...t, [field]: value } : t);
    onChange('custom_timings', next);
  };
  const removeCustomRow = (i) => {
    onChange('custom_timings', timings.filter((_, ix) => ix !== i));
  };

  return (
    <div className="border border-border rounded-md p-2 bg-background/50">
      <div className="flex items-center gap-2 mb-2">
        <label className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">
          Schedule mode
        </label>
        <select
          value={mode}
          onChange={e => {
            const newMode = e.target.value;
            onChange('schedule_mode', newMode);
            // Seed custom_timings with TDS template so user has rows to edit
            if (newMode === 'custom' && timings.length === 0) {
              onChange('custom_timings', [
                { time: 'morning', dose: '1' },
                { time: 'afternoon', dose: '0' },
                { time: 'night', dose: '1' },
              ]);
            }
          }}
          className="px-2 py-1 border border-border rounded-md bg-background text-foreground text-xs"
        >
          {SCHEDULE_MODES.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      {mode === 'opioid' && (
        <div className="grid grid-cols-5 gap-2">
          {TIME_DOSAGE_SLOTS.map((slot) => (
            <div key={slot.key}>
              <label className="block text-[10px] text-muted-foreground mb-0.5">{slot.label}</label>
              <input
                type="number"
                step="0.25"
                min="0"
                value={med[slot.key] || ''}
                onChange={e => onChange(slot.key, e.target.value)}
                className="w-full px-1 py-1.5 border border-border rounded-md bg-background text-foreground text-xs text-center"
              />
            </div>
          ))}
        </div>
      )}

      {mode === 'tds' && (
        <div className="grid grid-cols-3 gap-2">
          {TDS_SLOTS.map((slot) => (
            <div key={slot.key}>
              <label className="block text-[10px] text-muted-foreground mb-0.5">{slot.label}</label>
              <input
                type="number"
                step="0.25"
                min="0"
                value={med[slot.key] || ''}
                onChange={e => onChange(slot.key, e.target.value)}
                className="w-full px-1 py-1.5 border border-border rounded-md bg-background text-foreground text-xs text-center"
              />
            </div>
          ))}
        </div>
      )}

      {mode === 'custom' && (
        <div className="space-y-1">
          {timings.length === 0 && (
            <p className="text-[11px] text-muted-foreground italic">No timings yet. Click "Add timing" to start.</p>
          )}
          {timings.map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={t.time || ''}
                onChange={e => updateCustomRow(i, 'time', e.target.value)}
                placeholder="morning / 08:00 / bedtime"
                className="flex-1 px-2 py-1 border border-border rounded-md bg-background text-foreground text-xs"
              />
              <input
                type="number"
                step="0.25"
                min="0"
                value={t.dose || ''}
                onChange={e => updateCustomRow(i, 'dose', e.target.value)}
                className="w-20 px-1 py-1 border border-border rounded-md bg-background text-foreground text-xs text-center"
              />
              <button type="button" onClick={() => removeCustomRow(i)}
                className="text-red-500 hover:text-red-700 p-1">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button type="button" onClick={addCustomRow}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
            <Plus className="h-3 w-3" /> Add timing
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────
export default function PrescriptionBuilder({
  medications, setMedications,
  rxNotes, setRxNotes,
  followUpNotes, setFollowUpNotes,
  visitType, setVisitType,
  icd10Diagnosis,
  diagnosisText, setDiagnosisText,
  doctorInfo, setDoctorInfo,
  onSave, saving, saved,
  onDownloadPDF, canDownload = true, patientId,
  saveLabel = 'Save Prescription',
  // Optional — when provided, the Non-Pharmacological Notes field renders
  // inside the prescription block (above Pharmacological Notes).
  nonPharmacologicalNotes, setNonPharmacologicalNotes,
}) {
  const hasMeds = medications.length > 0 && medications.some(m => m.name);

  // ICD-10 combobox: opens on focus (browse the full list) and filters as you type.
  const [icd10Open, setIcd10Open] = useState(false);
  const icd10Query = (icd10Diagnosis || '').trim();
  const icd10Matches = icd10Query.length >= 2 ? searchICD10(icd10Query) : [];
  const icd10Options = icd10Matches.length > 0 ? icd10Matches : ICD10_CODES;

  const addMed = () => setMedications(prev => [...prev, emptyMed()]);
  const removeMed = (idx) => setMedications(prev => prev.filter((_, i) => i !== idx));
  const updateMed = (idx, field, value) => {
    setMedications(prev => {
      const meds = [...prev];
      const next = { ...meds[idx], [field]: value };
      // Keep the combined `dosage` (value + unit) in sync — it's what the PDF and
      // medication table render, so a unit change must propagate to it.
      if (field === 'dosage_value' || field === 'dosage_unit') {
        const v = (field === 'dosage_value' ? value : next.dosage_value) || '';
        const u = (field === 'dosage_unit' ? value : next.dosage_unit) || '';
        next.dosage = [v, u].filter(Boolean).join(' ');
      }
      meds[idx] = next;
      return meds;
    });
  };
  const handleMedSelect = (idx, medicine) => {

    // Prefer structured strength (first active ingredient) for the dosage prefill so
    // concentrations/combinations/percentages no longer come up blank; fall back to
    // parsing the legacy display string for medicines without structured data.
    let dosageValue = '';
    let dosageUnit = '';
    const comps = medicine.strength_components;
    if (Array.isArray(comps) && comps.length) {
      dosageValue = comps[0]?.value != null ? String(comps[0].value) : '';
      dosageUnit = comps[0]?.unit || '';
    } else {
      const match = (medicine.strength || '').match(/^([\d.]+)\s*([a-zA-Z\/]+)?$/);
      dosageValue = match?.[1] || '';
      dosageUnit = match?.[2] || '';
    }

    setMedications(prev => {
      const meds = [...prev];

      meds[idx] = {
        ...meds[idx],
        medicine_id: medicine.id,

        name:
          medicine.medicine_name ||
          medicine.name ||
          medicine.generic_name ||
          '',

        // Full strength string (combinations/concentrations shown in full).
        strength: medicine.strength || '',

        dosage_value: dosageValue,
        dosage_unit: dosageUnit,
        dosage: [dosageValue, dosageUnit].filter(Boolean).join(' '),

        // Map the inventory form onto a prescription <select> option so it auto-selects.
        dosage_form: toPrescriptionDosageForm(medicine.dosage_form),
      };

      return meds;
    });
  };

  return (
    <div className="border border-blue-200 dark:border-blue-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Pill className="h-5 w-5 text-blue-600" />
          <h4 className="text-sm font-bold text-blue-900 dark:text-blue-100">Prescription</h4>
          {medications.length > 0 && (
            <span className="text-xs bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 px-2 py-0.5 rounded-full">
              {medications.filter(m => m.name).length} medicines
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {onDownloadPDF && (
            <button onClick={onDownloadPDF}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-white border border-blue-300 rounded-md hover:bg-blue-50 transition-colors">
              <Download className="h-3.5 w-3.5" /> Download PDF
            </button>
          )}
          {hasMeds && patientId && (
            <a href={`/inventory/dispense?patient_id=${patientId}`} target="_blank"
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700 bg-white border border-green-300 rounded-md hover:bg-green-50 transition-colors">
              <Package className="h-3.5 w-3.5" /> Dispense from Kit
            </a>
          )}
          <button onClick={addMed}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-white border border-blue-300 rounded-md hover:bg-blue-50 transition-colors">
            <Plus className="h-3.5 w-3.5" /> Add Medicine
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Diagnosis Context — visit type + diagnosis text */}
        {setVisitType && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <SmallSelect label="Visit Type" value={visitType || ''} onChange={v => setVisitType(v)} options={VISIT_TYPE_OPTIONS} />
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground mb-0.5">Diagnosis</label>
              <textarea rows={2} placeholder="Describe the diagnosis in your own words..."
                value={diagnosisText || ''} onChange={e => setDiagnosisText(e.target.value)}
                className="w-full px-2 py-1.5 border border-border rounded-md bg-background text-foreground text-xs resize-none" />
            </div>
          </div>
        )}

        {/* Non-pharmacological notes (only renders when the parent passes the prop) */}
        {setNonPharmacologicalNotes && (
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Non-Pharmacological Notes</label>
            <textarea rows={2} placeholder="Counselling, physiotherapy, breathing exercises, lifestyle advice, etc."
              value={nonPharmacologicalNotes || ''}
              onChange={e => setNonPharmacologicalNotes(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm resize-none" />
          </div>
        )}

        {/* Pharmacological notes */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Pharmacological Notes</label>
          <textarea rows={2} placeholder="Notes about medication changes, titration, etc."
            value={rxNotes} onChange={e => setRxNotes(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm resize-none" />
        </div>

        {/* Follow-up notes */}
        {setFollowUpNotes && (
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Follow-up Notes</label>
            <textarea rows={2} placeholder="Notes for next follow-up visit..."
              value={followUpNotes || ''} onChange={e => setFollowUpNotes(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm resize-none" />
          </div>
        )}

        {/* Empty state */}
        {medications.length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <Pill className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No medicines prescribed yet</p>
          </div>
        )}

        {/* Medicine cards */}
        {medications.map((med, idx) => (
          <div key={idx} className="border border-border rounded-lg p-3 bg-muted/20 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-600">Medicine {idx + 1}</span>
              <button onClick={() => removeMed(idx)} className="text-red-500 hover:text-red-700 p-1">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            {/* Row 1 */}
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-3">
                <MedicineSearch
                  value={med.name || ''}
                  onNameChange={(v) => updateMed(idx, 'name', v)}
                  onSelect={(m) => handleMedSelect(idx, m)}
                />
                {med.strength && (
                  <div className="mt-0.5 text-[10px] text-muted-foreground truncate" title={med.strength}>
                    Strength: <span className="font-medium text-foreground">{med.strength}</span>
                  </div>
                )}
              </div>
              {/* Dosage / Strength — pre-filled from medicine.strength on select, editable
                  (meeting §5.1, 2026-04-14) */}
              <div className="col-span-1">
                <SmallInput
                  label="Dosage"
                  placeholder="500"
                  value={med.dosage_value || ''}
                  onChange={v => updateMed(idx, 'dosage_value', v)}
                  type="number"
                />
              </div>

              <div className="col-span-1">
                <SmallSelect
                  label="Unit"
                  value={med.dosage_unit || ''}
                  onChange={v => updateMed(idx, 'dosage_unit', v)}
                  options={DOSAGE_UNIT_OPTIONS}
                />
              </div>
              <div className="col-span-2">
                <SmallSelect label="Dosage Form" value={med.dosage_form || ''} onChange={v => updateMed(idx, 'dosage_form', v)} options={DOSAGE_FORM_OPTIONS} />
              </div>
              <div className="col-span-2">
                <SmallSelect label="Frequency" value={normalizeFrequency(med.frequency) || ''} onChange={v => updateMed(idx, 'frequency', v)} options={FREQUENCY_OPTIONS} />
              </div>
              <div className="col-span-1">
                <label className="block text-[10px] text-muted-foreground mb-0.5">SOS</label>
                <div className="flex items-center h-[30px]">
                  <input type="checkbox" checked={!!med.sos} onChange={e => updateMed(idx, 'sos', e.target.checked)}
                    className="h-4 w-4 rounded border-border text-blue-600 focus:ring-blue-500" />
                </div>
              </div>
              <div className="col-span-1">
                <SmallSelect label="Route" value={med.route || 'oral'} onChange={v => updateMed(idx, 'route', v)} options={ROUTE_OPTIONS} />
              </div>
              <div className="col-span-2">
                <SmallSelect label="Med. Type" value={med.medicine_type || ''} onChange={v => updateMed(idx, 'medicine_type', v)} options={MEDICINE_TYPE_OPTIONS} />
              </div>
            </div>
            {/* Row 2 */}
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-1">
                <SmallInput label="Duration" placeholder="7" value={med.duration || ''} onChange={v => updateMed(idx, 'duration', v)} type="number" />
              </div>
              <div className="col-span-1">
                <SmallSelect label="Unit" value={med.duration_unit || 'days'} onChange={v => updateMed(idx, 'duration_unit', v)} options={DURATION_UNIT_OPTIONS} />
              </div>
              <div className="col-span-1">
                <SmallInput label="Qty" placeholder="14" value={med.quantity || ''} onChange={v => updateMed(idx, 'quantity', v)} type="number" />
              </div>
              <div className="col-span-2">
                <div>
                  <label className="block text-[10px] text-muted-foreground mb-0.5">Instructions</label>
                  <select value={med.instructions || ''} onChange={e => updateMed(idx, 'instructions', e.target.value)}
                    className="w-full px-2 py-1.5 border border-border rounded-md bg-background text-foreground text-xs">
                    <option value="">Select</option>
                    {INSTRUCTION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              {/* Schedule mode selector + mode-specific timing UI (meeting §5.2) */}
              <div className="col-span-12">
                <ScheduleTimingEditor
                  med={med}
                  onChange={(field, value) => updateMed(idx, field, value)}
                />
              </div>
              <div className="col-span-12">
                <SmallInput label="Warning Signs" placeholder="If too drowsy, stop this medicine..." value={med.warning_signs || ''} onChange={v => updateMed(idx, 'warning_signs', v)} />
              </div>
            </div>
          </div>
        ))}

        {/* Doctor Details — for prescription signature */}
        {setDoctorInfo && medications.length > 0 && (
          <DoctorInfoSection doctorInfo={doctorInfo} setDoctorInfo={setDoctorInfo} />
        )}

        {/* Save button */}
        {medications.length > 0 && (
          <div className="flex justify-end pt-2">
            <button onClick={onSave} disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 transition-colors">
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              {saving ? 'Saving...' : saved ? 'Saved!' : saveLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
