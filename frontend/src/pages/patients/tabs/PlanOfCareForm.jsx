import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Button, Alert, CircularProgress,
} from '@mui/material';
import { saranamApi } from '../../../api/saranam';
import generatePrescriptionPDF from '../../../utils/generatePrescriptionPDF';
import { normalizeLoadedMeds } from '../../../constants/prescription';
import PrescriptionBuilder from '../../../components/common/PrescriptionBuilder';

const ASSESSMENT_TYPE = 'care-plan';

const defaultData = () => ({
  intervention_non_pharmacological: '',
  intervention_pharmacological: '',
  medications: [],
});

export default function PlanOfCareForm({ visitId, patientId, onSaved, patientName, patientUhid, patientHomecareCode }) {
  const [data, setData] = useState(defaultData());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Prescription-specific state (wired to PrescriptionBuilder)
  const [medications, setMedications] = useState([]);
  const [rxNotes, setRxNotes] = useState('');
  const [rxFollowUpNotes, setRxFollowUpNotes] = useState('');
  const [rxVisitType, setRxVisitType] = useState('initial_assessment');
  const [rxIcd10, setRxIcd10] = useState('');
  const [rxDiagnosisText, setRxDiagnosisText] = useState('');
  const [doctorInfo, setDoctorInfo] = useState({ name: '', qualification: '', designation: '', kmc_number: '' });
  const [rxSaving, setRxSaving] = useState(false);
  const [rxSaved, setRxSaved] = useState(false);
  // Latest issued prescription version for this patient (enables download).
  const [latestVersion, setLatestVersion] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      saranamApi.getAssessment(visitId, ASSESSMENT_TYPE).catch(() => null),
      patientId ? saranamApi.latestPrescription(patientId, visitId).catch(() => null) : Promise.resolve(null),
    ])
      .then(([res, latest]) => {
        if (!active) return;
        const hasDraft = res && ((res.medications && res.medications.length) ||
          res.intervention_pharmacological || res.icd10_diagnosis || res.diagnosis_text);
        // Prefer this visit's saved draft; otherwise carry forward the patient's
        // most recent prescription (auto-fill for follow-ups — meds usually repeat).
        const carry = latest?.carry_forward;
        const snap = (!hasDraft && carry) ? carry : (res || {});
        if (res) {
          setData((prev) => ({ ...prev, ...res }));
        } else if (carry) {
          setData((prev) => ({ ...prev, intervention_non_pharmacological: carry.intervention_non_pharmacological || '' }));
        }
        setMedications(normalizeLoadedMeds(snap.medications));
        setRxNotes(snap.intervention_pharmacological || '');
        setRxFollowUpNotes(snap.follow_up_notes || '');
        setRxVisitType((res && res.visit_type) || 'initial_assessment');
        setRxIcd10(snap.icd10_diagnosis || '');
        setRxDiagnosisText(snap.diagnosis_text || '');
        // Restore the prescribing doctor from the latest version so the signature
        // is re-loaded (DoctorInfoSection re-selects the provider from provider_id).
        if (latest?.doctor) {
          setDoctorInfo((prev) => ({ ...prev, ...latest.doctor }));
        }
        // Only a real issued version (with an id) enables the Download button.
        if (latest?.version?.id) setLatestVersion(latest.version);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [visitId, patientId]);

  // Build the args for generatePrescriptionPDF from the current form state.
  const buildPdfArgs = (extra = {}) => ({
    patientName: patientName || 'Patient',
    patientId,
    patientUhid: patientUhid || null,
    patientHomecareCode: patientHomecareCode || null,
    medications,
    pharmacological: rxNotes,
    nonPharmacological: data.intervention_non_pharmacological,
    followUpNotes: rxFollowUpNotes,
    doctorName: doctorInfo.name,
    doctorDesignation: [doctorInfo.qualification, doctorInfo.designation].filter(Boolean).join(', '),
    doctorLicenseNumber: doctorInfo.kmc_number,
    doctorSignatureImage: doctorInfo.signature_image || null,
    icd10Diagnosis: rxIcd10,
    diagnosis: rxDiagnosisText,
    ...extra,
  });

  const set = useCallback((field) => (e) => {
    setData((prev) => ({ ...prev, [field]: e.target.value }));
    setSuccess(false);
  }, []);

  const handleSave = async () => {
    setSaving(true); setError(''); setSuccess(false);
    try {
      await saranamApi.saveAssessment(visitId, ASSESSMENT_TYPE, {
        ...data,
        medications,
        intervention_pharmacological: rxNotes,
        visit_type: rxVisitType,
        icd10_diagnosis: rxIcd10,
        diagnosis_text: rxDiagnosisText,
        follow_up_notes: rxFollowUpNotes,
      });
      setSuccess(true);
      onSaved?.();
    } catch (err) {
      setError(err?.response?.data?.error || err?.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  // Save the draft AND issue an immutable version (generate the PDF + upload it).
  // The version's content is deduped server-side, so re-saving without changes
  // doesn't create a new version.
  const handleSavePrescription = async () => {
    setRxSaving(true);
    try {
      await saranamApi.saveAssessment(visitId, ASSESSMENT_TYPE, {
        ...data,
        medications,
        intervention_pharmacological: rxNotes,
        visit_type: rxVisitType,
        icd10_diagnosis: rxIcd10,
        diagnosis_text: rxDiagnosisText,
        follow_up_notes: rxFollowUpNotes,
      });

      const pdfBlob = await generatePrescriptionPDF(buildPdfArgs({ returnBlob: true }));
      // The signature is already embedded in the PDF. Don't ship a large base64
      // data-URL signature in the JSON metadata field — it blows past the form
      // field size limit (413). Keep only a short URL reference if present.
      const { signature_image, ...doctorMeta } = doctorInfo || {};
      const doctorForSnapshot = (signature_image && signature_image.startsWith('http'))
        ? { ...doctorMeta, signature_image }
        : doctorMeta;
      const res = await saranamApi.issuePrescription(visitId, pdfBlob, {
        medications,
        icd10_diagnosis: rxIcd10,
        diagnosis_text: rxDiagnosisText,
        intervention_pharmacological: rxNotes,
        intervention_non_pharmacological: data.intervention_non_pharmacological,
        follow_up_notes: rxFollowUpNotes,
        visit_type: rxVisitType,
        doctor: doctorForSnapshot,
      });
      if (res?.version) setLatestVersion(res.version);

      setRxSaved(true);
      setTimeout(() => setRxSaved(false), 3000);
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to save prescription');
    } finally { setRxSaving(false); }
  };

  // Download the latest issued version (backend streams it from storage + logs
  // the download). Disabled until a version has been issued.
  const handleDownloadPDF = async () => {
    if (latestVersion?.id) {
      try {
        await saranamApi.downloadPrescriptionVersion(
          latestVersion.id,
          `Prescription_${(patientName || 'Patient').replace(/\s+/g, '_')}_v${latestVersion.version_number}.pdf`,
        );
        return;
      } catch (err) {
        console.warn("Failed to download backend PDF, falling back to client-side:", err);
      }
    }

    try {
      await generatePrescriptionPDF(buildPdfArgs({ returnBlob: false }));
    } catch (err) {
      setError('Failed to generate PDF: ' + (err?.message || 'error'));
    }
  };

  if (loading) return <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>;

  return (
    <Box>
      {success && <Alert severity="success" sx={{ mb: 2 }}>Plan of care saved successfully.</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Prescription — uses the same Tailwind UI as the follow-up form.
          Non-Pharmacological Notes are rendered inside the prescription block
          (per 2026-04-28 client meeting §5D). */}
      <PrescriptionBuilder
        medications={medications}
        setMedications={(fn) => { setMedications(fn); setRxSaved(false); }}
        rxNotes={rxNotes}
        setRxNotes={(v) => { setRxNotes(v); setRxSaved(false); }}
        followUpNotes={rxFollowUpNotes}
        setFollowUpNotes={(v) => { setRxFollowUpNotes(v); setRxSaved(false); }}
        visitType={rxVisitType}
        setVisitType={(v) => { setRxVisitType(v); setRxSaved(false); }}
        icd10Diagnosis={rxIcd10}
        setIcd10Diagnosis={(v) => { setRxIcd10(v); setRxSaved(false); }}
        diagnosisText={rxDiagnosisText}
        setDiagnosisText={(v) => { setRxDiagnosisText(v); setRxSaved(false); }}
        doctorInfo={doctorInfo}
        setDoctorInfo={setDoctorInfo}
        onSave={handleSavePrescription}
        saving={rxSaving}
        saved={rxSaved}
        onDownloadPDF={handleDownloadPDF}
        canDownload={true}
        patientId={patientId}
        saveLabel="Save Prescription"
        nonPharmacologicalNotes={data.intervention_non_pharmacological || ''}
        setNonPharmacologicalNotes={(v) => set('intervention_non_pharmacological')({ target: { value: v } })}
      />

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button variant="contained" onClick={handleSave} disabled={saving}
          startIcon={saving ? <CircularProgress size={18} /> : null}>
          {saving ? 'Saving...' : 'Save Plan of Care'}
        </Button>
      </Box>
    </Box>
  );
}
