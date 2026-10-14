/**
 * Dedicated API client for Custom Analytics Reporting.
 * Located in frontend/src/api/reportApi.js alongside other system API services.
 */
import apiClient from './client';

export const reportApi = {
  /**
   * Fetch all available datasets, date fields, categories, and hospital catalog.
   */
  getDatasets: async () => {
    const response = await apiClient.get('/analytics/reports/datasets');
    return response.data?.data || response.data;
  },

  /**
   * Get preview data (sample 10 rows + dynamic visualization aggregations).
   */
  getPreview: async (payload) => {
    const response = await apiClient.post('/analytics/reports/preview', payload);
    return response.data?.data || response.data;
  },

  /**
   * Trigger direct file download for Excel (.xlsx) or CSV (.csv).
   */
  downloadReport: async (payload, format = 'csv') => {
    const response = await apiClient.post(
      '/analytics/reports/export',
      { ...payload, format },
      { responseType: 'blob' }
    );

    // Extract filename from response headers or build default
    let filename = `${payload.dataset || 'custom'}_report.${format}`;
    const disposition = response.headers?.['content-disposition'];
    if (disposition && disposition.indexOf('filename=') !== -1) {
      const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
      if (matches != null && matches[1]) {
        filename = matches[1].replace(/['"]/g, '');
      }
    }

    // Trigger browser file download
    const blob = new Blob([response.data], {
      type: format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv;charset=utf-8;'
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    return true;
  }
};

export default reportApi;
