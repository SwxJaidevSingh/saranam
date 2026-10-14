/**
 * BereavementForm — Saranam Bereavement Support Home Visit Record
 *
 * Optimized to match the exact visual style, layout, typography, and structure
 * of the VisitDetailView Follow-Up Sheet.
 */
import React, { useState, useEffect, useMemo } from "react";
import {
  ArrowLeft,
  Save,
  Loader2,
  CheckCircle,
  Users,
  Calendar,
  FileText,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import saranamApi from "../../../api/saranam";
import patientsApi from "../../../api/patients";
import GenogramBuilder from "./GenogramBuilder";
import OptimizedImageUpload from "../../../components/common/OptimizedImageUpload";
import ConsultationTypeMultiSelect from "../../../components/common/ConsultationTypeMultiSelect";

function SubSection({ title, children }) {
  return (
    <div className="space-y-2">
      {title && (
        <h4 className="text-sm font-semibold text-foreground border-b border-border pb-1">
          {title}
        </h4>
      )}
      {children}
    </div>
  );
}

function TextArea({ label, placeholder, value, onChange, rows = 3 }) {
  return (
    <div>
      {label && (
        <label className="block text-xs font-medium text-muted-foreground mb-1">
          {label}
        </label>
      )}
      <textarea
        rows={rows}
        placeholder={placeholder || label}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
      />
    </div>
  );
}

function InputField({ label, placeholder, value, onChange, type = "text", disabled = false }) {
  return (
    <div>
      {label && (
        <label className="block text-xs font-medium text-muted-foreground mb-1">
          {label}
        </label>
      )}
      <input
        type={type}
        placeholder={placeholder || label}
        value={value || ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm disabled:opacity-60 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
      />
    </div>
  );
}

// Preset options for multi-select checklists (flexible, NOT DB enums)
const EMOTIONAL_OPTIONS = [
  "Sadness",
  "Anxiety",
  "Crying spells",
  "Anger",
  "Emotional numbness",
  "Guilt",
  "Relief",
];

const RED_FLAG_OPTIONS = [
  "Persistent hopelessness",
  "Suicidal ideation/self-harm risk",
  "Social withdrawal",
  "Family conflict",
  "Psychiatric symptoms",
  "Functional impairment",
  "Child distress",
  "Severe guilt/self-blame",
  "Severe caregiver distress",
  "Substance misuse",
];

const FOLLOW_UP_OPTIONS = [
  "1-month follow-up",
  "3-month follow-up",
  "6-month follow-up",
  "Earlier review required",
];

export default function BereavementForm({
  visitId,
  patientId,
  visit,
  patientName: propPatientName,
  patientUhid: propPatientUhid,
  patientHomecareCode: propPatientHomecareCode,
  onBack,
  onSaved,
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [patientDetail, setPatientDetail] = useState(null);

  // Baseline reference accordion (identical to VisitDetailView)
  const [baseline, setBaseline] = useState(null);
  const [showBaseline, setShowBaseline] = useState(false);

  // Genogram state (synced with patients.genogram)
  const [genogram, setGenogram] = useState(null);

  // Multi-select consultation flags
  const [consultationFlags, setConsultationFlags] = useState({
    doctor_consultation: false,
    nursing_consultation: false,
    counsellor_consultation: false,
    physiotherapy_consultation: false,
    social_worker_consultation: false,
  });

  // Form Fields
  const [formData, setFormData] = useState({
    // 1. General Observations
    obs_home_environment: "",
    obs_family_interaction: "",
    obs_emotional_atmosphere: "",
    obs_rituals_completed: "",
    obs_immediate_concerns: "",

    // 2. Primary Caregiver / Decision Maker Observations
    caregiver_obs_1_name: "",
    caregiver_obs_1_relationship: "",
    caregiver_obs_1_coping: "",
    caregiver_obs_2_name: "",
    caregiver_obs_2_relationship: "",
    caregiver_obs_2_coping: "",

    // 3. Psychological Assessment: Emotional Responses
    emotional_responses: [],
    emotional_responses_other: "",

    // 4. Psychological Assessment: General Functioning
    functioning_sleep: "",
    functioning_appetite: "",
    functioning_daily_routine: "",
    functioning_role_changes: "",

    // 5. Support, Cultural & Strengths
    family_social_support: "",
    spiritual_cultural_obs: "",
    coping_strengths: "",

    // 6. Red Flag Screening
    red_flags: [],
    red_flags_other: "",

    // 7. Clinical Impression
    bereavement_risk: "low",

    // 8. Interventions During Visit
    interventions_notes: "",

    // 9. Follow-up Plan & Remarks
    follow_up_intervals: [],
    follow_up_remarks: "",
  });

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleArrayItem = (field, item) => {
    setFormData((prev) => {
      const current = Array.isArray(prev[field]) ? prev[field] : [];
      if (current.includes(item)) {
        return { ...prev, [field]: current.filter((x) => x !== item) };
      } else {
        return { ...prev, [field]: [...current, item] };
      }
    });
  };

  // Load Patient, Baseline, and existing Bereavement Assessment
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        setLoading(true);

        // 1. Patient Record
        const pt = await patientsApi.getById(patientId);
        if (isMounted && pt) {
          setPatientDetail(pt);
          if (pt.genogram) {
            setGenogram(pt.genogram);
          }
        }

        // 2. Baseline Record (for reference accordion)
        try {
          const initialVisit = await saranamApi.getInitialVisit(patientId);
          if (initialVisit) {
            const allBaseline = await saranamApi.getAllAssessments(initialVisit.id);
            if (isMounted) {
              setBaseline({
                visit: initialVisit,
                nursing: allBaseline?.nursing?.data || null,
                doctor: allBaseline?.doctor?.data || null,
                psychological: allBaseline?.psychological?.data || null,
                esas: allBaseline?.esas?.data || null,
                pps: allBaseline?.pps?.data || null,
                carePlan: allBaseline?.["care-plan"]?.data || null,
              });
            }
          }
        } catch {}

        // 3. Saved Bereavement Assessment
        const savedAssessment = await saranamApi.getAssessment(visitId, "bereavement");
        if (isMounted) {
          setConsultationFlags({
            doctor_consultation: Boolean(visit?.doctor_consultation),
            nursing_consultation: Boolean(visit?.nursing_consultation),
            counsellor_consultation: Boolean(visit?.counsellor_consultation),
            physiotherapy_consultation: Boolean(visit?.physiotherapy_consultation),
            social_worker_consultation: Boolean(visit?.social_worker_consultation),
          });

          if (savedAssessment) {
            setFormData({
              obs_home_environment: savedAssessment.obs_home_environment || "",
              obs_family_interaction: savedAssessment.obs_family_interaction || "",
              obs_emotional_atmosphere: savedAssessment.obs_emotional_atmosphere || "",
              obs_rituals_completed: savedAssessment.obs_rituals_completed || "",
              obs_immediate_concerns: savedAssessment.obs_immediate_concerns || "",

              caregiver_obs_1_name:
                savedAssessment.caregiver_obs_1_name || pt?.primary_caregiver_name || "",
              caregiver_obs_1_relationship:
                savedAssessment.caregiver_obs_1_relationship || pt?.primary_caregiver_relationship || "",
              caregiver_obs_1_coping: savedAssessment.caregiver_obs_1_coping || "",

              caregiver_obs_2_name:
                savedAssessment.caregiver_obs_2_name || pt?.decision_maker_name || "",
              caregiver_obs_2_relationship:
                savedAssessment.caregiver_obs_2_relationship || pt?.decision_maker_designation || "",
              caregiver_obs_2_coping: savedAssessment.caregiver_obs_2_coping || "",

              emotional_responses: Array.isArray(savedAssessment.emotional_responses)
                ? savedAssessment.emotional_responses
                : [],
              emotional_responses_other: savedAssessment.emotional_responses_other || "",

              functioning_sleep: savedAssessment.functioning_sleep || "",
              functioning_appetite: savedAssessment.functioning_appetite || "",
              functioning_daily_routine: savedAssessment.functioning_daily_routine || "",
              functioning_role_changes: savedAssessment.functioning_role_changes || "",

              family_social_support: savedAssessment.family_social_support || "",
              spiritual_cultural_obs: savedAssessment.spiritual_cultural_obs || "",
              coping_strengths: savedAssessment.coping_strengths || "",

              red_flags: Array.isArray(savedAssessment.red_flags) ? savedAssessment.red_flags : [],
              red_flags_other: savedAssessment.red_flags_other || "",

              bereavement_risk: savedAssessment.bereavement_risk || "low",
              interventions_notes: savedAssessment.interventions_notes || "",

              follow_up_intervals: Array.isArray(savedAssessment.follow_up_intervals)
                ? savedAssessment.follow_up_intervals
                : [],
              follow_up_remarks: savedAssessment.follow_up_remarks || "",
            });
          } else {
            // Default pre-fills from patient record
            setFormData((prev) => ({
              ...prev,
              caregiver_obs_1_name: pt?.primary_caregiver_name || "",
              caregiver_obs_1_relationship: pt?.primary_caregiver_relationship || "",
              caregiver_obs_2_name: pt?.decision_maker_name || "",
              caregiver_obs_2_relationship: pt?.decision_maker_designation || "",
            }));
          }
        }
      } catch (err) {
        console.error("Failed to load bereavement data", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (visitId && patientId) {
      loadData();
    }

    return () => {
      isMounted = false;
    };
  }, [visitId, patientId]);

  // Days elapsed since death
  const daysElapsedSinceDeath = useMemo(() => {
    const dod = patientDetail?.date_of_death;
    const vDate = visit?.visit_date;
    if (!dod) return null;
    const d1 = new Date(dod);
    const d2 = vDate ? new Date(vDate) : new Date();
    const diffTime = Math.abs(d2 - d1);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, [patientDetail?.date_of_death, visit?.visit_date]);

  const handleSave = async () => {
    try {
      setSaving(true);

      // Save Bereavement Assessment
      await saranamApi.saveAssessment(visitId, "bereavement", {
        obs_home_environment: formData.obs_home_environment,
        obs_family_interaction: formData.obs_family_interaction,
        obs_emotional_atmosphere: formData.obs_emotional_atmosphere,
        obs_rituals_completed: formData.obs_rituals_completed,
        obs_immediate_concerns: formData.obs_immediate_concerns,

        caregiver_obs_1_name: formData.caregiver_obs_1_name,
        caregiver_obs_1_relationship: formData.caregiver_obs_1_relationship,
        caregiver_obs_1_coping: formData.caregiver_obs_1_coping,

        caregiver_obs_2_name: formData.caregiver_obs_2_name,
        caregiver_obs_2_relationship: formData.caregiver_obs_2_relationship,
        caregiver_obs_2_coping: formData.caregiver_obs_2_coping,

        emotional_responses: formData.emotional_responses,
        emotional_responses_other: formData.emotional_responses_other,

        functioning_sleep: formData.functioning_sleep,
        functioning_appetite: formData.functioning_appetite,
        functioning_daily_routine: formData.functioning_daily_routine,
        functioning_role_changes: formData.functioning_role_changes,

        family_social_support: formData.family_social_support,
        spiritual_cultural_obs: formData.spiritual_cultural_obs,
        coping_strengths: formData.coping_strengths,

        red_flags: formData.red_flags,
        red_flags_other: formData.red_flags_other,

        bereavement_risk: formData.bereavement_risk,
        interventions_notes: formData.interventions_notes,

        follow_up_intervals: formData.follow_up_intervals,
        follow_up_remarks: formData.follow_up_remarks,
      });

      // Update Genogram in patient record if edited
      if (genogram) {
        await patientsApi.update(patientId, { genogram });
      }

      // Update visit consultation flags in patient_visits
      try {
        await saranamApi.updateVisit(visitId, {
          doctor_consultation: consultationFlags.doctor_consultation,
          nursing_consultation: consultationFlags.nursing_consultation,
          counsellor_consultation: consultationFlags.counsellor_consultation,
          physiotherapy_consultation: consultationFlags.physiotherapy_consultation,
          social_worker_consultation: consultationFlags.social_worker_consultation,
        });
      } catch (e) {
        console.error("Failed to update visit consultation flags", e);
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);

      if (onSaved) {
        onSaved();
      }
    } catch (err) {
      console.error("Failed to save bereavement record", err);
      alert(err?.response?.data?.error || "Failed to save bereavement record");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const patientName = propPatientName || patientDetail?.full_name || "Patient";
  const dateOfDeathStr = patientDetail?.date_of_death
    ? new Date(patientDetail.date_of_death).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "N/A";

  return (
    <div className="space-y-6">
      {/* ── Header (Identical structure to VisitDetailView) ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> All Visits
        </button>
        <div className="h-4 w-px bg-border" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-foreground">
              Bereavement #{visit?.visit_number}
            </h3>
            <span className="px-2 py-0.5 text-xs font-medium rounded-full border border-primary-500/30 bg-primary-500/10 text-primary-400">
              Bereavement Support
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {visit?.visit_date
              ? new Date(visit.visit_date).toLocaleDateString("en-IN", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : ""}
            {visit?.visit_location && ` — ${visit.visit_location}`}
          </p>
          {patientDetail && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span
                className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${
                  patientDetail.bsc_status === true
                    ? "text-green-700 bg-green-50 border-green-200"
                    : patientDetail.bsc_status === false
                    ? "text-gray-600 bg-gray-50 border-gray-200"
                    : "text-gray-400 bg-gray-50 border-dashed border-gray-200"
                }`}
              >
                {patientDetail.bsc_status === true
                  ? "BSC"
                  : patientDetail.bsc_status === false
                  ? "N-BSC"
                  : "Category: Not Determined"}
              </span>
              {patientDetail.is_onco !== null && patientDetail.is_onco !== undefined && (
                <span
                  className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${
                    patientDetail.is_onco === true
                      ? "text-amber-700 bg-amber-50 border-amber-200"
                      : "text-gray-600 bg-gray-50 border-gray-200"
                  }`}
                >
                  {patientDetail.is_onco === true ? "Onco" : "Non-Onco"}
                </span>
              )}
              {patientDetail.is_deceased && (
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full border text-red-700 bg-red-50 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900">
                  Deceased ({dateOfDeathStr})
                  {daysElapsedSinceDeath !== null && ` • ${daysElapsedSinceDeath}d elapsed`}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Top Save button */}
        <div className="flex items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
              <CheckCircle className="h-4 w-4" /> Saved!
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save
          </button>
        </div>
      </div>

      {/* ── Baseline Reference (Exact match to VisitDetailView) ── */}
      {baseline && (
        <div className="border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setShowBaseline(!showBaseline)}
            className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary-400" />
              <span className="text-sm font-semibold text-foreground">
                Initial Assessment (Baseline Reference)
              </span>
              <span className="text-[10px] text-muted-foreground px-2 py-0.5 rounded-full border border-border bg-background">
                Read-only
              </span>
            </div>
            {showBaseline ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          {showBaseline && (
            <div className="p-4 space-y-3 border-t border-border bg-muted/10 text-xs">
              {baseline.doctor && (
                <div>
                  <span className="font-bold text-muted-foreground">Diagnosis:</span>{" "}
                  <span>{baseline.doctor.diagnosis}</span>
                </div>
              )}
              {baseline.nursing && baseline.nursing.pain_score != null && (
                <div>
                  <span className="font-bold text-muted-foreground">Pain:</span>{" "}
                  <span>{baseline.nursing.pain_score}/10</span>
                </div>
              )}
              {baseline.esas && (
                <div>
                  <span className="font-bold text-muted-foreground">ESAS Total:</span>{" "}
                  <span>{baseline.esas.total_score}/100</span>
                </div>
              )}
              {baseline.pps && (
                <div>
                  <span className="font-bold text-muted-foreground">PPS:</span>{" "}
                  <span>{baseline.pps.pps_score}%</span>
                </div>
              )}
              {patientDetail?.place_of_death && (
                <div>
                  <span className="font-bold text-muted-foreground">Place of Death:</span>{" "}
                  <span className="capitalize">{patientDetail.place_of_death}</span>
                  {patientDetail?.place_of_death_remarks && ` (${patientDetail.place_of_death_remarks})`}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Main Sheet (Follow-Up Sheet container style) ── */}
      <div className="border border-border rounded-lg p-4 space-y-6">
        <h4 className="text-base font-bold text-foreground text-center border-b border-border pb-2">
          Bereavement Support Home Visit Record
        </h4>

        {/* Consultation Disciplines */}
        <SubSection title="Consultation Details">
          <div className="grid grid-cols-1 gap-3">
            <ConsultationTypeMultiSelect
              values={consultationFlags}
              onChange={(updated) => setConsultationFlags(updated)}
            />
          </div>
        </SubSection>

        {/* ── General Observations ── */}
        <SubSection title="General Observations">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextArea
              label="Home environment"
              placeholder="Describe home atmosphere, cleanliness, order..."
              value={formData.obs_home_environment}
              onChange={(v) => updateField("obs_home_environment", v)}
              rows={2}
            />
            <TextArea
              label="Family interaction"
              placeholder="How family members are communicating and supporting each other..."
              value={formData.obs_family_interaction}
              onChange={(v) => updateField("obs_family_interaction", v)}
              rows={2}
            />
            <TextArea
              label="Emotional atmosphere"
              placeholder="Overall household mood..."
              value={formData.obs_emotional_atmosphere}
              onChange={(v) => updateField("obs_emotional_atmosphere", v)}
              rows={2}
            />
            <TextArea
              label="Rituals completed"
              placeholder="Funeral, religious ceremonies, prayer meetings status..."
              value={formData.obs_rituals_completed}
              onChange={(v) => updateField("obs_rituals_completed", v)}
              rows={2}
            />
          </div>
          <TextArea
            label="Immediate concerns"
            placeholder="Urgent matters, conflicts, or immediate distress..."
            value={formData.obs_immediate_concerns}
            onChange={(v) => updateField("obs_immediate_concerns", v)}
            rows={2}
          />
        </SubSection>

        {/* ── Primary Caregiver / Decision Maker Observations ── */}
        <SubSection title="Primary Caregiver / Decision Maker Observations">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Person 1 */}
            <div className="border border-border rounded-lg p-3 bg-muted/5 space-y-3">
              <span className="text-xs font-bold text-foreground uppercase tracking-wide block border-b border-border pb-1">
                1. Primary Caregiver
              </span>
              <div className="grid grid-cols-2 gap-3">
                <InputField
                  label="Name"
                  placeholder="Caregiver Name"
                  value={formData.caregiver_obs_1_name}
                  onChange={(v) => updateField("caregiver_obs_1_name", v)}
                />
                <InputField
                  label="Relationship"
                  placeholder="e.g. Spouse, Son"
                  value={formData.caregiver_obs_1_relationship}
                  onChange={(v) => updateField("caregiver_obs_1_relationship", v)}
                />
              </div>
              <TextArea
                label="Grief response / concerns / coping"
                placeholder="Observed emotional reactions, personal concerns, coping..."
                value={formData.caregiver_obs_1_coping}
                onChange={(v) => updateField("caregiver_obs_1_coping", v)}
                rows={3}
              />
            </div>

            {/* Person 2 */}
            <div className="border border-border rounded-lg p-3 bg-muted/5 space-y-3">
              <span className="text-xs font-bold text-foreground uppercase tracking-wide block border-b border-border pb-1">
                2. Decision Maker / Second Caregiver
              </span>
              <div className="grid grid-cols-2 gap-3">
                <InputField
                  label="Name"
                  placeholder="Decision Maker Name"
                  value={formData.caregiver_obs_2_name}
                  onChange={(v) => updateField("caregiver_obs_2_name", v)}
                />
                <InputField
                  label="Relationship"
                  placeholder="e.g. Daughter, Brother"
                  value={formData.caregiver_obs_2_relationship}
                  onChange={(v) => updateField("caregiver_obs_2_relationship", v)}
                />
              </div>
              <TextArea
                label="Grief response / concerns / coping"
                placeholder="Observed emotional reactions, personal concerns, coping..."
                value={formData.caregiver_obs_2_coping}
                onChange={(v) => updateField("caregiver_obs_2_coping", v)}
                rows={3}
              />
            </div>
          </div>
        </SubSection>

        {/* ── Genogram Chart (Identical style & options to VisitDetailView) ── */}
        <SubSection title="Family Chart (Genogram)">
          {genogram?.useUploadedImage && genogram?.uploadedImageUrl ? (
            <div className="w-full h-[480px] bg-background border border-border rounded-xl flex items-center justify-center p-4 overflow-hidden relative select-none">
              <img
                src={genogram.uploadedImageUrl}
                className="max-w-full max-h-full object-contain shadow-medium rounded-lg"
                alt="Manual Genogram Chart"
              />
              {genogram?.manualBeneficiaryCount !== undefined &&
                genogram?.manualBeneficiaryCount !== null &&
                genogram?.manualBeneficiaryCount !== "" && (
                  <div className="absolute top-3 right-3 z-10 bg-card/95 backdrop-blur-sm border border-border rounded-xl p-2 px-3 shadow-medium flex items-center space-x-2">
                    <div className="p-1.5 bg-amber-500/10 text-amber-500 rounded-lg">
                      <Users className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider leading-none mb-0.5">
                        Household
                      </div>
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
                <p className="text-[11px] text-muted-foreground">
                  If you have a manually drawn family tree, upload it here.
                </p>
              </div>
              {genogram?.uploadedImageUrl && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">Active Display:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setGenogram((prev) => ({
                        ...prev,
                        useUploadedImage: !prev?.useUploadedImage,
                      }));
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold border transition ${
                      genogram?.useUploadedImage
                        ? "bg-amber-500/10 border-amber-500 text-amber-600 hover:bg-amber-500/20"
                        : "bg-background border-border text-foreground hover:bg-muted"
                    }`}
                  >
                    {genogram?.useUploadedImage ? "Showing Uploaded Photo" : "Showing Interactive Canvas"}
                  </button>
                </div>
              )}
            </div>

            <OptimizedImageUpload
              onUploadSuccess={(data) => {
                setGenogram((prev) => ({
                  ...prev,
                  uploadedImageUrl: data.optimized_url,
                  useUploadedImage: true,
                }));
              }}
            />

            {genogram?.uploadedImageUrl && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/40">
                <InputField
                  label="Total Beneficiaries (including patient)"
                  placeholder="e.g. 4"
                  type="text"
                  value={
                    genogram?.manualBeneficiaryCount !== undefined &&
                    genogram?.manualBeneficiaryCount !== null
                      ? genogram.manualBeneficiaryCount
                      : ""
                  }
                  onChange={(v) => {
                    setGenogram((prev) => ({
                      ...prev,
                      manualBeneficiaryCount: v === "" ? null : Number(v),
                    }));
                  }}
                />
              </div>
            )}

            {genogram?.uploadedImageUrl && (
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground select-all truncate max-w-[250px] sm:max-w-md font-mono font-semibold">
                  {genogram.uploadedImageUrl}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setGenogram((prev) => ({
                      ...prev,
                      uploadedImageUrl: null,
                      useUploadedImage: false,
                      manualBeneficiaryCount: null,
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

        {/* ── Psychological Assessment ── */}
        <SubSection title="Psychological Assessment">
          {/* Emotional Responses */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-muted-foreground">
              Emotional Responses Observed
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {EMOTIONAL_OPTIONS.map((opt) => {
                const checked = (formData.emotional_responses || []).includes(opt);
                return (
                  <label
                    key={opt}
                    className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleArrayItem("emotional_responses", opt)}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <span>{opt}</span>
                  </label>
                );
              })}
            </div>
            <div className="pt-2">
              <InputField
                label="Other Emotional Responses"
                placeholder="Specify any other observed emotional reactions..."
                value={formData.emotional_responses_other}
                onChange={(v) => updateField("emotional_responses_other", v)}
              />
            </div>
          </div>

          {/* General Functioning */}
          <div className="pt-4 border-t border-border/60">
            <label className="block text-xs font-semibold text-muted-foreground mb-2">
              General Functioning
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField
                label="Sleep"
                placeholder="e.g. Disturbed, Early waking, Normal with medication"
                value={formData.functioning_sleep}
                onChange={(v) => updateField("functioning_sleep", v)}
              />
              <InputField
                label="Appetite"
                placeholder="e.g. Decreased, Poor, Normal intake"
                value={formData.functioning_appetite}
                onChange={(v) => updateField("functioning_appetite", v)}
              />
              <InputField
                label="Daily routine"
                placeholder="e.g. Resuming duties, Staying indoors, Disrupted"
                value={formData.functioning_daily_routine}
                onChange={(v) => updateField("functioning_daily_routine", v)}
              />
              <InputField
                label="Role changes noted"
                placeholder="e.g. Took over family finances, Eldest child assuming care"
                value={formData.functioning_role_changes}
                onChange={(v) => updateField("functioning_role_changes", v)}
              />
            </div>
          </div>
        </SubSection>

        {/* ── Support, Cultural & Strengths ── */}
        <SubSection title="Support & Cultural Factors">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <TextArea
              label="Family and Social support"
              placeholder="Presence of extended family, community visits, neighbors..."
              value={formData.family_social_support}
              onChange={(v) => updateField("family_social_support", v)}
              rows={2}
            />
            <TextArea
              label="Spiritual / Cultural Observations"
              placeholder="Religious solace, faith customs, spiritual doubts..."
              value={formData.spiritual_cultural_obs}
              onChange={(v) => updateField("spiritual_cultural_obs", v)}
              rows={2}
            />
            <TextArea
              label="Coping Strengths"
              placeholder="Resilience factors, emotional adaptability, strong bonds..."
              value={formData.coping_strengths}
              onChange={(v) => updateField("coping_strengths", v)}
              rows={2}
            />
          </div>
        </SubSection>

        {/* ── Red Flag Screening ── */}
        <SubSection title="Red Flag Screening">
          <div className="border border-border rounded-lg p-3 bg-red-500/5 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {RED_FLAG_OPTIONS.map((flag) => {
                const checked = (formData.red_flags || []).includes(flag);
                return (
                  <label
                    key={flag}
                    className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleArrayItem("red_flags", flag)}
                      className="h-4 w-4 rounded border-border text-red-600 focus:ring-red-500"
                    />
                    <span>{flag}</span>
                  </label>
                );
              })}
            </div>
            <InputField
              label="Other Red Flags"
              placeholder="Specify any other identified risks..."
              value={formData.red_flags_other}
              onChange={(v) => updateField("red_flags_other", v)}
            />
          </div>
        </SubSection>

        {/* ── Clinical Impression ── */}
        <SubSection title="Clinical Impression">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Bereavement Risk
            </label>
            <select
              value={formData.bereavement_risk}
              onChange={(e) => updateField("bereavement_risk", e.target.value)}
              className="w-full sm:w-64 px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm font-semibold"
            >
              <option value="low">Low Risk</option>
              <option value="moderate">Moderate Risk</option>
              <option value="high">High Risk</option>
            </select>
          </div>
        </SubSection>

        {/* ── Interventions During Visit ── */}
        <SubSection title="Interventions During Visit">
          <TextArea
            placeholder="Document psychological first aid, active listening, normal grief education, reassurance provided..."
            value={formData.interventions_notes}
            onChange={(v) => updateField("interventions_notes", v)}
            rows={3}
          />
        </SubSection>

        {/* ── Follow-up Plan & Remarks ── */}
        <SubSection title="Follow-up Plan">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-4">
              {FOLLOW_UP_OPTIONS.map((interval) => {
                const checked = (formData.follow_up_intervals || []).includes(interval);
                return (
                  <label
                    key={interval}
                    className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleArrayItem("follow_up_intervals", interval)}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <span>{interval}</span>
                  </label>
                );
              })}
            </div>
            <TextArea
              label="Follow-up Remarks"
              placeholder="Add concluding remarks, referral details, or action points..."
              value={formData.follow_up_remarks}
              onChange={(v) => updateField("follow_up_remarks", v)}
              rows={2}
            />
          </div>
        </SubSection>
      </div>

      {/* ── Bottom Action Buttons (Identical to VisitDetailView) ── */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm font-medium disabled:opacity-50 transition-colors shadow-sm"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saved ? "Saved!" : "Save Bereavement Record"}
        </button>

        <button
          onClick={async () => {
            await handleSave();
            try {
              await saranamApi.updateVisit(visit.id, { status: "completed" });
              if (onBack) onBack();
            } catch (err) {
              alert(err?.response?.data?.error || "Failed to mark complete");
            }
          }}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50 transition-colors shadow-sm"
        >
          <CheckCircle className="h-4 w-4" />
          Mark as Complete
        </button>
      </div>
    </div>
  );
}
