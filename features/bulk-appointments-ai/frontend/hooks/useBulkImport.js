/**
 * useBulkImport Hook
 * Custom React hook for managing bulk import state and operations
 */

import { useState, useCallback } from 'react';
import bulkAppointmentsApi from '../api/bulkAppointments';

export const useBulkImport = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentSession, setCurrentSession] = useState(null);
  const [extractedData, setExtractedData] = useState([]);
  const [validationResults, setValidationResults] = useState(null);
  const [conflictSuggestions, setConflictSuggestions] = useState(null);
  const [creationResults, setCreationResults] = useState(null);

  /**
   * Upload file and extract appointments
   */
  const uploadFile = useCallback(async (file, llmProvider = 'openai') => {
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('llm_provider', llmProvider);

      const response = await bulkAppointmentsApi.upload(formData);

      setCurrentSession(response.session_id);
      setExtractedData(response.extracted_data || []);

      return response;
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Failed to upload file';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Validate appointments
   */
  const validateAppointments = useCallback(async (sessionId, appointments = null) => {
    setLoading(true);
    setError(null);

    try {
      const data = {
        session_id: sessionId || currentSession,
        ...(appointments && { appointments })
      };

      const response = await bulkAppointmentsApi.validate(data);
      setValidationResults(response);

      // Update extracted data with validation results
      if (response.items) {
        setExtractedData(response.items);
      }

      return response;
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Validation failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [currentSession]);

  /**
   * Resolve conflicts with AI
   */
  const resolveConflicts = useCallback(async (sessionId, autoResolve = false) => {
    setLoading(true);
    setError(null);

    try {
      const response = await bulkAppointmentsApi.resolveConflicts({
        session_id: sessionId || currentSession,
        auto_resolve: autoResolve
      });

      setConflictSuggestions(response);
      return response;
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Conflict resolution failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [currentSession]);

  /**
   * Manually resolve a single conflict
   */
  const resolveConflictManually = useCallback(async (itemId, action, resolutionData) => {
    setLoading(true);
    setError(null);

    try {
      const response = await bulkAppointmentsApi.resolveManually({
        item_id: itemId,
        action,
        resolution_data: resolutionData
      });

      // Update extracted data with resolved item
      setExtractedData(prev =>
        prev.map(item =>
          item.id === itemId ? response.item : item
        )
      );

      return response;
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Manual resolution failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Create appointments
   */
  const createAppointments = useCallback(async (sessionId) => {
    setLoading(true);
    setError(null);

    try {
      const response = await bulkAppointmentsApi.create({
        session_id: sessionId || currentSession
      });

      setCreationResults(response);
      return response;
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Failed to create appointments';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [currentSession]);

  /**
   * Export results
   */
  const exportResults = useCallback(async (sessionId) => {
    setLoading(true);
    setError(null);

    try {
      const blob = await bulkAppointmentsApi.exportResults(sessionId || currentSession);

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `import_results_${sessionId || currentSession}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      return true;
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Export failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [currentSession]);

  /**
   * Rollback import
   */
  const rollbackImport = useCallback(async (sessionId, reason) => {
    setLoading(true);
    setError(null);

    try {
      const response = await bulkAppointmentsApi.rollback(sessionId || currentSession, reason);
      return response;
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Rollback failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [currentSession]);

  /**
   * Update extracted data (for editing)
   */
  const updateExtractedData = useCallback((updatedData) => {
    setExtractedData(updatedData);
  }, []);

  /**
   * Clear all state
   */
  const reset = useCallback(() => {
    setCurrentSession(null);
    setExtractedData([]);
    setValidationResults(null);
    setConflictSuggestions(null);
    setCreationResults(null);
    setError(null);
  }, []);

  /**
   * Get statistics from current data
   */
  const getStatistics = useCallback(() => {
    if (!extractedData.length) {
      return {
        total: 0,
        valid: 0,
        invalid: 0,
        conflicts: 0,
        created: 0,
        failed: 0
      };
    }

    return {
      total: extractedData.length,
      valid: extractedData.filter(item => item.is_valid).length,
      invalid: extractedData.filter(item => !item.is_valid).length,
      conflicts: extractedData.filter(item => item.conflict?.has_conflict).length,
      created: extractedData.filter(item => item.created_appointment_id).length,
      failed: extractedData.filter(item => item.error).length
    };
  }, [extractedData]);

  return {
    // State
    loading,
    error,
    currentSession,
    extractedData,
    validationResults,
    conflictSuggestions,
    creationResults,

    // Actions
    uploadFile,
    validateAppointments,
    resolveConflicts,
    resolveConflictManually,
    createAppointments,
    exportResults,
    rollbackImport,
    updateExtractedData,
    reset,

    // Computed
    statistics: getStatistics()
  };
};

export default useBulkImport;
