/**
 * Homecare Dispatch API client (Patients Directory, Scheduling Board, Vehicles,
 * Completion Report, System Settings).
 */
import apiClient from './client';

const BASE = '/homecare-dispatch';

const downloadBlob = (data, filename) => {
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

export const homecareDispatchApi = {
  // System Settings
  getSettings: async () => (await apiClient.get(`${BASE}/settings`)).data.settings,
  saveSettings: async (settings) => (await apiClient.put(`${BASE}/settings`, settings)).data,

  // Patients Directory
  getPatientsDirectory: async () => (await apiClient.get(`${BASE}/patients`)).data,

  // Vehicles
  getVehicles: async () => (await apiClient.get(`${BASE}/vehicles`)).data,
  createVehicle: async (data) => (await apiClient.post(`${BASE}/vehicles`, data)).data,
  updateVehicle: async (id, data) => (await apiClient.put(`${BASE}/vehicles/${id}`, data)).data,
  deleteVehicle: async (id) => (await apiClient.delete(`${BASE}/vehicles/${id}`)).data,

  // Scheduling Board
  getOverview: async (startDate, endDate) =>
    (await apiClient.get(`${BASE}/schedules`, { params: { start_date: startDate, end_date: endDate } })).data.schedules,
  scheduleExists: async (dateStr) => (await apiClient.get(`${BASE}/schedules/${dateStr}/exists`)).data.exists,
  getSchedule: async (dateStr) => (await apiClient.get(`${BASE}/schedules/${dateStr}`)).data,
  getCandidates: async (dateStr) => (await apiClient.get(`${BASE}/schedules/${dateStr}/candidates`)).data,
  autoDraft: async (dateStr, slots) =>
    (await apiClient.post(`${BASE}/schedules/${dateStr}/auto-draft`, { slots })).data.slots,
  // Rejects with HTTP 409 (code 'concurrent_edit') if another session changed the date since it was loaded.
  saveDraft: async (dateStr, slots, { loadedSlotCount = 0, loadedMaxUpdated = null, force = false } = {}) =>
    (await apiClient.put(`${BASE}/schedules/${dateStr}/draft`, {
      slots, loaded_slot_count: loadedSlotCount, loaded_max_updated: loadedMaxUpdated, force,
    })).data,
  deleteDraft: async (dateStr) => (await apiClient.delete(`${BASE}/schedules/${dateStr}/draft`)).data,
  getBoundarySuggestions: async (dateStr, slots) =>
    (await apiClient.post(`${BASE}/schedules/${dateStr}/boundary-suggestions`, { slots })).data.suggestions,
  checkAbnormal: async (dateStr) =>
    (await apiClient.get(`${BASE}/schedules/${dateStr}/abnormal-check`)).data.abnormal_patients,
  lockSchedule: async (dateStr, roundTrip) =>
    (await apiClient.post(`${BASE}/schedules/${dateStr}/lock`, { round_trip: roundTrip })).data,

  // Dispatch Console
  setVisitStatus: async (dateStr, slotId, status) =>
    (await apiClient.post(`${BASE}/schedules/${dateStr}/slots/${slotId}/status`, { status })).data,
  getReplacements: async (dateStr, slotId) =>
    (await apiClient.get(`${BASE}/schedules/${dateStr}/slots/${slotId}/replacements`)).data.candidates,
  swapPatient: async (dateStr, slotId, replacementPatientId) =>
    (await apiClient.post(`${BASE}/schedules/${dateStr}/slots/${slotId}/swap`, { replacement_patient_id: replacementPatientId })).data,
  getExtraCandidates: async (dateStr, vehicleId) =>
    (await apiClient.get(`${BASE}/schedules/${dateStr}/vehicles/${vehicleId}/extra-candidates`)).data.candidates,
  addExtraVisit: async (dateStr, vehicleId, patientId) =>
    (await apiClient.post(`${BASE}/schedules/${dateStr}/vehicles/${vehicleId}/extra-visit`, { patient_id: patientId })).data,
  getLastOdometer: async (dateStr, vehicleId) =>
    (await apiClient.get(`${BASE}/schedules/${dateStr}/vehicles/${vehicleId}/last-odometer`)).data.last_closing_kms,
  submitVehicleLog: async (dateStr, vehicleId, log) =>
    (await apiClient.post(`${BASE}/schedules/${dateStr}/vehicles/${vehicleId}/log`, log)).data,

  // Completion Report
  getReportDates: async () => (await apiClient.get(`${BASE}/reports/dates`)).data.dates,
  getReport: async (dateStr) => (await apiClient.get(`${BASE}/reports/${dateStr}`)).data,
  downloadReport: async (dateStr, format) => {
    const res = await apiClient.get(`${BASE}/reports/${dateStr}/${format}`, { responseType: 'blob' });
    downloadBlob(res.data, `saranam_dispatch_report_${dateStr}.${format}`);
  },
};

/** Readable message from an API error. */
export const apiError = (err, fallback = 'Request failed.') =>
  err?.response?.data?.error || err?.response?.data?.message || err?.message || fallback;

export default homecareDispatchApi;
