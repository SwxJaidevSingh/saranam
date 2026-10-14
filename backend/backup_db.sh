#!/bin/bash

# =============================================================================
# Supabase Local Backup Script
# Automatically creates a timestamped SQL dump of the Supabase database.
# =============================================================================

# Set this to your exact Neon Database URL
set -o pipefail
DATABASE_URL="postgresql://neondb_owner:npg_Ftn08NymXKpO@ep-small-cloud-a4mq6l2y-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

# Create a backups directory if it doesn't exist
BACKUP_DIR="$(pwd)/backups"
mkdir -p "$BACKUP_DIR"

# Generate a timestamp for the filename
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/cv_raman_health_backup_$TIMESTAMP.sql.gz"

# Set up logging
LOG_FILE="$BACKUP_DIR/backup_log.txt"
exec 1>>"$LOG_FILE"
exec 2>&1

echo "=================================================="
echo "Starting database backup from Neon DB..."

# Use PostgreSQL 17 pg_dump to match Neon DB server version
PG_DUMP_CMD="/opt/homebrew/opt/postgresql@17/bin/pg_dump"

# Run pg_dump and compress it with gzip
$PG_DUMP_CMD --clean -d "$DATABASE_URL" | gzip > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Backup successfully created at: $BACKUP_FILE"
    
    # Retention Policy: Delete backups older than 7 days
    echo "Applying retention policy: Deleting backups older than 7 days..."
    find "$BACKUP_DIR" -name "cv_raman_health_backup_*.sql.gz" -type f -mtime +7 -exec rm {} \;
    echo "✅ Backup process completed successfully."
else
    echo "❌ Error: Backup failed!"
fi
