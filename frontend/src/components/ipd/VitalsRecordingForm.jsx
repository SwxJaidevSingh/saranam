import { useState } from 'react';
import { Activity, Save, AlertTriangle } from 'lucide-react';
import ipdApi from '../../api/ipd';

const DEFAULT_VITALS = {
  bp_systolic: '',
  bp_diastolic: '',
  temperature: '',
  pulse: '',
  respiratory_rate: '',
  spo2: '',
  blood_sugar: '',
  weight: '',
  pain_score: '',
  intake_ml: '',
  output_ml: ''
};

const VITAL_RANGES = {
  bp_systolic: { min: 60, max: 180, unit: 'mmHg', label: 'BP Systolic' },
  bp_diastolic: { min: 40, max: 120, unit: 'mmHg', label: 'BP Diastolic' },
  temperature: { min: 95, max: 106, unit: '°F', label: 'Temperature' },
  pulse: { min: 40, max: 150, unit: 'bpm', label: 'Pulse' },
  respiratory_rate: { min: 8, max: 40, unit: '/min', label: 'Respiratory Rate' },
  spo2: { min: 85, max: 100, unit: '%', label: 'SpO₂' },
  blood_sugar: { min: 40, max: 400, unit: 'mg/dL', label: 'Blood Sugar' },
  weight: { min: 0, max: 300, unit: 'kg', label: 'Weight' },
  pain_score: { min: 0, max: 10, unit: '/10', label: 'Pain Score' },
  intake_ml: { min: 0, max: 10000, unit: 'mL', label: 'Fluid Intake' },
  output_ml: { min: 0, max: 10000, unit: 'mL', label: 'Fluid Output' }
};

export default function VitalsRecordingForm({ admissionId, encounterId, patientId, onSuccess }) {
  const [vitalsData, setVitalsData] = useState(DEFAULT_VITALS);
  const [observationNotes, setObservationNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [warnings, setWarnings] = useState([]);

  const handleVitalChange = (field, value) => {
    setVitalsData(prev => ({ ...prev, [field]: value }));
    checkVitalWarnings(field, value);
  };

  const checkVitalWarnings = (field, value) => {
    if (!value) {
      setWarnings(prev => prev.filter(w => w.field !== field));
      return;
    }

    const numValue = parseFloat(value);
    const range = VITAL_RANGES[field];

    if (range && (numValue < range.min || numValue > range.max)) {
      const warning = {
        field,
        message: `${range.label} is out of normal range (${range.min}-${range.max} ${range.unit})`
      };

      setWarnings(prev => {
        const filtered = prev.filter(w => w.field !== field);
        return [...filtered, warning];
      });
    } else {
      setWarnings(prev => prev.filter(w => w.field !== field));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setIsSubmitting(true);
      setError(null);

      // Filter out empty values and convert to numbers
      const cleanedVitals = {};
      Object.entries(vitalsData).forEach(([key, value]) => {
        if (value !== '') {
          cleanedVitals[key] = parseFloat(value);
        }
      });

      // Add intake/output as nested object if both present
      if (cleanedVitals.intake_ml !== undefined || cleanedVitals.output_ml !== undefined) {
        cleanedVitals.intake_output = {
          intake_ml: cleanedVitals.intake_ml || 0,
          output_ml: cleanedVitals.output_ml || 0
        };
        delete cleanedVitals.intake_ml;
        delete cleanedVitals.output_ml;
      }

      if (Object.keys(cleanedVitals).length === 0) {
        setError('Please enter at least one vital sign');
        return;
      }

      await ipdApi.recordVitals(admissionId, {
        encounter_id: encounterId,
        patient_id: patientId,
        vitals_data: cleanedVitals,
        observation_notes: observationNotes
      });

      // Reset form
      setVitalsData(DEFAULT_VITALS);
      setObservationNotes('');
      setWarnings([]);

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Failed to record vitals:', err);
      setError(err.response?.data?.error || 'Failed to record vitals');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderVitalInput = (field) => {
    const range = VITAL_RANGES[field];
    const hasWarning = warnings.some(w => w.field === field);

    return (
      <div key={field}>
        <label className="block text-sm font-medium text-muted-foreground mb-1">
          {range.label}
          <span className="text-muted-foreground text-xs ml-1">({range.unit})</span>
        </label>
        <input
          type="number"
          value={vitalsData[field]}
          onChange={(e) => handleVitalChange(field, e.target.value)}
          placeholder={`${range.min}-${range.max}`}
          step={field === 'temperature' ? '0.1' : '1'}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
            hasWarning
              ? 'border-red-300 focus:ring-red-500 bg-red-50'
              : 'border-border focus:ring-blue-500'
          }`}
        />
      </div>
    );
  };

  return (
    <div className="bg-card rounded-lg shadow p-6">
      <div className="flex items-center gap-2 mb-6">
        <Activity className="h-6 w-6 text-blue-600" />
        <h2 className="text-xl font-bold text-foreground">Record Vitals</h2>
      </div>

      {warnings.length > 0 && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-yellow-900 mb-1">Warning: Abnormal Values Detected</h3>
              <ul className="list-disc list-inside text-sm text-yellow-800 space-y-1">
                {warnings.map((warning, idx) => (
                  <li key={idx}>{warning.message}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Blood Pressure */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-secondary rounded-lg">
          <div className="md:col-span-2">
            <h3 className="font-semibold text-foreground mb-3">Blood Pressure</h3>
          </div>
          {renderVitalInput('bp_systolic')}
          {renderVitalInput('bp_diastolic')}
        </div>

        {/* Primary Vitals */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {renderVitalInput('temperature')}
          {renderVitalInput('pulse')}
          {renderVitalInput('respiratory_rate')}
        </div>

        {/* Oxygen & Blood Sugar */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderVitalInput('spo2')}
          {renderVitalInput('blood_sugar')}
        </div>

        {/* Weight & Pain */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderVitalInput('weight')}
          {renderVitalInput('pain_score')}
        </div>

        {/* Intake/Output */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
          <div className="md:col-span-2">
            <h3 className="font-semibold text-foreground mb-3">Fluid Balance (24h)</h3>
          </div>
          {renderVitalInput('intake_ml')}
          {renderVitalInput('output_ml')}
          {vitalsData.intake_ml && vitalsData.output_ml && (
            <div className="md:col-span-2">
              <div className="text-sm">
                <span className="font-medium">Balance:</span>{' '}
                <span className={parseFloat(vitalsData.intake_ml) - parseFloat(vitalsData.output_ml) < 0 ? 'text-red-600' : 'text-green-600'}>
                  {(parseFloat(vitalsData.intake_ml) - parseFloat(vitalsData.output_ml)).toFixed(0)} mL
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Observation Notes */}
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Observation Notes
          </label>
          <textarea
            value={observationNotes}
            onChange={(e) => setObservationNotes(e.target.value)}
            rows={3}
            placeholder="Enter any relevant observations, symptoms, or patient condition notes..."
            className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm">
            {error}
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              setVitalsData(DEFAULT_VITALS);
              setObservationNotes('');
              setWarnings([]);
              setError(null);
            }}
            className="px-6 py-2 bg-secondary text-foreground rounded-lg hover:bg-accent"
          >
            Clear
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Save className="h-5 w-5" />
            {isSubmitting ? 'Saving...' : 'Save Vitals'}
          </button>
        </div>
      </form>
    </div>
  );
}
