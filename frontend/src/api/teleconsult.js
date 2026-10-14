/**
 * Teleconsult API client.
 * Backend: backend/app/teleconsult/routes/sessions.py
 */
import apiClient from "./client";

const teleconsultApi = {
  initiateNow: async ({
    patient_id,
    provider_id,
    channel,
    record_call,
    notes,
  }) => {
    const { data } = await apiClient.post(
      "/teleconsult/sessions/initiate-now",
      {
        patient_id,
        provider_id,
        channel,
        record_call,
        notes,
      },
    );
    return data;
  },

  scheduleSession: async ({
    patient_id,
    provider_id,
    channel,
    scheduled_at,
    record_call,
    notes,
    linked_visit_id,
  }) => {
    const { data } = await apiClient.post("/teleconsult/sessions/schedule", {
      patient_id,
      provider_id,
      channel,
      scheduled_at,
      record_call,
      notes,
      linked_visit_id,
    });
    return data;
  },

  listSessions: async (params = {}) => {
    const { data } = await apiClient.get("/teleconsult/sessions", { params });
    return data.sessions || [];
  },

  thisWeek: async (params = {}) => {
    const { data } = await apiClient.get("/teleconsult/sessions/this-week", {
      params,
    });
    return data.sessions || [];
  },

  getSession: async (id, { includeTokens = false } = {}) => {
    const { data } = await apiClient.get(`/teleconsult/sessions/${id}`, {
      params: { include_tokens: includeTokens },
    });
    return data;
  },

  endSession: async (id) => {
    const { data } = await apiClient.post(`/teleconsult/sessions/${id}/end`);
    return data;
  },

  cancelSession: async (id, reason) => {
    const { data } = await apiClient.delete(`/teleconsult/sessions/${id}`, {
      data: { reason },
    });
    return data;
  },

  health: async () => {
    const { data } = await apiClient.get("/teleconsult/health");
    return data;
  },

  // On-duty
  getMyOnDuty: async () => {
    const { data } = await apiClient.get("/teleconsult/me/on-duty");
    return data;
  },
  setMyOnDuty: async (isOnDuty) => {
    const { data } = await apiClient.put("/teleconsult/me/on-duty", {
      is_on_duty: !!isOnDuty,
    });
    return data;
  },
  listOnDuty: async () => {
    const { data } = await apiClient.get("/teleconsult/on-duty");
    return data.on_duty || [];
  },
  getDocumentation: async (sessionId) => {
    const response = await apiClient.get(
      `/teleconsult/sessions/${sessionId}/documentation`,
    );
    return response.data;
  },

  saveDocumentation: async (sessionId, payload) => {
    const response = await apiClient.put(
      `/teleconsult/sessions/${sessionId}/documentation`,
      payload,
    );
    return response.data;
  },

  getDocumentationByVisit: async (visitId) => {
    const response = await apiClient.get(
      `/teleconsult/visits/${visitId}/documentation`,
    );
    return response.data;
  },

  saveDocumentationByVisit: async (visitId, payload) => {
    const response = await apiClient.put(
      `/teleconsult/visits/${visitId}/documentation`,
      payload,
    );
    return response.data;
  },
};

export default teleconsultApi;

