/**
 * IPD (In-Patient Department) API endpoints
 */
import apiClient from './client';

export const ipdApi = {
  // ==================== Dashboard ====================

  /**
   * Get IPD dashboard statistics
   * @returns {Promise} Response with dashboard stats
   */
  getDashboard: async () => {
    const response = await apiClient.get('/ipd/dashboard');
    return response.data;
  },

  // ==================== Bed Management ====================

  /**
   * List beds with filters
   * @param {Object} filters - Filters for beds (facility_id, ward_name, bed_type, bed_status, etc.)
   * @param {number} page - Page number
   * @param {number} perPage - Results per page
   * @returns {Promise} Response with beds list
   */
  listBeds: async (filters = {}, page = 1, perPage = 50) => {
    const params = {
      ...filters,
      page,
      per_page: perPage
    };
    const response = await apiClient.get('/ipd/beds', { params });
    return response.data;
  },

  /**
   * Get bed by ID
   * @param {string} bedId - Bed UUID
   * @returns {Promise} Response with bed data
   */
  getBed: async (bedId) => {
    const response = await apiClient.get(`/ipd/beds/${bedId}`);
    return response.data;
  },

  /**
   * Create a new bed
   * @param {Object} bedData - Bed information
   * @returns {Promise} Response with created bed
   */
  createBed: async (bedData) => {
    const response = await apiClient.post('/ipd/beds', bedData);
    return response.data;
  },

  /**
   * Update a bed
   * @param {string} bedId - Bed UUID
   * @param {Object} bedData - Updated bed information
   * @returns {Promise} Response with updated bed
   */
  updateBed: async (bedId, bedData) => {
    const response = await apiClient.put(`/ipd/beds/${bedId}`, bedData);
    return response.data;
  },

  /**
   * Assign a bed to a patient
   * @param {string} bedId - Bed UUID
   * @param {Object} assignmentData - Assignment information (patient_id, admission_id, encounter_id, notes)
   * @returns {Promise} Response with assignment and bed data
   */
  assignBed: async (bedId, assignmentData) => {
    const response = await apiClient.post(`/ipd/beds/${bedId}/assign`, assignmentData);
    return response.data;
  },

  /**
   * Release a bed
   * @param {string} bedId - Bed UUID
   * @param {string} notes - Release notes
   * @returns {Promise} Response with updated bed
   */
  releaseBed: async (bedId, notes = '') => {
    const response = await apiClient.post(`/ipd/beds/${bedId}/release`, { notes });
    return response.data;
  },

  /**
   * Transfer patient from one bed to another
   * @param {string} currentBedId - Current bed UUID
   * @param {string} newBedId - New bed UUID
   * @param {string} transferReason - Reason for transfer
   * @param {string} notes - Additional notes
   * @returns {Promise} Response with old and new assignments
   */
  transferBed: async (currentBedId, newBedId, transferReason, notes = '') => {
    const response = await apiClient.post('/ipd/beds/transfer', {
      current_bed_id: currentBedId,
      new_bed_id: newBedId,
      transfer_reason: transferReason,
      notes
    });
    return response.data;
  },

  /**
   * Get bed availability statistics
   * @returns {Promise} Response with bed availability by type
   */
  getBedAvailability: async () => {
    const response = await apiClient.get('/ipd/beds/availability');
    return response.data;
  },

  // ==================== Admissions ====================

  /**
   * List IPD admissions with filters
   * @param {Object} filters - Filters (patient_id, admission_type, status, etc.)
   * @param {number} page - Page number
   * @param {number} perPage - Results per page
   * @returns {Promise} Response with admissions list
   */
  listAdmissions: async (filters = {}, page = 1, perPage = 20) => {
    const params = {
      ...filters,
      page,
      per_page: perPage
    };
    const response = await apiClient.get('/ipd/admissions', { params });
    return response.data;
  },

  /**
   * Get admission by ID
   * @param {string} admissionId - Admission UUID
   * @returns {Promise} Response with admission data
   */
  getAdmission: async (admissionId) => {
    const response = await apiClient.get(`/ipd/admissions/${admissionId}`);
    return response.data;
  },

  /**
   * Admit a patient to IPD
   * @param {Object} admissionData - Admission information
   * @returns {Promise} Response with created admission
   */
  admitPatient: async (admissionData) => {
    const response = await apiClient.post('/ipd/admissions', admissionData);
    return response.data;
  },

  /**
   * Update an admission
   * @param {string} admissionId - Admission UUID
   * @param {Object} admissionData - Updated admission information
   * @returns {Promise} Response with updated admission
   */
  updateAdmission: async (admissionId, admissionData) => {
    const response = await apiClient.put(`/ipd/admissions/${admissionId}`, admissionData);
    return response.data;
  },

  /**
   * Discharge a patient
   * @param {string} admissionId - Admission UUID
   * @param {Object} dischargeData - Discharge information
   * @returns {Promise} Response with updated admission
   */
  dischargePatient: async (admissionId, dischargeData) => {
    const response = await apiClient.post(`/ipd/admissions/${admissionId}/discharge`, dischargeData);
    return response.data;
  },

  // ==================== Clinical Documentation ====================

  /**
   * Create a progress note for an admission
   * @param {string} admissionId - Admission UUID
   * @param {Object} progressNoteData - Progress note data (form_id, form_data, notes)
   * @returns {Promise} Response with created progress note
   */
  createProgressNote: async (admissionId, progressNoteData) => {
    const response = await apiClient.post(`/ipd/admissions/${admissionId}/progress-notes`, progressNoteData);
    return response.data;
  },

  /**
   * Create a nursing assessment for an admission
   * @param {string} admissionId - Admission UUID
   * @param {Object} assessmentData - Nursing assessment data (form_id, form_data, notes)
   * @returns {Promise} Response with created nursing assessment
   */
  createNursingAssessment: async (admissionId, assessmentData) => {
    const response = await apiClient.post(`/ipd/admissions/${admissionId}/nursing-assessments`, assessmentData);
    return response.data;
  },

  /**
   * Get all clinical documentation for an admission
   * @param {string} admissionId - Admission UUID
   * @param {string} type - Optional filter by documentation type (PROGRESS_NOTE, NURSING_ASSESSMENT)
   * @returns {Promise} Response with clinical documentation
   */
  getClinicalDocumentation: async (admissionId, type = null) => {
    const params = type ? { type } : {};
    const response = await apiClient.get(`/ipd/admissions/${admissionId}/clinical-documentation`, { params });
    return response.data;
  },

  // ==================== Vitals ====================

  /**
   * Record vitals for an admission
   * @param {string} admissionId - Admission UUID
   * @param {Object} vitalsData - Vitals data
   * @returns {Promise} Response with created vitals record
   */
  recordVitals: async (admissionId, vitalsData) => {
    const response = await apiClient.post(`/ipd/admissions/${admissionId}/vitals`, vitalsData);
    return response.data;
  },

  /**
   * Get vitals history for an admission
   * @param {string} admissionId - Admission UUID
   * @param {number} limit - Number of records to return
   * @returns {Promise} Response with vitals history
   */
  getVitalsHistory: async (admissionId, limit = 50) => {
    const params = { limit };
    const response = await apiClient.get(`/ipd/admissions/${admissionId}/vitals`, { params });
    return response.data;
  },

  /**
   * Get all critical vitals
   * @param {number} hours - Number of hours to look back (default 24)
   * @returns {Promise} Response with critical vitals
   */
  getCriticalVitals: async (hours = 24) => {
    const params = { hours };
    const response = await apiClient.get('/ipd/vitals/critical', { params });
    return response.data;
  },

  // ==================== Waiting List ====================

  /**
   * Get bed waiting list
   * @param {string} status - Status filter (waiting, assigned, cancelled)
   * @param {string} priority - Priority filter (emergency, urgent, routine)
   * @param {string} bedType - Bed type filter
   * @returns {Promise} Response with waiting list
   */
  getWaitingList: async (status = 'waiting', priority = null, bedType = null) => {
    const params = { status };
    if (priority) params.priority = priority;
    if (bedType) params.bed_type = bedType;
    const response = await apiClient.get('/ipd/waiting-list', { params });
    return response.data;
  },

  /**
   * Add patient to waiting list
   * @param {Object} waitingListData - Waiting list entry data
   * @returns {Promise} Response with created waiting list entry
   */
  addToWaitingList: async (waitingListData) => {
    const response = await apiClient.post('/ipd/waiting-list', waitingListData);
    return response.data;
  },

  /**
   * Update waiting list entry
   * @param {string} waitingListId - Waiting list entry UUID
   * @param {Object} updateData - Updated data
   * @returns {Promise} Response with updated entry
   */
  updateWaitingList: async (waitingListId, updateData) => {
    const response = await apiClient.put(`/ipd/waiting-list/${waitingListId}`, updateData);
    return response.data;
  },

  // ==================== Helper Methods ====================

  /**
   * Get active admissions count
   * @returns {Promise} Response with count
   */
  getActiveAdmissionsCount: async () => {
    const response = await apiClient.get('/ipd/admissions', {
      params: { status: 'active', per_page: 1 }
    });
    return response.data.total || 0;
  },

  /**
   * Search available beds by type
   * @param {string} bedType - Type of bed (general, icu, etc.)
   * @param {string} wardName - Optional ward name filter
   * @returns {Promise} Response with available beds
   */
  searchAvailableBeds: async (bedType, wardName = null) => {
    const params = {
      bed_status: 'available',
      bed_type: bedType,
      per_page: 100
    };
    if (wardName) params.ward_name = wardName;
    const response = await apiClient.get('/ipd/beds', { params });
    return response.data;
  },

  /**
   * Get patient's current IPD admission
   * @param {string} patientId - Patient UUID
   * @returns {Promise} Response with current admission or null
   */
  getCurrentAdmission: async (patientId) => {
    const response = await apiClient.get('/ipd/admissions', {
      params: {
        patient_id: patientId,
        status: 'active',
        per_page: 1
      }
    });
    return response.data.admissions && response.data.admissions.length > 0
      ? response.data.admissions[0]
      : null;
  },

  /**
   * Get bed by number
   * @param {string} bedNumber - Bed number
   * @returns {Promise} Response with bed data or null
   */
  getBedByNumber: async (bedNumber) => {
    const response = await apiClient.get('/ipd/beds', {
      params: { bed_number: bedNumber, per_page: 1 }
    });
    return response.data.beds && response.data.beds.length > 0
      ? response.data.beds[0]
      : null;
  }
};

export default ipdApi;
