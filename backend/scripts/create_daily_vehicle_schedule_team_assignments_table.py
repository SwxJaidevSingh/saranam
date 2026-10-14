"""
Script to create the daily_vehicle_schedule_team_assignments table directly in PostgreSQL.

Usage:
    cmd /c python scripts/create_daily_vehicle_schedule_team_assignments_table.py
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

-- Create daily_vehicle_schedule_team_assignments table
CREATE TABLE IF NOT EXISTS daily_vehicle_schedule_team_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_date DATE NOT NULL,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
    daily_vehicle_schedule_id UUID REFERENCES daily_vehicle_schedules(id) ON DELETE SET NULL,
    provider_id UUID NOT NULL REFERENCES healthcare_providers(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_daily_veh_sched_team UNIQUE (schedule_date, role, provider_id, vehicle_id)
);

-- Indexes for efficient querying by date and vehicle
CREATE INDEX IF NOT EXISTS ix_daily_veh_sched_team_date ON daily_vehicle_schedule_team_assignments (schedule_date);
CREATE INDEX IF NOT EXISTS ix_daily_veh_sched_team_vehicle ON daily_vehicle_schedule_team_assignments (vehicle_id);
CREATE INDEX IF NOT EXISTS ix_daily_veh_sched_team_provider ON daily_vehicle_schedule_team_assignments (provider_id);
CREATE INDEX IF NOT EXISTS ix_daily_veh_sched_team_sched_id ON daily_vehicle_schedule_team_assignments (daily_vehicle_schedule_id);
"""


def main():
    app = create_app()
    with app.app_context():
        print("Creating daily_vehicle_schedule_team_assignments table...")
        try:
            db.session.execute(text(CREATE_TABLE_SQL))
            db.session.commit()
            print("Successfully created daily_vehicle_schedule_team_assignments table and indexes.")
        except Exception as e:
            db.session.rollback()
            print(f"Error creating table: {e}")
            sys.exit(1)


if __name__ == '__main__':
    main()
