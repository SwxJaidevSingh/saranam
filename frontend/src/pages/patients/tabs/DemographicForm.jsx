import { useState, useEffect } from 'react';
import { Save, RefreshCw, Users } from 'lucide-react';
import patientsApi from '../../../api/patients';
import FamilyChartForm from './FamilyChart';
import GenogramBuilder from './GenogramBuilder';
import OptimizedImageUpload from '../../../components/common/OptimizedImageUpload';


// ─── Form Elements ────────────────────────────────────────────────────────
function SubSection({ title, children }) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-foreground border-b border-border pb-1">{title}</h4>
      {children}
    </div>
  );
}

function InputField({ label, placeholder, value, onChange, type = "text", disabled }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm disabled:opacity-60"
      />
    </div>
  );
}

function SelectField({ label, options, value, onChange, disabled }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm disabled:opacity-60"
      >
        <option value="">Select...</option>
        {options.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}

const MARITAL_STATUS_OPTIONS = [
  "Single",
  "Married",
  "Divorced",
  "Widowed",
  "Separated",
  "Other"
];

const EDUCATION_OPTIONS = [
  "No formal education",
  "Primary school",
  "Secondary school",
  "High school graduate",
  "PUC graduate",
  "College graduate",
  "Postgraduate degree",
  "Literate",
  "Illiterate",
];

const BARRIER_OPTIONS = [
  "None",
  "Hearing impairment",
  "Visual impairment",
  "Speech impairment",
  "Language barrier",
  "Cognitive impairment",
  "Other"
];

const SOURCE_OPTIONS = [
  "Patient",
  "Spouse",
  "Child",
  "Parent",
  "Sibling",
  "Other relative",
  "Friend",
  "Caregiver",
  "Hospital records",
  "Other"
];

export default function DemographicForm({ patient, onSaved }) {
  const [form, setForm] = useState({
    educational_status: '',
    occupation: '',
    religion: '',
    marital_status: '',
    preferred_language: '',
    barriers_to_communication: '',
    no_of_children: '',
    source_of_information: '',
    // Care circle (family / caregiver)
    primary_caregiver_name: '',
    primary_caregiver_relationship: '',
    primary_caregiver_phone: '',
    // Decision maker
    decision_maker_name: '',
    decision_maker_designation: '',
    decision_maker_phone: '',
  });
  const [familyChart, setFamilyChart] = useState([]);
  const [genogram, setGenogram] = useState(null);


  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (patient) {
      setForm({
        educational_status: patient.educational_status || '',
        occupation: patient.occupation || '',
        religion: patient.religion || '',
        marital_status: patient.marital_status || '',
        preferred_language: patient.preferred_language || '',
        barriers_to_communication: patient.barriers_to_communication || '',
        no_of_children: patient.no_of_children !== null && patient.no_of_children !== undefined ? patient.no_of_children : '',
        source_of_information: patient.source_of_information || '',
        primary_caregiver_name: patient.primary_caregiver_name || '',
        primary_caregiver_relationship: patient.primary_caregiver_relationship || '',
        primary_caregiver_phone: patient.primary_caregiver_phone || '',
        decision_maker_name: patient.decision_maker_name || '',
        decision_maker_designation: patient.decision_maker_designation || '',
        decision_maker_phone: patient.decision_maker_phone || '',
      });
      setFamilyChart(patient?.family_chart || []);
      setGenogram(patient?.genogram || null);
    }

  }, [patient?.id, patient?.updated_at]);

  const handleChange = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!patient?.id) return;
    setSaving(true);
    try {
      const payload = {
        educational_status: form.educational_status || '',
        occupation: form.occupation || '',
        religion: form.religion || '',
        marital_status: form.marital_status || '',
        preferred_language: form.preferred_language || '',
        barriers_to_communication: form.barriers_to_communication || '',
        no_of_children: form.no_of_children === '' ? null : Number(form.no_of_children),
        source_of_information: form.source_of_information || '',
        family_chart: familyChart,
        genogram: genogram,

        // Care Circle
        primary_caregiver_name: form.primary_caregiver_name || '',
        primary_caregiver_relationship: form.primary_caregiver_relationship || '',
        primary_caregiver_phone: form.primary_caregiver_phone || '',
        decision_maker_name: form.decision_maker_name || '',
        decision_maker_designation: form.decision_maker_designation || '',
        decision_maker_phone: form.decision_maker_phone || '',
      };

      await patientsApi.update(patient.id, payload);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      if (onSaved) onSaved();
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to save demographic history');
    } finally {
      setSaving(false);
    }
  };

  const calculatedAge = patient?.age || (patient?.date_of_birth
    ? Math.floor((new Date() - new Date(patient.date_of_birth)) / 31557600000)
    : null);

  return (
    <div className="space-y-6">
      {/* ── Personal References ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-3.5 bg-muted/20 border border-border rounded-lg text-xs">
        <div>
          <span className="font-bold text-muted-foreground block uppercase tracking-wider mb-0.5">Name</span>
          <span className="font-semibold text-foreground text-sm">{patient?.full_name || '—'}</span>
        </div>
        <div>
          <span className="font-bold text-muted-foreground block uppercase tracking-wider mb-0.5">Age</span>
          <span className="font-semibold text-foreground text-sm">{calculatedAge ? `${calculatedAge} years` : '—'}</span>
        </div>
        <div>
          <span className="font-bold text-muted-foreground block uppercase tracking-wider mb-0.5">Gender</span>
          <span className="font-semibold text-foreground text-sm">{patient?.gender || '—'}</span>
        </div>
      </div>

      {/* ── Demographic Profile ── */}
      <SubSection title="Demographic Profile">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SelectField
            label="Educational Status"
            options={EDUCATION_OPTIONS}
            value={form.educational_status}
            onChange={v => handleChange('educational_status', v)}
          />
          <InputField
            label="Occupation"
            placeholder="e.g. Retired teacher, Farmer, Homemaker"
            value={form.occupation}
            onChange={v => handleChange('occupation', v)}
          />
          <InputField
            label="Religion"
            // options={RELIGION_OPTIONS}
            value={form.religion}
            onChange={v => handleChange('religion', v)}
          />
          <SelectField
            label="Marital Status"
            options={MARITAL_STATUS_OPTIONS}
            value={form.marital_status}
            onChange={v => handleChange('marital_status', v)}
          />
          <InputField
            label="Language Spoken"
            // options={LANGUAGE_OPTIONS}
            value={form.preferred_language}
            onChange={v => handleChange('preferred_language', v)}
          />
          <InputField
            label="No. of Children"
            placeholder="e.g. 2"
            type="number"
            value={form.no_of_children}
            onChange={v => handleChange('no_of_children', v)}
          />
          <SelectField
            label="Any Barriers to Communication"
            options={BARRIER_OPTIONS}
            value={form.barriers_to_communication}
            onChange={v => handleChange('barriers_to_communication', v)}
          />
          <SelectField
            label="Source of Information"
            options={SOURCE_OPTIONS}
            value={form.source_of_information}
            onChange={v => handleChange('source_of_information', v)}
          />

        </div>
      </SubSection>

      {/* <FamilyChartForm /> */}
      <SubSection title="Family Chart">
        <FamilyChartForm value={familyChart} onChange={setFamilyChart} />
      </SubSection>

      <SubSection title="Genogram Chart">
        {genogram?.useUploadedImage && genogram?.uploadedImageUrl ? (
          <div className="w-full h-[480px] bg-background border border-border rounded-xl flex items-center justify-center p-4 overflow-hidden relative select-none">
            <img
              src={genogram.uploadedImageUrl}
              className="max-w-full max-h-full object-contain shadow-medium rounded-lg"
              alt="Manual Genogram Chart"
            />
            {genogram?.manualBeneficiaryCount !== undefined && genogram?.manualBeneficiaryCount !== null && genogram?.manualBeneficiaryCount !== '' && (
              <div className="absolute top-3 right-3 z-10 bg-card/95 backdrop-blur-sm border border-border rounded-xl p-2 px-3 shadow-medium flex items-center space-x-2">
                <div className="p-1.5 bg-amber-500/10 text-amber-500 rounded-lg">
                  <Users className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider leading-none mb-0.5">Household</div>
                  <div className="text-[10px] font-bold text-foreground leading-none">
                    Total Beneficiaries is {genogram.manualBeneficiaryCount}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <GenogramBuilder value={genogram} onChange={setGenogram} />
        )}

        {/* Upload Panel and Toggles Below */}
        <div className="mt-4 p-4 bg-muted/10 border border-border/60 rounded-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h5 className="text-xs font-bold text-foreground">Or, Upload Hand-Drawn Genogram</h5>
              <p className="text-[11px] text-muted-foreground">If you have a manually drawn family tree, upload it here.</p>
            </div>
            {genogram?.uploadedImageUrl && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">Active Display:</span>
                <button
                  type="button"
                  onClick={() => {
                    setGenogram(prev => ({
                      ...prev,
                      useUploadedImage: !prev?.useUploadedImage
                    }));
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold border transition ${genogram?.useUploadedImage
                      ? 'bg-amber-500/10 border-amber-500 text-amber-600 hover:bg-amber-500/20'
                      : 'bg-background border-border text-foreground hover:bg-muted'
                    }`}
                >
                  {genogram?.useUploadedImage ? 'Showing Uploaded Photo' : 'Showing Interactive Canvas'}
                </button>
              </div>
            )}
          </div>

          <OptimizedImageUpload
            onUploadSuccess={(data) => {
              setGenogram(prev => ({
                ...prev,
                uploadedImageUrl: data.optimized_url,
                useUploadedImage: true
              }));
            }}
          />

          {genogram?.uploadedImageUrl && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/40">
              <InputField
                label="Total Beneficiaries (including patient)"
                placeholder="e.g. 4"
                type='text'
                value={genogram?.manualBeneficiaryCount !== undefined && genogram?.manualBeneficiaryCount !== null ? genogram.manualBeneficiaryCount : ''}
                onChange={v => {
                  setGenogram(prev => ({
                    ...prev,
                    manualBeneficiaryCount: v === '' ? null : Number(v)
                  }));
                }}
              />
            </div>
          )}

          {genogram?.uploadedImageUrl && (
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground select-all truncate max-w-[250px] sm:max-w-md font-mono">
                {genogram.uploadedImageUrl}
              </span>
              <button
                type="button"
                onClick={() => {
                  setGenogram(prev => ({
                    ...prev,
                    uploadedImageUrl: null,
                    useUploadedImage: false,
                    manualBeneficiaryCount: null
                  }));
                }}
                className="text-red-500 hover:text-red-700 underline font-medium"
              >
                Delete Uploaded Photo
              </button>
            </div>
          )}
        </div>
      </SubSection>


      {/* ── Care Circle Details ── */}
      <SubSection title="Care Circle Details">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Primary Caregiver */}
          <div className="space-y-3 bg-muted/10 p-3.5 border border-border/60 rounded-lg">
            <h5 className="text-xs font-bold text-foreground uppercase tracking-wider">Primary Caregiver</h5>
            <InputField
              label="Caregiver Name"
              placeholder="e.g. Ravi Kumar"
              value={form.primary_caregiver_name}
              onChange={v => handleChange('primary_caregiver_name', v)}
            />
            <InputField
              label="Relationship to Patient"
              placeholder="e.g. Son, Daughter, Spouse"
              value={form.primary_caregiver_relationship}
              onChange={v => handleChange('primary_caregiver_relationship', v)}
            />
          </div>

          {/* Decision Maker */}
          <div className="space-y-3 bg-muted/10 p-3.5 border border-border/60 rounded-lg">
            <h5 className="text-xs font-bold text-foreground uppercase tracking-wider">Decision Maker</h5>
            <InputField
              label="Decision Maker Name"
              placeholder="e.g. Dr. Ramesh"
              value={form.decision_maker_name}
              onChange={v => handleChange('decision_maker_name', v)}
            />
            <InputField
              label="Relationship to Patient"
              placeholder="e.g. Oncologist, Treating Physician, Eldest Son"
              value={form.decision_maker_designation}
              onChange={v => handleChange('decision_maker_designation', v)}
            />
          </div>
        </div>
      </SubSection>

      {/* ── Save Button ── */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-50"
        >
          {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saved ? 'Saved!' : 'Save Demographic History'}
        </button>
      </div>
    </div>
  );
}