"""
WHO life-course age categorization for the Analytics Dashboard.

Meeting §6.1 (2026-04-14): the previous 0-18 / 19-35 / 36-60 / 60+ buckets
were replaced with the WHO life-course scheme Dr. Ashwini referenced. The
exact bands below are a sensible default — when she shares the official
scheme, edit ``AGE_BANDS`` only; the rest of the pipeline picks it up.

Conventions:
- Each entry is ``(label, min_years_inclusive, max_years_inclusive)``.
- Ranges are contiguous and non-overlapping; age ``X`` lands in the
  first band where ``min <= X <= max``.
- The final "Super senior" band has ``max = None`` to mean "80 and above".
- Patients whose ``date_of_birth`` is NULL bucket into "Unknown (no DOB)"
  so the chart totals honestly reflect data-quality gaps.
"""
from datetime import date
from typing import List, Optional, Tuple


# (label, min_years, max_years-or-None)
AGE_BANDS: List[Tuple[str, int, Optional[int]]] = [
    ('Infant',        0,   1),
    ('Young child',   2,   4),
    ('Child',         5,   9),
    ('Adolescent',   10,  19),
    ('Young adult',  20,  29),
    ('Adult',        30,  44),
    ('Middle-aged',  45,  59),
    ('Senior',       60,  79),
    ('Super senior', 80,  None),
]

UNKNOWN_DOB_LABEL = 'Unknown (no DOB)'


def bucket_for_age(age_years: Optional[int]) -> str:
    """
    Return the WHO age-band label for a given integer age in years, or
    :data:`UNKNOWN_DOB_LABEL` if age is None / negative.
    """
    if age_years is None or age_years < 0:
        return UNKNOWN_DOB_LABEL
    for label, lo, hi in AGE_BANDS:
        if age_years >= lo and (hi is None or age_years <= hi):
            return label
    # Should be unreachable because the last band is open-ended.
    return UNKNOWN_DOB_LABEL


def compute_age_years(dob: Optional[date], today: Optional[date] = None) -> Optional[int]:
    """
    Return integer age in whole years, accounting for whether this year's
    birthday has passed yet. Returns None when DOB is missing or in the
    future (data-entry error).
    """
    if dob is None:
        return None
    today = today or date.today()
    age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    if age < 0:
        return None
    return age


def ordered_bucket_labels() -> List[str]:
    """All band labels in display order, followed by the Unknown bucket."""
    return [label for label, _, _ in AGE_BANDS] + [UNKNOWN_DOB_LABEL]
