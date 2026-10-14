"""
Add bulk import tables

This migration creates tables for bulk appointment import functionality.

To apply this migration:
1. Copy content to a new migration file created with:
   flask db revision -m "Add bulk import tables"
2. Run: flask db upgrade
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


# revision identifiers, used by Alembic.
# NOTE: These will be auto-generated when you run `flask db revision`
revision = 'xxxxx'  # Will be auto-generated
down_revision = 'yyyyy'  # Will be previous migration
branch_labels = None
depends_on = None


def upgrade():
    # Create bulk_import_sessions table
    op.create_table(
        'bulk_import_sessions',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),

        # File information
        sa.Column('filename', sa.String(500), nullable=False),
        sa.Column('file_type', sa.String(20), nullable=False),
        sa.Column('file_size', sa.Integer, nullable=False),
        sa.Column('file_path', sa.String(1000), nullable=True),

        # Import metadata
        sa.Column('llm_provider', sa.String(50), nullable=False),
        sa.Column('extraction_method', sa.String(50), server_default='llm'),

        # Status tracking
        sa.Column('status', sa.String(50), server_default='uploaded'),

        # Statistics
        sa.Column('total_rows', sa.Integer, server_default='0'),
        sa.Column('extracted_count', sa.Integer, server_default='0'),
        sa.Column('valid_count', sa.Integer, server_default='0'),
        sa.Column('created_count', sa.Integer, server_default='0'),
        sa.Column('failed_count', sa.Integer, server_default='0'),
        sa.Column('conflict_count', sa.Integer, server_default='0'),

        # Auto-created entities
        sa.Column('patients_created', sa.Integer, server_default='0'),
        sa.Column('providers_matched', sa.Integer, server_default='0'),

        # Processing times
        sa.Column('started_at', sa.DateTime, nullable=False),
        sa.Column('completed_at', sa.DateTime, nullable=True),
        sa.Column('processing_duration_seconds', sa.Integer, nullable=True),

        # LLM usage tracking
        sa.Column('llm_tokens_used', sa.Integer, server_default='0'),
        sa.Column('llm_api_calls', sa.Integer, server_default='0'),
        sa.Column('llm_cost_estimate', sa.String(20), nullable=True),

        # Error tracking
        sa.Column('error_message', sa.Text, nullable=True),
        sa.Column('error_details', JSONB, nullable=True),

        # Validation summary
        sa.Column('validation_summary', JSONB, nullable=True),

        # Extraction data
        sa.Column('raw_extraction', JSONB, nullable=True),
        sa.Column('processed_data', JSONB, nullable=True),

        # Conflict resolution
        sa.Column('conflict_resolutions', JSONB, nullable=True),

        # User tracking
        sa.Column('created_by', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('uploaded_by_name', sa.String(255), nullable=True),

        # Rollback support
        sa.Column('can_rollback', sa.Boolean, server_default='true'),
        sa.Column('rolled_back_at', sa.DateTime, nullable=True),
        sa.Column('rolled_back_by', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('rollback_reason', sa.Text, nullable=True),

        # Additional metadata
        sa.Column('metadata', JSONB, nullable=True),

        # Timestamps (standard BaseModel fields)
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now(), onupdate=sa.func.now())
    )

    # Create indexes for bulk_import_sessions
    op.create_index('idx_bulk_sessions_created_by', 'bulk_import_sessions', ['created_by'])
    op.create_index('idx_bulk_sessions_status', 'bulk_import_sessions', ['status'])
    op.create_index('idx_bulk_sessions_created_at', 'bulk_import_sessions', ['created_at'])

    # Create bulk_import_items table
    op.create_table(
        'bulk_import_items',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),

        # Session reference
        sa.Column('session_id', UUID(as_uuid=True),
                  sa.ForeignKey('bulk_import_sessions.id', ondelete='CASCADE'),
                  nullable=False),

        # Row tracking
        sa.Column('row_number', sa.Integer, nullable=False),
        sa.Column('original_data', JSONB, nullable=False),

        # Status tracking
        sa.Column('status', sa.String(50), server_default='pending'),

        # Extracted appointment data
        sa.Column('extracted_data', JSONB, nullable=True),

        # Validation results
        sa.Column('is_valid', sa.Boolean, server_default='false'),
        sa.Column('validation_errors', JSONB, nullable=True),
        sa.Column('validation_warnings', JSONB, nullable=True),

        # Entity matching
        sa.Column('patient_id', UUID(as_uuid=True), sa.ForeignKey('patients.id'), nullable=True),
        sa.Column('patient_match_type', sa.String(50), nullable=True),
        sa.Column('patient_match_score', sa.Integer, nullable=True),

        sa.Column('provider_id', UUID(as_uuid=True), sa.ForeignKey('healthcare_providers.id'), nullable=True),
        sa.Column('provider_match_type', sa.String(50), nullable=True),
        sa.Column('provider_match_score', sa.Integer, nullable=True),

        sa.Column('service_id', UUID(as_uuid=True), sa.ForeignKey('services.id'), nullable=True),

        # Patient creation tracking
        sa.Column('patient_created', sa.Boolean, server_default='false'),
        sa.Column('created_patient_data', JSONB, nullable=True),

        # Conflict detection
        sa.Column('has_conflict', sa.Boolean, server_default='false'),
        sa.Column('conflict_type', sa.String(50), nullable=True),
        sa.Column('conflict_details', JSONB, nullable=True),

        # Conflict resolution
        sa.Column('resolution_action', sa.String(50), nullable=True),
        sa.Column('resolution_data', JSONB, nullable=True),

        # AI suggestions
        sa.Column('ai_suggestions', JSONB, nullable=True),

        # Final appointment data
        sa.Column('final_appointment_data', JSONB, nullable=True),

        # Created appointment reference
        sa.Column('created_appointment_id', UUID(as_uuid=True), sa.ForeignKey('encounters.id'), nullable=True),

        # Error tracking
        sa.Column('error_message', sa.Text, nullable=True),
        sa.Column('error_details', JSONB, nullable=True),

        # Processing metadata
        sa.Column('processed_at', sa.DateTime, nullable=True),
        sa.Column('retry_count', sa.Integer, server_default='0'),

        # Timestamps (standard BaseModel fields)
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now(), onupdate=sa.func.now())
    )

    # Create indexes for bulk_import_items
    op.create_index('idx_bulk_items_session_id', 'bulk_import_items', ['session_id'])
    op.create_index('idx_bulk_items_status', 'bulk_import_items', ['status'])
    op.create_index('idx_bulk_items_patient_id', 'bulk_import_items', ['patient_id'])
    op.create_index('idx_bulk_items_provider_id', 'bulk_import_items', ['provider_id'])
    op.create_index('idx_bulk_items_created_appointment', 'bulk_import_items', ['created_appointment_id'])


def downgrade():
    # Drop indexes first
    op.drop_index('idx_bulk_items_created_appointment', 'bulk_import_items')
    op.drop_index('idx_bulk_items_provider_id', 'bulk_import_items')
    op.drop_index('idx_bulk_items_patient_id', 'bulk_import_items')
    op.drop_index('idx_bulk_items_status', 'bulk_import_items')
    op.drop_index('idx_bulk_items_session_id', 'bulk_import_items')

    op.drop_index('idx_bulk_sessions_created_at', 'bulk_import_sessions')
    op.drop_index('idx_bulk_sessions_status', 'bulk_import_sessions')
    op.drop_index('idx_bulk_sessions_created_by', 'bulk_import_sessions')

    # Drop tables
    op.drop_table('bulk_import_items')
    op.drop_table('bulk_import_sessions')
