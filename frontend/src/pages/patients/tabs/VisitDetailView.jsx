/**
 * VisitDetailView — Follow-Up Sheet with Prescription Builder, PPS, and Previous Prescriptions
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  Save,
  RefreshCw,
  Loader2,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  Pill,
  Calendar,
  Users,
} from "lucide-react";
import saranamApi from "../../../api/saranam";
import patientsApi from "../../../api/patients";
import generatePrescriptionPDF from "../../../utils/generatePrescriptionPDF";
import { normalizeLoadedMeds } from "../../../constants/prescription";
import PrescriptionBuilder from "../../../components/common/PrescriptionBuilder";
import ProceduresSection from "../../../components/common/ProceduresSection";
import FollowupSummaryCard from "../../../components/patients/FollowupSummaryCard";
import BodyMapView from "./BodyMapView";
import PpsForm from "./PpsForm";
import PhysiotherapyAssessmentForm from "./PhysiotherapyAssessmentForm";
import PsychologicalAssessmentForm from "./PsychologicalAssessmentForm";
import TeleconsultForm from "./TeleConsultForm";
import BereavementForm from "./BereavementForm";
import GenogramBuilder from "./GenogramBuilder";
import OptimizedImageUpload from "../../../components/common/OptimizedImageUpload";
import ConsultationTypeMultiSelect from "../../../components/common/ConsultationTypeMultiSelect";

function SubSection({ title, children }) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-foreground border-b border-border pb-1">
        {title}
      </h4>
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
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm resize-none"
      />
    </div>
  );
}

function VitalInput({ label, unit, placeholder, value, onChange }) {
  return (
    <div>
      <label className="block text-xs text-muted-foreground mb-1">
        {label} <span className="text-muted-foreground/50">{unit}</span>
      </label>
      <input
        type="number"
        step="any"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2.5 py-1.5 border border-border rounded-lg bg-background text-foreground text-sm"
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
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm disabled:opacity-60"
      />
    </div>
  );
}

const VISIT_TYPE_LABELS = {
  initial: "Initial Visit",
  follow_up: "Follow-Up",
  emergency: "Emergency",
  phone: "Phone Call",
};


// ═══════════════════════════════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════════════════════════════
const VisitDetailView = ({
  visit,
  onBack,
  patientName,
  patientUhid,
  patientHomecareCode,
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Baseline data
  const [baseline, setBaseline] = useState(null);
  const [showBaseline, setShowBaseline] = useState(false);

  // Follow-up sheet fields: multi-select consultation flags
  const [consultationFlags, setConsultationFlags] = useState({
    doctor_consultation: false,
    nursing_consultation: false,
    counsellor_consultation: false,
    physiotherapy_consultation: false,
    social_worker_consultation: false,
  });
  const [chiefComplaints, setChiefComplaints] = useState("");
  const [hpi, setHpi] = useState("");
  const [clinicalAssessment, setClinicalAssessment] = useState("");
  const [psychoSocial, setPsychoSocial] = useState("");
  const [showPhysioAssessment, setShowPhysioAssessment] = useState(false);
  const [showPsychoAssessment, setShowPsychoAssessment] = useState(false);
  const [localExam, setLocalExam] = useState("");
  const [systemicExam, setSystemicExam] = useState("");
  const [adviseNonPharmacological, setAdviseNonPharmacological] = useState("");
  const [followUpAdvise, setFollowUpAdvise] = useState("");
  const [followUpRemarks, setFollowUpRemarks] = useState("");
  const [visitSummary, setVisitSummary] = useState("");

  const [bodyMapMarkers, setBodyMapMarkers] = useState([]);
  const [bodyMapSourceInfo, setBodyMapSourceInfo] = useState(null); // { visit_number, visit_date }
  // Mirrors `carriedForward` for prescriptions: true when this visit had no
  // markers of its own yet and we pulled them from the most recent prior
  // visit instead. Any edit here still saves only to THIS visit's own
  // doctor_assessment row — nothing overwrites the source visit.
  const [bodyMapCarriedForward, setBodyMapCarriedForward] = useState(false);

  // Vitals
  const [vitals, setVitals] = useState({
    pr: "",
    bp_systolic: "",
    bp_diastolic: "",
    rr: "",
    spo2: "",
    temperature: "",
    grbs: "",
  });

  // Prescription (per visit)
  const [medications, setMedications] = useState([]);
  const [rxNotes, setRxNotes] = useState("");
  const [rxFollowUpNotes, setRxFollowUpNotes] = useState("");
  const [rxVisitType, setRxVisitType] = useState("follow_up");
  const [rxIcd10, setRxIcd10] = useState("");
  const [rxDiagnosisText, setRxDiagnosisText] = useState("");
  const [doctorInfo, setDoctorInfo] = useState({
    name: "",
    qualification: "",
    designation: "",
    kmc_number: "",
  });
  const [rxSaving, setRxSaving] = useState(false);
  const [rxSaved, setRxSaved] = useState(false);
  const [carriedForward, setCarriedForward] = useState(false);
  const [latestVersion, setLatestVersion] = useState(null);
  const [patientDetail, setPatientDetail] = useState(null);
  const [editBscStatus, setEditBscStatus] = useState("");
  const [editIsOnco, setEditIsOnco] = useState("");
  // Patient Outcome
  const [deceased, setDeceased] = useState(false);
  const [dateOfDeath, setDateOfDeath] = useState("");
  const [placeOfDeath, setPlaceOfDeath] = useState("");
  const [placeOfDeathRemarks, setPlaceOfDeathRemarks] = useState("");
  const [genogram, setGenogram] = useState(null);

  const isTeleconsult = visit?.visit_type === 'teleconsult';

  useEffect(() => {
    if (visit) loadData();
    if (visit && !isTeleconsult) loadData();
  }, [visit?.id, isTeleconsult]);

  const loadData = async () => {
    setLoading(true);
    try {
      const v = await saranamApi.getVisit(visit.id);
      if (v) {
        setVitals({
          pr: v.vitals_pr ?? "",
          bp_systolic: v.vitals_bp_systolic ?? "",
          bp_diastolic: v.vitals_bp_diastolic ?? "",
          rr: v.vitals_rr ?? "",
          spo2: v.vitals_spo2 ?? "",
          temperature: v.vitals_temperature ?? "",
          grbs: v.vitals_grbs ?? "",
        });
        setVisitSummary(v.visit_summary || "");
        setConsultationFlags({
          doctor_consultation: Boolean(v.doctor_consultation),
          nursing_consultation: Boolean(v.nursing_consultation),
          counsellor_consultation: Boolean(v.counsellor_consultation),
          physiotherapy_consultation: Boolean(v.physiotherapy_consultation),
          social_worker_consultation: Boolean(v.social_worker_consultation),
        });
        setAdviseNonPharmacological(v.advice_non_pharmacological || "");
        setFollowUpAdvise(v.follow_up_advice || "");
        setFollowUpRemarks(v.follow_up_remarks || "");
      }

      const doc = await saranamApi.getAssessment(visit.id, "doctor");
      if (doc) {
        setChiefComplaints(doc.chief_complaints || "");
        setHpi(doc.history_of_presenting_illness || "");
        setClinicalAssessment(doc.doctor_notes || "");
        setLocalExam(doc.exam_per_abdomen || "");
        setSystemicExam(
          [doc.exam_respiratory, doc.exam_cardiovascular, doc.exam_cns]
            .filter(Boolean)
            .join("\n") || "",
        );
      }

      // ── Body map: use this visit's own markers if it already has any;
      // otherwise carry forward the most recent prior visit's markers
      // (mirrors the prescription carry-forward flow below). ──
      const ownMarkers = Array.isArray(doc?.body_map_annotations)
        ? doc.body_map_annotations
        : [];
      if (ownMarkers.length > 0) {
        setBodyMapMarkers(ownMarkers);
        setBodyMapCarriedForward(false);
        setBodyMapSourceInfo(null);
      } else {
        try {
          const latestMap = await saranamApi.latestBodyMap(
            visit.patient_id,
            visit.id,
          );
          if (latestMap?.markers?.length > 0) {
            setBodyMapMarkers(latestMap.markers);
            setBodyMapCarriedForward(true);
            setBodyMapSourceInfo({
              visit_number: latestMap.source_visit_number,
              visit_date: latestMap.source_visit_date,
            });
          } else {
            setBodyMapMarkers([]);
            setBodyMapCarriedForward(false);
            setBodyMapSourceInfo(null);
          }
        } catch {
          setBodyMapMarkers([]);
          setBodyMapCarriedForward(false);
          setBodyMapSourceInfo(null);
        }
      }

      const psych = await saranamApi.getAssessment(visit.id, "psychological");
      if (psych) {
        setPsychoSocial(
          [
            psych.patient_mood,
            psych.patient_disease_concerns,
            psych.family_support_notes,
          ]
            .filter(Boolean)
            .join("\n") || "",
        );
      }

      const carePlan = await saranamApi.getAssessment(visit.id, "care-plan");

      const hasPrescription =
        carePlan &&
        ((carePlan.medications?.length ?? 0) > 0 ||
          carePlan.intervention_pharmacological ||
          carePlan.diagnosis_text ||
          carePlan.icd10_diagnosis);

      // The patient's most recent prescription (across ALL visits incl. the
      // initial assessment) — for auto-fill carry-forward + doctor + download.
      const latest = await saranamApi
        .latestPrescription(visit.patient_id, visit.id)
        .catch(() => null);

      if (hasPrescription) {
        setMedications(normalizeLoadedMeds(carePlan.medications));
        setRxNotes(carePlan.intervention_pharmacological || "");
        setRxFollowUpNotes(carePlan.follow_up_notes || "");
        setRxVisitType(carePlan.visit_type || "follow_up");
        setRxIcd10(carePlan.icd10_diagnosis || "");
        setRxDiagnosisText(carePlan.diagnosis_text || "");
      } else if (latest?.carry_forward) {
        // No prescription for this visit yet — carry forward the patient's most
        // recent prescription so follow-ups don't re-type repeated meds.
        const cf = latest.carry_forward;
        setMedications(normalizeLoadedMeds(cf.medications));
        setRxNotes(cf.intervention_pharmacological || "");
        setRxFollowUpNotes(cf.follow_up_notes || "");
        setRxIcd10(cf.icd10_diagnosis || "");
        setRxDiagnosisText(cf.diagnosis_text || "");
        if (cf.intervention_non_pharmacological)
          setAdviseNonPharmacological(cf.intervention_non_pharmacological);
        setCarriedForward(true);
      }

      // Restore the prescribing doctor (signature re-loads via provider_id) and
      // enable download when a real issued version exists.
      if (latest?.doctor)
        setDoctorInfo((prev) => ({ ...prev, ...latest.doctor }));
      if (latest?.version?.id) setLatestVersion(latest.version);

      try {
        const patientRec = await patientsApi.getById(visit.patient_id);
        if (patientRec) {
          setPatientDetail(patientRec);
          setGenogram(patientRec.genogram || null);
          setEditBscStatus(patientRec.bsc_status === true ? "bsc" : patientRec.bsc_status === false ? "non_bsc" : "");
          setEditIsOnco(patientRec.is_onco === true ? "onco" : patientRec.is_onco === false ? "non_onco" : "");
          setDeceased(!!patientRec.is_deceased);
          setDateOfDeath(patientRec.date_of_death || "");
          setPlaceOfDeath(patientRec.place_of_death || "");
          setPlaceOfDeathRemarks(patientRec.place_of_death_remarks || "");
        }
      } catch {}

      try {
        const initialVisit = await saranamApi.getInitialVisit(visit.patient_id);
        if (initialVisit) {
          const allBaseline = await saranamApi.getAllAssessments(
            initialVisit.id,
          );
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
      } catch {}
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handleBodyMapMarkersChange = async (nextMarkers) => {
    setBodyMapMarkers(nextMarkers);
    // Any edit — even to carried-forward markers — is now this visit's own
    // data going forward, so drop the "carried forward" banner.
    setBodyMapCarriedForward(false);
    await saranamApi.saveAssessment(visit.id, "doctor", {
      body_map_annotations: nextMarkers,
    });
  };

  // Build generatePrescriptionPDF args from current state.
  const buildRxPdfArgs = (extra = {}) => ({
    patientName: patientName || "Patient",
    patientId: visit.patient_id,
    patientUhid: patientUhid || visit.patient_uhid || null,
    patientHomecareCode:
      patientHomecareCode || visit.patient_homecare_code || null,
    medications,
    pharmacological: rxNotes,
    nonPharmacological: adviseNonPharmacological,
    followUpNotes: rxFollowUpNotes,
    doctorName: doctorInfo.name,
    doctorDesignation: [doctorInfo.qualification, doctorInfo.designation]
      .filter(Boolean)
      .join(", "),
    doctorLicenseNumber: doctorInfo.kmc_number,
    doctorSignatureImage: doctorInfo.signature_image || null,
    icd10Diagnosis: rxIcd10,
    diagnosis: rxDiagnosisText,
    ...extra,
  });

  const savePrescription = async () => {
    setRxSaving(true);
    try {
      await saranamApi.saveAssessment(visit.id, "care-plan", {
        intervention_pharmacological: rxNotes,
        medications,
        visit_type: rxVisitType,
        icd10_diagnosis: rxIcd10,
        diagnosis_text: rxDiagnosisText,
        follow_up_notes: rxFollowUpNotes,
      });

      // Issue an immutable version: generate the PDF + upload it. Strip the large
      // base64 signature from the metadata (it's already in the PDF) — keep a URL ref.
      const pdfBlob = await generatePrescriptionPDF(
        buildRxPdfArgs({ returnBlob: true }),
      );
      const { signature_image, ...doctorMeta } = doctorInfo || {};
      const doctorForSnapshot =
        signature_image && signature_image.startsWith("http")
          ? { ...doctorMeta, signature_image }
          : doctorMeta;
      const res = await saranamApi.issuePrescription(visit.id, pdfBlob, {
        medications,
        icd10_diagnosis: rxIcd10,
        diagnosis_text: rxDiagnosisText,
        intervention_pharmacological: rxNotes,
        intervention_non_pharmacological: adviseNonPharmacological,
        follow_up_notes: rxFollowUpNotes,
        visit_type: rxVisitType,
        doctor: doctorForSnapshot,
      });
      if (res?.version) setLatestVersion(res.version);

      setRxSaved(true);
      setTimeout(() => setRxSaved(false), 3000);
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to save prescription");
    } finally {
      setRxSaving(false);
    }
  };

  const downloadPrescriptionPDF = async () => {
    if (latestVersion?.id) {
      try {
        await saranamApi.downloadPrescriptionVersion(
          latestVersion.id,
          `Prescription_${(patientName || "Patient").replace(/\s+/g, "_")}_v${latestVersion.version_number}.pdf`,
        );
        return;
      } catch (err) {
        console.warn("Failed to download backend PDF, falling back to client-side:", err);
      }
    }

    try {
      await generatePrescriptionPDF(buildRxPdfArgs({ returnBlob: false }));
    } catch (err) {
      alert("Failed to generate PDF: " + (err?.message || "error"));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const numOrNull = (v) => (v === "" ? null : Number(v));
      await saranamApi.updateVisit(visit.id, {
        doctor_consultation: consultationFlags.doctor_consultation,
        nursing_consultation: consultationFlags.nursing_consultation,
        counsellor_consultation: consultationFlags.counsellor_consultation,
        physiotherapy_consultation: consultationFlags.physiotherapy_consultation,
        social_worker_consultation: consultationFlags.social_worker_consultation,
        vitals_pr: numOrNull(vitals.pr),
        vitals_bp_systolic: numOrNull(vitals.bp_systolic),
        vitals_bp_diastolic: numOrNull(vitals.bp_diastolic),
        vitals_rr: numOrNull(vitals.rr),
        vitals_spo2: numOrNull(vitals.spo2),
        vitals_temperature: numOrNull(vitals.temperature),
        vitals_grbs: numOrNull(vitals.grbs),
        visit_summary: visitSummary,
        advice_non_pharmacological: adviseNonPharmacological,
        follow_up_advice: followUpAdvise,
        follow_up_remarks: followUpRemarks,
      });

      await saranamApi.saveAssessment(visit.id, "doctor", {
        chief_complaints: chiefComplaints,
        history_of_presenting_illness: hpi,
        doctor_notes: clinicalAssessment,
        exam_per_abdomen: localExam,
        exam_respiratory: systemicExam,
      });

      if (psychoSocial) {
        await saranamApi.saveAssessment(visit.id, "psychological", {
          patient_mood: psychoSocial,
        });
      }

      if (deceased) {
        if (!dateOfDeath) {
          alert("Please set the date of death before saving.");
          setSaving(false);
          return;
        }
        if (placeOfDeath === "others" && !placeOfDeathRemarks.trim()) {
          alert("Please describe the place of death in Remarks.");
          setSaving(false);
          return;
        }
        await patientsApi.update(visit.patient_id, {
          is_deceased: true,
          date_of_death: dateOfDeath,
          place_of_death: placeOfDeath || null,
          place_of_death_remarks:
            placeOfDeath === "others" ? placeOfDeathRemarks.trim() : null,
        });
      } else {
        await patientsApi.update(visit.patient_id, {
          is_deceased: false,
          date_of_death: null,
          place_of_death: null,
          place_of_death_remarks: null,
        });
      }

      // Save patient category (BSC Status & Oncology Status) and Genogram
      await patientsApi.update(visit.patient_id, {
        bsc_status: editBscStatus === "bsc" ? true : editBscStatus === "non_bsc" ? false : null,
        is_onco: editIsOnco === "onco" ? true : editIsOnco === "non_onco" ? false : null,
        genogram: genogram,
      });

      const reloadedPatient = await patientsApi.getById(visit.patient_id);
      if (reloadedPatient) {
        setPatientDetail(reloadedPatient);
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to save follow-up");
    } finally {
      setSaving(false);
    }
  };

  if (!visit) return null;
  
  if (visit.visit_type === "teleconsult") {
    return (
      <TeleconsultForm
        visitId={visit.id}
        patientId={visit.patient_id}
        visit={visit}
        onBack={onBack}
        onSaved={onBack}
      />
    );
  }

  if (visit.visit_type === "bereavement") {
    return (
      <BereavementForm
        visitId={visit.id}
        patientId={visit.patient_id}
        visit={visit}
        patientName={patientName}
        patientUhid={patientUhid}
        patientHomecareCode={patientHomecareCode}
        onBack={onBack}
        onSaved={onBack}
      />
    );
  }

  if (loading)
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );


  return (
    <div className="space-y-6">
      {/* ── Header ── */}
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
              Follow-Up #{visit.visit_number}
            </h3>
            <span className="px-2 py-0.5 text-xs font-medium rounded-full border border-primary-500/30 bg-primary-500/10 text-primary-400">
              {VISIT_TYPE_LABELS[visit.visit_type] || visit.visit_type}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {visit.visit_date
              ? new Date(visit.visit_date).toLocaleDateString("en-IN", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : ""}
            {visit.visit_location && ` — ${visit.visit_location}`}
          </p>
          {patientDetail && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${
                patientDetail.bsc_status === true ? 'text-green-700 bg-green-50 border-green-200' :
                patientDetail.bsc_status === false ? 'text-gray-600 bg-gray-50 border-gray-200' :
                'text-gray-400 bg-gray-50 border-dashed border-gray-200'
              }`}>
                {patientDetail.bsc_status === true ? 'BSC' : patientDetail.bsc_status === false ? 'N-BSC' : 'Category: Not Determined'}
              </span>
              {patientDetail.is_onco !== null && patientDetail.is_onco !== undefined && (
                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${
                  patientDetail.is_onco === true ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-gray-600 bg-gray-50 border-gray-200'
                }`}>
                  {patientDetail.is_onco === true ? 'Onco' : 'Non-Onco'}
                </span>
              )}
              {patientDetail.clinical_complexity && (
                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${
                  patientDetail.clinical_complexity === 'high' ? 'text-red-700 bg-red-50 border-red-200' : 
                  patientDetail.clinical_complexity === 'medium' ? 'text-amber-700 bg-amber-50 border-amber-200' : 
                  patientDetail.clinical_complexity === 'low' ? 'text-gray-600 bg-gray-50 border-gray-200' :
                  'text-gray-400 bg-gray-50 border-dashed border-gray-200'
                }`}>
                  Priority: {patientDetail.clinical_complexity === 'not_yet_determined' ? 'Not Determined' : patientDetail.clinical_complexity.charAt(0).toUpperCase() + patientDetail.clinical_complexity.slice(1)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Baseline Reference ── */}
      {baseline && (
        <div className="border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setShowBaseline(!showBaseline)}
            className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary-400" />
              <span className="text-sm font-semibold text-foreground">
                Initial Assessment (Baseline)
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
                  <span className="font-bold text-muted-foreground">
                    Diagnosis:
                  </span>{" "}
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
                  <span className="font-bold text-muted-foreground">
                    ESAS Total:
                  </span>{" "}
                  <span>{baseline.esas.total_score}/100</span>
                </div>
              )}
              {baseline.pps && (
                <div>
                  <span className="font-bold text-muted-foreground">PPS:</span>{" "}
                  <span>{baseline.pps.pps_score}%</span>
                </div>
              )}
              {baseline.carePlan?.medications?.length > 0 && (
                <div>
                  <span className="font-bold text-muted-foreground">
                    Baseline Medications:
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {baseline.carePlan.medications.map((m, i) => (
                      <div key={i} className="text-[11px] text-foreground">
                        {m.name} {m.dosage && `— ${m.dosage}`}{" "}
                        {m.frequency && `— ${m.frequency}`}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Follow-Up Sheet ── */}
      <div className="border border-border rounded-lg p-4 space-y-6">
        <h4 className="text-base font-bold text-foreground text-center border-b border-border pb-2">
          {visit.visit_type === "initial" ? "Initial Visit Sheet" : "Follow-Up Sheet"}
        </h4>

        <SubSection title="Consultation Details">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-full">
              <ConsultationTypeMultiSelect
                values={consultationFlags}
                onChange={(updated) => setConsultationFlags(updated)}
              />
            </div>
          </div>
        </SubSection>

        <SubSection title="Chief Complaints">
          <TextArea
            placeholder="Main complaints..."
            value={chiefComplaints}
            onChange={setChiefComplaints}
            rows={2}
          />
        </SubSection>

        <SubSection title="History of Presenting Illness">
          <TextArea
            placeholder="Progression since last visit..."
            value={hpi}
            onChange={setHpi}
            rows={3}
          />
        </SubSection>

        <SubSection title="Clinical Assessment">
          <TextArea
            placeholder="Clinical findings..."
            value={clinicalAssessment}
            onChange={setClinicalAssessment}
            rows={3}
          />
        </SubSection>

        {/* <SubSection title="Psycho-social & Spiritual">
          <TextArea placeholder="Mood, family, coping..." value={psychoSocial} onChange={setPsychoSocial} rows={2} />
        </SubSection> */}

        <SubSection title="Patient Category">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                BSC Status
              </label>
              <select
                value={editBscStatus}
                onChange={(e) => setEditBscStatus(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm font-semibold"
              >
                <option value="">Not Determined</option>
                <option value="bsc">BSC</option>
                <option value="non_bsc">N-BSC</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Oncology Status
              </label>
              <select
                value={editIsOnco}
                onChange={(e) => setEditIsOnco(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm font-semibold"
              >
                <option value="">Not Determined</option>
                <option value="onco">Onco</option>
                <option value="non_onco">Non-Onco</option>
              </select>
            </div>
          </div>
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
                <span className="text-muted-foreground select-all truncate max-w-[250px] sm:max-w-md font-mono font-semibold">
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

        <SubSection title="Vitals">
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <VitalInput
              label="PR"
              unit="bpm"
              placeholder="72"
              value={vitals.pr}
              onChange={(v) => setVitals((p) => ({ ...p, pr: v }))}
            />
            <VitalInput
              label="BP Sys"
              unit="mmHg"
              placeholder="120"
              value={vitals.bp_systolic}
              onChange={(v) => setVitals((p) => ({ ...p, bp_systolic: v }))}
            />
            <VitalInput
              label="BP Dia"
              unit="mmHg"
              placeholder="80"
              value={vitals.bp_diastolic}
              onChange={(v) => setVitals((p) => ({ ...p, bp_diastolic: v }))}
            />
            <VitalInput
              label="RR"
              unit="/min"
              placeholder="16"
              value={vitals.rr}
              onChange={(v) => setVitals((p) => ({ ...p, rr: v }))}
            />
            <VitalInput
              label="SpO2"
              unit="%"
              placeholder="98"
              value={vitals.spo2}
              onChange={(v) => setVitals((p) => ({ ...p, spo2: v }))}
            />
            <VitalInput
              label="Temp"
              unit="°F"
              placeholder="98"
              value={vitals.temperature}
              onChange={(v) => setVitals((p) => ({ ...p, temperature: v }))}
            />
            <VitalInput
              label="GRBS"
              unit="mg/dL"
              placeholder="110"
              value={vitals.grbs}
              onChange={(v) => setVitals((p) => ({ ...p, grbs: v }))}
            />
          </div>
        </SubSection>

        {/* ── PPS ── */}
        <SubSection>
          <PpsForm visitId={visit.id} patientId={visit.patient_id} />
        </SubSection>

        <SubSection title="Local Examination">
          <TextArea
            placeholder="Local findings..."
            value={localExam}
            onChange={setLocalExam}
            rows={2}
          />
        </SubSection>

        <SubSection title="Systemic Examination">
          <TextArea
            placeholder="Respiratory, CVS, CNS..."
            value={systemicExam}
            onChange={setSystemicExam}
            rows={2}
          />
        </SubSection>

        {/* ── Physiotherapy Assessment ── */}
        <SubSection title="Physiotherapy Assessment">
          <button
            type="button"
            onClick={() => setShowPhysioAssessment((p) => !p)}
            className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
          >
            {showPhysioAssessment ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            {showPhysioAssessment ? "Hide" : "Show"} Physiotherapy Assessment
          </button>
          {showPhysioAssessment && (
            <PhysiotherapyAssessmentForm
              visitId={visit.id}
              patientId={visit.patient_id}
              showProcedures={false}
            />
          )}
        </SubSection>

        {/* ── Psychological Assessment ── */}
        <SubSection title="Psychological Assessment">
          <button
            type="button"
            onClick={() => setShowPsychoAssessment((p) => !p)}
            className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
          >
            {showPsychoAssessment ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            {showPsychoAssessment ? "Hide" : "Show"} Psychological Assessment
          </button>
          {showPsychoAssessment && (
            <PsychologicalAssessmentForm
              visitId={visit.id}
              patientId={visit.patient_id}
              showProcedures={false}
            />
          )}
        </SubSection>

        <SubSection title="Follow-up Advice">
          <TextArea
            placeholder="Next visit, things to monitor..."
            value={followUpAdvise}
            onChange={setFollowUpAdvise}
            rows={2}
          />
        </SubSection>

        <SubSection title="Follow-up Remarks">
          <TextArea
            placeholder="Add remarks..."
            value={followUpRemarks}
            onChange={setFollowUpRemarks}
            rows={2}
          />
        </SubSection>

        <SubSection title="Visit Summary">
          <TextArea
            placeholder="Overall summary..."
            value={visitSummary}
            onChange={setVisitSummary}
            rows={2}
          />
        </SubSection>

        <SubSection title="Patient Outcome">
          <div className="space-y-2 border border-border rounded-lg p-3 bg-muted/10">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={deceased}
                onChange={(e) => {
                  const v = e.target.checked;
                  setDeceased(v);
                  if (v && !dateOfDeath)
                    setDateOfDeath(
                      visit.visit_date || new Date().toISOString().slice(0, 10),
                    );
                }}
                className="h-4 w-4"
              />
              <span className="text-sm font-medium text-foreground">
                Patient has passed away
              </span>
            </label>
            {deceased && (
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Date of death
                  </label>
                  <input
                    type="date"
                    value={dateOfDeath}
                    onChange={(e) => setDateOfDeath(e.target.value)}
                    max={new Date().toISOString().slice(0, 10)}
                    className="w-full sm:w-60 px-2.5 py-1.5 border border-border rounded-lg bg-background text-foreground text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Place of death
                  </label>
                  <select
                    value={placeOfDeath}
                    onChange={(e) => setPlaceOfDeath(e.target.value)}
                    className="w-full sm:w-60 px-2.5 py-1.5 border border-border rounded-lg bg-background text-foreground text-sm"
                  >
                    <option value="">Not specified</option>
                    <option value="home">Home</option>
                    <option value="hospital">Hospital</option>
                    <option value="on_the_way">On the way to hospital</option>
                    <option value="others">Others</option>
                  </select>
                </div>
                {placeOfDeath === "others" && (
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Remarks (required)
                    </label>
                    <textarea
                      rows={2}
                      value={placeOfDeathRemarks}
                      onChange={(e) => setPlaceOfDeathRemarks(e.target.value)}
                      placeholder="Describe the place of death"
                      className="w-full px-2.5 py-1.5 border border-border rounded-lg bg-background text-foreground text-sm resize-none"
                    />
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground mt-1">
                  Free-form notes on passing can go in the Visit Summary or
                  Clinical Assessment fields above.
                </p>
              </div>
            )}
          </div>
        </SubSection>
      </div>

      {/* ── Save Buttons ── */}
      <div className="flex justify-end gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-50 transition-colors"
        >
          {saving ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saving ? "Saving..." : saved ? "Saved!" : "Save Follow-Up"}
        </button>
      </div>

      {/* ── Body Map ── */}
      <div className="border border-border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <h4 className="text-sm font-bold text-foreground">Body Map</h4>
        </div>
        {bodyMapCarriedForward && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            Markers copied from{" "}
            {bodyMapSourceInfo?.visit_number != null
              ? `Visit #${bodyMapSourceInfo.visit_number}`
              : "a previous visit"}
            {bodyMapSourceInfo?.visit_date &&
              ` (${new Date(bodyMapSourceInfo.visit_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })})`}
            . Any changes will be saved only for this visit.
          </div>
        )}
        <BodyMapView
          readOnly={false}
          freeClickMarkers={bodyMapMarkers}
          onMarkersChange={handleBodyMapMarkersChange}
          aiHighlights={[]}
          onAiHighlightsChange={() => {}}
        />
      </div>

      {/* ── Procedures ── */}
      <ProceduresSection visitId={visit.id} patientId={visit.patient_id} />

      {/* ── AI Follow-Up Summary ── */}
      {visit.visit_type !== "initial" && <FollowupSummaryCard visit={visit} />}
      {carriedForward && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Prescription copied from previous visit. Any changes will be saved
          only for this visit.
        </div>
      )}

      {/* ── Prescription ── */}
      <PrescriptionBuilder
        medications={medications}
        setMedications={(fn) => {
          setMedications(fn);
          setRxSaved(false);
        }}
        rxNotes={rxNotes}
        setRxNotes={(v) => {
          setRxNotes(v);
          setRxSaved(false);
        }}
        followUpNotes={rxFollowUpNotes}
        setFollowUpNotes={(v) => {
          setRxFollowUpNotes(v);
          setRxSaved(false);
        }}
        visitType={rxVisitType}
        setVisitType={(v) => {
          setRxVisitType(v);
          setRxSaved(false);
        }}
        icd10Diagnosis={rxIcd10}
        setIcd10Diagnosis={(v) => {
          setRxIcd10(v);
          setRxSaved(false);
        }}
        diagnosisText={rxDiagnosisText}
        setDiagnosisText={(v) => {
          setRxDiagnosisText(v);
          setRxSaved(false);
        }}
        doctorInfo={doctorInfo}
        setDoctorInfo={setDoctorInfo}
        onSave={savePrescription}
        saving={rxSaving}
        saved={rxSaved}
        onDownloadPDF={downloadPrescriptionPDF}
        canDownload={true}
        patientId={visit.patient_id}
        nonPharmacologicalNotes={adviseNonPharmacological}
        setNonPharmacologicalNotes={setAdviseNonPharmacological}
      />

      {/* ── Previous Prescriptions ── */}
      {/* <div className="border border-border rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2 border-b border-border pb-2">
          <Pill className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-bold text-foreground">Previous Prescriptions</h4>
        </div>
        <PreviousPrescriptions patientId={visit.patient_id} currentVisitId={visit.id} />
      </div> */}

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
        className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50 transition-colors"
      >
        <CheckCircle className="h-4 w-4" />
        Mark as Complete
      </button>
    </div>
  );
};

export default VisitDetailView;
