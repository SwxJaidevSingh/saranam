/**
 * Inventory API client (Dashboard, Medicine Catalog, Stock Management, Dispense,
 * Returns & Recalls, Error Reporting, Reports, Admin).
 */
import apiClient from './client';

const BASE = '/inventory';
const data = (p) => p.then(r => r.data);

export const inventoryApi = {
  getDashboard: () => data(apiClient.get(`${BASE}/dashboard`)),

  // Medicine Catalog
  getCatalog: (q = '') => data(apiClient.get(`${BASE}/catalog`, { params: { q } })),
  addMedicine: (body) => data(apiClient.post(`${BASE}/catalog/medicines`, body)),
  saveMedicineMeta: (id, body) => data(apiClient.put(`${BASE}/catalog/medicines/${id}/meta`, body)),
  addCategory: (name) => data(apiClient.post(`${BASE}/catalog/categories`, { name })),

  // Stock Management
  getStock: () => data(apiClient.get(`${BASE}/stock`)),
  setReorderLevel: (stockId, source, level) => data(apiClient.put(`${BASE}/stock/${stockId}/reorder-level`, { source, level })),
  getReceiveOptions: () => data(apiClient.get(`${BASE}/stock/receive-options`)),
  receiveStock: (body) => data(apiClient.post(`${BASE}/stock/receive`, body)),
  getMovements: () => data(apiClient.get(`${BASE}/stock/movements`)),

  // Dispense
  getDispensePatients: () => data(apiClient.get(`${BASE}/dispense/patients`)),
  getDispenseContext: (patientId) => data(apiClient.get(`${BASE}/dispense/patients/${patientId}`)),
  dispense: (patientId, lines, acknowledged) => data(apiClient.post(`${BASE}/dispense`, { patient_id: patientId, lines, acknowledged })),

  // Returns & Recalls
  getReturns: (type = 'All') => data(apiClient.get(`${BASE}/returns`, { params: { type } })),
  reportReturn: (body) => data(apiClient.post(`${BASE}/returns`, body)),

  // Medication Error Reporting
  getErrors: (status = 'All') => data(apiClient.get(`${BASE}/errors`, { params: { status } })),
  reportError: (body) => data(apiClient.post(`${BASE}/errors`, body)),
  updateErrorStatus: (id, status) => data(apiClient.put(`${BASE}/errors/${id}/status`, { status })),

  // Reports
  getReport: (slug, params = {}) => data(apiClient.get(`${BASE}/reports/${slug}`, { params })),
  downloadReportCsv: async (slug, params = {}) => {
    const res = await apiClient.get(`${BASE}/reports/${slug}/csv`, { params, responseType: 'blob' });
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug}_${iso}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  // Admin
  getUsers: () => data(apiClient.get(`${BASE}/admin/users`)),
  getAdminPatients: () => data(apiClient.get(`${BASE}/admin/patients`)),
  saveAllergies: (patientId, allergies) => data(apiClient.put(`${BASE}/admin/patients/${patientId}/allergies`, { allergies })),
  getEmergencyMeds: () => data(apiClient.get(`${BASE}/admin/emergency-meds`)),
  addEmergencyMed: (body) => data(apiClient.post(`${BASE}/admin/emergency-meds`, body)),
};

export const apiError = (err, fallback = 'Request failed.') =>
  err?.response?.data?.error || err?.response?.data?.message || err?.message || fallback;

export default inventoryApi;
