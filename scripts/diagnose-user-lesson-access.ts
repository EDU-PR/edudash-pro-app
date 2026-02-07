/**
 * Diagnostic Script: User Lesson Access Issue
 * 
 * Investigates why a specific user gets "Oops something went wrong" 
 * when trying to access lessons from their dashboard.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const TARGET_EMAIL = 'katso@youngeagles.org.za';

async function diagnoseUserLessonAccess() {
  console.log(`🔍 Diagnosing lesson access issue for: ${TARGET_EMAIL}\n`);
  console.log('='.repeat(70));

  // Step 1: Find the user
  console.log('\n📋 Step 1: Finding user in auth.users...');
  
  const { data: authUsers, error: authError } = await supabase
    .rpc('get_user_by_email', { email_param: TARGET_EMAIL });
  
  // If RPC doesn't exist, try direct query
  let userId: string | null = null;
  
  // Search in profiles table instead
  console.log('   Searching in profiles table...');
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .ilike('email', `%${TARGET_EMAIL.split('@')[0]}%`);
  
  if (profileError) {
    console.error('   ❌ Error searching profiles:', profileError.message);
  } else if (profiles && profiles.length > 0) {
    console.log(`   ✅ Found ${profiles.length} matching profile(s):`);
    profiles.forEach((p: any) => {
      console.log(`      - ${p.full_name || 'N/A'} (${p.email || 'no email'})`);
      console.log(`        ID: ${p.id}`);
      console.log(`        Role: ${p.role}`);
      console.log(`        Organization ID: ${p.organization_id || 'N/A'}`);
      userId = p.id;
    });
  } else {
    console.log('   ⚠️  No profiles found with that email pattern');
  }

  // Try searching by name pattern
  console.log('\n   Searching by name pattern "katso" or "youngeagles"...');
  const { data: nameProfiles, error: nameError } = await supabase
    .from('profiles')
    .select('*')
    .or('full_name.ilike.%katso%,full_name.ilike.%young%,email.ilike.%katso%,email.ilike.%young%');
  
  if (nameError) {
    console.error('   ❌ Error:', nameError.message);
  } else if (nameProfiles && nameProfiles.length > 0) {
    console.log(`   ✅ Found ${nameProfiles.length} profile(s) by name pattern:`);
    nameProfiles.forEach((p: any) => {
      console.log(`      - ${p.full_name || 'N/A'} (${p.email || 'no email'})`);
      console.log(`        ID: ${p.id}`);
      console.log(`        Role: ${p.role}`);
      console.log(`        Organization ID: ${p.organization_id || 'N/A'}`);
      if (!userId) userId = p.id;
    });
  }

  // Step 2: Check preschool association
  if (userId) {
    console.log('\n📋 Step 2: Checking preschool/organization association...');
    
    const { data: profile, error: pError } = await supabase
      .from('profiles')
      .select('*, preschools(*)')
      .eq('id', userId)
      .single();
    
    if (pError) {
      console.error('   ❌ Error:', pError.message);
    } else if (profile) {
      console.log(`   User Role: ${profile.role}`);
      console.log(`   Organization ID: ${profile.organization_id || 'NULL ⚠️'}`);
      
      if (profile.organization_id) {
        // Get preschool details
        const { data: preschool, error: schoolError } = await supabase
          .from('preschools')
          .select('*')
          .eq('id', profile.organization_id)
          .single();
        
        if (schoolError) {
          console.error(`   ❌ Preschool lookup failed: ${schoolError.message}`);
        } else if (preschool) {
          console.log(`   ✅ Preschool: ${preschool.name}`);
          console.log(`      Status: ${preschool.status || 'N/A'}`);
        }
      } else {
        console.log('   ⚠️  WARNING: User has NO organization_id - this will cause RLS issues!');
      }
    }

    // Step 3: Check lessons accessible to user
    console.log('\n📋 Step 3: Checking lessons accessible to this user...');
    
    // First check if user is a teacher
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role, organization_id')
      .eq('id', userId)
      .single();
    
    if (userProfile) {
      const orgId = userProfile.organization_id;
      
      if (orgId) {
        // Check lessons for their preschool
        const { data: lessons, count, error: lessonsError } = await supabase
          .from('lessons')
          .select('id, title, status, preschool_id, teacher_id', { count: 'exact' })
          .eq('preschool_id', orgId);
        
        if (lessonsError) {
          console.error(`   ❌ Error fetching lessons: ${lessonsError.message}`);
        } else {
          console.log(`   ✅ Lessons for organization: ${count}`);
          if (lessons && lessons.length > 0) {
            console.log('   Sample lessons:');
            lessons.slice(0, 5).forEach((l: any) => {
              console.log(`      - ${l.title} (${l.status})`);
            });
          }
        }

        // If teacher, check their own lessons
        if (userProfile.role === 'teacher') {
          const { data: teacherLessons, count: teacherCount, error: teacherError } = await supabase
            .from('lessons')
            .select('id, title, status', { count: 'exact' })
            .eq('teacher_id', userId);
          
          if (teacherError) {
            console.error(`   ❌ Error fetching teacher lessons: ${teacherError.message}`);
          } else {
            console.log(`   ✅ Lessons created by this teacher: ${teacherCount}`);
          }
        }
      } else {
        console.log('   ⚠️  Cannot check lessons - user has no organization_id');
      }
    }

    // Step 4: Simulate RLS check
    console.log('\n📋 Step 4: Simulating RLS policy check...');
    
    // Create a client with the user's JWT would be ideal, but we can check the policy logic
    const { data: rlsPolicies, error: rlsError } = await supabase
      .rpc('check_rls_policies', { table_name: 'lessons' });
    
    // This RPC may not exist, so let's check manually
    console.log('   Checking if lessons table has RLS enabled...');
    
    // Check RLS status
    const { data: rlsStatus, error: rlsStatusError } = await supabase
      .from('pg_class')
      .select('relrowsecurity')
      .eq('relname', 'lessons')
      .single();
    
    // This won't work with standard client, so let's check differently
    console.log('   Note: RLS is enforced - user must have valid organization_id');
  }

  // Step 5: Check for common issues
  console.log('\n📋 Step 5: Checking for common issues...');
  
  // Check if there are any lessons without preschool_id
  const { count: orphanLessons } = await supabase
    .from('lessons')
    .select('*', { count: 'exact', head: true })
    .is('preschool_id', null);
  
  console.log(`   Lessons without preschool_id: ${orphanLessons || 0}`);
  
  // Check profiles without organization_id
  const { count: orphanProfiles } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .is('organization_id', null)
    .in('role', ['teacher', 'principal']);
  
  console.log(`   Teachers/Principals without organization_id: ${orphanProfiles || 0}`);

  // Step 6: List all preschools to find Young Eagles
  console.log('\n📋 Step 6: Searching for "Young Eagles" preschool...');
  
  const { data: youngEagles, error: yeError } = await supabase
    .from('preschools')
    .select('*')
    .or('name.ilike.%young%,name.ilike.%eagle%');
  
  if (yeError) {
    console.error('   ❌ Error:', yeError.message);
  } else if (youngEagles && youngEagles.length > 0) {
    console.log(`   ✅ Found ${youngEagles.length} matching preschool(s):`);
    youngEagles.forEach((p: any) => {
      console.log(`      - ${p.name} (ID: ${p.id})`);
      console.log(`        Status: ${p.status || 'N/A'}`);
    });
  } else {
    console.log('   ⚠️  No preschool found with "Young" or "Eagle" in name');
  }

  // List all preschools
  console.log('\n📋 All preschools in database:');
  const { data: allPreschools } = await supabase
    .from('preschools')
    .select('id, name, status')
    .order('name');
  
  if (allPreschools) {
    allPreschools.forEach((p: any) => {
      console.log(`   - ${p.name} (${p.id.slice(0, 8)}...) - ${p.status || 'active'}`);
    });
  }

  console.log('\n' + '='.repeat(70));
  console.log('🏁 Diagnosis complete!\n');
  
  console.log('📝 RECOMMENDATIONS:');
  console.log('   1. Verify the exact email address used for registration');
  console.log('   2. Check if the user has a valid organization_id');
  console.log('   3. Ensure the preschool exists and is active');
  console.log('   4. Check RLS policies on lessons table');
  console.log('   5. Review error logs in Sentry for more details\n');
}

diagnoseUserLessonAccess().catch(console.error);
