/**
 * TeleconsultForm — Saranam version
 * Editable SOP compliance documentation for teleconsultation calls.
 */
import { useState, useEffect } from "react";
import {
  Save,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { Button, Snackbar, Alert } from "@mui/material";
import saranamApi from "../../../api/saranam";
import teleconsultApi from "../../../api/teleconsult";
import { patientsApi } from "@/api/patients";
import ConsultationTypeMultiSelect from "../../../components/common/ConsultationTypeMultiSelect";

// ─── Helpers ──────────────────────────────────────────────────────────────
function SubSection({ title, children }) {
  return (
    <div className="space-y-3">
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
      <label className="block text-xs font-medium text-muted-foreground mb-1">
        {label}
      </label>
      <textarea
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm resize-none"
      />
    </div>
  );
}

function InputField({ label, placeholder, value, onChange, disabled = false, type = "text" }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">
        {label}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full px-3 py-2 border border-border rounded-lg text-sm ${
          disabled
            ? "bg-muted/30 text-foreground font-semibold"
            : "bg-background text-foreground"
        }`}
      />
    </div>
  );
}

function SelectField({ label, options, value, onChange }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

const WHO_ANSWERED_OPTIONS = [
  { value: "patient", label: "Patient" },
  { value: "primary_caregiver", label: "Primary Caregiver" },
  { value: "decision_maker", label: "Decision Maker" },
  { value: "other", label: "Other" },
];

const CALL_DIRECTION_OPTIONS = [
  { value: "Incoming call", label: "Incoming call" },
  { value: "Outgoing call", label: "Outgoing call" },
];

const CALL_TYPE_OPTIONS = [
  { value: "Follow-up", label: "Follow-up" },
  { value: "Condolence", label: "Condolence" },
  { value: "Bereavement", label: "Bereavement" },
];

// ═══════════════════════════════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════════════════════════════
export default function TeleconsultForm({ visitId, patientId, visit, onBack }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [patientDetail, setPatientDetail] = useState(null);
  const [editBscStatus, setEditBscStatus] = useState("");
  const [editIsOnco, setEditIsOnco] = useState("");
  const [toast, setToast] = useState({ open: false, message: "", severity: "success" });

  const showToast = (message, severity = "success") =>
    setToast({ open: true, message, severity });
  const closeToast = () => setToast((prev) => ({ ...prev, open: false }));

  const [sopData, setSopData] = useState({
    visitDate: visit?.visit_date ? String(visit.visit_date).split("T")[0] : new Date().toISOString().split("T")[0],
    patientName: "",
    patientPhone: "",
    primaryCaregiver: "",
    primaryCaregiverPhone: "",
    decisionMaker: "",
    decisionMakerPhone: "",
    staffName: "",
    staffNumber: "",
    whoAnswered: "patient",
    otherRelationship: "",
    callerName: "",
    callerPhone: "",
    phoneUsedType: "person_phone",
    consultationType: "Nurse",
    doctorConsultation: false,
    nursingConsultation: false,
    counsellorConsultation: false,
    physiotherapyConsultation: false,
    socialWorkerConsultation: false,
    callDirection: "Outgoing call",
    callType: "Follow-up",
    severity: "low",
    reason: "",
    symptoms: "",
    advice: "",
    notes: "",
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [visitId]);

  const updateField = (field, value) => {
    setSopData((prev) => ({ ...prev, [field]: value }));
  };

  const handleWhoAnsweredChange = (val) => {
    let callerName = "";
    let callerPhone = "";
    if (val === "patient") {
      callerName = sopData.patientName;
      callerPhone = sopData.patientPhone;
    } else if (val === "primary_caregiver") {
      callerName = sopData.primaryCaregiver;
      callerPhone = sopData.primaryCaregiverPhone;
    } else if (val === "decision_maker") {
      callerName = sopData.decisionMaker;
      callerPhone = sopData.decisionMakerPhone;
    }
    setSopData((prev) => ({
      ...prev,
      whoAnswered: val,
      callerName: callerName,
      callerPhone: callerPhone,
      phoneUsedType: "person_phone",
    }));
  };

  const handleComplete = async () => {
    setSaving(true);

    try {
      await teleconsultApi.saveDocumentationByVisit(visitId, {
        who_answered: sopData.whoAnswered,
        other_relationship:
          sopData.whoAnswered === "other" ? sopData.otherRelationship : null,
        caller_name: sopData.callerName,
        caller_phone:
          sopData.phoneUsedType === "patient_phone"
            ? sopData.patientPhone
            : sopData.callerPhone,
        phone_used_type: sopData.phoneUsedType,
        doctor_consultation: sopData.doctorConsultation,
        nursing_consultation: sopData.nursingConsultation,
        counsellor_consultation: sopData.counsellorConsultation,
        physiotherapy_consultation: sopData.physiotherapyConsultation,
        social_worker_consultation: sopData.socialWorkerConsultation,
        call_direction: sopData.callDirection,
        call_type: sopData.callType,
        severity: sopData.severity,
        reason: sopData.reason,
        symptoms: sopData.symptoms,
        advice: sopData.advice,
        notes: sopData.notes,
      });

      // Update visit status, date & consultation flags in patient_visits
      try {
        await saranamApi.updateVisit(visitId, {
          status: "completed",
          visit_date: sopData.visitDate,
          doctor_consultation: sopData.doctorConsultation,
          nursing_consultation: sopData.nursingConsultation,
          counsellor_consultation: sopData.counsellorConsultation,
          physiotherapy_consultation: sopData.physiotherapyConsultation,
          social_worker_consultation: sopData.socialWorkerConsultation,
        });
      } catch (e) {
        console.error("Failed to update visit status/date", e);
      }

      // Save patient category (BSC Status & Oncology Status)
      try {
        await patientsApi.update(patientId, {
          bsc_status: editBscStatus === "bsc" ? true : editBscStatus === "non_bsc" ? false : null,
          is_onco: editIsOnco === "onco" ? true : editIsOnco === "non_onco" ? false : null,
        });
      } catch (e) {
        console.error("Failed to update patient category", e);
      }

      if (session?.id) {
        try {
          await teleconsultApi.endSession(session.id);
        } catch {
          // Ignore session end error if call session was not active
        }
      }

      setTimeout(() => {
        onBack?.();
      }, 800);
    } catch (err) {
      showToast(err?.response?.data?.error || "Failed to complete teleconsult.", "error");
    } finally {
      setSaving(false);
    }
  };

  const loadData = async () => {
    setLoading(true);

    let currentSession = null;
    let patient = null;

    try {
      patient = await patientsApi.getById(patientId);
      if (patient) {
        setPatientDetail(patient);
        setEditBscStatus(patient.bsc_status === true ? "bsc" : patient.bsc_status === false ? "non_bsc" : "");
        setEditIsOnco(patient.is_onco === true ? "onco" : patient.is_onco === false ? "non_onco" : "");
      }
    } catch (err) {
      console.error("Failed to load patient", err);
    }

    try {
      const sessions = await teleconsultApi.listSessions({
        linked_visit_id: visitId,
      });
      currentSession = sessions[0] || null;
      setSession(currentSession);
    } catch {
      setSession(null);
    }

    try {
      const data = await teleconsultApi.getDocumentationByVisit(visitId);

      const whoAns = data?.who_answered || "patient";
      let initialCallerName = data?.caller_name || "";
      let initialCallerPhone = data?.caller_phone || "";
      let initialPhoneUsedType = data?.phone_used_type || "person_phone";

      if (!data?.caller_name) {
        if (whoAns === "patient") {
          initialCallerName = patient?.full_name || "";
          initialCallerPhone = patient?.phone || patient?.phone_number || "";
        } else if (whoAns === "primary_caregiver") {
          initialCallerName = patient?.primary_caregiver_name || "";
          initialCallerPhone = patient?.primary_caregiver_phone || "";
        } else if (whoAns === "decision_maker") {
          initialCallerName = patient?.decision_maker_name || "";
          initialCallerPhone = patient?.decision_maker_phone || "";
        }
      }

      setSopData((prev) => ({
        visitDate: visit?.visit_date ? String(visit.visit_date).split("T")[0] : prev.visitDate,
        patientName: patient?.full_name || "",
        patientPhone: patient?.phone || patient?.phone_number || "",
        primaryCaregiver: patient?.primary_caregiver_name || "",
        primaryCaregiverPhone: patient?.primary_caregiver_phone || "",
        decisionMaker: patient?.decision_maker_name || "",
        decisionMakerPhone: patient?.decision_maker_phone || "",
        staffName: currentSession?.provider_name || prev.staffName,
        staffNumber: currentSession?.provider_phone || prev.staffNumber,
        whoAnswered: whoAns,
        otherRelationship: data?.other_relationship || "",
        callerName: initialCallerName,
        callerPhone: initialCallerPhone,
        phoneUsedType: initialPhoneUsedType,
        doctorConsultation: Boolean(data?.doctor_consultation || visit?.doctor_consultation),
        nursingConsultation: Boolean(data?.nursing_consultation || visit?.nursing_consultation),
        counsellorConsultation: Boolean(data?.counsellor_consultation || visit?.counsellor_consultation),
        physiotherapyConsultation: Boolean(data?.physiotherapy_consultation || visit?.physiotherapy_consultation),
        socialWorkerConsultation: Boolean(data?.social_worker_consultation || visit?.social_worker_consultation),
        callDirection: data?.call_direction || "Outgoing call",
        callType: data?.call_type || "Follow-up",
        severity: data?.severity || "low",
        reason: data?.reason || "",
        symptoms: data?.symptoms || "",
        advice: data?.advice || "",
        notes: data?.notes || "",
      }));
    } catch (err) {
      setSopData((prev) => ({
        ...prev,
        visitDate: visit?.visit_date ? String(visit.visit_date).split("T")[0] : prev.visitDate,
        patientName: patient?.full_name || "",
        patientPhone: patient?.phone || patient?.phone_number || "",
        primaryCaregiver: patient?.primary_caregiver_name || "",
        primaryCaregiverPhone: patient?.primary_caregiver_phone || "",
        decisionMaker: patient?.decision_maker_name || "",
        decisionMakerPhone: patient?.decision_maker_phone || "",
        callerName: patient?.full_name || "",
        callerPhone: patient?.phone || patient?.phone_number || "",
        staffName: currentSession?.provider_name || "",
        staffNumber: currentSession?.provider_phone || "",
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await teleconsultApi.saveDocumentationByVisit(visitId, {
        who_answered: sopData.whoAnswered,
        other_relationship:
          sopData.whoAnswered === "other" ? sopData.otherRelationship : null,
        caller_name: sopData.callerName,
        caller_phone:
          sopData.phoneUsedType === "patient_phone"
            ? sopData.patientPhone
            : sopData.callerPhone,
        phone_used_type: sopData.phoneUsedType,
        doctor_consultation: sopData.doctorConsultation,
        nursing_consultation: sopData.nursingConsultation,
        counsellor_consultation: sopData.counsellorConsultation,
        physiotherapy_consultation: sopData.physiotherapyConsultation,
        social_worker_consultation: sopData.socialWorkerConsultation,
        call_direction: sopData.callDirection,
        call_type: sopData.callType,
        severity: sopData.severity,
        reason: sopData.reason,
        symptoms: sopData.symptoms,
        advice: sopData.advice,
        notes: sopData.notes,
      });

      try {
        await saranamApi.updateVisit(visitId, {
          visit_date: sopData.visitDate,
          doctor_consultation: sopData.doctorConsultation,
          nursing_consultation: sopData.nursingConsultation,
          counsellor_consultation: sopData.counsellorConsultation,
          physiotherapy_consultation: sopData.physiotherapyConsultation,
          social_worker_consultation: sopData.socialWorkerConsultation,
        });
      } catch (e) {
        console.error("Failed to update visit date", e);
      }

      try {
        await patientsApi.update(patientId, {
          bsc_status: editBscStatus === "bsc" ? true : editBscStatus === "non_bsc" ? false : null,
          is_onco: editIsOnco === "onco" ? true : editIsOnco === "non_onco" ? false : null,
        });
      } catch (e) {
        console.error("Failed to update patient category", e);
      }

      showToast("Teleconsultation documentation saved successfully!", "success");
    } catch (err) {
      showToast(err?.response?.data?.error || "Failed to save teleconsultation documentation", "error");
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

  const callerTypeLabel =
    sopData.whoAnswered === "patient"
      ? "Patient"
      : sopData.whoAnswered === "primary_caregiver"
      ? "Caregiver"
      : sopData.whoAnswered === "decision_maker"
      ? "Decision Maker"
      : "Caller";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="text-base">←</span> All Visits
        </button>
        <div className="h-4 w-px bg-border" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-foreground">
              Teleconsultation #{visit?.visit_number}
            </h3>
            <span className="px-2 py-0.5 text-xs font-medium rounded-full border border-primary-500/30 bg-primary-500/10 text-primary-400">
              Teleconsultation
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {sopData.visitDate
              ? new Date(sopData.visitDate).toLocaleDateString("en-IN", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : ""}
            {visit?.visit_location && ` — ${visit.visit_location}`}
          </p>
        </div>
      </div>

      {/* ── Call Classification ── */}
      <SubSection title="Call Classification">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <InputField
            label="Date of Contact"
            type="date"
            value={sopData.visitDate}
            onChange={(v) => updateField("visitDate", v)}
          />
          <SelectField
            label="Incoming / Outgoing Call"
            options={CALL_DIRECTION_OPTIONS}
            value={sopData.callDirection}
            onChange={(v) => updateField("callDirection", v)}
          />
          <SelectField
            label="Call Type"
            options={CALL_TYPE_OPTIONS}
            value={sopData.callType}
            onChange={(v) => updateField("callType", v)}
          />
        </div>
        <div className="mt-3">
          <ConsultationTypeMultiSelect
            values={{
              doctor_consultation: sopData.doctorConsultation,
              nursing_consultation: sopData.nursingConsultation,
              counsellor_consultation: sopData.counsellorConsultation,
              physiotherapy_consultation: sopData.physiotherapyConsultation,
              social_worker_consultation: sopData.socialWorkerConsultation,
            }}
            onChange={(updated) => {
              setSopData((prev) => ({
                ...prev,
                doctorConsultation: updated.doctor_consultation,
                nursingConsultation: updated.nursing_consultation,
                counsellorConsultation: updated.counsellor_consultation,
                physiotherapyConsultation: updated.physiotherapy_consultation,
                socialWorkerConsultation: updated.social_worker_consultation,
              }));
            }}
          />
        </div>
      </SubSection>

      {/* ── Patient Details ── */}
      <SubSection title="Patient Information">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <InputField
            label="Patient Name"
            value={sopData.patientName}
            disabled
          />
          <InputField
            label="Patient Phone"
            value={sopData.patientPhone}
            disabled
          />
          <InputField
            label="Primary Caregiver"
            value={sopData.primaryCaregiver || "Not Saved"}
            disabled
          />
          <InputField
            label="Caregiver Phone"
            value={sopData.primaryCaregiverPhone || "Not Saved"}
            disabled
          />
          <InputField
            label="Decision Maker"
            value={sopData.decisionMaker || "Not Saved"}
            disabled
          />
          <InputField
            label="Decision Maker Phone"
            value={sopData.decisionMakerPhone || "Not Saved"}
            disabled
          />
        </div>
      </SubSection>

      {/* ── Patient Category ── */}
      <SubSection title="Patient Category">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-card p-3 rounded-lg border border-border">
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

      {/* ── Staff Details ── */}
      <SubSection title="Staff Details">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <InputField
            label="Staff / Clinician Name"
            placeholder="Provider name"
            value={sopData.staffName}
            onChange={(v) => updateField("staffName", v)}
          />
          <InputField
            label="Staff Phone No."
            placeholder="Provider phone"
            value={sopData.staffNumber}
            onChange={(v) => updateField("staffNumber", v)}
          />
        </div>
      </SubSection>

      {/* ── Caller Details ── */}
      <SubSection title="Caller Details">
        <div className="space-y-4">
          <SelectField
            label="Who Answered the Phone?"
            options={WHO_ANSWERED_OPTIONS}
            value={sopData.whoAnswered}
            onChange={handleWhoAnsweredChange}
          />

          {sopData.whoAnswered === "other" && (
            <InputField
              label="Relationship with Patient"
              placeholder="e.g. Daughter, Brother, Neighbour"
              value={sopData.otherRelationship}
              onChange={(v) => updateField("otherRelationship", v)}
            />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border border-border/60 p-3 rounded-lg bg-muted/10">
            <InputField
              label={`${callerTypeLabel} Name`}
              placeholder={`Enter ${callerTypeLabel.toLowerCase()} name`}
              value={sopData.callerName}
              onChange={(v) => updateField("callerName", v)}
            />
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Which Phone Number Was Dialed?
              </label>
              <div className="space-y-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="phoneUsedType"
                    value="person_phone"
                    checked={sopData.phoneUsedType === "person_phone"}
                    onChange={() => updateField("phoneUsedType", "person_phone")}
                    className="text-primary"
                  />
                  <span>
                    {callerTypeLabel}'s Direct Phone ({sopData.callerPhone || "Not Saved"})
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="phoneUsedType"
                    value="patient_phone"
                    checked={sopData.phoneUsedType === "patient_phone"}
                    onChange={() => updateField("phoneUsedType", "patient_phone")}
                    className="text-primary"
                  />
                  <span>Patient's Phone ({sopData.patientPhone || "Not Saved"})</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </SubSection>

      {/* ── Call Assessment ── */}
      <SubSection title="Call Assessment">
        <TextArea
          label="Symptoms Discussed"
          placeholder="Describe symptoms observed..."
          value={sopData.symptoms}
          onChange={(v) => updateField("symptoms", v)}
          rows={2}
        />
      </SubSection>

      {/* ── Advice & Notes ── */}
      <SubSection title="Advice & Notes">
        <TextArea
          label="Advice & Action Plan"
          placeholder="What was suggested to the caller?"
          value={sopData.advice}
          onChange={(v) => updateField("advice", v)}
          rows={2}
        />
        <TextArea
          label="Internal Notes / Extra Info"
          placeholder="Any additional context for the team..."
          value={sopData.notes}
          onChange={(v) => updateField("notes", v)}
          rows={2}
        />
      </SubSection>

      {/* ── Save / Complete ── */}
      <div className="flex items-center justify-between border-t pt-6">
        <Button variant="outline" onClick={onBack} disabled={saving}>
          Back
        </Button>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Draft
              </>
            )}
          </Button>

          <Button
            onClick={handleComplete}
            disabled={saving || visit?.status === "completed"}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Completing...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Mark as Complete
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Toast notifications — replaces window.alert() */}
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={closeToast}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={closeToast}
          severity={toast.severity}
          variant="filled"
          sx={{ width: "100%", borderRadius: 2 }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </div>
  );
}
