/**
 * Medicine catalog search used by prescription forms (OPD, Plan of Care, visits).
 * Returns medicine_master rows: id, medicine_name, generic_name, brand_name,
 * strength, strength_components, dosage_form.
 */
import apiClient from './client';

export const searchMedicines = async (query, limit = 10) => {
  const res = await apiClient.get('/inventory/medicines/search', { params: { q: query, limit } });
  return res.data || [];
};

export default searchMedicines;
