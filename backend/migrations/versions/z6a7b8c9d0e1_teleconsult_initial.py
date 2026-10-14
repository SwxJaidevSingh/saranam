"""teleconsult: tele_sessions + tele_notifications

Revision ID: z6a7b8c9d0e1
Revises: y5z6a7b8c9d0
Create Date: 2026-04-29 02:30:00.000000

Adds the Teleconsult module (EnableX-backed voice/video consultations + the
notification queue used by the reminder scheduler). See
docs/Saranam/plans/telecounications/03_DATABASE.md for full design.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = 'z6a7b8c9d0e1'
down_revision = 'y5z6a7b8c9d0'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()

    def table_exists(name):
        return bind.execute(sa.text(
            "SELECT 1 FROM information_schema.tables WHERE table_name=:n"
        ), {'n': name}).scalar()

    # ---- tele_sessions --------------------------------------------------
    if not table_exists('tele_sessions'):
        op.create_table(
            'tele_sessions',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                      server_default=sa.text('uuid_generate_v4()')),
            sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now()),

            sa.Column('patient_id', postgresql.UUID(as_uuid=True),
                      sa.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False),
            sa.Column('provider_id', postgresql.UUID(as_uuid=True),
                      sa.ForeignKey('healthcare_providers.id', ondelete='SET NULL')),
            sa.Column('linked_visit_id', postgresql.UUID(as_uuid=True),
                      sa.ForeignKey('patient_visits.id', ondelete='SET NULL')),
            sa.Column('created_by', postgresql.UUID(as_uuid=True),
                      sa.ForeignKey('users.id', ondelete='SET NULL')),

            sa.Column('channel', sa.String(16), nullable=False),
            sa.Column('provider_vendor', sa.String(16), nullable=False, server_default='enablex'),

            sa.Column('vendor_session_id', sa.String(128), unique=True),
            sa.Column('vendor_room_name', sa.String(255)),

            sa.Column('moderator_token', sa.Text),
            sa.Column('participant_token', sa.Text),
            sa.Column('moderator_join_url', sa.Text),
            sa.Column('participant_join_url', sa.Text),

            sa.Column('status', sa.String(32), nullable=False, server_default='scheduled'),

            sa.Column('scheduled_at', sa.DateTime),
            sa.Column('started_at', sa.DateTime),
            sa.Column('ended_at', sa.DateTime),
            sa.Column('duration_seconds', sa.Integer),

            sa.Column('record_call', sa.Boolean, nullable=False, server_default=sa.false()),
            sa.Column('recording_url', sa.Text),
            sa.Column('recording_id', sa.String(128)),

            sa.Column('cancel_reason', sa.Text),
            sa.Column('notes', sa.Text),
            sa.Column('raw_payload', postgresql.JSONB),

            sa.Column('deleted_at', sa.DateTime),
        )

        op.create_index('idx_tele_sessions_patient', 'tele_sessions',
                        ['patient_id', 'scheduled_at'],
                        postgresql_where=sa.text('deleted_at IS NULL'))
        op.create_index('idx_tele_sessions_provider', 'tele_sessions',
                        ['provider_id', 'scheduled_at'],
                        postgresql_where=sa.text('deleted_at IS NULL'))
        op.create_index('idx_tele_sessions_active', 'tele_sessions',
                        ['scheduled_at'],
                        postgresql_where=sa.text(
                            "status IN ('scheduled','ringing','in_progress') AND deleted_at IS NULL"
                        ))
        op.create_index('idx_tele_sessions_visit', 'tele_sessions',
                        ['linked_visit_id'],
                        postgresql_where=sa.text('linked_visit_id IS NOT NULL'))

    # ---- tele_notifications --------------------------------------------
    if not table_exists('tele_notifications'):
        op.create_table(
            'tele_notifications',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                      server_default=sa.text('uuid_generate_v4()')),
            sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now()),

            sa.Column('session_id', postgresql.UUID(as_uuid=True),
                      sa.ForeignKey('tele_sessions.id', ondelete='CASCADE'), nullable=False),

            sa.Column('recipient_type', sa.String(16), nullable=False),
            sa.Column('recipient_user_id', postgresql.UUID(as_uuid=True)),
            sa.Column('recipient_email', sa.String(255)),
            sa.Column('recipient_phone', sa.String(32)),

            sa.Column('channel', sa.String(16), nullable=False),
            sa.Column('template_key', sa.String(64), nullable=False),

            sa.Column('scheduled_for', sa.DateTime, nullable=False),
            sa.Column('sent_at', sa.DateTime),

            sa.Column('status', sa.String(32), nullable=False, server_default='pending'),

            sa.Column('vendor_message_id', sa.String(128)),
            sa.Column('error_message', sa.Text),
            sa.Column('retry_count', sa.Integer, nullable=False, server_default='0'),
            sa.Column('raw_response', postgresql.JSONB),

            sa.UniqueConstraint('session_id', 'recipient_type', 'channel', 'template_key',
                                name='uq_tele_notif_dedup'),
        )

        op.create_index('idx_tele_notif_due_pending', 'tele_notifications',
                        ['scheduled_for'],
                        postgresql_where=sa.text("status = 'pending'"))
        op.create_index('idx_tele_notif_session', 'tele_notifications',
                        ['session_id', 'recipient_type', 'channel'])

    # ---- system_settings seed ------------------------------------------
    op.execute("""
        INSERT INTO system_settings (id, key, value, created_at, updated_at) VALUES
          (uuid_generate_v4(), 'teleconsult_enabled', 'true', now(), now()),
          (uuid_generate_v4(), 'teleconsult_default_provider_vendor', 'enablex', now(), now()),
          (uuid_generate_v4(), 'teleconsult_clinic_name', 'Saranam Palliative Care', now(), now()),
          (uuid_generate_v4(), 'teleconsult_clinic_email', 'team@exatorial.com', now(), now()),
          (uuid_generate_v4(), 'teleconsult_timezone', 'Asia/Kolkata', now(), now()),
          (uuid_generate_v4(), 'teleconsult_reminder_24h_offset_min', '1440', now(), now()),
          (uuid_generate_v4(), 'teleconsult_reminder_15m_offset_min', '15', now(), now())
        ON CONFLICT (key) DO NOTHING
    """)


def downgrade():
    op.drop_index('idx_tele_notif_session', table_name='tele_notifications')
    op.drop_index('idx_tele_notif_due_pending', table_name='tele_notifications')
    op.drop_table('tele_notifications')

    op.drop_index('idx_tele_sessions_visit', table_name='tele_sessions')
    op.drop_index('idx_tele_sessions_active', table_name='tele_sessions')
    op.drop_index('idx_tele_sessions_provider', table_name='tele_sessions')
    op.drop_index('idx_tele_sessions_patient', table_name='tele_sessions')
    op.drop_table('tele_sessions')

    op.execute("""
        DELETE FROM system_settings WHERE key IN (
          'teleconsult_enabled',
          'teleconsult_default_provider_vendor',
          'teleconsult_clinic_name',
          'teleconsult_clinic_email',
          'teleconsult_timezone',
          'teleconsult_reminder_24h_offset_min',
          'teleconsult_reminder_15m_offset_min'
        )
    """)
