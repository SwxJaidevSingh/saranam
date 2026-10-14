/**
 * InitialAssessmentTab — Hospital Portal patient-detail Initial Assessment
 * (Baseline). View + edit for the full baseline: nursing, doctor, ESAS-R, PPS,
 * physiotherapy, psychological, and plan-of-care.
 *
 * Loads the whole baseline bundle once (GET /portal/patients/:id/baseline),
 * splits it across the sub-forms, and persists each form independently via
 * PUT /portal/patients/:id/baseline/:form. After a successful save the bundle
 * is re-fetched so derived values (e.g. computed totals on the server) stay in
 * sync.
 *
 * Props: { patientId, editable }
 */
import { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import clinicalApi from '../../api/clinical';
import NursingAssessmentForm from './NursingAssessmentForm';
import DoctorAssessmentForm from './DoctorAssessmentForm';
import EsasRForm from './EsasRForm';
import PpsForm from './PpsForm';
import PhysiotherapyAssessmentForm from './PhysiotherapyAssessmentForm';
import PsychologicalAssessmentForm from './PsychologicalAssessmentForm';
import PlanOfCareForm from './PlanOfCareForm';

const SUB_TABS = [
  { key: 'nursing', label: 'Nursing' },
  { key: 'doctor', label: 'Doctor' },
  { key: 'esas', label: 'ESAS-R' },
  { key: 'pps', label: 'PPS' },
  { key: 'physio', label: 'Physiotherapy' },
  { key: 'psychological', label: 'Psychological' },
  { key: 'plan-of-care', label: 'Plan of Care' },
];

export default function InitialAssessmentTab({ patientId, editable = false }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bundle, setBundle] = useState(null);
  const [active, setActive] = useState('nursing');

  const loadBundle = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    setError('');
    try {
      const data = await clinicalApi.getBaseline(patientId);
      setBundle(data || {});
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to load initial assessment.');
      setBundle({});
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => { loadBundle(); }, [loadBundle]);

  // Save one form's slice, then refresh the bundle so the UI reflects the
  // persisted state. Errors propagate to the form (which shows an alert).
  const handleSaveForm = useCallback(async (form, payload) => {
    await clinicalApi.saveBaselineForm(patientId, form, payload);
    await loadBundle();
  }, [patientId, loadBundle]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const b = bundle || {};

  const renderActive = () => {
    switch (active) {
      case 'nursing':
        return <NursingAssessmentForm data={b.nursing} editable={editable} onSave={handleSaveForm} />;
      case 'doctor':
        return <DoctorAssessmentForm data={b.doctor} editable={editable} onSave={handleSaveForm} />;
      case 'esas':
        return <EsasRForm data={b.esas} editable={editable} onSave={handleSaveForm} />;
      case 'pps':
        return (
          <PpsForm
            data={b.pps}
            editable={editable}
            onSave={handleSaveForm}
            patientComplexity={b.patient?.clinical_complexity || b.clinical_complexity || null}
          />
        );
      case 'physio':
        return <PhysiotherapyAssessmentForm data={b.physio} editable={editable} onSave={handleSaveForm} />;
      case 'psychological':
        return <PsychologicalAssessmentForm data={b.psychological} editable={editable} onSave={handleSaveForm} />;
      case 'plan-of-care':
        return <PlanOfCareForm data={b['plan-of-care']} editable={editable} onSave={handleSaveForm} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Sub-tab navigation */}
      <div className="flex flex-wrap gap-1.5 border-b border-border pb-2">
        {SUB_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActive(t.key)}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors
              ${active === t.key
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-background text-foreground border-border hover:bg-accent'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div>{renderActive()}</div>
    </div>
  );
}
