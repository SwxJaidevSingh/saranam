/**
 * Saranam Palliative Care API endpoints
 */
import apiClient from './client';

export const saranamApi = {
  // ── Visits ──
  getInitialVisit: async (patientId) => {
    const response = await apiClient.get(`/saranam/patients/${patientId}/initial-visit`);
    return response.data;
  },

  listVisits: async (patientId) => {
    const response = await apiClient.get(`/saranam/patients/${patientId}/visits`);
    return response.data;
  },

  createVisit: async (patientId, visitData) => {
    const response = await apiClient.post(`/saranam/patients/${patientId}/visits`, visitData);
    return response.data;
  },

  getVisit: async (visitId) => {
    const response = await apiClient.get(`/saranam/visits/${visitId}`);
    return response.data;
  },

  updateVisit: async (visitId, visitData) => {
    const response = await apiClient.put(`/saranam/visits/${visitId}`, visitData);
    return response.data;
  },

  // ── Assessments (generic — works for all types) ──
  getAllAssessments: async (visitId) => {
    const response = await apiClient.get(`/saranam/visits/${visitId}/assessments`);
    return response.data;
  },

  getAssessment: async (visitId, type) => {
    const response = await apiClient.get(`/saranam/visits/${visitId}/${type}`);
    return response.data;
  },

  saveAssessment: async (visitId, type, data) => {
    const response = await apiClient.post(`/saranam/visits/${visitId}/${type}`, data);
    return response.data;
  },

  // ── AI Summaries ──
  // Per-form AI summary. Type is one of:
  // 'nursing' | 'doctor' | 'psychological' | 'physiotherapy'.
  // Backend reads the saved assessment row, so the form must be saved first.
  generateAssessmentSummary: async (visitId, type) => {
    const response = await apiClient.post(`/saranam/visits/${visitId}/${type}/summary`);
    return response.data; // { summary, model }
  },

  // Patient-level holistic summary.
  getPatientSummary: async (patientId) => {
    const response = await apiClient.get(`/saranam/patients/${patientId}/summary`);
    return response.data; // null if no snapshot yet
  },

  generatePatientSummary: async (patientId) => {
    const response = await apiClient.post(`/saranam/patients/${patientId}/summary/generate`);
    // { summary_blocks: {nursing, psychosocial, physiotherapy},
    //   summary_text (flattened), body_locations, diff_stats, model }
    return response.data;
  },

  savePatientSummary: async (patientId, payload) => {
    // payload: { summary_blocks: {...} | summary_text, body_locations?, model? }
    const response = await apiClient.put(`/saranam/patients/${patientId}/summary`, payload);
    return response.data;
  },

  // ── Per-visit follow-up summaries (2026-05-13 client meeting) ──
  // One row per follow-up visit; the list endpoint powers both the "Latest
  // Patient Health" card and the "Past Records" section on the patient
  // Overview tab.
  getFollowupSummary: async (visitId) => {
    const response = await apiClient.get(`/saranam/visits/${visitId}/follow-up-summary`);
    return response.data; // null if not generated yet
  },

  generateFollowupSummary: async (visitId) => {
    const response = await apiClient.post(`/saranam/visits/${visitId}/follow-up-summary/generate`);
    return response.data; // { summary, body_locations, diff_stats, model }
  },

  saveFollowupSummary: async (visitId, payload) => {
    // payload: { summary_text, body_locations?, model? }
    const response = await apiClient.put(`/saranam/visits/${visitId}/follow-up-summary`, payload);
    return response.data;
  },

  listFollowupSummaries: async (patientId) => {
    const response = await apiClient.get(`/saranam/patients/${patientId}/follow-up-summaries`);
    return response.data; // { items: [...], total }
  },

  // ── PPS Suggestion ──
  suggestPps: async (visitId) => {
    const response = await apiClient.get(`/saranam/visits/${visitId}/pps/suggest`);
    return response.data;
  },

  // ── Trends ──
  getPatientScores: async (patientId, scoreType) => {
    const response = await apiClient.get(`/saranam/patients/${patientId}/scores/${scoreType}`);
    return response.data;
  },

  // ── Prescription versions (PDF stored in Cloudinary / DB) ──
  // Issue an immutable version: uploads the client-generated PDF + a JSON snapshot.
  issuePrescription: async (visitId, pdfBlob, data) => {
    const form = new FormData();
    form.append('pdf', pdfBlob, 'prescription.pdf');
    form.append('data', JSON.stringify(data || {}));
    const response = await apiClient.post(
      `/saranam/visits/${visitId}/prescription/issue`, form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return response.data; // { created, version }
  },

  listPrescriptionVersions: async (patientId, limit = 10) => {
    const response = await apiClient.get(
      `/saranam/patients/${patientId}/prescription-versions`, { params: { limit } });
    return response.data; // { versions: [...], total }
  },

  latestPrescription: async (patientId, excludeVisitId) => {
    const response = await apiClient.get(
      `/saranam/patients/${patientId}/prescription/latest`,
      { params: excludeVisitId ? { exclude_visit: excludeVisitId } : {} });
    return response.data; // { version, carry_forward, doctor }
  },

  // Download a version's PDF (backend streams it + logs the download).
  downloadPrescriptionVersion: async (versionId, fileName) => {
    const response = await apiClient.get(
      `/saranam/prescription-versions/${versionId}/download`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || `Prescription_${versionId}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },

  latestBodyMap: async (patientId, excludeVisitId) => {
    const response = await apiClient.get(
      `/saranam/patients/${patientId}/body-map/latest`,
      { params: excludeVisitId ? { exclude_visit: excludeVisitId } : {} }
    );
    return response.data;
  },


};

export default saranamApi;
