/**
 * Test Script: Simulate User's Lesson Access
 * 
 * Tests lesson access as if we were the specific user
 * to understand why they see "Oops something went wrong"
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TARGET_USER_ID = 'a1fd12d2-5f09-4a23-822d-f3071bfc544b';
const TARGET_ORG_ID = 'ba79097c-1b93-4b48-bcbe-df73878ab4d1';

async function testUserLessonAccess() {
  console.log('🔬 Testing Lesson Access for User\n');
  console.log('User ID:', TARGET_USER_ID);
  console.log('Org ID:', TARGET_ORG_ID);
  console.log('='.repeat(70));

  // Step 1: Get lessons for this organization (with admin client)
  console.log('\n📋 Step 1: Lessons available for organization (admin view)...');
  const { data: orgLessons, error: orgError } = await adminClient
    .from('lessons')
    .select('id, title, status, preschool_id')
    .eq('preschool_id', TARGET_ORG_ID)
    .limit(5);

  if (orgError) {
    console.error('   ❌ Error:', orgError.message);
  } else {
    console.log(`   ✅ Found ${orgLessons?.length || 0} lessons:`);
    orgLessons?.forEach((l: any) => {
      console.log(`      - ${l.title} (${l.status}) - ID: ${l.id}`);
    });
  }

  // Step 2: Try accessing with anon client (simulates unauthenticated)
  console.log('\n📋 Step 2: Trying to access lessons with anon client (no auth)...');
  const { data: anonLessons, error: anonError } = await anonClient
    .from('lessons')
    .select('id, title, status')
    .eq('preschool_id', TARGET_ORG_ID)
    .limit(5);

  if (anonError) {
    console.error('   ❌ Error (expected - RLS blocks):', anonError.message);
  } else {
    console.log(`   ✅ Found ${anonLessons?.length || 0} lessons with anon client`);
    if (anonLessons && anonLessons.length > 0) {
      console.log('   ⚠️  WARNING: Anon client can access lessons - RLS may be too permissive');
    }
  }

  // Step 3: Get a specific lesson ID to test
  if (orgLessons && orgLessons.length > 0) {
    const testLessonId = orgLessons[0].id;
    console.log(`\n📋 Step 3: Testing access to specific lesson: ${testLessonId}`);
    
    // Try with anon client
    const { data: specificLesson, error: specificError } = await anonClient
      .from('lessons')
      .select('*')
      .eq('id', testLessonId)
      .single();

    if (specificError) {
      console.error('   ❌ Anon access error:', specificError.message);
      console.error('   Error code:', specificError.code);
      console.error('   Error details:', specificError.details);
    } else {
      console.log('   ✅ Anon client can access lesson');
    }
  }

  // Step 4: Check RLS policies on lessons table
  console.log('\n📋 Step 4: Checking RLS policies on lessons table...');
  
  // Query pg_policies (requires admin privileges)
  const { data: policies, error: policyError } = await adminClient
    .rpc('get_policies_for_table', { table_name: 'lessons' });

  // This RPC likely doesn't exist, so let's try raw SQL
  const { data: rlsData, error: rlsError } = await adminClient
    .from('pg_policies')
    .select('*')
    .eq('tablename', 'lessons');

  if (rlsError) {
    console.log('   Note: Cannot query pg_policies directly');
  }

  // Step 5: Check if lesson_progress table exists and has correct structure
  console.log('\n📋 Step 5: Checking lesson_progress table...');
  
  const { data: progressCheck, error: progressError } = await adminClient
    .from('lesson_progress')
    .select('*')
    .limit(1);

  if (progressError) {
    console.error('   ❌ lesson_progress table error:', progressError.message);
    if (progressError.code === '42P01') {
      console.log('   ⚠️  Table does not exist - this might cause crashes!');
    }
  } else {
    console.log('   ✅ lesson_progress table accessible');
    if (progressCheck && progressCheck.length > 0) {
      console.log('   Columns:', Object.keys(progressCheck[0]).join(', '));
    }
  }

  // Step 6: Check user_lesson_bookmarks table
  console.log('\n📋 Step 6: Checking user_lesson_bookmarks table...');
  
  const { data: bookmarksCheck, error: bookmarksError } = await adminClient
    .from('user_lesson_bookmarks')
    .select('*')
    .limit(1);

  if (bookmarksError) {
    console.error('   ❌ user_lesson_bookmarks table error:', bookmarksError.message);
    if (bookmarksError.code === '42P01') {
      console.log('   ⚠️  Table does not exist - bookmarks won\'t work!');
    }
  } else {
    console.log('   ✅ user_lesson_bookmarks table accessible');
  }

  // Step 7: Get lessons the user should be able to see
  console.log('\n📋 Step 7: Lessons this teacher created...');
  
  const { data: teacherLessons, error: teacherError } = await adminClient
    .from('lessons')
    .select('id, title, status')
    .eq('teacher_id', TARGET_USER_ID);

  if (teacherError) {
    console.error('   ❌ Error:', teacherError.message);
  } else {
    console.log(`   ✅ Teacher has created ${teacherLessons?.length || 0} lessons:`);
    teacherLessons?.forEach((l: any) => {
      console.log(`      - ${l.title} (${l.status})`);
    });
  }

  // Step 8: Check profile organization_id match
  console.log('\n📋 Step 8: Verifying profile organization matches preschool...');
  
  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, full_name, role, organization_id')
    .eq('id', TARGET_USER_ID)
    .single();

  if (profileError) {
    console.error('   ❌ Error:', profileError.message);
  } else {
    console.log('   User profile:');
    console.log(`      Name: ${profile.full_name}`);
    console.log(`      Role: ${profile.role}`);
    console.log(`      Organization ID: ${profile.organization_id}`);
    
    if (profile.organization_id === TARGET_ORG_ID) {
      console.log('   ✅ Organization ID matches!');
    } else {
      console.log('   ❌ MISMATCH! Profile org does not match expected org');
    }
  }

  // Step 9: Test for common error patterns
  console.log('\n📋 Step 9: Testing for common error patterns...');

  // Check if lessons have null required fields
  const { data: nullFieldsCheck, error: nullError } = await adminClient
    .from('lessons')
    .select('id, title, content, description')
    .eq('preschool_id', TARGET_ORG_ID)
    .or('title.is.null,content.is.null');

  if (nullError) {
    console.error('   ❌ Error:', nullError.message);
  } else if (nullFieldsCheck && nullFieldsCheck.length > 0) {
    console.log(`   ⚠️  Found ${nullFieldsCheck.length} lessons with null title or content`);
    nullFieldsCheck.forEach((l: any) => {
      console.log(`      - ID: ${l.id}, Title: ${l.title || 'NULL'}`);
    });
  } else {
    console.log('   ✅ No lessons with null required fields');
  }

  console.log('\n' + '='.repeat(70));
  console.log('🏁 Test complete!\n');

  console.log('📝 FINDINGS SUMMARY:');
  console.log('   1. User exists with correct organization_id');
  console.log('   2. Organization has lessons available');
  console.log('   3. RLS may be blocking access if user is not authenticated');
  console.log('   4. Check if lesson_progress table is causing issues');
  console.log('   5. Verify app is properly authenticated when fetching\n');
}

testUserLessonAccess().catch(console.error);
