/**
 * Apply Lessons RLS Fix Migration
 * 
 * Fixes the "permission denied for schema app_auth" error
 * by replacing RLS policies that reference app_auth schema
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function applyMigration() {
  console.log('🔧 Applying Lessons RLS Fix Migration\n');
  console.log('='.repeat(60));

  // Step 1: Test current access (this will likely fail)
  console.log('\n📋 Step 1: Testing current lessons access...');
  const { data: beforeTest, error: beforeError } = await supabase
    .from('lessons')
    .select('id')
    .limit(1);
  
  if (beforeError) {
    console.log('   Current state: Error -', beforeError.message);
  } else {
    console.log('   Current state: OK (', beforeTest?.length, 'lessons accessible)');
  }

  // Step 2: Execute the migration SQL using rpc
  console.log('\n📋 Step 2: Applying migration via SQL...');
  
  // We need to execute raw SQL - let's use the REST API
  const migrationSQL = `
    -- Drop existing problematic policies
    DROP POLICY IF EXISTS "lessons_rls_read" ON lessons;
    DROP POLICY IF EXISTS "lessons_rls_write" ON lessons;
    DROP POLICY IF EXISTS "lessons_tenant_isolation" ON lessons;
    DROP POLICY IF EXISTS "lessons_select_policy" ON lessons;
    DROP POLICY IF EXISTS "lessons_insert_policy" ON lessons;
    DROP POLICY IF EXISTS "lessons_update_policy" ON lessons;
    DROP POLICY IF EXISTS "lessons_delete_policy" ON lessons;
    DROP POLICY IF EXISTS "service_role_access" ON lessons;
    DROP POLICY IF EXISTS "authenticated_access" ON lessons;
    
    -- Create simple service role bypass
    CREATE POLICY "lessons_service_role_full_access"
    ON lessons FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
    
    -- Create authenticated user access
    CREATE POLICY "lessons_authenticated_read"
    ON lessons FOR SELECT
    TO authenticated
    USING (
      -- Users can see lessons from their org
      preschool_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
      OR
      -- Or public lessons
      is_public = true
    );
    
    -- Teachers can manage their own lessons
    CREATE POLICY "lessons_teacher_manage"
    ON lessons FOR ALL
    TO authenticated
    USING (teacher_id = auth.uid())
    WITH CHECK (teacher_id = auth.uid());
  `;

  // The Supabase client doesn't allow raw SQL, but we can test if the fix is needed
  // For now, let's verify the issue and provide manual instructions
  
  console.log('   Note: SQL migration needs to be applied via Supabase Dashboard');
  console.log('   Go to: https://supabase.com/dashboard/project/lvvvjywrmpcqrpvuptdi/sql');
  console.log('\n   Copy and paste the contents of:');
  console.log('   migrations/fix_lessons_app_auth_error.sql');

  // Step 3: Check if user_lesson_bookmarks exists
  console.log('\n📋 Step 3: Checking user_lesson_bookmarks table...');
  const { error: bookmarksError } = await supabase
    .from('user_lesson_bookmarks')
    .select('id')
    .limit(1);
  
  if (bookmarksError) {
    console.log('   ❌ Table missing:', bookmarksError.message);
    console.log('   This also needs to be created via the migration SQL');
  } else {
    console.log('   ✅ Table exists');
  }

  console.log('\n' + '='.repeat(60));
  console.log('📝 MANUAL STEPS REQUIRED:');
  console.log('');
  console.log('1. Open Supabase Dashboard SQL Editor:');
  console.log('   https://supabase.com/dashboard/project/lvvvjywrmpcqrpvuptdi/sql/new');
  console.log('');
  console.log('2. Copy the SQL from: migrations/fix_lessons_app_auth_error.sql');
  console.log('');
  console.log('3. Run the SQL');
  console.log('');
  console.log('4. Test that katso@youngeagles.org.za can access lessons');
  console.log('');
}

applyMigration().catch(console.error);
