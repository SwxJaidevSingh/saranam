"""Add all Saranam clinical assessment tables

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-03-24 07:30:00.000000

Creates: nursing_assessments, doctor_assessments, psychological_assessments,
         physiotherapy_assessments, esas_scores, pps_scores, plans_of_care
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = 'c3d4e5f6a7b8'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade():
    # ── Nursing Assessments ──
    op.create_table(
        'nursing_assessments',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('patient_id', UUID(as_uuid=True), sa.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('visit_id', UUID(as_uuid=True), sa.ForeignKey('patient_visits.id', ondelete='CASCADE'), nullable=False),
        sa.Column('consciousness', sa.String(20)),
        sa.Column('orientation', sa.String(20)),
        sa.Column('demeanor', sa.String(20)),
        sa.Column('adl', sa.String(30)),
        sa.Column('built', sa.String(20)),
        sa.Column('hygiene_general', sa.String(10)),
        sa.Column('pain_score', sa.Integer),
        sa.Column('pain_details', sa.Text),
        sa.Column('nausea_vomiting', sa.Text),
        sa.Column('dyspnea', sa.Text),
        sa.Column('bowel', sa.Text),
        sa.Column('bladder', sa.Text),
        sa.Column('wound_present', sa.Boolean, server_default='false'),
        sa.Column('wound_size', sa.Text),
        sa.Column('wound_site', sa.Text),
        sa.Column('wound_fungative', sa.Boolean, server_default='false'),
        sa.Column('wound_bleeding', sa.Boolean, server_default='false'),
        sa.Column('wound_discharge', sa.Text),
        sa.Column('wound_odor', sa.String(20)),
        sa.Column('wound_maggot', sa.Boolean, server_default='false'),
        sa.Column('device_feeding_tube', JSONB),
        sa.Column('device_urinary_catheter', JSONB),
        sa.Column('device_tracheostomy', JSONB),
        sa.Column('device_stoma', JSONB),
        sa.Column('lymphedema_present', sa.Boolean, server_default='false'),
        sa.Column('lymphedema_details', sa.Text),
        sa.Column('bed_sore_present', sa.Boolean, server_default='false'),
        sa.Column('braden_scale_score', sa.Integer),
        sa.Column('hygiene_environmental', sa.String(10)),
        sa.Column('hygiene_oral', sa.String(10)),
        sa.Column('hygiene_skin', sa.String(10)),
        sa.Column('procedures_done', sa.Text),
        sa.Column('instructions_given', sa.Text),
        sa.Column('future_plans', sa.Text),
        sa.Column('assessed_by', UUID(as_uuid=True), sa.ForeignKey('users.id')),
        sa.Column('assessed_at', sa.DateTime, server_default=sa.text('NOW()')),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime, server_default=sa.text('NOW()'), nullable=False),
        sa.UniqueConstraint('visit_id', name='uq_nursing_visit'),
    )
    op.create_index('idx_nursing_patient', 'nursing_assessments', ['patient_id'])
    op.create_index('idx_nursing_visit', 'nursing_assessments', ['visit_id'])

    # ── Doctor Assessments ──
    op.create_table(
        'doctor_assessments',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('patient_id', UUID(as_uuid=True), sa.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('visit_id', UUID(as_uuid=True), sa.ForeignKey('patient_visits.id', ondelete='CASCADE'), nullable=False),
        sa.Column('diagnosis', sa.Text),
        sa.Column('hpe_report', sa.Text),
        sa.Column('chief_complaints', sa.Text),
        sa.Column('history_of_presenting_illness', sa.Text),
        sa.Column('comorbidities', sa.Text),
        sa.Column('medication_history', sa.Text),
        sa.Column('previous_investigations', sa.Text),
        sa.Column('family_history', sa.Text),
        sa.Column('diet', sa.String(50)),
        sa.Column('appetite', sa.String(20)),
        sa.Column('bowel', sa.Text),
        sa.Column('bladder', sa.Text),
        sa.Column('habits', sa.Text),
        sa.Column('exam_respiratory', sa.Text),
        sa.Column('exam_cardiovascular', sa.Text),
        sa.Column('exam_per_abdomen', sa.Text),
        sa.Column('exam_cns', sa.Text),
        sa.Column('doctor_notes', sa.Text),
        sa.Column('body_map_front_url', sa.Text),
        sa.Column('body_map_back_url', sa.Text),
        sa.Column('body_map_annotations', JSONB),
        sa.Column('assessed_by', UUID(as_uuid=True), sa.ForeignKey('users.id')),
        sa.Column('assessed_at', sa.DateTime, server_default=sa.text('NOW()')),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime, server_default=sa.text('NOW()'), nullable=False),
        sa.UniqueConstraint('visit_id', name='uq_doctor_visit'),
    )
    op.create_index('idx_doctor_patient', 'doctor_assessments', ['patient_id'])
    op.create_index('idx_doctor_visit', 'doctor_assessments', ['visit_id'])

    # ── Psychological Assessments ──
    op.create_table(
        'psychological_assessments',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('patient_id', UUID(as_uuid=True), sa.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('visit_id', UUID(as_uuid=True), sa.ForeignKey('patient_visits.id', ondelete='CASCADE'), nullable=False),
        sa.Column('patient_mood', sa.Text),
        sa.Column('patient_sleep', sa.Text),
        sa.Column('patient_disease_concerns', sa.Text),
        sa.Column('problems_physical', JSONB),
        sa.Column('problems_emotional', JSONB),
        sa.Column('problems_social', JSONB),
        sa.Column('problems_practical', JSONB),
        sa.Column('problems_spiritual', JSONB),
        sa.Column('distress_score', sa.Integer),
        sa.Column('family_support_notes', sa.Text),
        sa.Column('caregiver_mood', sa.Text),
        sa.Column('caregiver_burden', sa.Text),
        sa.Column('caregiver_concerns_about_patient', sa.Text),
        sa.Column('caregiver_personal_concerns', sa.Text),
        sa.Column('zarit_q1_stress', sa.Integer),
        sa.Column('zarit_q2_time', sa.Integer),
        sa.Column('zarit_q3_strain', sa.Integer),
        sa.Column('zarit_q4_uncertain', sa.Integer),
        sa.Column('zarit_total_score', sa.Integer),
        sa.Column('remarks', sa.Text),
        sa.Column('assessed_by', UUID(as_uuid=True), sa.ForeignKey('users.id')),
        sa.Column('assessed_at', sa.DateTime, server_default=sa.text('NOW()')),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime, server_default=sa.text('NOW()'), nullable=False),
        sa.UniqueConstraint('visit_id', name='uq_psych_visit'),
    )
    op.create_index('idx_psych_patient', 'psychological_assessments', ['patient_id'])
    op.create_index('idx_psych_visit', 'psychological_assessments', ['visit_id'])

    # ── Physiotherapy Assessments ──
    op.create_table(
        'physiotherapy_assessments',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('patient_id', UUID(as_uuid=True), sa.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('visit_id', UUID(as_uuid=True), sa.ForeignKey('patient_visits.id', ondelete='CASCADE'), nullable=False),
        sa.Column('pain_vas_score', sa.Integer),
        sa.Column('pain_area', sa.Text),
        sa.Column('pain_nature', sa.Text),
        sa.Column('obs_built', sa.String(20)),
        sa.Column('obs_posture', sa.Text),
        sa.Column('obs_swelling', sa.Text),
        sa.Column('obs_deformity', sa.Text),
        sa.Column('obs_wasting', sa.Text),
        sa.Column('palp_tenderness', sa.Text),
        sa.Column('palp_edema', sa.Text),
        sa.Column('palp_scar', sa.Text),
        sa.Column('exam_rom', sa.Text),
        sa.Column('exam_mmt', sa.Text),
        sa.Column('exam_tone', sa.Text),
        sa.Column('exam_balance', sa.Text),
        sa.Column('exam_functional_status', sa.Text),
        sa.Column('physio_notes', sa.Text),
        sa.Column('assessed_by', UUID(as_uuid=True), sa.ForeignKey('users.id')),
        sa.Column('assessed_at', sa.DateTime, server_default=sa.text('NOW()')),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime, server_default=sa.text('NOW()'), nullable=False),
        sa.UniqueConstraint('visit_id', name='uq_physio_visit'),
    )
    op.create_index('idx_physio_patient', 'physiotherapy_assessments', ['patient_id'])
    op.create_index('idx_physio_visit', 'physiotherapy_assessments', ['visit_id'])

    # ── ESAS-R Scores ──
    op.create_table(
        'esas_scores',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('patient_id', UUID(as_uuid=True), sa.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('visit_id', UUID(as_uuid=True), sa.ForeignKey('patient_visits.id', ondelete='CASCADE'), nullable=False),
        sa.Column('pain', sa.Integer),
        sa.Column('tiredness', sa.Integer),
        sa.Column('nausea', sa.Integer),
        sa.Column('depression', sa.Integer),
        sa.Column('anxiety', sa.Integer),
        sa.Column('drowsiness', sa.Integer),
        sa.Column('appetite', sa.Integer),
        sa.Column('wellbeing', sa.Integer),
        sa.Column('shortness_of_breath', sa.Integer),
        sa.Column('other_symptom_name', sa.String(100)),
        sa.Column('other_symptom_score', sa.Integer),
        sa.Column('total_score', sa.Integer),
        sa.Column('recorded_at', sa.DateTime, server_default=sa.text('NOW()'), nullable=False),
        sa.Column('recorded_by', UUID(as_uuid=True), sa.ForeignKey('users.id')),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime, server_default=sa.text('NOW()'), nullable=False),
        sa.UniqueConstraint('visit_id', name='uq_esas_visit'),
    )
    op.create_index('idx_esas_patient', 'esas_scores', ['patient_id'])
    op.create_index('idx_esas_visit', 'esas_scores', ['visit_id'])
    op.create_index('idx_esas_recorded', 'esas_scores', ['patient_id', 'recorded_at'])

    # ── PPS Scores ──
    op.create_table(
        'pps_scores',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('patient_id', UUID(as_uuid=True), sa.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('visit_id', UUID(as_uuid=True), sa.ForeignKey('patient_visits.id', ondelete='CASCADE'), nullable=False),
        sa.Column('pps_score', sa.Integer, nullable=False),
        sa.Column('ambulation', sa.String(100)),
        sa.Column('activity_level', sa.String(255)),
        sa.Column('self_care', sa.String(100)),
        sa.Column('intake', sa.String(100)),
        sa.Column('consciousness_level', sa.String(100)),
        sa.Column('estimated_survival_days', sa.Integer),
        sa.Column('notes', sa.Text),
        sa.Column('recorded_at', sa.DateTime, server_default=sa.text('NOW()'), nullable=False),
        sa.Column('recorded_by', UUID(as_uuid=True), sa.ForeignKey('users.id')),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime, server_default=sa.text('NOW()'), nullable=False),
        sa.UniqueConstraint('visit_id', name='uq_pps_visit'),
    )
    op.create_index('idx_pps_patient', 'pps_scores', ['patient_id'])
    op.create_index('idx_pps_visit', 'pps_scores', ['visit_id'])
    op.create_index('idx_pps_recorded', 'pps_scores', ['patient_id', 'recorded_at'])

    # ── Plans of Care ──
    op.create_table(
        'plans_of_care',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('patient_id', UUID(as_uuid=True), sa.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('visit_id', UUID(as_uuid=True), sa.ForeignKey('patient_visits.id', ondelete='CASCADE'), nullable=False),
        sa.Column('intervention_non_pharmacological', sa.Text),
        sa.Column('intervention_pharmacological', sa.Text),
        sa.Column('medications', JSONB),
        sa.Column('created_by', UUID(as_uuid=True), sa.ForeignKey('users.id')),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime, server_default=sa.text('NOW()'), nullable=False),
        sa.UniqueConstraint('visit_id', name='uq_poc_visit'),
    )
    op.create_index('idx_poc_patient', 'plans_of_care', ['patient_id'])
    op.create_index('idx_poc_visit', 'plans_of_care', ['visit_id'])


def downgrade():
    op.drop_table('plans_of_care')
    op.drop_table('pps_scores')
    op.drop_table('esas_scores')
    op.drop_table('physiotherapy_assessments')
    op.drop_table('psychological_assessments')
    op.drop_table('doctor_assessments')
    op.drop_table('nursing_assessments')
