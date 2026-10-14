"""Shared query filter helpers for PPT charts."""

from typing import Optional, Dict, Any
from app.patients.models import Patient


def parse_filter_params(request_args: Dict[str, Any]) -> Dict[str, Optional[str]]:
    """
    Extract common filter parameters from request query args.
    """
    status = request_args.get('status', 'all')
    if status:
        status = status.strip().lower()

    complexity = request_args.get('complexity', 'all')
    if complexity:
        complexity = complexity.strip().lower()

    return {
        'status': status if status != 'all' else None,
        'complexity': complexity if complexity != 'all' else None,
        'start_date': request_args.get('start_date'),
        'end_date': request_args.get('end_date'),
    }


def apply_patient_filters(query, status: Optional[str] = None, complexity: Optional[str] = None):
    """
    Apply standard patient status and complexity filters to a SQLAlchemy query.
    """
    if status:
        status_val = status.lower()
        if status_val == 'alive':
            query = query.filter(Patient.is_deceased.is_(False))
        elif status_val == 'inactive':
            query = query.filter(
                (Patient.care_status == 'inactive') | (Patient.is_active.is_(False))
            )
        elif status_val in ('death', 'deceased'):
            query = query.filter(Patient.is_deceased.is_(True))

    if complexity and complexity.lower() != 'all':
        query = query.filter(Patient.clinical_complexity == complexity.lower())

    return query


def apply_date_range_filter(query, date_column, start_date: Optional[str] = None, end_date: Optional[str] = None):
    """
    Apply start_date and end_date filters to a SQLAlchemy column.
    """
    if start_date:
        query = query.filter(date_column >= start_date)
    if end_date:
        query = query.filter(date_column <= end_date)
    return query
