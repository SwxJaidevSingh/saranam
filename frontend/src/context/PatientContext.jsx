/**
 * Patient Context
 * Provides patient state management across the application
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import patientsApi from '../api/patients';

const PatientContext = createContext();

export const usePatient = () => {
  const context = useContext(PatientContext);
  if (!context) {
    throw new Error('usePatient must be used within a PatientProvider');
  }
  return context;
};

export const PatientProvider = ({ children }) => {
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [recentPatients, setRecentPatients] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Select a patient for form submission or viewing
   */
  const selectPatient = useCallback((patient) => {
    setSelectedPatient(patient);
    // Add to recent patients if not already there
    if (patient && !recentPatients.find(p => p.id === patient.id)) {
      setRecentPatients(prev => [patient, ...prev.slice(0, 9)]); // Keep last 10
    }
  }, [recentPatients]);

  /**
   * Clear selected patient
   */
  const clearSelectedPatient = useCallback(() => {
    setSelectedPatient(null);
  }, []);

  /**
   * Search patients by query
   */
  const searchPatients = useCallback(async (query, page = 1, perPage = 20, bscStatus = null, geographicCluster = '', isOnco = null, isContacted = null, sortBy = 'created_at', sortOrder = 'desc') => {
    setLoading(true);
    setError(null);
    try {
      const data = await patientsApi.search(query, page, perPage, bscStatus, geographicCluster, isOnco, isContacted, sortBy, sortOrder);
      setSearchResults(data.patients || []);
      return data;
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to search patients');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Get patient by ID
   */
  const getPatient = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      const patient = await patientsApi.getById(id);
      return patient;
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch patient');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Create a new patient
   */
  const createPatient = useCallback(async (patientData) => {
    setLoading(true);
    setError(null);
    try {
      const patient = await patientsApi.create(patientData);
      // Automatically select the newly created patient
      setSelectedPatient(patient);
      // Add to recent patients
      setRecentPatients(prev => [patient, ...prev.slice(0, 9)]);
      return patient;
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create patient');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Update an existing patient
   */
  const updatePatient = useCallback(async (id, patientData) => {
    setLoading(true);
    setError(null);
    try {
      const patient = await patientsApi.update(id, patientData);
      // Update selected patient if it's the one being updated
      if (selectedPatient?.id === id) {
        setSelectedPatient(patient);
      }
      return patient;
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update patient');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [selectedPatient]);

  /**
   * Load recent patients from API
   */
  const loadRecentPatients = useCallback(async (limit = 10) => {
    setLoading(true);
    setError(null);
    try {
      const data = await patientsApi.getRecent(limit);
      setRecentPatients(data.patients || []);
      return data.patients;
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load recent patients');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Get patient submissions
   */
  const getPatientSubmissions = useCallback(async (id, page = 1, perPage = 20) => {
    setLoading(true);
    setError(null);
    try {
      const data = await patientsApi.getSubmissions(id, page, perPage);
      return data;
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load patient submissions');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Check for duplicate patient
   */
  const checkDuplicate = useCallback(async (checkParams) => {
    try {
      const data = await patientsApi.checkDuplicate(checkParams);
      return data;
    } catch (err) {
      console.error('Duplicate check failed:', err);
      return { duplicate_found: false };
    }
  }, []);

  const value = {
    // State
    selectedPatient,
    recentPatients,
    searchResults,
    loading,
    error,

    // Actions
    selectPatient,
    clearSelectedPatient,
    searchPatients,
    getPatient,
    createPatient,
    updatePatient,
    loadRecentPatients,
    getPatientSubmissions,
    checkDuplicate
  };

  return (
    <PatientContext.Provider value={value}>
      {children}
    </PatientContext.Provider>
  );
};

export default PatientContext;
