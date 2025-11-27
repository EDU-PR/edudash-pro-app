#!/bin/bash

# Script to run new migrations from copilot/add-whatsapp-style-messaging branch
# Date: 2025-11-27

DB_HOST="aws-0-ap-southeast-1.pooler.supabase.com"
DB_PORT="6543"
DB_USER="postgres.lvvvjywrmpcqrpvuptdi"
DB_NAME="postgres"

echo "🚀 Running new migrations from copilot/add-whatsapp-style-messaging branch..."
echo ""

# Migration 1: Create homework-files bucket
echo "📦 Migration 1: Creating homework-files storage bucket..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f supabase/migrations/20251126000001_create_homework_files_bucket.sql
if [ $? -eq 0 ]; then
  echo "✅ Migration 1 completed successfully"
else
  echo "❌ Migration 1 failed"
  exit 1
fi
echo ""

# Migration 2: Allow message notification type
echo "📬 Migration 2: Adding message notification type..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f supabase/migrations/20251126113000_allow_message_notification_type.sql
if [ $? -eq 0 ]; then
  echo "✅ Migration 2 completed successfully"
else
  echo "❌ Migration 2 failed"
  exit 1
fi
echo ""

# Migration 3: Fix notifications FK to profiles
echo "🔗 Migration 3: Fixing notifications foreign key to profiles..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f supabase/migrations/20251126114000_fix_notifications_fk_to_profiles.sql
if [ $? -eq 0 ]; then
  echo "✅ Migration 3 completed successfully"
else
  echo "❌ Migration 3 failed"
  exit 1
fi
echo ""

echo "🎉 All migrations completed successfully!"
echo ""
echo "📋 Summary of applied migrations:"
echo "   1. homework-files storage bucket with RLS policies"
echo "   2. Message notification type support"
echo "   3. Notifications FK updated to reference profiles table"
