"""Portal-specific pydantic schemas (origin capture).

Matches the validation style of app/patients/schemas.py. Demographic fields are
validated by the existing PatientCreateSchema/PatientUpdateSchema — these
schemas cover ONLY the structured referral origin that the portal layers on top.
"""
from datetime import date
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


# origin_type is REQUIRED at portal intake.
ORIGIN_TYPES = [
    'hospital', 'doctor', 'camp', 'self', 'ngo', 'govt_scheme', 'online', 'other',
]


class PatientOriginSchema(BaseModel):
    """Structured referral origin. `organization_id` here is the REFERRER org
    (origin_organization_id), NOT the owning tenant — the owning org is forced
    server-side from the TenantContext and never read from input."""

    origin_type: str = Field(..., description="One of: " + ", ".join(ORIGIN_TYPES))
    source_code: Optional[str] = Field(None, max_length=10,
                                        description="Referring hospital catalog code (type=hospital)")
    organization_id: Optional[UUID] = Field(None,
                                             description="Referrer org id when the referrer is a tenant org")
    source_name: Optional[str] = Field(None, max_length=150,
                                        description="Doctor/camp/NGO/scheme name (free text)")
    referral_date: Optional[date] = None
    notes: Optional[str] = None

    @field_validator('origin_type')
    @classmethod
    def validate_origin_type(cls, v):
        if not v or v not in ORIGIN_TYPES:
            raise ValueError(f'origin_type must be one of: {", ".join(ORIGIN_TYPES)}')
        return v

    @field_validator('referral_date', mode='before')
    @classmethod
    def validate_referral_date(cls, v):
        if not v:
            return None
        if isinstance(v, str):
            try:
                v = date.fromisoformat(v)
            except ValueError:
                raise ValueError('Invalid referral_date format. Use YYYY-MM-DD')
        return v

    class Config:
        from_attributes = True
