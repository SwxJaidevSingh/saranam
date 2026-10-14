import apiClient from "./client";

const callLogsApi = {
  /**
   * Fetch all call logs from Exotel backend
   * @returns {Promise<Object>} Response with call logs
   */
  getCalls: async (params = {}) => {
    const response = await apiClient.get("/exotel/calls", { params });
    return response.data;
  },

  /**
   * Initiate an outbound call
   * @param {string} from - Provider's phone number
   * @param {string} to - Patient's phone number
   * @returns {Promise} Response from backend
   */
  makeCall: async (from, to, patientName, providerName) => {
    const response = await apiClient.post("/exotel/make-call", {
      from,
      to,
      patient_name: patientName,
      provider_name: providerName
    });
    return response.data;
  },

  /**
   * Fetch status of a specific call
   * @param {string} callSid - Exotel Call SID
   * @returns {Promise<Object>} Call status data
   */
  getCallStatus: async (callSid) => {
    const response = await apiClient.get(`/exotel/call-status/${callSid}`);
    return response.data;
  },

  /**
   * Fetch all agents (providers) with their persistent on-duty status
   * @returns {Promise<Array>} List of agents with status
   */
  getAgents: async () => {
    const response = await apiClient.get("/exotel/agents");
    return response.data;
  },

  /**
   * Update persistent on-duty status for an agent
   * @param {string} providerId - Provider UUID
   * @param {boolean} isOnDuty - New status
   * @returns {Promise<Object>} Updated status record
   */
  updateAgentStatus: async (provider_id, is_on_duty) => {
    const response = await apiClient.put('/exotel/agent-status', { provider_id, is_on_duty });
    return response.data;
  },

  /**
   * Save SOP documentation for a call
   * @param {Object} sopData 
   */
  saveSOP: async (sopData) => {
    const response = await apiClient.post('/exotel/sop', sopData);
    return response.data;
  },

  /**
   * Fetch all escalated SOP records
   * @returns {Promise<Object>} Response with escalations list
   */
  getEscalations: async () => {
    const response = await apiClient.get('/exotel/sop');
    return response.data;
  },

  /**
   * Fetch all SOP history records with pagination and filters
   * @param {Object} params - {start_date, end_date, page, per_page}
   * @returns {Promise<Object>} Response with SOP history items and total count
   */
  getSOPHistory: async (params = {}) => {
    const response = await apiClient.get('/exotel/sop/history', { params });
    return response.data;
  },

  /**
   * Fetch scheduled calls
   * @param {Object} params - {start_date, end_date}
   * @returns {Promise<Object>} Response with schedule list
   */
  getSchedule: async (params = {}) => {
    const response = await apiClient.get('/exotel/scheduler', { params });
    return response.data;
  },

  /**
   * Add a patient to the schedule
   * @param {Object} data - {patient_id, scheduled_date, notes}
   */
  addToSchedule: async (data) => {
    const response = await apiClient.post('/exotel/scheduler', data);
    return response.data;
  },

  /**
   * Remove a record from the schedule
   * @param {string} scheduleId - UUID of the schedule record
   */
  removeFromSchedule: async (scheduleId) => {
    const response = await apiClient.delete(`/exotel/scheduler/${scheduleId}`);
    return response.data;
  },

  /**
   * Automatically generate call schedules
   */
  autoGenerateSchedule: async () => {
    const response = await apiClient.post('/exotel/scheduler/auto-generate');
    return response.data;
  },

  /**
   * Send a customizable email to a patient
   * @param {string} patientId - Patient UUID
   * @param {string} subject - Email subject
   * @param {string} body - Email body
   */
  sendEmail: async (patientId, subject, body) => {
    const response = await apiClient.post('/exotel/send-email', {
      patient_id: patientId,
      subject,
      body
    });
    return response.data;
  }
};

export default callLogsApi;
