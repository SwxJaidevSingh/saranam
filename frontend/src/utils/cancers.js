/**
 * Cancers Data Helper
 * 
 * Provides utility functions to load and parse the reusable cancer hierarchy
 * from the public directory (/cancers_by_body_location.json) and flatten it
 * for search autocomplete elements.
 */

let cachedFlatCancers = null;
let cachedHierarchy = null;

// Helper to flatten the hierarchical cancer database
export function flattenCancerHierarchy(data) {
  const result = [];
  if (!data || !data.cancers_by_body_location) return result;

  const locations = data.cancers_by_body_location;
  for (const [location, value] of Object.entries(locations)) {
    if (Array.isArray(value)) {
      value.forEach(cancer => {
        result.push({
          name: cancer,
          location: location,
          category: location,
          displayText: `${cancer} (${location})`
        });
      });
    } else if (typeof value === 'object' && value !== null) {
      for (const [subCategory, subValue] of Object.entries(value)) {
        if (Array.isArray(subValue)) {
          subValue.forEach(cancer => {
            result.push({
              name: cancer,
              location: location,
              subCategory: subCategory,
              category: `${location} - ${subCategory}`,
              displayText: `${cancer} (${location} - ${subCategory})`
            });
          });
        }
      }
    }
  }
  return result.sort((a, b) => a.name.localeCompare(b.name));
}

// Inline fallback of the flattened list in case network fetch fails
const FALLBACK_CANCERS = [
  { name: "AIDS-Related Lymphoma", location: "AIDS-Related", category: "AIDS-Related", displayText: "AIDS-Related Lymphoma (AIDS-Related)" },
  { name: "Primary Central Nervous System Lymphoma", location: "AIDS-Related", category: "AIDS-Related", displayText: "Primary Central Nervous System Lymphoma (AIDS-Related)" },
  { name: "Kaposi Sarcoma", location: "AIDS-Related", category: "AIDS-Related", displayText: "Kaposi Sarcoma (AIDS-Related)" },
  { name: "Breast Cancer", location: "Breast", category: "Breast", displayText: "Breast Cancer (Breast)" },
  { name: "Breast Cancer, Childhood", location: "Breast", category: "Breast", displayText: "Breast Cancer, Childhood (Breast)" },
  { name: "Breast Cancer and Pregnancy", location: "Breast", category: "Breast", displayText: "Breast Cancer and Pregnancy (Breast)" },
  { name: "Male Breast Cancer", location: "Breast", category: "Breast", displayText: "Male Breast Cancer (Breast)" },
  { name: "Anal Cancer", location: "Digestive/Gastrointestinal", category: "Digestive/Gastrointestinal", displayText: "Anal Cancer (Digestive/Gastrointestinal)" },
  { name: "Appendix Cancer", location: "Digestive/Gastrointestinal", category: "Digestive/Gastrointestinal", displayText: "Appendix Cancer (Digestive/Gastrointestinal)" },
  { name: "Bile Duct Cancer", location: "Digestive/Gastrointestinal", category: "Digestive/Gastrointestinal", displayText: "Bile Duct Cancer (Digestive/Gastrointestinal)" },
  { name: "Colon Cancer", location: "Digestive/Gastrointestinal", category: "Digestive/Gastrointestinal", displayText: "Colon Cancer (Digestive/Gastrointestinal)" },
  { name: "Esophageal Cancer", location: "Digestive/Gastrointestinal", category: "Digestive/Gastrointestinal", displayText: "Esophageal Cancer (Digestive/Gastrointestinal)" },
  { name: "Gallbladder Cancer", location: "Digestive/Gastrointestinal", category: "Digestive/Gastrointestinal", displayText: "Gallbladder Cancer (Digestive/Gastrointestinal)" },
  { name: "Gastric Cancer", location: "Digestive/Gastrointestinal", category: "Digestive/Gastrointestinal", displayText: "Gastric Cancer (Digestive/Gastrointestinal)" },
  { name: "Gastrointestinal Stromal Tumors (GIST)", location: "Digestive/Gastrointestinal", category: "Digestive/Gastrointestinal", displayText: "Gastrointestinal Stromal Tumors (GIST) (Digestive/Gastrointestinal)" },
  { name: "Islet Cell Tumors, Pancreatic Neuroendocrine Tumors", location: "Digestive/Gastrointestinal", category: "Digestive/Gastrointestinal", displayText: "Islet Cell Tumors, Pancreatic Neuroendocrine Tumors (Digestive/Gastrointestinal)" },
  { name: "Liver Cancer, Adult Primary", location: "Digestive/Gastrointestinal", category: "Digestive/Gastrointestinal", displayText: "Liver Cancer, Adult Primary (Digestive/Gastrointestinal)" },
  { name: "Liver Cancer, Childhood", location: "Digestive/Gastrointestinal", category: "Digestive/Gastrointestinal", displayText: "Liver Cancer, Childhood (Digestive/Gastrointestinal)" },
  { name: "Neuroendocrine Tumor, Gastrointestinal", location: "Digestive/Gastrointestinal", category: "Digestive/Gastrointestinal", displayText: "Neuroendocrine Tumor, Gastrointestinal (Digestive/Gastrointestinal)" },
  { name: "Pancreatic Cancer", location: "Digestive/Gastrointestinal", category: "Digestive/Gastrointestinal", displayText: "Pancreatic Cancer (Digestive/Gastrointestinal)" },
  { name: "Rectal Cancer", location: "Digestive/Gastrointestinal", category: "Digestive/Gastrointestinal", displayText: "Rectal Cancer (Digestive/Gastrointestinal)" },
  { name: "Small Intestine Cancer", location: "Digestive/Gastrointestinal", category: "Digestive/Gastrointestinal", displayText: "Small Intestine Cancer (Digestive/Gastrointestinal)" },
  { name: "Stomach (Gastric) Cancer", location: "Digestive/Gastrointestinal", category: "Digestive/Gastrointestinal", displayText: "Stomach (Gastric) Cancer (Digestive/Gastrointestinal)" },
  { name: "Synchronous Dual Primary Cancers", location: "Dual Malignancy", category: "Dual Malignancy", displayText: "Synchronous Dual Primary Cancers (Dual Malignancy)" },
  { name: "Metachronous Dual Primary Cancers", location: "Dual Malignancy", category: "Dual Malignancy", displayText: "Metachronous Dual Primary Cancers (Dual Malignancy)" },
  { name: "Multiple Primary Malignancies (MPM)", location: "Dual Malignancy", category: "Dual Malignancy", displayText: "Multiple Primary Malignancies (MPM) (Dual Malignancy)" },
  { name: "Adrenocortical Carcinoma", location: "Endocrine and Neuroendocrine", category: "Endocrine and Neuroendocrine", displayText: "Adrenocortical Carcinoma (Endocrine and Neuroendocrine)" },
  { name: "Islet Cell Tumors, Pancreatic Neuroendocrine Tumors", location: "Endocrine and Neuroendocrine", category: "Endocrine and Neuroendocrine", displayText: "Islet Cell Tumors, Pancreatic Neuroendocrine Tumors (Endocrine and Neuroendocrine)" },
  { name: "Neuroendocrine Carcinoma of the Skin (Merkel Cell Carcinoma)", location: "Endocrine and Neuroendocrine", category: "Endocrine and Neuroendocrine", displayText: "Neuroendocrine Carcinoma of the Skin (Merkel Cell Carcinoma) (Endocrine and Neuroendocrine)" },
  { name: "Neuroendocrine Tumor, Gastrointestinal", location: "Endocrine and Neuroendocrine", category: "Endocrine and Neuroendocrine", displayText: "Neuroendocrine Tumor, Gastrointestinal (Endocrine and Neuroendocrine)" },
  { name: "Parathyroid Cancer", location: "Endocrine and Neuroendocrine", category: "Endocrine and Neuroendocrine", displayText: "Parathyroid Cancer (Endocrine and Neuroendocrine)" },
  { name: "Paraganglioma", location: "Endocrine and Neuroendocrine", category: "Endocrine and Neuroendocrine", displayText: "Paraganglioma (Endocrine and Neuroendocrine)" },
  { name: "Pheochromocytoma", location: "Endocrine and Neuroendocrine", category: "Endocrine and Neuroendocrine", displayText: "Pheochromocytoma (Endocrine and Neuroendocrine)" },
  { name: "Pituitary Tumor", location: "Endocrine and Neuroendocrine", category: "Endocrine and Neuroendocrine", displayText: "Pituitary Tumor (Endocrine and Neuroendocrine)" },
  { name: "Thyroid Cancer", location: "Endocrine and Neuroendocrine", category: "Endocrine and Neuroendocrine", displayText: "Thyroid Cancer (Endocrine and Neuroendocrine)" },
  { name: "Melanoma, Intraocular", location: "Eye", category: "Eye", displayText: "Melanoma, Intraocular (Eye)" },
  { name: "Retinoblastoma", location: "Eye", category: "Eye", displayText: "Retinoblastoma (Eye)" },
  { name: "Bladder Cancer", location: "Genitourinary", category: "Genitourinary", displayText: "Bladder Cancer (Genitourinary)" },
  { name: "Kidney (Renal Cell) Cancer", location: "Genitourinary", category: "Genitourinary", displayText: "Kidney (Renal Cell) Cancer (Genitourinary)" },
  { name: "Penile Cancer", location: "Genitourinary", category: "Genitourinary", displayText: "Penile Cancer (Genitourinary)" },
  { name: "Prostate Cancer", location: "Genitourinary", category: "Genitourinary", displayText: "Prostate Cancer (Genitourinary)" },
  { name: "Renal Pelvis and Ureter Cancer, Transitional Cell", location: "Genitourinary", category: "Genitourinary", displayText: "Renal Pelvis and Ureter Cancer, Transitional Cell (Genitourinary)" },
  { name: "Testicular Cancer", location: "Genitourinary", category: "Genitourinary", displayText: "Testicular Cancer (Genitourinary)" },
  { name: "Urethral Cancer", location: "Genitourinary", category: "Genitourinary", displayText: "Urethral Cancer (Genitourinary)" },
  { name: "Wilms Tumor and Other Childhood Kidney Tumors", location: "Genitourinary", category: "Genitourinary", displayText: "Wilms Tumor and Other Childhood Kidney Tumors (Genitourinary)" },
  { name: "Central Nervous System, Childhood", location: "Germ Cell", category: "Germ Cell", displayText: "Central Nervous System, Childhood (Germ Cell)" },
  { name: "Extracranial Germ Cell Tumor, Childhood", location: "Germ Cell", category: "Germ Cell", displayText: "Extracranial Germ Cell Tumor, Childhood (Germ Cell)" },
  { name: "Extragonadal Germ Cell Tumor", location: "Germ Cell", category: "Germ Cell", displayText: "Extragonadal Germ Cell Tumor (Germ Cell)" },
  { name: "Ovarian Germ Cell Tumor", location: "Germ Cell", category: "Germ Cell", displayText: "Ovarian Germ Cell Tumor (Germ Cell)" },
  { name: "Testicular Cancer", location: "Germ Cell", category: "Germ Cell", displayText: "Testicular Cancer (Germ Cell)" },
  { name: "Cervical Cancer", location: "Gynecologic", category: "Gynecologic", displayText: "Cervical Cancer (Gynecologic)" },
  { name: "Endometrial Cancer", location: "Gynecologic", category: "Gynecologic", displayText: "Endometrial Cancer (Gynecologic)" },
  { name: "Fallopian Tube Cancer", location: "Gynecologic", category: "Gynecologic", displayText: "Fallopian Tube Cancer (Gynecologic)" },
  { name: "Gestational Trophoblastic Tumor", location: "Gynecologic", category: "Gynecologic", displayText: "Gestational Trophoblastic Tumor (Gynecologic)" },
  { name: "Ovarian Epithelial Cancer", location: "Gynecologic", category: "Gynecologic", displayText: "Ovarian Epithelial Cancer (Gynecologic)" },
  { name: "Ovarian Germ Cell Tumor", location: "Gynecologic", category: "Gynecologic", displayText: "Ovarian Germ Cell Tumor (Gynecologic)" },
  { name: "Ovarian Low Malignant Potential Tumor", location: "Gynecologic", category: "Gynecologic", displayText: "Ovarian Low Malignant Potential Tumor (Gynecologic)" },
  { name: "Primary Peritoneal Cancer", location: "Gynecologic", category: "Gynecologic", displayText: "Primary Peritoneal Cancer (Gynecologic)" },
  { name: "Uterine Sarcoma", location: "Gynecologic", category: "Gynecologic", displayText: "Uterine Sarcoma (Gynecologic)" },
  { name: "Vaginal Cancer", location: "Gynecologic", category: "Gynecologic", displayText: "Vaginal Cancer (Gynecologic)" },
  { name: "Vulvar Cancer", location: "Gynecologic", category: "Gynecologic", displayText: "Vulvar Cancer (Gynecologic)" },
  { name: "Hypopharyngeal Cancer", location: "Head and Neck", category: "Head and Neck", displayText: "Hypopharyngeal Cancer (Head and Neck)" },
  { name: "Laryngeal Cancer", location: "Head and Neck", category: "Head and Neck", displayText: "Laryngeal Cancer (Head and Neck)" },
  { name: "Lip and Oral Cavity Cancer", location: "Head and Neck", category: "Head and Neck", displayText: "Lip and Oral Cavity Cancer (Head and Neck)" },
  { name: "Metastatic Squamous Neck Cancer with Occult Primary", location: "Head and Neck", category: "Head and Neck", displayText: "Metastatic Squamous Neck Cancer with Occult Primary (Head and Neck)" },
  { name: "Mouth Cancer", location: "Head and Neck", category: "Head and Neck", displayText: "Mouth Cancer (Head and Neck)" },
  { name: "Nasopharyngeal Cancer", location: "Head and Neck", category: "Head and Neck", displayText: "Nasopharyngeal Cancer (Head and Neck)" },
  { name: "Oral Cavity Cancer, Lip and Oropharyngeal Cancer", location: "Head and Neck", category: "Head and Neck", displayText: "Oral Cavity Cancer, Lip and Oropharyngeal Cancer (Head and Neck)" },
  { name: "Paranasal Sinus and Nasal Cavity Cancer", location: "Head and Neck", category: "Head and Neck", displayText: "Paranasal Sinus and Nasal Cavity Cancer (Head and Neck)" },
  { name: "Parathyroid Cancer", location: "Head and Neck", category: "Head and Neck", displayText: "Parathyroid Cancer (Head and Neck)" },
  { name: "Pharyngeal Cancer", location: "Head and Neck", category: "Head and Neck", displayText: "Pharyngeal Cancer (Head and Neck)" },
  { name: "Salivary Gland Cancer", location: "Head and Neck", category: "Head and Neck", displayText: "Salivary Gland Cancer (Head and Neck)" },
  { name: "Throat Cancer", location: "Head and Neck", category: "Head and Neck", displayText: "Throat Cancer (Head and Neck)" },
  { name: "Thyroid Cancer", location: "Head and Neck", category: "Head and Neck", displayText: "Thyroid Cancer (Head and Neck)" },
  { name: "Acute Lymphoblastic Leukemia, Adult", location: "Hematologic/Blood", subCategory: "Leukemia", category: "Hematologic/Blood - Leukemia", displayText: "Acute Lymphoblastic Leukemia, Adult (Hematologic/Blood - Leukemia)" },
  { name: "Acute Lymphoblastic Leukemia, Childhood", location: "Hematologic/Blood", subCategory: "Leukemia", category: "Hematologic/Blood - Leukemia", displayText: "Acute Lymphoblastic Leukemia, Childhood (Hematologic/Blood - Leukemia)" },
  { name: "Acute Myeloid Leukemia, Adult", location: "Hematologic/Blood", subCategory: "Leukemia", category: "Hematologic/Blood - Leukemia", displayText: "Acute Myeloid Leukemia, Adult (Hematologic/Blood - Leukemia)" },
  { name: "Acute Myeloid Leukemia, Childhood", location: "Hematologic/Blood", subCategory: "Leukemia", category: "Hematologic/Blood - Leukemia", displayText: "Acute Myeloid Leukemia, Childhood (Hematologic/Blood - Leukemia)" },
  { name: "Chronic Lymphocytic Leukemia", location: "Hematologic/Blood", subCategory: "Leukemia", category: "Hematologic/Blood - Leukemia", displayText: "Chronic Lymphocytic Leukemia (Hematologic/Blood - Leukemia)" },
  { name: "Chronic Myelogenous Leukemia", location: "Hematologic/Blood", subCategory: "Leukemia", category: "Hematologic/Blood - Leukemia", displayText: "Chronic Myelogenous Leukemia (Hematologic/Blood - Leukemia)" },
  { name: "Hairy Cell Leukemia", location: "Hematologic/Blood", subCategory: "Leukemia", category: "Hematologic/Blood - Leukemia", displayText: "Hairy Cell Leukemia (Hematologic/Blood - Leukemia)" },
  { name: "AIDS-Related Lymphoma", location: "Hematologic/Blood", subCategory: "Lymphoma", category: "Hematologic/Blood - Lymphoma", displayText: "AIDS-Related Lymphoma (Hematologic/Blood - Lymphoma)" },
  { name: "Cutaneous T-Cell Lymphoma", location: "Hematologic/Blood", subCategory: "Lymphoma", category: "Hematologic/Blood - Lymphoma", displayText: "Cutaneous T-Cell Lymphoma (Hematologic/Blood - Lymphoma)" },
  { name: "Hodgkin Lymphoma, Adult", location: "Hematologic/Blood", subCategory: "Lymphoma", category: "Hematologic/Blood - Lymphoma", displayText: "Hodgkin Lymphoma, Adult (Hematologic/Blood - Lymphoma)" },
  { name: "Hodgkin Lymphoma, Childhood", location: "Hematologic/Blood", subCategory: "Lymphoma", category: "Hematologic/Blood - Lymphoma", displayText: "Hodgkin Lymphoma, Childhood (Hematologic/Blood - Lymphoma)" },
  { name: "Hodgkin Lymphoma During Pregnancy", location: "Hematologic/Blood", subCategory: "Lymphoma", category: "Hematologic/Blood - Lymphoma", displayText: "Hodgkin Lymphoma During Pregnancy (Hematologic/Blood - Lymphoma)" },
  { name: "Mycosis Fungoides", location: "Hematologic/Blood", subCategory: "Lymphoma", category: "Hematologic/Blood - Lymphoma", displayText: "Mycosis Fungoides (Hematologic/Blood - Lymphoma)" },
  { name: "Non-Hodgkin Lymphoma, Adult", location: "Hematologic/Blood", subCategory: "Lymphoma", category: "Hematologic/Blood - Lymphoma", displayText: "Non-Hodgkin Lymphoma, Adult (Hematologic/Blood - Lymphoma)" },
  { name: "Non-Hodgkin Lymphoma, Childhood", location: "Hematologic/Blood", subCategory: "Lymphoma", category: "Hematologic/Blood - Lymphoma", displayText: "Non-Hodgkin Lymphoma, Childhood (Hematologic/Blood - Lymphoma)" },
  { name: "Non-Hodgkin Lymphoma During Pregnancy", location: "Hematologic/Blood", subCategory: "Lymphoma", category: "Hematologic/Blood - Lymphoma", displayText: "Non-Hodgkin Lymphoma During Pregnancy (Hematologic/Blood - Lymphoma)" },
  { name: "Primary Central Nervous System Lymphoma", location: "Hematologic/Blood", subCategory: "Lymphoma", category: "Hematologic/Blood - Lymphoma", displayText: "Primary Central Nervous System Lymphoma (Hematologic/Blood - Lymphoma)" },
  { name: "Sézary Syndrome", location: "Hematologic/Blood", subCategory: "Lymphoma", category: "Hematologic/Blood - Lymphoma", displayText: "Sézary Syndrome (Hematologic/Blood - Lymphoma)" },
  { name: "Waldenström Macroglobulinemia", location: "Hematologic/Blood", subCategory: "Lymphoma", category: "Hematologic/Blood - Lymphoma", displayText: "Waldenström Macroglobulinemia (Hematologic/Blood - Lymphoma)" },
  { name: "Chronic Myeloproliferative Neoplasms", location: "Hematologic/Blood", subCategory: "Other Hematologic/Blood Cancers", category: "Hematologic/Blood - Other Hematologic/Blood Cancers", displayText: "Chronic Myeloproliferative Neoplasms (Hematologic/Blood - Other Hematologic/Blood Cancers)" },
  { name: "Langerhans Cell Histiocytosis", location: "Hematologic/Blood", subCategory: "Other Hematologic/Blood Cancers", category: "Hematologic/Blood - Other Hematologic/Blood Cancers", displayText: "Langerhans Cell Histiocytosis (Hematologic/Blood - Other Hematologic/Blood Cancers)" },
  { name: "Multiple Myeloma/Plasma Cell Neoplasm", location: "Hematologic/Blood", subCategory: "Other Hematologic/Blood Cancers", category: "Hematologic/Blood - Other Hematologic/Blood Cancers", displayText: "Multiple Myeloma/Plasma Cell Neoplasm (Hematologic/Blood - Other Hematologic/Blood Cancers)" },
  { name: "Myelodysplastic Syndromes", location: "Hematologic/Blood", subCategory: "Other Hematologic/Blood Cancers", category: "Hematologic/Blood - Other Hematologic/Blood Cancers", displayText: "Myelodysplastic Syndromes (Hematologic/Blood - Other Hematologic/Blood Cancers)" },
  { name: "Myelodysplastic/Myeloproliferative Neoplasms", location: "Hematologic/Blood", subCategory: "Other Hematologic/Blood Cancers", category: "Hematologic/Blood - Other Hematologic/Blood Cancers", displayText: "Myelodysplastic/Myeloproliferative Neoplasms (Hematologic/Blood - Other Hematologic/Blood Cancers)" },
  { name: "Ewing Sarcoma", location: "Musculoskeletal", subCategory: "Bone Cancer", category: "Musculoskeletal - Bone Cancer", displayText: "Ewing Sarcoma (Musculoskeletal - Bone Cancer)" },
  { name: "Osteosarcoma and Undifferentiated Pleomorphic Sarcoma of Bone", location: "Musculoskeletal", subCategory: "Bone Cancer", category: "Musculoskeletal - Bone Cancer", displayText: "Osteosarcoma and Undifferentiated Pleomorphic Sarcoma of Bone (Musculoskeletal - Bone Cancer)" },
  { name: "Chordoma", location: "Musculoskeletal", subCategory: "Bone Cancer", category: "Musculoskeletal - Bone Cancer", displayText: "Chordoma (Musculoskeletal - Bone Cancer)" },
  { name: "Rhabdomyosarcoma, Childhood", location: "Musculoskeletal", subCategory: "Other Musculoskeletal", category: "Musculoskeletal - Other Musculoskeletal", displayText: "Rhabdomyosarcoma, Childhood (Musculoskeletal - Other Musculoskeletal)" },
  { name: "Soft Tissue Sarcoma", location: "Musculoskeletal", subCategory: "Other Musculoskeletal", category: "Musculoskeletal - Other Musculoskeletal", displayText: "Soft Tissue Sarcoma (Musculoskeletal - Other Musculoskeletal)" },
  { name: "Astrocytomas", location: "Neurologic", subCategory: "Brain Tumor", category: "Neurologic - Brain Tumor", displayText: "Astrocytomas (Neurologic - Brain Tumor)" },
  { name: "Brain Stem Glioma", location: "Neurologic", subCategory: "Brain Tumor", category: "Neurologic - Brain Tumor", displayText: "Brain Stem Glioma (Neurologic - Brain Tumor)" },
  { name: "Central Nervous System Atypical Teratoid/Rhabdoid Tumor", location: "Neurologic", subCategory: "Brain Tumor", category: "Neurologic - Brain Tumor", displayText: "Central Nervous System Atypical Teratoid/Rhabdoid Tumor (Neurologic - Brain Tumor)" },
  { name: "Medulloblastoma and Other Central Nervous System Embryonal Tumors", location: "Neurologic", subCategory: "Brain Tumor", category: "Neurologic - Brain Tumor", displayText: "Medulloblastoma and Other Central Nervous System Embryonal Tumors (Neurologic - Brain Tumor)" },
  { name: "Central Nervous System Germ Cell Tumors", location: "Neurologic", subCategory: "Brain Tumor", category: "Neurologic - Brain Tumor", displayText: "Central Nervous System Germ Cell Tumors (Neurologic - Brain Tumor)" },
  { name: "Craniopharyngioma", location: "Neurologic", subCategory: "Brain Tumor", category: "Neurologic - Brain Tumor", displayText: "Craniopharyngioma (Neurologic - Brain Tumor)" },
  { name: "Ependymoma", location: "Neurologic", subCategory: "Brain Tumor", category: "Neurologic - Brain Tumor", displayText: "Ependymoma (Neurologic - Brain Tumor)" },
  { name: "Neuroblastoma", location: "Neurologic", subCategory: "Other Neurologic", category: "Neurologic - Other Neurologic", displayText: "Neuroblastoma (Neurologic - Other Neurologic)" },
  { name: "Pituitary Tumor", location: "Neurologic", subCategory: "Other Neurologic", category: "Neurologic - Other Neurologic", displayText: "Pituitary Tumor (Neurologic - Other Neurologic)" },
  { name: "Primary Central Nervous System (CNS) Lymphoma", location: "Neurologic", subCategory: "Other Neurologic", category: "Neurologic - Other Neurologic", displayText: "Primary Central Nervous System (CNS) Lymphoma (Neurologic - Other Neurologic)" },
  { name: "Lung Cancer, Non-Small Cell", location: "Respiratory/Thoracic", category: "Respiratory/Thoracic", displayText: "Lung Cancer, Non-Small Cell (Respiratory/Thoracic)" },
  { name: "Lung Cancer, Small Cell", location: "Respiratory/Thoracic", category: "Respiratory/Thoracic", displayText: "Lung Cancer, Small Cell (Respiratory/Thoracic)" },
  { name: "Pleuropulmonary Blastoma, Childhood", location: "Respiratory/Thoracic", category: "Respiratory/Thoracic", displayText: "Pleuropulmonary Blastoma, Childhood (Respiratory/Thoracic)" },
  { name: "Tracheobronchial Tumors, Childhood", location: "Respiratory/Thoracic", category: "Respiratory/Thoracic", displayText: "Tracheobronchial Tumors, Childhood (Respiratory/Thoracic)" },
  { name: "Mesothelioma", location: "Respiratory/Thoracic", category: "Respiratory/Thoracic", displayText: "Mesothelioma (Respiratory/Thoracic)" },
  { name: "Thymus Cancer (Thymoma and Thymic Carcinoma)", location: "Respiratory/Thoracic", category: "Respiratory/Thoracic", displayText: "Thymus Cancer (Thymoma and Thymic Carcinoma) (Respiratory/Thoracic)" },
  { name: "Cutaneous T-Cell Lymphoma", location: "Skin", category: "Skin", displayText: "Cutaneous T-Cell Lymphoma (Skin)" },
  { name: "Kaposi Sarcoma", location: "Skin", category: "Skin", displayText: "Kaposi Sarcoma (Skin)" },
  { name: "Melanoma", location: "Skin", category: "Skin", displayText: "Melanoma (Skin)" },
  { name: "Merkel Cell Carcinoma", location: "Skin", category: "Skin", displayText: "Merkel Cell Carcinoma (Skin)" },
  { name: "Skin Cancer", location: "Skin", category: "Skin", displayText: "Skin Cancer (Skin)" },
  { name: "Sézary Syndrome", location: "Skin", category: "Skin", displayText: "Sézary Syndrome (Skin)" },
  { name: "Carcinoma of Unknown Primary", location: "Unknown Primary", category: "Unknown Primary", displayText: "Carcinoma of Unknown Primary (Unknown Primary)" }
];

// Async function to load cancer database
export async function getCancers() {
  if (cachedFlatCancers) {
    return cachedFlatCancers;
  }

  try {
    const res = await fetch('/cancers_by_body_location.json');
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    cachedHierarchy = data;
    cachedFlatCancers = flattenCancerHierarchy(data);
    return cachedFlatCancers;
  } catch (error) {
    console.warn("Failed to fetch cancers_by_body_location.json, using fallback: ", error);
    cachedFlatCancers = FALLBACK_CANCERS;
    return FALLBACK_CANCERS;
  }
}

// Synchronous fetch of hierarchy if already loaded, or fallback
export function getCancersSync() {
  return cachedFlatCancers || FALLBACK_CANCERS;
}
