#!/bin/bash

# =============================================================================
# EDUDASH PRO - DATABASE AUDIT RUNNER
# =============================================================================
# Purpose: Run comprehensive database audit via psql
# Usage: ./scripts/run-database-audit.sh [output_file]
# =============================================================================

set -e

# Database connection details
DB_HOST="aws-0-ap-southeast-1.pooler.supabase.com"
DB_PORT="6543"
DB_USER="postgres.lvvvjywrmpcqrpvuptdi"
DB_NAME="postgres"
DB_PASSWORD="hHFgMNhsfdUKUEkA"

# Output file (optional)
OUTPUT_FILE="${1:-docs/DATABASE_AUDIT_REPORT_$(date +%Y%m%d_%H%M%S).txt}"

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
AUDIT_SQL="$PROJECT_ROOT/scripts/database-audit.sql"

# Check if audit SQL file exists
if [ ! -f "$AUDIT_SQL" ]; then
    echo "Error: Audit SQL file not found at $AUDIT_SQL"
    exit 1
fi

# Create output directory if it doesn't exist
OUTPUT_DIR="$(dirname "$OUTPUT_FILE")"
if [ ! -d "$OUTPUT_DIR" ]; then
    mkdir -p "$OUTPUT_DIR"
fi

echo "============================================================================="
echo "EDUDASH PRO - DATABASE AUDIT"
echo "============================================================================="
echo "Host: $DB_HOST"
echo "Port: $DB_PORT"
echo "Database: $DB_NAME"
echo "Output: $OUTPUT_FILE"
echo "============================================================================="
echo ""

# Set PGPASSWORD environment variable for non-interactive password
export PGPASSWORD="$DB_PASSWORD"

# Run the audit
echo "Running database audit..."
psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -f "$AUDIT_SQL" \
    > "$OUTPUT_FILE" 2>&1

# Check exit status
if [ $? -eq 0 ]; then
    echo "✓ Audit completed successfully"
    echo "Results saved to: $OUTPUT_FILE"
    echo ""
    echo "Review the output file for all issues."
else
    echo "✗ Audit failed. Check the output file for errors: $OUTPUT_FILE"
    exit 1
fi

# Unset password
unset PGPASSWORD

