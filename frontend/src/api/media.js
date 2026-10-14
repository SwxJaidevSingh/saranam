import apiClient from './client';

const mediaApi = {
  /**
   * Upload an image to the media optimization endpoint.
   * Converts to AVIF on storage and receives optimized WebP URLs.
   * @param {File} file - Image file object.
   * @returns {Promise<{public_id, original_url, optimized_url, storage}>}
   */
  uploadImage: async (file) => {
    const formData = new FormData();
    formData.append('image', file);
    const response = await apiClient.post('/media/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }
};

export default mediaApi;
