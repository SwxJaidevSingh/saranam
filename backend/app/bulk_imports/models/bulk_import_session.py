"""
Bulk Import Session Model
Tracks bulk appointment import sessions for auditing and rollback
"""

from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy import Column, String, Integer, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.common.models import BaseModel


class BulkImportSession(BaseModel):
    """
    Tracks bulk import sessions
    """
    __tablename__ = 'bulk_import_sessions'

    # Primary identification
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # File information
    filename = Column(String(500), nullable=False)
    file_type = Column(String(20), nullable=False)  # xlsx, csv, pdf
    file_size = Column(Integer, nullable=False)  # bytes
    file_path = Column(String(1000), nullable=True)  # Temporary storage path

    # Import metadata
    llm_provider = Column(String(50), nullable=True)  # openai, anthropic, local (nullable for pure logic)
    extraction_method = Column(String(50), default='llm')  # llm, structured, manual
    uses_pure_logic = Column(Boolean, default=False)  # Pure logic mode (no LLM)

    # Status tracking
    status = Column(String(50), default='uploaded')
    # Statuses: uploaded, extracting, extracted, validating, validated,
    #          creating, completed, failed, rolled_back

    # Statistics
    total_rows = Column(Integer, default=0)
    extracted_count = Column(Integer, default=0)
    valid_count = Column(Integer, default=0)
    created_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    conflict_count = Column(Integer, default=0)

    # Pure logic statistics
    auto_approved_count = Column(Integer, default=0)  # Valid, no conflicts
    needs_review_count = Column(Integer, default=0)   # Valid, has conflicts
    rejected_count = Column(Integer, default=0)       # Invalid data
    missing_provider_count = Column(Integer, default=0)  # Missing provider resolution needed
    skipped_count = Column(Integer, default=0)        # User skipped

    # Conflict summary (pure logic)
    conflict_summary = Column(JSONB, nullable=True)
    # Structure: {"PROVIDER_TIME_OVERLAP": 5, "BREAK_TIME_OVERLAP": 2, ...}

    # Auto-created entities
    patients_created = Column(Integer, default=0)
    providers_matched = Column(Integer, default=0)

    # Processing times
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    processing_duration_seconds = Column(Integer, nullable=True)

    # LLM usage tracking
    llm_tokens_used = Column(Integer, default=0)
    llm_api_calls = Column(Integer, default=0)
    llm_cost_estimate = Column(String(20), nullable=True)  # e.g., "$0.15"

    # Error tracking
    error_message = Column(Text, nullable=True)
    error_details = Column(JSONB, nullable=True)

    # Validation summary
    validation_summary = Column(JSONB, nullable=True)
    # Structure: {
    #   "errors": [{"row": 1, "field": "patient_name", "message": "Required"}],
    #   "warnings": [{"row": 2, "field": "time", "message": "Slot conflict"}],
    #   "conflicts": [{"row": 3, "provider_id": "xxx", "original_time": "...", "suggested_times": [...]}]
    # }

    # Extraction data (raw)
    raw_extraction = Column(JSONB, nullable=True)
    # Structure: Array of extracted appointment objects

    # Final processed data
    processed_data = Column(JSONB, nullable=True)
    # Structure: Array of validated appointment objects ready for creation

    # Conflict resolution
    conflict_resolutions = Column(JSONB, nullable=True)
    # Structure: {row_number: {"action": "accepted|manual|skipped", "new_time": "..."}}

    # User tracking
    created_by = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    uploaded_by_name = Column(String(255), nullable=True)  # Denormalized for reporting

    # Rollback support
    can_rollback = Column(Boolean, default=True)
    rolled_back_at = Column(DateTime, nullable=True)
    rolled_back_by = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=True)
    rollback_reason = Column(Text, nullable=True)

    # Additional metadata
    # Additional metadata
    import_metadata = Column(JSONB, nullable=True)
    # Flexible field for custom data: template_id, import_source, etc.

    # Timestamps (inherited from BaseModel)
    # created_at, updated_at

    # Relationships
    import_items = relationship('BulkImportItem', back_populates='session', cascade='all, delete-orphan')
    creator = relationship('User', foreign_keys=[created_by])
    rollback_user = relationship('User', foreign_keys=[rolled_back_by])

    def __repr__(self):
        return f'<BulkImportSession {self.id}: {self.filename} - {self.status}>'

    def to_dict(self):
        """Convert to dictionary for API responses"""
        return {
            'id': str(self.id),
            'filename': self.filename,
            'file_type': self.file_type,
            'file_size': self.file_size,
            'status': self.status,
            'llm_provider': self.llm_provider,
            'extraction_method': self.extraction_method,
            'statistics': {
                'total_rows': self.total_rows,
                'extracted_count': self.extracted_count,
                'valid_count': self.valid_count,
                'created_count': self.created_count,
                'failed_count': self.failed_count,
                'conflict_count': self.conflict_count,
                'patients_created': self.patients_created,
                'providers_matched': self.providers_matched
            },
            'timing': {
                'started_at': self.started_at.isoformat() if self.started_at else None,
                'completed_at': self.completed_at.isoformat() if self.completed_at else None,
                'duration_seconds': self.processing_duration_seconds
            },
            'llm_usage': {
                'tokens_used': self.llm_tokens_used,
                'api_calls': self.llm_api_calls,
                'cost_estimate': self.llm_cost_estimate
            },
            'created_by': str(self.created_by),
            'uploaded_by_name': self.uploaded_by_name,
            'can_rollback': self.can_rollback,
            'rolled_back_at': self.rolled_back_at.isoformat() if self.rolled_back_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'validation_summary': self.validation_summary,
            'metadata': self.import_metadata
        }

    def update_statistics(self):
        """Update statistics from import items"""
        if self.import_items:
            self.total_rows = len(self.import_items)
            self.created_count = sum(1 for item in self.import_items if item.status == 'created')
            self.failed_count = sum(1 for item in self.import_items if item.status == 'failed')
            self.conflict_count = sum(1 for item in self.import_items if item.has_conflict)

    def mark_completed(self):
        """Mark session as completed"""
        self.status = 'completed'
        self.completed_at = datetime.utcnow()
        if self.started_at:
            duration = (self.completed_at - self.started_at).total_seconds()
            self.processing_duration_seconds = int(duration)

    def mark_failed(self, error_message, error_details=None):
        """Mark session as failed"""
        self.status = 'failed'
        self.completed_at = datetime.utcnow()
        self.error_message = error_message
        self.error_details = error_details
        if self.started_at:
            duration = (self.completed_at - self.started_at).total_seconds()
            self.processing_duration_seconds = int(duration)
