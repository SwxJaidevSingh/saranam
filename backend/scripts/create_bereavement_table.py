"""
Script to create the bereavement_assessments table directly in PostgreSQL.

Usage:
    cmd /c python scripts/create_bereavement_table.py
"""
import sys
import os
from sqlalchemy import text

# Add backend root directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app
from app.extensions import db

CREATE_TABLE_SQL = """
-- Ensure UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create bereavement_assessments table
CREATE TABLE IF NOT EXISTS bereavement_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    visit_id UUID NOT NULL REFERENCES patient_visits(id) ON DELETE CASCADE,

    -- 1. General Observations
    obs_home_environment TEXT,
    obs_family_interaction TEXT,
    obs_emotional_atmosphere TEXT,
    obs_rituals_completed TEXT,
    obs_immediate_concerns TEXT,

    -- 2. Primary Caregiver / Decision Maker Observations
    caregiver_obs_1_name VARCHAR(100),
    caregiver_obs_1_relationship VARCHAR(50),
    caregiver_obs_1_coping TEXT,

    caregiver_obs_2_name VARCHAR(100),
    caregiver_obs_2_relationship VARCHAR(50),
    caregiver_obs_2_coping TEXT,

    -- 3. Psychological Assessment: Emotional Responses (Flexible JSONB, NO ENUM)
    emotional_responses JSONB DEFAULT '[]'::jsonb,
    emotional_responses_other TEXT,

    -- 4. Psychological Assessment: General Functioning
    functioning_sleep TEXT,
    functioning_appetite TEXT,
    functioning_daily_routine TEXT,
    functioning_role_changes TEXT,

    -- 5. Support, Cultural & Strengths Observations
    family_social_support TEXT,
    spiritual_cultural_obs TEXT,
    coping_strengths TEXT,

    -- 6. Red Flag Screening (Flexible JSONB, NO ENUM)
    red_flags JSONB DEFAULT '[]'::jsonb,
    red_flags_other TEXT,

    -- 7. Clinical Impression (VARCHAR, NO ENUM)
    bereavement_risk VARCHAR(50),

    -- 8. Interventions During Visit
    interventions_notes TEXT,

    -- 9. Follow-up Plan & Remarks (Flexible JSONB, NO ENUM)
    follow_up_intervals JSONB DEFAULT '[]'::jsonb,
    follow_up_remarks TEXT,

    -- 10. Audit & Metadata Fields
    assessed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    assessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    -- 11. Constraints
    CONSTRAINT uq_bereavement_assessment_visit UNIQUE (visit_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS ix_bereavement_assessments_patient_id 
    ON bereavement_assessments (patient_id);

CREATE INDEX IF NOT EXISTS ix_bereavement_assessments_visit_id 
    ON bereavement_assessments (visit_id);
"""

def main():
    app = create_app()
    with app.app_context():
        print("Executing SQL to create bereavement_assessments table...")
        try:
            db.session.execute(text(CREATE_TABLE_SQL))
            db.session.commit()
            print(" Table 'bereavement_assessments' created or verified successfully!")
        except Exception as e:
            db.session.rollback()
            print(f" Failed to execute SQL: {e}")
            sys.exit(1)

if __name__ == '__main__':
    main()
