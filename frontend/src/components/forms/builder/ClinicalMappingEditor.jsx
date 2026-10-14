import { useState, useEffect } from 'react';
import { Activity, Info } from 'lucide-react';

// Common observation types with LOINC codes
const OBSERVATION_TYPES = [
  {
    value: 'bp_systolic',
    label: 'Blood Pressure (Systolic)',
    loincCode: '8480-6',
    unit: 'mmHg',
    category: 'vital-signs'
  },
  {
    value: 'bp_diastolic',
    label: 'Blood Pressure (Diastolic)',
    loincCode: '8462-4',
    unit: 'mmHg',
    category: 'vital-signs'
  },
  {
    value: 'heart_rate',
    label: 'Heart Rate',
    loincCode: '8867-4',
    unit: 'bpm',
    category: 'vital-signs'
  },
  {
    value: 'respiratory_rate',
    label: 'Respiratory Rate',
    loincCode: '9279-1',
    unit: '/min',
    category: 'vital-signs'
  },
  {
    value: 'temperature',
    label: 'Body Temperature',
    loincCode: '8310-5',
    unit: '°F',
    category: 'vital-signs'
  },
  {
    value: 'spo2',
    label: 'Oxygen Saturation (SpO2)',
    loincCode: '2708-6',
    unit: '%',
    category: 'vital-signs'
  },
  {
    value: 'weight',
    label: 'Body Weight',
    loincCode: '29463-7',
    unit: 'kg',
    category: 'vital-signs'
  },
  {
    value: 'height',
    label: 'Body Height',
    loincCode: '8302-2',
    unit: 'cm',
    category: 'vital-signs'
  },
  {
    value: 'bmi',
    label: 'Body Mass Index (BMI)',
    loincCode: '39156-5',
    unit: 'kg/m2',
    category: 'vital-signs'
  },
  {
    value: 'pain_scale',
    label: 'Pain Severity (0-10)',
    loincCode: '72514-3',
    unit: 'score',
    category: 'survey'
  },
  {
    value: 'glucose',
    label: 'Blood Glucose',
    loincCode: '2339-0',
    unit: 'mg/dL',
    category: 'laboratory'
  },
  {
    value: 'hemoglobin',
    label: 'Hemoglobin',
    loincCode: '718-7',
    unit: 'g/dL',
    category: 'laboratory'
  }
];

const CATEGORIES = [
  { value: 'vital-signs', label: 'Vital Signs' },
  { value: 'survey', label: 'Survey/Assessment' },
  { value: 'laboratory', label: 'Laboratory' },
  { value: 'imaging', label: 'Imaging' },
  { value: 'procedure', label: 'Procedure' },
  { value: 'social-history', label: 'Social History' }
];

export default function ClinicalMappingEditor({ value, onChange }) {
  const [mapping, setMapping] = useState({
    observationType: '',
    loincCode: '',
    unit: '',
    category: 'vital-signs',
    ...value
  });

  const [useCustom, setUseCustom] = useState(false);

  useEffect(() => {
    // Check if current mapping matches a predefined type
    const predefinedMatch = OBSERVATION_TYPES.find(
      (type) => type.value === mapping.observationType
    );
    setUseCustom(!predefinedMatch && !!mapping.observationType);
  }, [mapping.observationType]);

  const handlePredefinedChange = (observationType) => {
    const selected = OBSERVATION_TYPES.find((type) => type.value === observationType);
    if (selected) {
      const newMapping = {
        observationType: selected.value,
        loincCode: selected.loincCode,
        unit: selected.unit,
        category: selected.category
      };
      setMapping(newMapping);
      onChange(newMapping);
    }
  };

  const handleCustomChange = (field, value) => {
    const newMapping = { ...mapping, [field]: value };
    setMapping(newMapping);
    onChange(newMapping);
  };

  const handleClear = () => {
    const emptyMapping = {
      observationType: '',
      loincCode: '',
      unit: '',
      category: 'vital-signs'
    };
    setMapping(emptyMapping);
    onChange(null);
    setUseCustom(false);
  };

  const hasMapping = !!(mapping.observationType || mapping.loincCode);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary-600" />
          <h3 className="font-medium text-foreground">Clinical Mapping</h3>
        </div>
        {hasMapping && (
          <button
            onClick={handleClear}
            className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 underline"
          >
            Clear
          </button>
        )}
      </div>

      <div className="bg-blue-500/10 border border-blue-200 dark:border-blue-400/30 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-600 dark:text-blue-400">
            Clinical mappings enable automatic creation of FHIR-compliant observations
            when this field is submitted. Observations link to patient encounters for
            longitudinal tracking.
          </p>
        </div>
      </div>

      {/* Predefined or Custom Toggle */}
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            checked={!useCustom}
            onChange={() => setUseCustom(false)}
            className="w-4 h-4 text-primary-600"
          />
          <span className="text-sm font-medium text-foreground">Use Predefined</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            checked={useCustom}
            onChange={() => setUseCustom(true)}
            className="w-4 h-4 text-primary-600"
          />
          <span className="text-sm font-medium text-foreground">Custom Mapping</span>
        </label>
      </div>

      {!useCustom ? (
        /* Predefined Observation Types */
        <div className="space-y-3">
          <div className="form-group">
            <label className="form-label text-sm">Observation Type</label>
            <select
              value={mapping.observationType}
              onChange={(e) => handlePredefinedChange(e.target.value)}
              className="input text-sm"
            >
              <option value="">-- Select Observation Type --</option>
              {OBSERVATION_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label} ({type.loincCode})
                </option>
              ))}
            </select>
          </div>

          {mapping.observationType && (
            <div className="bg-secondary rounded-lg p-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">LOINC Code:</span>
                <span className="font-mono text-foreground">{mapping.loincCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Unit:</span>
                <span className="font-mono text-foreground">{mapping.unit}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Category:</span>
                <span className="text-foreground capitalize">{mapping.category}</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Custom Mapping Fields */
        <div className="space-y-3">
          <div className="form-group">
            <label className="form-label text-sm">
              Observation Type <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={mapping.observationType}
              onChange={(e) => handleCustomChange('observationType', e.target.value)}
              className="input text-sm"
              placeholder="e.g., blood_glucose"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Unique identifier for this observation type
            </p>
          </div>

          <div className="form-group">
            <label className="form-label text-sm">LOINC Code</label>
            <input
              type="text"
              value={mapping.loincCode}
              onChange={(e) => handleCustomChange('loincCode', e.target.value)}
              className="input text-sm font-mono"
              placeholder="e.g., 2339-0"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Standard LOINC code for interoperability
            </p>
          </div>

          <div className="form-group">
            <label className="form-label text-sm">Unit of Measure</label>
            <input
              type="text"
              value={mapping.unit}
              onChange={(e) => handleCustomChange('unit', e.target.value)}
              className="input text-sm"
              placeholder="e.g., mg/dL, mmHg, bpm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Unit for the measured value
            </p>
          </div>

          <div className="form-group">
            <label className="form-label text-sm">Category</label>
            <select
              value={mapping.category}
              onChange={(e) => handleCustomChange('category', e.target.value)}
              className="input text-sm"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* SNOMED-CT Code (Optional) */}
      {hasMapping && (
        <div className="pt-3 border-t border-border">
          <details className="group">
            <summary className="cursor-pointer text-sm font-medium text-foreground flex items-center gap-2">
              <span>Advanced Options (Optional)</span>
              <span className="text-xs text-muted-foreground">(SNOMED-CT)</span>
            </summary>
            <div className="mt-3 space-y-3">
              <div className="form-group">
                <label className="form-label text-sm">SNOMED-CT Code</label>
                <input
                  type="text"
                  value={mapping.snomedCode || ''}
                  onChange={(e) => handleCustomChange('snomedCode', e.target.value)}
                  className="input text-sm font-mono"
                  placeholder="e.g., 271649006"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Additional SNOMED-CT code for enhanced semantic interoperability
                </p>
              </div>
            </div>
          </details>
        </div>
      )}

      {hasMapping && (
        <div className="bg-green-500/10 border border-green-200 dark:border-green-400/30 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full mt-1.5"></div>
            <div className="text-xs text-green-600 dark:text-green-400">
              <p className="font-medium">Clinical mapping configured</p>
              <p className="mt-1">
                When this field is submitted, an Observation record will be automatically
                created and linked to the patient's encounter.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
