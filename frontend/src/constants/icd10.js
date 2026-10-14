/**
 * Curated ICD-10 codes for palliative care.
 * Focused on cancers, chronic conditions, pain, and end-of-life diagnoses.
 * Format: { code, description }
 */

export const ICD10_CODES = [
  // ── Malignant Neoplasms (Cancers) ──────────────────────────────
  { code: 'C00', description: 'Malignant neoplasm of lip' },
  { code: 'C01', description: 'Malignant neoplasm of base of tongue' },
  { code: 'C02', description: 'Malignant neoplasm of other parts of tongue' },
  { code: 'C03', description: 'Malignant neoplasm of gum' },
  { code: 'C04', description: 'Malignant neoplasm of floor of mouth' },
  { code: 'C05', description: 'Malignant neoplasm of palate' },
  { code: 'C06', description: 'Malignant neoplasm of other parts of mouth' },
  { code: 'C07', description: 'Malignant neoplasm of parotid gland' },
  { code: 'C09', description: 'Malignant neoplasm of tonsil' },
  { code: 'C10', description: 'Malignant neoplasm of oropharynx' },
  { code: 'C11', description: 'Malignant neoplasm of nasopharynx' },
  { code: 'C12', description: 'Malignant neoplasm of piriform sinus' },
  { code: 'C13', description: 'Malignant neoplasm of hypopharynx' },
  { code: 'C15', description: 'Malignant neoplasm of oesophagus' },
  { code: 'C16', description: 'Malignant neoplasm of stomach' },
  { code: 'C17', description: 'Malignant neoplasm of small intestine' },
  { code: 'C18', description: 'Malignant neoplasm of colon' },
  { code: 'C19', description: 'Malignant neoplasm of rectosigmoid junction' },
  { code: 'C20', description: 'Malignant neoplasm of rectum' },
  { code: 'C22', description: 'Malignant neoplasm of liver' },
  { code: 'C23', description: 'Malignant neoplasm of gallbladder' },
  { code: 'C24', description: 'Malignant neoplasm of bile ducts' },
  { code: 'C25', description: 'Malignant neoplasm of pancreas' },
  { code: 'C30', description: 'Malignant neoplasm of nasal cavity' },
  { code: 'C32', description: 'Malignant neoplasm of larynx' },
  { code: 'C33', description: 'Malignant neoplasm of trachea' },
  { code: 'C34', description: 'Malignant neoplasm of bronchus and lung' },
  { code: 'C37', description: 'Malignant neoplasm of thymus' },
  { code: 'C38', description: 'Malignant neoplasm of heart and mediastinum' },
  { code: 'C40', description: 'Malignant neoplasm of bone (limbs)' },
  { code: 'C41', description: 'Malignant neoplasm of bone (other sites)' },
  { code: 'C43', description: 'Malignant melanoma of skin' },
  { code: 'C44', description: 'Other malignant neoplasms of skin' },
  { code: 'C45', description: 'Mesothelioma' },
  { code: 'C46', description: 'Kaposi sarcoma' },
  { code: 'C47', description: 'Malignant neoplasm of peripheral nerves' },
  { code: 'C48', description: 'Malignant neoplasm of retroperitoneum' },
  { code: 'C49', description: 'Malignant neoplasm of connective tissue' },
  { code: 'C50', description: 'Malignant neoplasm of breast' },
  { code: 'C51', description: 'Malignant neoplasm of vulva' },
  { code: 'C52', description: 'Malignant neoplasm of vagina' },
  { code: 'C53', description: 'Malignant neoplasm of cervix uteri' },
  { code: 'C54', description: 'Malignant neoplasm of corpus uteri' },
  { code: 'C56', description: 'Malignant neoplasm of ovary' },
  { code: 'C57', description: 'Malignant neoplasm of other female genital organs' },
  { code: 'C61', description: 'Malignant neoplasm of prostate' },
  { code: 'C62', description: 'Malignant neoplasm of testis' },
  { code: 'C64', description: 'Malignant neoplasm of kidney' },
  { code: 'C67', description: 'Malignant neoplasm of bladder' },
  { code: 'C68', description: 'Malignant neoplasm of urinary organs' },
  { code: 'C69', description: 'Malignant neoplasm of eye' },
  { code: 'C70', description: 'Malignant neoplasm of meninges' },
  { code: 'C71', description: 'Malignant neoplasm of brain' },
  { code: 'C72', description: 'Malignant neoplasm of spinal cord' },
  { code: 'C73', description: 'Malignant neoplasm of thyroid gland' },
  { code: 'C74', description: 'Malignant neoplasm of adrenal gland' },
  { code: 'C76', description: 'Malignant neoplasm of other ill-defined sites' },
  { code: 'C77', description: 'Secondary malignant neoplasm of lymph nodes' },
  { code: 'C78', description: 'Secondary malignant neoplasm of respiratory/digestive' },
  { code: 'C79', description: 'Secondary malignant neoplasm of other sites' },
  { code: 'C80', description: 'Malignant neoplasm without specification of site' },
  { code: 'C81', description: 'Hodgkin lymphoma' },
  { code: 'C82', description: 'Follicular lymphoma' },
  { code: 'C83', description: 'Non-follicular lymphoma' },
  { code: 'C84', description: 'Mature T/NK-cell lymphomas' },
  { code: 'C85', description: 'Non-Hodgkin lymphoma, unspecified' },
  { code: 'C90', description: 'Multiple myeloma' },
  { code: 'C91', description: 'Lymphoid leukaemia' },
  { code: 'C92', description: 'Myeloid leukaemia' },
  { code: 'C95', description: 'Leukaemia of unspecified cell type' },

  // ── GEJ / GI Specific ─────────────────────────────────────────
  { code: 'C16.0', description: 'Malignant neoplasm of cardia (GEJ carcinoma)' },

  // ── Pediatric Cancers ──────────────────────────────────────────
  { code: 'C91.0', description: 'Acute lymphoblastic leukaemia (ALL)' },
  { code: 'C47.9', description: 'Neuroblastoma, unspecified' },
  { code: 'C41.9', description: 'Ewing sarcoma' },
  { code: 'C64.9', description: 'Renal cell carcinoma' },
  { code: 'C60', description: 'Malignant neoplasm of penis' },

  // ── Pain & Symptom Management ──────────────────────────────────
  { code: 'G89.0', description: 'Central pain syndrome' },
  { code: 'G89.1', description: 'Acute pain, not elsewhere classified' },
  { code: 'G89.2', description: 'Chronic pain, not elsewhere classified' },
  { code: 'G89.3', description: 'Neoplasm related pain (acute/chronic)' },
  { code: 'G89.4', description: 'Chronic pain syndrome' },
  { code: 'R52', description: 'Pain, unspecified' },
  { code: 'M54.5', description: 'Low back pain' },
  { code: 'M79.3', description: 'Panniculitis (pain in limb)' },

  // ── Palliative Care Specific ───────────────────────────────────
  { code: 'Z51.5', description: 'Encounter for palliative care' },
  { code: 'Z51.0', description: 'Encounter for antineoplastic radiation therapy' },
  { code: 'Z51.1', description: 'Encounter for antineoplastic chemotherapy' },
  { code: 'R64', description: 'Cachexia (wasting syndrome)' },
  { code: 'R53.1', description: 'Weakness / Fatigue' },
  { code: 'R11', description: 'Nausea and vomiting' },
  { code: 'R06.0', description: 'Dyspnoea (breathlessness)' },
  { code: 'J96', description: 'Respiratory failure' },
  { code: 'K59.0', description: 'Constipation' },
  { code: 'R63.0', description: 'Anorexia (loss of appetite)' },
  { code: 'G47.0', description: 'Insomnia' },
  { code: 'F32', description: 'Depressive episode' },
  { code: 'F41', description: 'Anxiety disorders' },
  { code: 'R45.3', description: 'Demoralization and apathy' },
  { code: 'L89', description: 'Pressure ulcer (bedsore)' },
  { code: 'T14.1', description: 'Open wound, unspecified' },

  // ── Chronic Conditions ─────────────────────────────────────────
  { code: 'I10', description: 'Essential (primary) hypertension' },
  { code: 'E11', description: 'Type 2 diabetes mellitus' },
  { code: 'E10', description: 'Type 1 diabetes mellitus' },
  { code: 'I50', description: 'Heart failure' },
  { code: 'J44', description: 'Chronic obstructive pulmonary disease (COPD)' },
  { code: 'N18', description: 'Chronic kidney disease' },
  { code: 'K74', description: 'Fibrosis and cirrhosis of liver' },
  { code: 'G30', description: 'Alzheimer disease' },
  { code: 'G20', description: 'Parkinson disease' },
  { code: 'G35', description: 'Multiple sclerosis' },
  { code: 'B20', description: 'HIV disease' },

  // ── End of Life ────────────────────────────────────────────────
  { code: 'R99', description: 'Ill-defined and unknown cause of mortality' },
  { code: 'Z66', description: 'Do not resuscitate status' },
];

/**
 * Search ICD-10 codes by code or description.
 * Returns filtered list matching the query.
 */
export function searchICD10(query) {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();
  return ICD10_CODES.filter(
    (item) => item.code.toLowerCase().includes(q) || item.description.toLowerCase().includes(q)
  ).slice(0, 15);
}
