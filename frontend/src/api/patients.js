/**
 * Patients API endpoints
 */
import apiClient from './client';

export const patientsApi = {
  /**
   * List patients with options
   * @param {Object} options - Options like limit, page, search, etc.
   * @returns {Promise} Response with patients list
   */
  list: async (options = {}) => {
    const params = {};
    if (options.limit) params.per_page = options.limit;
    if (options.page) params.page = options.page;
    if (options.search) params.q = options.search;
    const response = await apiClient.get('/patients', { params });
    return response.data;
  },

  /**
   * Search/list patients
   * @param {string} query - Search query
   * @param {number} page - Page number
   * @param {number} perPage - Results per page
   * @returns {Promise} Response with patients list
   */
  search: async (query = '', page = 1, perPage = 20, bscStatus = null, geographicCluster = '', isOnco = null, isContacted = null, sortBy = 'created_at', sortOrder = 'desc') => {
    const params = {
      q: query,
      page,
      per_page: perPage,
      sort_by: sortBy,
      sort_order: sortOrder
    };
    if (bscStatus !== null && bscStatus !== undefined) {
      params.bsc_status = bscStatus;
    }
    if (isOnco !== null && isOnco !== undefined) {
      params.is_onco = isOnco;
    }
    if (isContacted !== null && isContacted !== undefined) {
      params.is_contacted = isContacted;
    }
    if (geographicCluster) {
      params.geographic_cluster = geographicCluster;
    }
    const response = await apiClient.get('/patients', { params });
    return response.data;
  },

  /**
   * Detect the GBA zone (North/South/East/West/Central) for a lat/long via
   * point-in-polygon on the official GBA corporation boundaries.
   * @returns {Promise<string|null>} zone name, or null if outside all zones
   */
  detectZone: async (lat, lng) => {
    const response = await apiClient.post('/patients/zones/detect', { lat, lng });
    return response.data.zone;
  },

  /**
   * GBA zone boundaries (GeoJSON) + colors, for the map overlay.
   * @returns {Promise<{boundaries: object, colors: object}>}
   */
  getZoneBoundaries: async () => {
    const response = await apiClient.get('/patients/zones/boundaries');
    return response.data;
  },

  /**
   * Get patient by ID
   * @param {string} id - Patient UUID
   * @returns {Promise} Response with patient data
   */
  getById: async (id) => {
    const response = await apiClient.get(`/patients/${id}`);
    return response.data;
  },

  /**
   * Create a new patient
   * @param {Object} patientData - Patient information
   * @returns {Promise} Response with created patient
   */
  create: async (patientData) => {
    const response = await apiClient.post('/patients', patientData);
    return response.data;
  },

  /**
   * Update an existing patient
   * @param {string} id - Patient UUID
   * @param {Object} patientData - Updated patient information
   * @returns {Promise} Response with updated patient
   */
  update: async (id, patientData) => {
    const response = await apiClient.put(`/patients/${id}`, patientData);
    return response.data;
  },

  /**
   * Get patient's form submissions
   * @param {string} id - Patient UUID
   * @param {number} page - Page number
   * @param {number} perPage - Results per page
   * @returns {Promise} Response with submissions list
   */
  getSubmissions: async (id, page = 1, perPage = 20) => {
    const params = { page, per_page: perPage };
    const response = await apiClient.get(`/patients/${id}/submissions`, { params });
    return response.data;
  },

  /**
   * Get recently accessed patients
   * @param {number} limit - Number of patients to return
   * @returns {Promise} Response with recent patients
   */
  getRecent: async (limit = 10) => {
    const params = { limit };
    const response = await apiClient.get('/patients/recent', { params });
    return response.data;
  },

  /**
   * Advanced patient search with filters
   * @param {Object} searchParams - Search parameters and filters
   * @returns {Promise} Response with filtered patients
   */
  advancedSearch: async (searchParams) => {
    const response = await apiClient.post('/patients/search', searchParams);
    return response.data;
  },

  /**
   * Check for duplicate patient
   * @param {Object} data - Data to check (abha_address)
   * @returns {Promise} Response with duplicate check result
   */
  checkDuplicate: async (data) => {
    const response = await apiClient.post('/patients/duplicate-check', data);
    return response.data;
  },

  /**
   * Get patient timeline
   * @param {string} id - Patient UUID
   * @returns {Promise} Response with patient timeline
   */
  getTimeline: async (id) => {
    const response = await apiClient.get(`/patients/${id}/timeline`);
    return response.data;
  },

  /**
   * Admin-only: regenerate a patient's UHID using the current (year, zone)
   * counter. Old UHID is recorded in uhid_history so the patient remains
   * searchable by either current or any previous UHID.
   * @param {string} id - Patient UUID
   * @param {string} reason - Optional human-readable reason for the audit log
   * @returns {Promise} Response with the new UHID + updated patient
   */
  regenerateUhid: async (id, reason = '') => {
    const response = await apiClient.post(`/patients/${id}/regenerate-uhid`, { reason });
    return response.data;
  },

  /**
   * Read-only preview of the next UHID for a (zone, hospital) combination.
   * Used to show a live "probable UHID" card while filling the registration
   * form. Counter is NOT advanced — concurrent registrations may still
   * consume the previewed number, so callers should label it as an estimate.
   *
   * @param {string} zone - One of South/East/North/West/Central
   * @param {string} hospital - One of KMIO/KCGH/SWON
   * @returns {Promise<{homecare_code, next_uhid, full_display, year, zone_code, is_preview}>}
   */
  previewUhid: async (zone, hospital) => {
    const response = await apiClient.get('/patients/uhid/preview', {
      params: { zone, hospital },
    });
    return response.data;
  },

  // ─── Universal PPS (patient-level, meeting §2.1, 2026-04-14) ───
  // Writes a standalone PPS row (visit_id=NULL) and triggers priority sync.
  // Returns { pps: {..row}, priority: {latest_pps_score, clinical_complexity} }.
  recordPatientPps: async (patientId, { pps_score, notes, ambulation, activity_level, self_care, intake, consciousness_level, estimated_survival_days } = {}) => {
    const response = await apiClient.post(`/patients/${patientId}/pps`, {
      pps_score, notes, ambulation, activity_level, self_care, intake, consciousness_level, estimated_survival_days,
    });
    return response.data;
  },

  // ─── Config: Diagnosis Options ──────────────────────────────────
  getDiagnosisOptions: async () => {
    const response = await apiClient.get('/patients/config/diagnosis-options');
    return response.data;
  },
  addDiagnosisOption: async (option) => {
    const response = await apiClient.post('/patients/config/diagnosis-options', { option });
    return response.data;
  },
  deleteDiagnosisOption: async (option) => {
    const response = await apiClient.delete('/patients/config/diagnosis-options', { data: { option } });
    return response.data;
  },

  // ─── Config: Referral Partners ──────────────────────────────────
  getReferralPartners: async () => {
    const response = await apiClient.get('/patients/config/referral-partners');
    return response.data;
  },
  addReferralPartner: async (option) => {
    const response = await apiClient.post('/patients/config/referral-partners', { option });
    return response.data;
  },
  deleteReferralPartner: async (option) => {
    const response = await apiClient.delete('/patients/config/referral-partners', { data: { option } });
    return response.data;
  },

  // ─── Config: Hospital Master List ───────────────────────────────
  // Each entry: { code, name, homecare_prefix, is_default, is_active, lat?, lng? }
  getHospitalOptions: async ({ includeInactive = false } = {}) => {
    const response = await apiClient.get('/patients/config/hospital-options', {
      params: includeInactive ? { include_inactive: 1 } : {},
    });
    return response.data;
  },
  addHospitalOption: async ({ code, name, homecare_prefix, lat, lng }) => {
    const response = await apiClient.post('/patients/config/hospital-options', {
      code, name, homecare_prefix, lat, lng,
    });
    return response.data;
  },
  updateHospitalOptions: async (options) => {
    const response = await apiClient.put('/patients/config/hospital-options', { options });
    return response.data;
  },
  deleteHospitalOption: async (code, { force = false } = {}) => {
    const response = await apiClient.delete('/patients/config/hospital-options', {
      data: { code },
      params: force ? { force: 1 } : {},
    });
    return response.data;
  },
};

export default patientsApi;
