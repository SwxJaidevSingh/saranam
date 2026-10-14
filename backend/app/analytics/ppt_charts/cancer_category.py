"""
Backend service for Cancer Category Bifurcation (Oncology) Analysis.
Decoupled PPT Charts service.
Bifurcates patients based on the `diagnosis` field in the Patient table into:
1. Digestive/Gastrointestinal cancer
2. Gynaecological cancer
3. Head And Neck cancer
4. Breast
5. Respiratory/Thoracic cancer
6. Genitourinary cancer
7. Hematological/Blood cancer
8. Others
"""

from typing import Dict, Any, List
from app.extensions import db
from app.patients.models import Patient
from .shared.filters.patient_filters import (
    apply_patient_filters,
    apply_date_range_filter,
    parse_filter_params,
)

CANCER_CATEGORIES = [
    {
        'name': 'Digestive/Gastrointestinal cancer',
        'color': '#2f65b9',
        'order': 1,
    },
    {
        'name': 'Gynaecological cancer',
        'color': '#ea580c',
        'order': 2,
    },
    {
        'name': 'Head And Neck cancer',
        'color': '#94a3b8',
        'order': 3,
    },
    {
        'name': 'Breast',
        'color': '#f59e0b',
        'order': 4,
    },
    {
        'name': 'Respiratory/Thoracic cancer',
        'color': '#38bdf8',
        'order': 5,
    },
    {
        'name': 'Genitourinary cancer',
        'color': '#65a30d',
        'order': 6,
    },
    {
        'name': 'Hematological/Blood cancer',
        'color': '#312e81',
        'order': 7,
    },
    {
        'name': 'Others',
        'color': '#c2410c',
        'order': 8,
    },
]


def classify_cancer_category(diagnosis: str, gender: str = "") -> str:
    """
    Intelligently maps raw clinical diagnosis strings from Patient.diagnosis
    to official cancer categories using oncology taxonomy rules and gender context.
    """
    if not diagnosis or not isinstance(diagnosis, str):
        return "Others"

    t = diagnosis.lower().strip()
    if not t:
        return "Others"

    g = (gender or "").lower().strip()
    is_male = g.startswith("m")

    # 1. Check primary Sarcomas, CNS/Brain, Melanoma, or Unknown Primary first
    # to avoid metastases (e.g. "Osteosarcoma with lung mets") falsely matching secondary sites.
    if any(k in t for k in [
        "osteosarcoma", "chondrosarcoma", "ewing", "rhabdomyosarcoma", "leiomyosarcoma",
        "sarcoma", "glioma", "astrocytoma", "glioblastoma", "ependymoma", "medulloblastoma",
        "brain tumor", "brain stem", "dipg", "melanoma", "unknown primary", "occult primary",
        "unknown origin", "oligometastasis"
    ]):
        return "Others"

    # 2. Breast
    if any(k in t for k in ["breast", "mbc"]):
        return "Breast"

    # 3. Digestive / Gastrointestinal
    if any(k in t for k in [
        "esophag", "oesophag", "stomach", "gastric", "colon", "colorectal",
        "rectum", "rectal", "rectosigmoid", "sigmoid", "anorectum", "ano-rectum", "anal",
        "pancrea", "liver", "hepato", "hcc", "gall bladder", "gallbladder",
        "cholangio", "biliary", "bile duct", "gist", "gastrointestinal stromal",
        "small intestine", "appendix", "gastro"
    ]):
        return "Digestive/Gastrointestinal cancer"

    # 4. Gynaecological
    if any(k in t for k in [
        "cervix", "cervical", "ovary", "ovarian", "endometr", "uterus", "uterine",
        "vagina", "vaginal", "vulva", "vulvar", "bvalut", "vault", "fallopian",
        "pseudomyxoma", "periton", "trophoblastic", "gynaec", "gynec"
    ]) or ("genital tract" in t and not is_male):
        return "Gynaecological cancer"

    # 5. Head and Neck
    if any(k in t for k in [
        "tongue", "buccal", "bm", "rmt", "retromolar", "gingivobuccal", "oral",
        "mouth", "lip", "alveolus", "palate", "maxilla", "tonsil", "pharynx",
        "pharyngeal", "hypopharynx", "oropharynx", "nasopharynx", "pyriform", "pfs",
        "larynx", "laryngeal", "supraglottis", "supraqlottis", "vallecula", "epiglott",
        "sinus", "salivary", "parotid", "thyroid", "mucoepidermoid", "head and neck",
        "head & neck", "throat", "nasal", "vocal cord", "adenoid cystic"
    ]):
        return "Head And Neck cancer"

    # 6. Respiratory / Thoracic
    if any(k in t for k in [
        "lung", "thoracic", "respiratory", "mesothelioma", "thymus", "thymoma",
        "bronchial", "pleural", "pleuropulmonary", "tracheobronchial"
    ]):
        return "Respiratory/Thoracic cancer"

    # 7. Genitourinary
    if any(k in t for k in [
        "kidney", "renal", "bladder", "urinary bladder", "prostate", "penile",
        "penis", "testic", "urethra", "ureter", "wilms", "genitourinary"
    ]) or ("genital tract" in t and is_male):
        return "Genitourinary cancer"

    # 8. Hematological / Blood
    if any(k in t for k in [
        "leukemia", "lukemia", "lymphoma", "myeloma", "myloma", "aml", "all",
        "dlbcl", "hodgkin", "plasma cell", "hematologic", "blood cancer",
        "sezary", "waldenstrom", "myelodysplastic", "plasmacytoma"
    ]):
        return "Hematological/Blood cancer"

    # 9. Fallback
    return "Others"


def get_cancer_category_data(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Get cancer category distribution from Patient.diagnosis:
    Returns count and percentage for each of the 8 canonical categories.
    """
    filters = parse_filter_params(params)
    status = filters.get('status')
    complexity = filters.get('complexity')
    start_date = filters.get('start_date')
    end_date = filters.get('end_date')

    query = (
        db.session.query(
            Patient.id,
            Patient.diagnosis,
            Patient.gender
        )
        .filter(Patient.is_active.is_(True))
    )

    if status or complexity:
        query = apply_patient_filters(query, status=status, complexity=complexity)

    if start_date or end_date:
        query = apply_date_range_filter(query, Patient.registration_date, start_date=start_date, end_date=end_date)

    patients = query.all()

    # Initialize counts for each category
    counts: Dict[str, int] = {item['name']: 0 for item in CANCER_CATEGORIES}

    for p in patients:
        # Categorize every patient who has diagnosis or consider all active patients
        cat = classify_cancer_category(p.diagnosis, p.gender)
        counts[cat] = counts.get(cat, 0) + 1

    total = sum(counts.values())

    data: List[Dict[str, Any]] = []
    for item in CANCER_CATEGORIES:
        name = item['name']
        cnt = counts.get(name, 0)
        pct = round((cnt / total) * 100) if total > 0 else 0
        data.append({
            'name': name,
            'count': cnt,
            'percentage': pct,
            'color': item['color'],
        })

    return {
        'success': True,
        'data': data,
        'total': total,
    }
