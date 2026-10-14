"""Prescription version models — immutable, versioned, signed prescription PDFs.

A prescription is a legal document: once *issued* it is immutable. Any change
creates the next version; all versions are retained. Versions form one
per-patient chain (v1, v2, …), each labeled by the visit it was issued from and
each carrying a frozen snapshot of the prescribing doctor (so the signature /
designation can never "disappear" — it's part of the version).

PDFs are stored privately in Cloudinary (resource_type=raw, type=authenticated);
downloads are backend-mediated and logged in PrescriptionPdfDownload (for the
analytics tab + medico-legal access trail).
"""
from sqlalchemy import Column, String, Integer, ForeignKey, Index, LargeBinary
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship as db_relationship
from app.common.models import BaseModel
from app.extensions import db


class PrescriptionVersion(BaseModel):
    """One immutable, issued prescription PDF for a patient (v1, v2, …)."""
    __tablename__ = 'prescription_versions'

    patient_id = Column(UUID(as_uuid=True), ForeignKey('patients.id', ondelete='CASCADE'), nullable=False)
    visit_id = Column(UUID(as_uuid=True), ForeignKey('patient_visits.id', ondelete='SET NULL'), nullable=True)
    plan_of_care_id = Column(UUID(as_uuid=True), ForeignKey('plans_of_care.id', ondelete='SET NULL'), nullable=True)

    # Per-patient sequential version number (1, 2, 3, …).
    version_number = Column(Integer, nullable=False)
    # Visit type label snapshot for display ("initial_assessment", "follow_up", …).
    visit_type = Column(String(50), nullable=True)

    # Frozen content of the prescription at issue time (meds, diagnosis, notes).
    snapshot = Column(JSONB, nullable=True)
    # Frozen prescriber identity {provider_id, name, qualification, designation,
    # kmc_number, signature_image}. This is the medico-legal signer of the doc.
    prescribing_doctor = Column(JSONB, nullable=True)
    # sha256 of normalized (snapshot + doctor) — used to skip an unchanged re-issue.
    content_hash = Column(String(64), nullable=True)

    # Where the PDF lives: 'cloudinary' (private asset) or 'db' (fallback bytes
    # stored here when Cloudinary isn't configured). The download path picks the
    # right source — so the feature works with or without Cloudinary credentials.
    storage_kind = Column(String(20), nullable=True)
    # Cloudinary storage (private). public_id is what we sign to fetch the asset.
    cloudinary_public_id = Column(String(255), nullable=True)
    cloudinary_url = Column(String(500), nullable=True)
    cloudinary_resource_type = Column(String(20), nullable=True, server_default='raw')
    # Fallback: the PDF bytes, used only when storage_kind == 'db'.
    pdf_data = Column(LargeBinary, nullable=True)
    file_bytes = Column(Integer, nullable=True)

    created_by = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=True)

    __table_args__ = (
        Index('ix_prescription_versions_patient_id', 'patient_id'),
        Index('ix_prescription_versions_visit_id', 'visit_id'),
    )

    patient = db_relationship('Patient')
    visit = db_relationship('PatientVisit')
    creator = db_relationship('User', foreign_keys=[created_by])

    def to_dict(self, include_doctor=True):
        d = super().to_dict()
        d['id'] = str(self.id) if self.id else None
        d['patient_id'] = str(self.patient_id) if self.patient_id else None
        d['visit_id'] = str(self.visit_id) if self.visit_id else None
        d['plan_of_care_id'] = str(self.plan_of_care_id) if self.plan_of_care_id else None
        d['created_by'] = str(self.created_by) if self.created_by else None
        d['created_at'] = self.created_at.isoformat() if self.created_at else None
        d['updated_at'] = self.updated_at.isoformat() if self.updated_at else None
        # Never leak the raw cloudinary URL to clients — downloads go through the
        # backend so they can be authorized + logged. Also drop the raw PDF bytes
        # (not JSON-serializable, and never sent inline).
        d.pop('cloudinary_url', None)
        d.pop('cloudinary_public_id', None)
        d.pop('pdf_data', None)
        if not include_doctor:
            d.pop('prescribing_doctor', None)
        return d

    def __repr__(self):
        return f'<PrescriptionVersion patient={self.patient_id} v{self.version_number}>'


class PrescriptionPdfDownload(BaseModel):
    """Audit + analytics row: one per prescription-PDF download."""
    __tablename__ = 'prescription_pdf_downloads'

    version_id = Column(UUID(as_uuid=True), ForeignKey('prescription_versions.id', ondelete='CASCADE'), nullable=False)
    patient_id = Column(UUID(as_uuid=True), ForeignKey('patients.id', ondelete='CASCADE'), nullable=True)
    downloaded_by = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=True)

    __table_args__ = (
        Index('ix_prescription_pdf_downloads_version_id', 'version_id'),
        Index('ix_prescription_pdf_downloads_patient_id', 'patient_id'),
        Index('ix_prescription_pdf_downloads_downloaded_by', 'downloaded_by'),
    )

    version = db_relationship('PrescriptionVersion')
    downloader = db_relationship('User', foreign_keys=[downloaded_by])

    def __repr__(self):
        return f'<PrescriptionPdfDownload version={self.version_id}>'
