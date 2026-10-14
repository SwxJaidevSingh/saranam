/**
 * OverviewTab — Patient demographics + initial (baseline) assessment forms
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Grid, Chip, Paper, Divider, Button, TextField, MenuItem,
  Accordion, AccordionSummary, AccordionDetails, CircularProgress, Alert,
} from '@mui/material';
import { CheckCircle } from '@mui/icons-material';
import {
  Person, Phone, LocationOn, CalendarToday, MedicalServices, ExpandMore,
} from '@mui/icons-material';
import patientsApi from '../../../api/patients';
import saranamApi from '../../../api/saranam';
import BodyMapView from './BodyMapView';
import NursingAssessmentForm from './NursingAssessmentForm';
import DoctorAssessmentForm from './DoctorAssessmentForm';
import PsychologicalAssessmentForm from './PsychologicalAssessmentForm';
import DemographicForm from './DemographicForm';
import SocialHistoryForm from './SocialHistory';
import PhysiotherapyAssessmentForm from './PhysiotherapyAssessmentForm';
// import EsasRForm from './EsasRForm';
import PpsForm from './PpsForm';
import PlanOfCareForm from './PlanOfCareForm';
// import ProceduresSection from '../../../components/common/ProceduresSection';
import CareCircleCard from '../../../components/patients/CareCircleCard';
import PpsCard from '../../../components/patients/PpsCard';
import AiPatientSummaryCard from '../../../components/patients/AiPatientSummaryCard';
import FollowupSummaryHistorySection from '../../../components/patients/FollowupSummaryHistorySection';
import { useAuth } from '@/context/AuthContext';
import ConsultationTypeMultiSelect from '../../../components/common/ConsultationTypeMultiSelect';

const InfoItem = ({ icon, label, value }) => {
  if (!value) return null;
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
      {icon && <Box sx={{ color: 'text.secondary', mt: 0.3 }}>{icon}</Box>}
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.65rem' }}>
          {label}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {value}
        </Typography>
      </Box>
    </Box>
  );
};

const AssessmentAccordion = ({ title, status, children }) => {
  const isSaved = status === 'saved';
  return (
    <Accordion
      sx={{
        '&:before': { display: 'none' },
        boxShadow: 'none',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '8px !important',
        mb: 1,
        '&.Mui-expanded': { mb: 1 },
      }}
    >
      <AccordionSummary expandIcon={<ExpandMore />} sx={{ minHeight: 48, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1 }}>{title}</Typography>
          <Chip
            label={isSaved ? 'Saved' : 'Not started'}
            size="small"
            color={isSaved ? 'success' : 'default'}
            variant={isSaved ? 'filled' : 'outlined'}
            sx={{ height: 22, fontSize: '0.65rem' }}
          />
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        {children || (
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', py: 2, textAlign: 'center' }}>
            Form will be available in the next update.
          </Typography>
        )}
      </AccordionDetails>
    </Accordion>
  );
};

const CATEGORY_OPTIONS = [
  { value: 'bsc_onco', label: 'BSC Onco', bsc: true, onco: true },
  { value: 'non_bsc_onco', label: 'Non-BSC Onco', bsc: false, onco: true },
  { value: 'bsc_non_onco', label: 'BSC Non-Onco', bsc: true, onco: false },
  { value: 'non_bsc_non_onco', label: 'Non-BSC Non-Onco', bsc: false, onco: false },
];

const COMPLEXITY_OPTIONS = [
  { value: 'not_yet_determined', label: 'Not Yet Determined' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const PRIORITY_OPTIONS = [
  { value: 'not_yet_determined', label: 'Not Yet Determined' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const getCategoryValue = (patient) => {
  if (patient.bsc_status == null && patient.is_onco == null) return '';
  const bsc = patient.bsc_status;
  const onco = patient.is_onco;
  if (bsc && onco) return 'bsc_onco';
  if (!bsc && onco) return 'non_bsc_onco';
  if (bsc && !onco) return 'bsc_non_onco';
  return 'non_bsc_non_onco';
};

const PatientCategoryForm = ({ patient }) => {
  const [category, setCategory] = useState(getCategoryValue(patient));
  const [complexity, setComplexity] = useState(patient.clinical_complexity || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Re-hydrate when the parent patient prop changes (e.g. after PPS save
  // auto-syncs clinical_complexity, the Priority dropdown should reflect the
  // new value without the user having to reopen the page).
  useEffect(() => {
    setCategory(getCategoryValue(patient));
    setComplexity(patient.clinical_complexity || '');
  }, [patient?.id, patient?.clinical_complexity, patient?.bsc_status, patient?.is_onco]);

  const handleSave = async () => {
    if (!category) {
      alert('Please select a patient category');
      return;
    }
    const selected = CATEGORY_OPTIONS.find(c => c.value === category);
    if (!selected) return;
    setSaving(true);
    try {
      await patientsApi.update(patient.id, {
        bsc_status: selected.bsc,
        is_onco: selected.onco,
        ...(complexity ? { clinical_complexity: complexity } : {}),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      alert('Failed to update patient category');
    } finally {
      setSaving(false);
    }
  };

  const isUnset = patient.bsc_status == null && patient.is_onco == null;

  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mt: 1, mb: 1, bgcolor: isUnset ? 'warning.50' : 'action.hover', borderColor: isUnset ? 'warning.main' : 'divider' }}>
      <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 700 }}>
        Patient Category & Priority
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        {isUnset
          ? 'Category was not set during registration. Please determine it based on the assessment.'
          : 'Confirm or update based on the initial assessment findings.'}
        {' Priority auto-updates when you change the PPS score above, but you can also edit it manually.'}
      </Typography>
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <TextField
          select size="small" sx={{ flex: 1, minWidth: 150 }}
          label="Patient Category"
          value={category}
          onChange={(e) => { setCategory(e.target.value); setSaved(false); }}
        >
          <MenuItem value="" disabled><em>Select category...</em></MenuItem>
          {CATEGORY_OPTIONS.map(opt => (
            <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
          ))}
        </TextField>
        <TextField
          select size="small" sx={{ flex: 1, minWidth: 140 }}
          label="Patient Priority"
          value={complexity}
          onChange={(e) => { setComplexity(e.target.value); setSaved(false); }}
        >
          <MenuItem value="" disabled><em>Select priority...</em></MenuItem>
          {COMPLEXITY_OPTIONS.map(opt => (
            <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
          ))}
        </TextField>
        <Button
          variant="contained"
          size="small"
          onClick={handleSave}
          disabled={saving}
          color={saved ? 'success' : 'primary'}
          sx={{ textTransform: 'none', minWidth: 80, height: 40 }}
        >
          {saving ? <CircularProgress size={18} color="inherit" /> : saved ? 'Saved' : 'Save'}
        </Button>
      </Box>
    </Paper>
  );
};

// Format an ISO datetime/date string to yyyy-mm-dd for a native date input.
const toDateInputValue = (isoString) => {
  if (!isoString) return '';
  // Handles both "2026-05-04" and full timestamps like "2026-05-04T00:00:00"
  return isoString.slice(0, 10);
};

const OverviewTab = ({ patient, onPatientRefresh }) => {
  const [initialVisit, setInitialVisit] = useState(null);
  const [loadingVisit, setLoadingVisit] = useState(true);
  const [assessmentStatuses, setAssessmentStatuses] = useState({});
  const [uhidPreview, setUhidPreview] = useState(null);

  // ── Initial Assessment Date (visit_date on the initial visit record) ──
  // Editable here because it previously had no UI path other than direct DB
  // edits. Pre-populated from initialVisit.visit_date whenever it's present.
  const [editingVisitDate, setEditingVisitDate] = useState(false);
  const [visitDateDraft, setVisitDateDraft] = useState('');
  const [savingVisitDate, setSavingVisitDate] = useState(false);
  const [visitDateError, setVisitDateError] = useState('');

  const [savingConsultationType, setSavingConsultationType] = useState(false);
  const [consultationTypeSaved, setConsultationTypeSaved] = useState(false);

  const { user } = useAuth();
  const { hasPermission } = useAuth();

  const canEditVisitDate = ['admin', 'doctor', 'nurse'].includes(user?.role);

  // Fetch the probable UHID for patients who don't have one yet. Only applies
  // to Bangalore residents with zone + linked hospital set — others never get
  // a UHID. The value is best-effort (peek, no counter increment); the actual
  // UHID is confirmed at the moment the "Mark Complete" button is clicked.
  useEffect(() => {
    if (!patient) return;
    if (patient.uhid) { setUhidPreview(null); return; }
    if (!patient.is_bangalore_resident) { setUhidPreview(null); return; }
    if (!patient.geographic_cluster || !patient.linked_hospital) {
      setUhidPreview(null);
      return;
    }
    let cancelled = false;
    patientsApi.previewUhid(patient.geographic_cluster, patient.linked_hospital)
      .then((res) => { if (!cancelled) setUhidPreview(res); })
      .catch(() => { if (!cancelled) setUhidPreview(null); });
    return () => { cancelled = true; };
  }, [patient?.id, patient?.uhid, patient?.is_bangalore_resident, patient?.geographic_cluster, patient?.linked_hospital]);

  useEffect(() => {
    if (patient?.id) {
      loadInitialVisit();
    }
  }, [patient?.id]);

  // Whenever initialVisit loads/changes, (re)populate the date draft from the
  // existing visit_date. This covers every patient that already has an
  // initial visit with a visit_date set (i.e. all current patients).
  useEffect(() => {
    setVisitDateDraft(toDateInputValue(initialVisit?.visit_date));
    setVisitDateError('');
  }, [initialVisit?.visit_date]);

  const loadInitialVisit = async () => {
    try {
      setLoadingVisit(true);
      const data = await saranamApi.getInitialVisit(patient.id);
      setInitialVisit(data);
      // Load assessment statuses for this visit
      if (data?.id) {
        const statuses = await saranamApi.getAllAssessments(data.id);
        setAssessmentStatuses(statuses);
      }
    } catch (err) {
      setInitialVisit(null);
    } finally {
      setLoadingVisit(false);
    }
  };

  const handleAssessmentSaved = async () => {
    // Refresh assessment statuses after a form is saved
    if (initialVisit?.id) {
      const statuses = await saranamApi.getAllAssessments(initialVisit.id);
      setAssessmentStatuses(statuses);
    }
  };

  const handleSaveVisitDate = async () => {
    if (!initialVisit?.id) return;
    if (!visitDateDraft) {
      setVisitDateError('Please select a date');
      return;
    }
    const chosen = new Date(visitDateDraft);
    if (chosen > new Date()) {
      setVisitDateError('Date cannot be in the future');
      return;
    }
    if (patient?.registration_date && chosen < new Date(patient.registration_date)) {
      setVisitDateError('Date cannot be before the patient\'s registration date');
      return;
    }
    setVisitDateError('');
    setSavingVisitDate(true);
    try {
      const updated = await saranamApi.updateVisit(initialVisit.id, { visit_date: visitDateDraft });
      setInitialVisit(prev => ({ ...prev, visit_date: updated?.visit_date || visitDateDraft }));
      setEditingVisitDate(false);
    } catch (err) {
      setVisitDateError(err?.response?.data?.error || 'Failed to update initial assessment date');
    } finally {
      setSavingVisitDate(false);
    }
  };

  const handleCancelVisitDateEdit = () => {
    setVisitDateDraft(toDateInputValue(initialVisit?.visit_date));
    setVisitDateError('');
    setEditingVisitDate(false);
  };

  const handleConsultationFlagsChange = async (updatedFlags) => {
    if (!initialVisit?.id) return;
    setSavingConsultationType(true);
    setConsultationTypeSaved(false);
    try {
      const updated = await saranamApi.updateVisit(initialVisit.id, {
        doctor_consultation: updatedFlags.doctor_consultation,
        nursing_consultation: updatedFlags.nursing_consultation,
        counsellor_consultation: updatedFlags.counsellor_consultation,
        physiotherapy_consultation: updatedFlags.physiotherapy_consultation,
        social_worker_consultation: updatedFlags.social_worker_consultation,
      });
      setInitialVisit(prev => ({
        ...prev,
        ...updatedFlags,
        consultation_types: updated?.consultation_types || [],
      }));
      setConsultationTypeSaved(true);
      setTimeout(() => setConsultationTypeSaved(false), 2500);
    } catch (err) {
      console.error('Failed to update consultation flags', err);
    } finally {
      setSavingConsultationType(false);
    }
  };

  const getStatus = (type) => assessmentStatuses[type]?.exists ? 'saved' : 'not_started';

  // Free-click body map markers — persisted via doctor_assessments.body_map_annotations JSONB
  const bodyMapMarkers = React.useMemo(() => {
    const raw = assessmentStatuses?.doctor?.data?.body_map_annotations;
    return Array.isArray(raw) ? raw : [];
  }, [assessmentStatuses]);

  const handleBodyMapMarkersChange = async (nextMarkers) => {
    if (!initialVisit?.id) return;
    await saranamApi.saveAssessment(initialVisit.id, 'doctor', { body_map_annotations: nextMarkers });
    await handleAssessmentSaved();
  };

  // AI body-location highlights — patient-scoped, set by AI Patient Summary.
  const [aiHighlights, setAiHighlights] = useState([]);

  useEffect(() => {
    let cancelled = false;
    if (!patient?.id) return undefined;
    saranamApi.getPatientSummary(patient.id)
      .then((res) => { if (!cancelled) setAiHighlights(Array.isArray(res?.body_locations) ? res.body_locations : []); })
      .catch(() => { if (!cancelled) setAiHighlights([]); });
    return () => { cancelled = true; };
  }, [patient?.id]);

  const handleAiHighlightsChange = async (next) => {
    setAiHighlights(next);
    // Persist by upserting via PUT — preserves current summary text.
    try {
      const current = await saranamApi.getPatientSummary(patient.id);
      const payload = {
        summary_text: current?.summary_text || '',
        body_locations: next,
        model: current?.model_used || null,
      };
      await saranamApi.savePatientSummary(patient.id, payload);
    } catch (err) {
      // Non-fatal — UI already updated; surface a console warning for debug.
      console.warn('Failed to persist AI highlight change', err);
    }
  };

  // Per-visit body map history (2026-05-13 client meeting). The body map
  // can render either the patient-level baseline or any individual visit's
  // body_locations. Switching to a visit is read-only — editing happens on
  // the visit detail page where the summary was generated.
  const [followupBodyMaps, setFollowupBodyMaps] = useState([]);
  const [bodyMapSource, setBodyMapSource] = useState('baseline');

  useEffect(() => {
    let cancelled = false;
    if (!patient?.id) return undefined;
    saranamApi.listFollowupSummaries(patient.id)
      .then((res) => {
        if (cancelled) return;
        setFollowupBodyMaps(Array.isArray(res?.items) ? res.items : []);
      })
      .catch(() => { if (!cancelled) setFollowupBodyMaps([]); });
    return () => { cancelled = true; };
  }, [patient?.id]);

  const displayedAiHighlights = useMemo(() => {
    if (bodyMapSource === 'baseline') return aiHighlights;
    const v = followupBodyMaps.find(f => f.visit_id === bodyMapSource);
    return Array.isArray(v?.body_locations) ? v.body_locations : [];
  }, [bodyMapSource, aiHighlights, followupBodyMaps]);

  const isViewingHistorical = bodyMapSource !== 'baseline';
  const activeFollowup = isViewingHistorical
    ? followupBodyMaps.find(f => f.visit_id === bodyMapSource)
    : null;

  const [completing, setCompleting] = useState(false);

  const handleMarkComplete = async () => {
    if (!initialVisit) return;
    setCompleting(true);
    try {
      const updated = await saranamApi.updateVisit(initialVisit.id, { status: 'completed' });
      setInitialVisit(prev => ({ ...prev, status: 'completed' }));
      // Reload patient so a freshly-assigned UHID shows on the chips above.
      if (onPatientRefresh) await onPatientRefresh();
      if (updated?.assigned_uhid) {
        alert(`Initial assessment completed. UHID ${updated.assigned_uhid} assigned.`);
      }
    } catch (err) {
      alert('Failed to mark as complete');
    } finally {
      setCompleting(false);
    }
  };

  if (!patient) return null;

  const age = patient.age || (patient.date_of_birth
    ? Math.floor((new Date() - new Date(patient.date_of_birth)) / 31557600000)
    : null);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Demographics */}
      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 700, color: 'primary.main' }}>
          Demographics
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={4}>
            <InfoItem icon={<Person fontSize="small" />} label="Full Name" value={patient.full_name} />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <InfoItem label="Gender" value={patient.gender} />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <InfoItem label="Age" value={age ? `${age} years` : null} />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <InfoItem icon={<CalendarToday fontSize="small" />} label="Date of Birth" value={
              patient.date_of_birth
                ? `${new Date(patient.date_of_birth).toLocaleDateString()}${patient.is_approximate_dob ? ' (approx)' : ''}`
                : null
            } />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <InfoItem icon={<Phone fontSize="small" />} label="Contact" value={patient.contact} />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <InfoItem icon={<LocationOn fontSize="small" />} label="Address" value={patient.address} />
          </Grid>
          {patient.diagnosis && (
            <Grid item xs={12} sm={6} md={4}>
              <InfoItem icon={<MedicalServices fontSize="small" />} label="Diagnosis" value={patient.diagnosis} />
            </Grid>
          )}
          {patient.referred_from && (
            <Grid item xs={12} sm={6} md={4}>
              <InfoItem label="Referred From" value={patient.referred_from} />
            </Grid>
          )}
          {patient.educational_status && (
            <Grid item xs={12} sm={6} md={4}>
              <InfoItem label="Educational Status" value={patient.educational_status} />
            </Grid>
          )}
          {patient.occupation && (
            <Grid item xs={12} sm={6} md={4}>
              <InfoItem label="Occupation" value={patient.occupation} />
            </Grid>
          )}
          {patient.religion && (
            <Grid item xs={12} sm={6} md={4}>
              <InfoItem label="Religion" value={patient.religion} />
            </Grid>
          )}
          {patient.marital_status && (
            <Grid item xs={12} sm={6} md={4}>
              <InfoItem label="Marital Status" value={patient.marital_status} />
            </Grid>
          )}
          {patient.preferred_language && (
            <Grid item xs={12} sm={6} md={4}>
              <InfoItem label="Language" value={patient.preferred_language} />
            </Grid>
          )}
          {patient.no_of_children !== null && patient.no_of_children !== undefined && patient.no_of_children !== '' && (
            <Grid item xs={12} sm={6} md={4}>
              <InfoItem label="No of children" value={String(patient.no_of_children)} />
            </Grid>
          )}
          {patient.barriers_to_communication && (
            <Grid item xs={12} sm={6} md={4}>
              <InfoItem label="Barriers to communication" value={patient.barriers_to_communication} />
            </Grid>
          )}
          {patient.source_of_information && (
            <Grid item xs={12} sm={6} md={4}>
              <InfoItem label="Source of Information" value={patient.source_of_information} />
            </Grid>
          )}
          <Grid item xs={12} sm={6} md={4}>
            <InfoItem
              label="Registration Date"
              icon={<CalendarToday fontSize="small" />}
              value={patient.registration_date
                ? new Date(patient.registration_date).toLocaleDateString()
                : null}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Clinical Status */}
      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 700, color: 'primary.main' }}>
          Clinical Status
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {patient.bsc_status == null && patient.is_onco == null ? (
            <Chip label="Category: Not Yet Determined" variant="outlined" size="small" sx={{ fontWeight: 600, borderStyle: 'dashed' }} />
          ) : (
            <>
              <Chip
                label={patient.bsc_status ? 'BSC' : 'N-BSC'}
                color={patient.bsc_status ? 'success' : 'default'}
                size="small"
                sx={{ fontWeight: 600 }}
              />
              {patient.is_onco !== null && patient.is_onco !== undefined && (
                <Chip
                  label={patient.is_onco ? 'Onco' : 'Non-Onco'}
                  color={patient.is_onco ? 'warning' : 'default'}
                  size="small"
                  sx={{ fontWeight: 600 }}
                />
              )}
            </>
          )}
          {patient.clinical_complexity ? (
            <Chip
              label={`Priority: ${patient.clinical_complexity === 'not_yet_determined' ? 'Not Yet Determined' : patient.clinical_complexity.charAt(0).toUpperCase() + patient.clinical_complexity.slice(1)}`}
              variant="outlined"
              size="small"
              color={patient.clinical_complexity === 'high' ? 'error' : patient.clinical_complexity === 'medium' ? 'warning' : 'default'}
            />
          ) : (
            <Chip label="Priority: Not Assessed" variant="outlined" size="small" sx={{ borderStyle: 'dashed' }} />
          )}
          {patient.geographic_cluster && (
            <Chip label={`Zone: ${patient.geographic_cluster}`} variant="outlined" size="small" color="info" />
          )}
          {patient.homecare_code && (
            <Chip
              label={patient.homecare_code}
              variant="outlined"
              size="small"
              sx={{ fontFamily: 'monospace', fontWeight: 700 }}
            />
          )}
          {patient.uhid && (
            <Chip
              label={`UHID: ${patient.uhid}`}
              variant="outlined"
              size="small"
              color="primary"
              sx={{ fontFamily: 'monospace', fontWeight: 600 }}
            />
          )}
          {patient.hospital_uhid && (
            <Chip
              label={`Hospital UHID: ${patient.hospital_uhid}`}
              variant="outlined"
              size="small"
              color="secondary"
              sx={{ fontFamily: 'monospace', fontWeight: 600 }}
            />
          )}
          {patient.has_abha && (
            <Chip label="ABHA Registered" variant="outlined" size="small" color="primary" />
          )}
        </Box>
      </Paper>

      {/* Care Circle — primary caregiver + decision maker (meeting §1.1, 2026-04-14) */}
      <CareCircleCard patient={patient} onSaved={onPatientRefresh} />

      {/* Initial (Baseline) Assessment Forms */}
      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main' }}>
              Initial Assessment (Baseline)
            </Typography>
            <Typography variant="caption" color="text.secondary">
              One-time clinical baseline data filled during patient registration
            </Typography>

            {/* ── Editable Initial Assessment Date ──
                Pre-populated from initialVisit.visit_date whenever it
                exists (true for all current patients). Previously this
                date could only be corrected via a direct DB edit. */}
            {!loadingVisit && initialVisit && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.75, flexWrap: 'wrap' }}>
                {editingVisitDate ? (
                  <>
                    <TextField
                      size="small"
                      type="date"
                      label="Assessment Date"
                      value={visitDateDraft}
                      onChange={(e) => { setVisitDateDraft(e.target.value); setVisitDateError(''); }}
                      error={!!visitDateError}
                      helperText={visitDateError || ' '}
                      InputLabelProps={{ shrink: true }}
                      sx={{ width: 190 }}
                    />
                    <Button
                      size="small"
                      variant="contained"
                      onClick={handleSaveVisitDate}
                      disabled={savingVisitDate}
                      sx={{ textTransform: 'none', height: 40 }}
                    >
                      {savingVisitDate ? <CircularProgress size={16} color="inherit" /> : 'Save'}
                    </Button>
                    <Button
                      size="small"
                      onClick={handleCancelVisitDateEdit}
                      disabled={savingVisitDate}
                      sx={{ textTransform: 'none', height: 40 }}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Typography variant="caption" color="text.secondary">
                      Assessment Date:{' '}
                      <Typography component="span" variant="caption" sx={{ fontWeight: 700, color: 'text.primary' }}>
                        {initialVisit.visit_date
                          ? new Date(initialVisit.visit_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                          : 'Not set'}
                      </Typography>
                    </Typography>
                    {canEditVisitDate && (
                      <Button
                        size="small"
                        onClick={() => setEditingVisitDate(true)}
                        sx={{ textTransform: 'none', minWidth: 'auto', p: '2px 6px', fontSize: '0.7rem' }}
                      >
                        Edit
                      </Button>
                    )}
                  </>
                )}
              </Box>
            )}
          </Box>
          {initialVisit && (
            <Chip
              label={initialVisit.status === 'completed' ? 'Completed' : 'In Progress'}
              size="small"
              color={initialVisit.status === 'completed' ? 'success' : 'warning'}
              sx={{ height: 22, fontSize: '0.65rem' }}
            />
          )}
        </Box>

        {loadingVisit ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={24} />
          </Box>
        ) : !initialVisit ? (
          <Alert severity="info" sx={{ borderRadius: 1 }}>
            No initial visit record found. One will be created automatically when assessment forms are available.
          </Alert>
        ) : (
          <Box>
            {/* Type of Consultation dropdown - above demographic assessment */}
            <Box sx={{ mb: 2, p: 2, bgcolor: 'background.paper', borderRadius: 2, border: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Box sx={{ width: '100%' }}>
                  <ConsultationTypeMultiSelect
                    values={{
                      doctor_consultation: Boolean(initialVisit.doctor_consultation),
                      nursing_consultation: Boolean(initialVisit.nursing_consultation),
                      counsellor_consultation: Boolean(initialVisit.counsellor_consultation),
                      physiotherapy_consultation: Boolean(initialVisit.physiotherapy_consultation),
                      social_worker_consultation: Boolean(initialVisit.social_worker_consultation),
                    }}
                    onChange={handleConsultationFlagsChange}
                    disabled={savingConsultationType}
                  />
                </Box>
                {savingConsultationType && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                    <CircularProgress size={14} />
                    <Typography variant="caption" color="text.secondary">Saving...</Typography>
                  </Box>
                )}
                {consultationTypeSaved && (
                  <Box sx={{ mt: 1 }}>
                    <Chip label="Saved" size="small" color="success" variant="outlined" sx={{ height: 22, fontSize: '0.65rem' }} />
                  </Box>
                )}
              </Box>
            </Box>

            <AssessmentAccordion title="Demographic History" status={
              (patient.educational_status || patient.occupation || patient.religion ||
                patient.marital_status || patient.preferred_language || patient.barriers_to_communication ||
                (patient.no_of_children !== null && patient.no_of_children !== undefined && patient.no_of_children !== '') ||
                patient.source_of_information) ? 'saved' : 'not_started'
            }>

              <DemographicForm patient={patient} onSaved={onPatientRefresh} />
            </AssessmentAccordion>

            <AssessmentAccordion title="Social History" status={getStatus('social-history')}>
              <SocialHistoryForm visitId={initialVisit.id} patientId={patient.id} onSaved={handleAssessmentSaved} />
            </AssessmentAccordion>

            {['admin', 'doctor', 'nurse'].includes(user?.role) && (
              <AssessmentAccordion title="Nursing Assessment" status={getStatus('nursing')}>
                <NursingAssessmentForm visitId={initialVisit.id} patientId={patient.id} onSaved={handleAssessmentSaved} />
              </AssessmentAccordion>
            )}

            {(hasPermission('view_psych_assessment') || hasPermission('view_all_assessments')) && (
              <AssessmentAccordion
                title="Psychological Assessment"
                status={getStatus('psychological')}
              >
                <PsychologicalAssessmentForm
                  visitId={initialVisit.id}
                  patientId={patient.id}
                  onSaved={handleAssessmentSaved}
                />
              </AssessmentAccordion>
            )}

            {(hasPermission('view_physio_assessment') || hasPermission('view_all_assessments')) && (
              <AssessmentAccordion
                title="Physiotherapy Assessment"
                status={getStatus('physiotherapy')}
              >
                <PhysiotherapyAssessmentForm
                  visitId={initialVisit.id}
                  patientId={patient.id}
                  onSaved={handleAssessmentSaved}
                />
              </AssessmentAccordion>
            )}
            {['admin', 'doctor'].includes(user?.role) && (
              <AssessmentAccordion title="Doctor Assessment" status={getStatus('doctor')}>
                <DoctorAssessmentForm visitId={initialVisit.id} patientId={patient.id} onSaved={handleAssessmentSaved} />
                <div className='mt-3'>
                  {!loadingVisit && initialVisit && (
                    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, gap: 2, flexWrap: 'wrap' }}>
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                            Body Map
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {isViewingHistorical
                              ? `Viewing AI highlights from Visit #${activeFollowup?.visit_number ?? '?'} (read-only). Free-click annotations from baseline.`
                              : 'Drop red markers anywhere on the body. Blue highlights are AI-suggested — generated when you click "Generate Patient Summary."'}
                          </Typography>
                        </Box>
                        <TextField
                          select
                          size="small"
                          label="View"
                          value={bodyMapSource}
                          onChange={(e) => setBodyMapSource(e.target.value)}
                          sx={{ minWidth: 240 }}
                        >
                          <MenuItem value="baseline">Baseline (editable)</MenuItem>
                          {followupBodyMaps.map((f) => {
                            const d = f.visit_date
                              ? new Date(f.visit_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                              : '';
                            return (
                              <MenuItem key={f.visit_id} value={f.visit_id}>
                                Visit #{f.visit_number} • {d}
                              </MenuItem>
                            );
                          })}
                        </TextField>
                      </Box>
                      <BodyMapView
                        readOnly={isViewingHistorical}
                        freeClickMarkers={bodyMapMarkers}
                        onMarkersChange={isViewingHistorical ? undefined : handleBodyMapMarkersChange}
                        aiHighlights={displayedAiHighlights}
                        onAiHighlightsChange={isViewingHistorical ? undefined : handleAiHighlightsChange}
                      />
                    </Paper>)}
                </div>
              </AssessmentAccordion>
            )}
            {['admin', 'doctor', 'nurse',].includes(user?.role) && (
              <AssessmentAccordion title="PPS Score" status={getStatus('pps')}>
                <PpsForm
                  visitId={initialVisit.id}
                  patientId={patient.id}
                  onSaved={handleAssessmentSaved}
                  patientComplexity={patient.clinical_complexity}
                />
              </AssessmentAccordion>)}


            {['admin', 'doctor'].includes(user?.role) && (
              <AssessmentAccordion title="Plan of Care" status={getStatus('care-plan')}>
                <PlanOfCareForm visitId={initialVisit.id} patientId={patient.id} onSaved={handleAssessmentSaved} patientName={patient.full_name} patientUhid={patient.uhid} patientHomecareCode={patient.homecare_code} />
              </AssessmentAccordion>)}

            {/* Patient Category — set/confirm during initial assessment */}
            <PatientCategoryForm patient={patient} />

            {/* Mark Complete Button */}
            {initialVisit.status !== 'completed' ? (
              <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                {/* ── Live UHID Preview Card (shown only when UHID will be assigned) ── */}
                {!patient.uhid && uhidPreview && (
                  <Box
                    sx={{
                      mb: 2,
                      p: 1.5,
                      bgcolor: 'primary.50',
                      border: '1px solid',
                      borderColor: 'primary.200',
                      borderRadius: 1,
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{ fontWeight: 700, color: 'primary.main', textTransform: 'uppercase', letterSpacing: 0.5 }}
                    >
                      UHID Preview
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2, mt: 0.5, alignItems: 'flex-end' }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          Homecare UHID Code
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ fontFamily: 'monospace', fontWeight: 700, color: 'primary.dark' }}
                        >
                          {uhidPreview.homecare_code || '—'}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          UHID (probable)
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ fontFamily: 'monospace', fontWeight: 700, color: 'primary.dark' }}
                        >
                          {uhidPreview.next_uhid}
                        </Typography>
                      </Box>
                    </Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', mt: 0.75, fontStyle: 'italic' }}
                    >
                      Probable UHID. The actual number is assigned the moment you click the button below.
                    </Typography>
                  </Box>
                )}
                {!patient.uhid && !uhidPreview && patient.is_bangalore_resident && (!patient.geographic_cluster || !patient.linked_hospital) && (
                  <Alert severity="warning" sx={{ mb: 2, borderRadius: 1 }}>
                    <Typography variant="body2">
                      Set the patient's zone and linked hospital before completing
                      the initial assessment to auto-generate a UHID.
                    </Typography>
                  </Alert>
                )}
                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={completing ? <CircularProgress size={18} color="inherit" /> : <CheckCircle />}
                    onClick={handleMarkComplete}
                    disabled={completing}
                    sx={{ textTransform: 'none', fontWeight: 600, px: 4 }}
                  >
                    {completing
                      ? 'Marking...'
                      : (!patient.uhid && uhidPreview)
                        ? 'Mark Complete and Assign UHID'
                        : 'Mark Initial Assessment as Complete'}
                  </Button>
                </Box>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider', gap: 1 }}>
                <CheckCircle sx={{ color: 'success.main', fontSize: 20 }} />
                <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 600 }}>
                  Initial Assessment Completed
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </Paper>

      {/* System Info */}
      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 700, color: 'primary.main' }}>
          System Information
        </Typography>
        <Grid container spacing={3}>
          {patient.abha_address && (
            <Grid item xs={12} sm={6} md={4}>
              <InfoItem icon={<MedicalServices fontSize="small" />} label="ABHA Address" value={patient.abha_address} />
            </Grid>
          )}
          <Grid item xs={12} sm={6} md={4}>
            <InfoItem
              label="Registration Date"
              value={patient.registration_date
                ? new Date(patient.registration_date).toLocaleDateString()
                : null}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <InfoItem
              label="Patient Created On"
              value={patient.created_at ? new Date(patient.created_at).toLocaleDateString() : null}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <InfoItem label="Submissions" value={`${patient.submission_count || 0} form submissions`} />
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};

export default OverviewTab;