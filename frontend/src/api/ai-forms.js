import apiClient from './client';

const aiFormsApi = {
  /**
   * Generate or refine form using AI
   * @param {Object} data - Generation request data
   * @param {string} data.llm_provider - "openai", "anthropic", or "gemini"
   * @param {string} data.llm_model - Model name (optional)
   * @param {string} data.api_key - User's API key
   * @param {string} data.mode - "general" or "healthcare"
   * @param {string} data.user_message - User's prompt
   * @param {Array} data.conversation_history - Previous messages (optional)
   * @param {Object} data.current_schema - Current form schema for refinement (optional)
   * @returns {Promise<Object>} Response with session_id, message, schema, suggestions
   */
  generate: async (data) => {
    const response = await apiClient.post('/ai-forms/generate', data);
    return response.data;
  },

  /**
   * Refine existing AI-generated form
   * @param {string} sessionId - AI session ID
   * @param {string} message - User's refinement request
   * @param {string} apiKey - User's API key
   * @returns {Promise<Object>} Response with updated schema
   */
  refine: async (sessionId, message, apiKey) => {
    const response = await apiClient.post('/ai-forms/refine', {
      session_id: sessionId,
      user_message: message,
      api_key: apiKey
    });
    return response.data;
  },

  /**
   * Save AI-generated form to database
   * @param {Object} data - Finalization data
   * @param {string} data.session_id - AI session ID
   * @param {string} data.form_name - Form name (optional)
   * @param {string} data.form_description - Form description (optional)
   * @returns {Promise<Object>} Response with form_id
   */
  finalize: async (data) => {
    const response = await apiClient.post('/ai-forms/finalize', data);
    return response.data;
  },

  /**
   * Get AI session details
   * @param {string} sessionId - AI session ID
   * @returns {Promise<Object>} Session details
   */
  getSession: async (sessionId) => {
    const response = await apiClient.get(`/ai-forms/sessions/${sessionId}`);
    return response.data;
  },

  /**
   * Abandon AI session
   * @param {string} sessionId - AI session ID
   * @returns {Promise<Object>} Success message
   */
  abandonSession: async (sessionId) => {
    const response = await apiClient.delete(`/ai-forms/sessions/${sessionId}`);
    return response.data;
  },

  /**
   * List user's AI sessions
   * @param {Object} params - Query parameters
   * @param {string} params.status - Filter by status (optional)
   * @param {number} params.limit - Max results (optional, default 10)
   * @returns {Promise<Object>} List of sessions
   */
  listSessions: async (params = {}) => {
    const response = await apiClient.get('/ai-forms/sessions', { params });
    return response.data;
  },

  /**
   * Generate a form template using AI
   * @param {Object} data - Template generation request
   * @param {string} data.llm_provider - LLM provider
   * @param {string} data.llm_model - Model name (optional)
   * @param {string} data.api_key - User's API key
   * @param {string} data.mode - "general" or "healthcare"
   * @param {string} data.user_message - Template description
   * @returns {Promise<Object>} Response with metadata and schema
   */
  generateTemplate: async (data) => {
    const response = await apiClient.post('/ai-templates/generate', data);
    return response.data;
  },

  /**
   * Save generated template to library
   * @param {Object} data - Template save data
   * @param {string} data.session_id - AI session ID
   * @param {string} data.name - Template name
   * @param {string} data.category - Template category
   * @param {string} data.description - Template description
   * @param {Array} data.use_cases - Use cases (optional)
   * @param {string} data.target_users - Target users (optional)
   * @param {boolean} data.is_public - Make public (optional, default true)
   * @returns {Promise<Object>} Response with template_id
   */
  saveTemplate: async (data) => {
    const response = await apiClient.post('/ai-templates/save', data);
    return response.data;
  }
};

export default aiFormsApi;
