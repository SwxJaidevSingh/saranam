/**
 * Cohort API Service
 * Handles all API calls for patient cohort management
 */
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5002';

const getAuthHeader = () => {
  const token = localStorage.getItem('access_token');
  return { Authorization: `Bearer ${token}` };
};

/**
 * Create a new cohort
 */
export const createCohort = async (cohortData) => {
  const response = await axios.post(
    `${API_BASE_URL}/api/cohorts`,
    cohortData,
    { headers: getAuthHeader() }
  );
  return response.data;
};

/**
 * Get all cohorts
 */
export const getCohorts = async (isActive = true) => {
  const response = await axios.get(
    `${API_BASE_URL}/api/cohorts`,
    {
      headers: getAuthHeader(),
      params: { is_active: isActive }
    }
  );
  return response.data;
};

/**
 * Get a specific cohort with details
 */
export const getCohort = async (cohortId) => {
  const response = await axios.get(
    `${API_BASE_URL}/api/cohorts/${cohortId}`,
    { headers: getAuthHeader() }
  );
  return response.data;
};

/**
 * Update a cohort
 */
export const updateCohort = async (cohortId, updates) => {
  const response = await axios.put(
    `${API_BASE_URL}/api/cohorts/${cohortId}`,
    updates,
    { headers: getAuthHeader() }
  );
  return response.data;
};

/**
 * Delete a cohort
 */
export const deleteCohort = async (cohortId) => {
  const response = await axios.delete(
    `${API_BASE_URL}/api/cohorts/${cohortId}`,
    { headers: getAuthHeader() }
  );
  return response.data;
};

/**
 * Get patients in a cohort
 */
export const getCohortPatients = async (cohortId, page = 1, perPage = 50, stillQualifies = null) => {
  const params = { page, per_page: perPage };
  if (stillQualifies !== null) {
    params.still_qualifies = stillQualifies;
  }

  const response = await axios.get(
    `${API_BASE_URL}/api/cohorts/${cohortId}/patients`,
    {
      headers: getAuthHeader(),
      params
    }
  );
  return response.data;
};

/**
 * Recalculate cohort membership
 */
export const recalculateCohort = async (cohortId) => {
  const response = await axios.post(
    `${API_BASE_URL}/api/cohorts/${cohortId}/recalculate`,
    {},
    { headers: getAuthHeader() }
  );
  return response.data;
};

/**
 * Get outcome trends for a cohort
 */
export const getCohortOutcomes = async (cohortId, metricName, days = 90) => {
  const response = await axios.get(
    `${API_BASE_URL}/api/cohorts/${cohortId}/outcomes`,
    {
      headers: getAuthHeader(),
      params: { metric_name: metricName, days }
    }
  );
  return response.data;
};

/**
 * Export cohort patients to CSV
 */
export const exportCohortPatients = async (cohortId) => {
  // Get all patients (no pagination limit for export)
  const response = await getCohortPatients(cohortId, 1, 10000);

  // Convert to CSV
  const patients = response.patients;
  if (!patients || patients.length === 0) {
    throw new Error('No patients to export');
  }

  const headers = ['ID', 'First Name', 'Last Name', 'Email', 'Phone', 'Gender', 'Date of Birth', 'Joined At'];
  const rows = patients.map(p => [
    p.id,
    p.first_name,
    p.last_name,
    p.email,
    p.phone,
    p.gender,
    p.date_of_birth,
    p.joined_at
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell || ''}"`).join(','))
  ].join('\n');

  // Create download
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `cohort-${cohortId}-patients-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};
