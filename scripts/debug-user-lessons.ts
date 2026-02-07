/**
 * Debug Script: User Lesson Access Issues
 * 
 * Investigates why a specific user gets "Oops something went wrong"
 * when accessing lessons from their dashboard.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const USER_EMAIL = 'katso@youngeagles.org.za';

async function debugUserLessonAccess() {
  console.log(`🔍 Debugging Lesson Access for: ${USER_EMAIL}\n`);
  console.log('='.repeat(70));

  // Step 1: Find user in auth.users
  console.log('\n📋 Step 1: Finding user in auth.users...');
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
  
  if (authError) {
    console.error('❌ Error listing users:', authError.message);
    return;
  }

  const authUser = authUsers.users.find(u => u.email === USER_EMAIL);
  if (!authUser) {
    console.error(`❌ User ${USER_EMAIL} not found in auth.users`);
    return;
  }

  console.log(`✅ Found user in auth.users:`);
  console.log(`   ID: ${authUser.id}`);
  console.log(`   Email: ${authUser.email}`);
  console.log(`   Created: ${authUser.created_at}`);
  console.log(`   Last sign in: ${authUser.last_sign_in_at || 'Never'}`);
  console.log(`   Confirmed: ${authUser.email_confirmed_at ? 'Yes' : 'No'}`);

  const userId = authUser.id;

  // Step 2: Find user profile
  console.log('\n📋 Step 2: Checking profiles table...');
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (profileError) {
    console.error('❌ Error fetching profile:', profileError.message);
    console.log('   This might be why lessons fail - no profile record!');
  } else if (profile) {
    console.log(`✅ Found profile:`);
    console.log(`   Full name: ${profile.full_name || 'Not set'}`);
    console.log(`   Role: ${profile.role}`);
    console.log(`   Organization ID: ${profile.organization_id || 'None'}`);
    console.log(`   Preschool ID: ${profile.preschool_id || 'None'}`);
    console.log(`   Status: ${profile.status || 'Not set'}`);
    console.log(`   Is active: ${profile.is_active}`);
  }

  // Step 3: Check organization/preschool membership
  console.log('\n📋 Step 3: Checking preschool membership...');
  
  if (profile?.preschool_id) {
    const { data: preschool, error: preschoolError } = await supabase
      .from('preschools')
      .select('*')
      .eq('id', profile.preschool_id)
      .single();

    if (preschoolError) {
      console.error('❌ Error fetching preschool:', preschoolError.message);
    } else if (preschool) {
      console.log(`✅ Belongs to preschool:`);
      console.log(`   Name: ${preschool.name}`);
      console.log(`   ID: ${preschool.id}`);
      console.log(`   Status: ${preschool.status || 'Not set'}`);
    }
  } else if (profile?.organization_id) {
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', profile.organization_id)
      .single();

    if (orgError) {
      console.error('❌ Error fetching organization:', orgError.message);
    } else if (org) {
      console.log(`✅ Belongs to organization:`);
      console.log(`   Name: ${org.name}`);
      console.log(`   ID: ${org.id}`);
    }
  } else {
    console.log('⚠️  User has NO preschool_id or organization_id!');
    console.log('   This is likely causing the lesson access failure.');
  }

  // Step 4: Check if user is a teacher with classes
  console.log('\n📋 Step 4: Checking teacher assignments...');
  
  if (profile?.role === 'teacher') {
    // Check class_teachers junction table
    const { data: classTeachers, error: ctError } = await supabase
      .from('class_teachers')
      .select('*, classes(*)')
      .eq('teacher_id', userId);

    if (ctError) {
      console.log('   ⚠️  class_teachers table error:', ctError.message);
    } else if (classTeachers && classTeachers.length > 0) {
      console.log(`✅ Teacher is assigned to ${classTeachers.length} class(es):`);
      classTeachers.forEach((ct: any) => {
        console.log(`   - ${ct.classes?.name || 'Unknown class'} (${ct.class_id?.slice(0,8)}...)`);
      });
    } else {
      console.log('   ⚠️  Teacher has no class assignments');
    }

    // Also check classes table directly
    const { data: ownedClasses, error: ocError } = await supabase
      .from('classes')
      .select('id, name, preschool_id')
      .eq('teacher_id', userId);

    if (ocError) {
      console.log('   ⚠️  Error checking owned classes:', ocError.message);
    } else if (ownedClasses && ownedClasses.length > 0) {
      console.log(`✅ Teacher owns ${ownedClasses.length} class(es):`);
      ownedClasses.forEach((c: any) => {
        console.log(`   - ${c.name} (${c.id?.slice(0,8)}...)`);
      });
    }
  }

  // Step 5: Try to fetch lessons as this user would
  console.log('\n📋 Step 5: Simulating lesson fetch for user...');
  
  const preschoolId = profile?.preschool_id || profile?.organization_id;
  
  if (!preschoolId) {
    console.error('❌ Cannot fetch lessons - user has no preschool/organization ID');
    console.log('\n🔧 SOLUTION: User needs to be assigned to a preschool/organization');
    return;
  }

  // Fetch lessons the way the app would
  const { data: lessons, error: lessonsError } = await supabase
    .from('lessons')
    .select('id, title, status, teacher_id, preschool_id')
    .eq('preschool_id', preschoolId)
    .limit(10);

  if (lessonsError) {
    console.error('❌ Error fetching lessons:', lessonsError.message);
    console.log('   This is likely the cause of the "Oops" error!');
  } else {
    console.log(`✅ Found ${lessons?.length || 0} lessons for preschool ${preschoolId.slice(0,8)}...`);
    if (lessons && lessons.length > 0) {
      lessons.slice(0, 5).forEach((l: any) => {
        console.log(`   - ${l.title} (${l.status})`);
      });
    }
  }

  // Step 6: Check if user has any lessons assigned directly
  console.log('\n📋 Step 6: Checking lessons by teacher_id...');
  const { data: teacherLessons, error: tlError } = await supabase
    .from('lessons')
    .select('id, title, status, preschool_id')
    .eq('teacher_id', userId);

  if (tlError) {
    console.error('❌ Error:', tlError.message);
  } else {
    console.log(`✅ User has created ${teacherLessons?.length || 0} lessons directly`);
    if (teacherLessons && teacherLessons.length > 0) {
      teacherLessons.slice(0, 3).forEach((l: any) => {
        console.log(`   - ${l.title} (preschool: ${l.preschool_id?.slice(0,8) || 'none'}...)`);
      });
    }
  }

  // Step 7: Check RLS policies that might affect this user
  console.log('\n📋 Step 7: Checking potential RLS issues...');
  
  // Simulate what RLS would do - check if user's preschool matches lesson preschool
  if (profile?.role === 'teacher' && preschoolId) {
    const { data: accessibleLessons, error: alError } = await supabase
      .from('lessons')
      .select('id, title, preschool_id, teacher_id')
      .or(`preschool_id.eq.${preschoolId},teacher_id.eq.${userId}`)
      .limit(5);

    if (alError) {
      console.error('❌ Error checking accessible lessons:', alError.message);
    } else {
      console.log(`✅ Lessons accessible via RLS (preschool OR teacher): ${accessibleLessons?.length || 0}`);
    }
  }

  // Summary and recommendations
  console.log('\n' + '='.repeat(70));
  console.log('📊 DIAGNOSIS SUMMARY:');
  console.log('='.repeat(70));

  const issues: string[] = [];
  
  if (!profile) {
    issues.push('❌ No profile record exists for this user');
  }
  if (!profile?.preschool_id && !profile?.organization_id) {
    issues.push('❌ User has no preschool_id or organization_id');
  }
  if (profile?.is_active === false) {
    issues.push('❌ User profile is marked as inactive');
  }
  if (profile?.status === 'suspended' || profile?.status === 'inactive') {
    issues.push(`❌ User status is: ${profile?.status}`);
  }

  if (issues.length === 0) {
    console.log('✅ No obvious issues found with user configuration');
    console.log('   The error might be in the frontend code or a specific lesson');
  } else {
    console.log('Found the following issues:');
    issues.forEach(issue => console.log(`   ${issue}`));
    
    console.log('\n🔧 RECOMMENDED FIXES:');
    if (!profile?.preschool_id && !profile?.organization_id) {
      console.log('   1. Assign user to a preschool:');
      console.log(`      UPDATE profiles SET preschool_id = '<preschool-uuid>' WHERE id = '${userId}';`);
    }
    if (!profile) {
      console.log('   1. Create a profile for this user');
    }
  }

  console.log('\n');
}

debugUserLessonAccess().catch(console.error);
