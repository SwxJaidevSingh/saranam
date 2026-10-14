"""Pydantic schemas for form configurations."""
from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field, field_validator
from app.form_configurations.models import FormType, DocumentationType


class FormConfigurationCreateSchema(BaseModel):
    """Schema for creating a form configuration."""
    facility_id: Optional[UUID] = None
    service_id: Optional[UUID] = None
    form_type: str
    form_id: UUID
    is_required: bool = False
    display_order: Optional[int] = None
    is_active: bool = True

    @field_validator('form_type')
    @classmethod
    def validate_form_type(cls, v):
        """Validate form type is valid."""
        valid_types = [ft.value for ft in FormType]
        if v not in valid_types:
            raise ValueError(f'Invalid form type. Must be one of: {", ".join(valid_types)}')
        return v

    class Config:
        from_attributes = True


class FormConfigurationUpdateSchema(BaseModel):
    """Schema for updating a form configuration."""
    form_id: Optional[UUID] = None
    is_required: Optional[bool] = None
    display_order: Optional[int] = None
    is_active: Optional[bool] = None

    class Config:
        from_attributes = True


class FormConfigurationResponseSchema(BaseModel):
    """Schema for form configuration response."""
    id: UUID
    facility_id: Optional[UUID] = None
    service_id: Optional[UUID] = None
    form_type: str
    form_id: UUID
    is_required: bool
    display_order: Optional[int] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    # Nested form details (optional, if joined)
    form: Optional[dict] = None
    facility: Optional[dict] = None
    service: Optional[dict] = None

    class Config:
        from_attributes = True


class ClinicalDocumentationCreateSchema(BaseModel):
    """Schema for creating clinical documentation."""
    admission_id: UUID
    patient_id: UUID
    encounter_id: UUID
    documentation_type: str
    form_submission_id: Optional[UUID] = None
    documented_by: Optional[UUID] = None
    documented_at: datetime
    notes: Optional[str] = None

    @field_validator('documentation_type')
    @classmethod
    def validate_documentation_type(cls, v):
        """Validate documentation type is valid."""
        valid_types = [dt.value for dt in DocumentationType]
        if v not in valid_types:
            raise ValueError(f'Invalid documentation type. Must be one of: {", ".join(valid_types)}')
        return v

    class Config:
        from_attributes = True


class ClinicalDocumentationResponseSchema(BaseModel):
    """Schema for clinical documentation response."""
    id: UUID
    admission_id: UUID
    patient_id: UUID
    encounter_id: UUID
    documentation_type: str
    form_submission_id: Optional[UUID] = None
    documented_by: Optional[UUID] = None
    documented_at: datetime
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    # Nested details (optional, if joined)
    form_submission: Optional[dict] = None
    documenter: Optional[dict] = None

    class Config:
        from_attributes = True


class FormConfigurationQuerySchema(BaseModel):
    """Schema for querying form configurations."""
    facility_id: Optional[UUID] = None
    service_id: Optional[UUID] = None
    form_type: Optional[str] = None
    is_active: bool = True

    class Config:
        from_attributes = True
