/**
 * SocialHistoryForm — Saranam baseline section
 */
import { useState, useEffect } from 'react';
import { Save, RefreshCw, Loader2 } from 'lucide-react';
import saranamApi from '../../../api/saranam';

function SubSection({ title, children }) {
    return (
        <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground border-b border-border pb-1">{title}</h4>
            {children}
        </div>
    );
}

function InsightCell({ name, value, onChange }) {
    return (
        <div className="p-3 space-y-2">
            {INSIGHT_OPTIONS.map(option => (
                <label
                    key={option.value}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                >
                    <input
                        type="radio"
                        name={name}
                        value={option.value}
                        checked={value === option.value}
                        onChange={(e) => onChange(e.target.value)}
                        className="h-4 w-4"
                    />
                    <span>{option.label}</span>
                </label>
            ))}
        </div>
    );
}

function TextArea({ label, placeholder, value, onChange, rows = 2 }) {
    return (
        <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
            <textarea
                rows={rows} placeholder={placeholder || label} value={value}
                onChange={e => onChange(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm resize-none"
            />
        </div>
    );
}

function GridCell({ value, onChange, placeholder }) {
    return (
        <textarea
            rows={2}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full h-full px-3 py-2 bg-background text-foreground text-sm resize-none outline-none"
        />
    );
}

const INSIGHT_OPTIONS = [
    { value: 'aware', label: 'Aware' },
    { value: 'not_willing', label: 'Not willing to know' },
    { value: 'unaware', label: 'Unaware' },
];
export default function SocialHistoryForm({ visitId, patientId, onSaved }) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const [sourceOfIncome, setSourceOfIncome] = useState('');
    const [socioeconomicStatus, setSocioeconomicStatus] = useState('');
    const [livingCondition, setLivingCondition] = useState('');
    const [socialBurden, setSocialBurden] = useState('');
    const [healthInsurance, setHealthInsurance] = useState('');

    // Insight & Prognosis — 2x2 table (Patient/Family x Diagnosis/Prognosis)
    const [insightPatientDiagnosis, setInsightPatientDiagnosis] = useState('');
    const [insightPatientPrognosis, setInsightPatientPrognosis] = useState('');
    const [insightFamilyDiagnosis, setInsightFamilyDiagnosis] = useState('');
    const [insightFamilyPrognosis, setInsightFamilyPrognosis] = useState('');

    const [socialIssues, setSocialIssues] = useState('');

    useEffect(() => { loadData(); }, [visitId]);

    const loadData = async () => {
        try {
            setLoading(true);
            const data = await saranamApi.getAssessment(visitId, 'social-history');
            if (data) {
                setSourceOfIncome(data.source_of_income || '');
                setSocioeconomicStatus(data.socioeconomic_status || '');
                setLivingCondition(data.living_condition || '');
                setSocialBurden(data.social_burden || '');
                setHealthInsurance(data.health_insurance || '');
                setInsightPatientDiagnosis(data.insight_patient_diagnosis || '');
                setInsightPatientPrognosis(data.insight_patient_prognosis || '');
                setInsightFamilyDiagnosis(data.insight_family_diagnosis || '');
                setInsightFamilyPrognosis(data.insight_family_prognosis || '');
                setSocialIssues(data.social_issues || '');
            }
        } catch (err) {
            // No existing data — fresh form
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await saranamApi.saveAssessment(visitId, 'social-history', {
                source_of_income: sourceOfIncome,
                socioeconomic_status: socioeconomicStatus,
                living_condition: livingCondition,
                social_burden: socialBurden,
                health_insurance: healthInsurance,
                insight_patient_diagnosis: insightPatientDiagnosis,
                insight_patient_prognosis: insightPatientPrognosis,
                insight_family_diagnosis: insightFamilyDiagnosis,
                insight_family_prognosis: insightFamilyPrognosis,
                social_issues: socialIssues,
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
            if (onSaved) onSaved();
        } catch (err) {
            alert(err?.response?.data?.error || 'Failed to save social history');
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

            <SubSection title="Social History">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <TextArea label="Source of Income" value={sourceOfIncome} onChange={setSourceOfIncome} />
                    <TextArea label="Socioeconomic Status" value={socioeconomicStatus} onChange={setSocioeconomicStatus} />
                    <TextArea label="Living Condition and Environment" value={livingCondition} onChange={setLivingCondition} />
                    <TextArea label="Social Burden" value={socialBurden} onChange={setSocialBurden} />
                    <TextArea label="Health Insurance / Life Insurance" value={healthInsurance} onChange={setHealthInsurance} />
                </div>
            </SubSection>

            <SubSection title="Insight & Prognosis">
                <div className="border border-border rounded-lg overflow-hidden">
                    {/* Header row */}
                    <div className="grid grid-cols-3 bg-muted/30 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        <div className="px-3 py-2 border-r border-border">Insight</div>
                        <div className="px-3 py-2 border-r border-border">Diagnosis</div>
                        <div className="px-3 py-2">Prognosis</div>
                    </div>
                    {/* Patient row */}
                    <div className="grid grid-cols-3 border-t border-border">
                        <div className="px-3 py-2 text-sm font-medium text-foreground border-r border-border flex items-center bg-muted/10">
                            Patient
                        </div>
                        <div className="border-r border-border">
                            <InsightCell
                                name="patient-diagnosis"
                                value={insightPatientDiagnosis}
                                onChange={setInsightPatientDiagnosis}
                            />
                        </div>

                        <div>
                            <InsightCell
                                name="patient-prognosis"
                                value={insightPatientPrognosis}
                                onChange={setInsightPatientPrognosis}
                            />
                        </div>
                    </div>
                    {/* Family row */}
                    <div className="grid grid-cols-3 border-t border-border">
                        <div className="px-3 py-2 text-sm font-medium text-foreground border-r border-border flex items-center bg-muted/10">
                            Family
                        </div>
                        <div className="border-r border-border">
                            <InsightCell
                                name="family-diagnosis"
                                value={insightFamilyDiagnosis}
                                onChange={setInsightFamilyDiagnosis}
                            />
                        </div>

                        <div>
                            <InsightCell
                                name="family-prognosis"
                                value={insightFamilyPrognosis}
                                onChange={setInsightFamilyPrognosis}
                            />
                        </div>
                    </div>
                </div>
            </SubSection>

            <SubSection title="Social Issues">
                <TextArea label="Social Issues" value={socialIssues} onChange={setSocialIssues} rows={3} />
            </SubSection>

            <div className="flex justify-end pt-2">
                <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-50">
                    {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {saved ? 'Saved!' : 'Save Social History'}
                </button>
            </div>
        </div>
    );
}