#!/usr/bin/env node

/**
 * Sync existing users to new user_profiles table
 * This script populates the new user_profiles table with existing user data
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function syncUserProfiles() {
  console.log('🔄 Syncing existing users to user_profiles table...');
  console.log('=' .repeat(60));

  try {
    // First, let's see what tables exist and their structure
    console.log('\n📊 Checking existing user data sources...');
    
    // Try to get data from profiles table (old structure)
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .limit(5);
    
    if (!profilesError && profiles) {
      console.log(`✅ Found ${profiles.length} profiles (sample):`, profiles[0]);
    } else {
      console.log('⚠️ Profiles table error or empty:', profilesError);
    }

    // Try to get data from users table
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .limit(5);
    
    if (!usersError && users) {
      console.log(`✅ Found ${users.length} users (sample):`, users[0]);
    } else {
      console.log('⚠️ Users table error or empty:', usersError);
    }

    // Check current user_profiles content
    console.log('\n🔍 Checking current user_profiles table...');
    const { data: currentProfiles, error: currentError } = await supabase
      .from('user_profiles')
      .select('*');
    
    if (!currentError) {
      console.log(`📋 Current user_profiles count: ${currentProfiles?.length || 0}`);
      if (currentProfiles?.length > 0) {
        console.log('Sample user_profile:', currentProfiles[0]);
      }
    } else {
      console.log('❌ Error accessing user_profiles:', currentError);
    }

    // Try to sync data from the most likely source
    let sourceData = [];
    let sourceTable = '';

    if (profiles && profiles.length > 0) {
      sourceData = profiles;
      sourceTable = 'profiles';
      console.log(`\n🎯 Using profiles table as source (${profiles.length} records)`);
    } else if (users && users.length > 0) {
      sourceData = users;
      sourceTable = 'users';
      console.log(`\n🎯 Using users table as source (${users.length} records)`);
    } else {
      console.log('\n❌ No source data found in profiles or users tables');
      return;
    }

    // Get more complete data from source table
    const { data: allSourceData, error: sourceError } = await supabase
      .from(sourceTable)
      .select('*');
    
    if (sourceError) {
      console.log('❌ Error getting source data:', sourceError);
      return;
    }

    console.log(`\n📥 Processing ${allSourceData.length} records from ${sourceTable}...`);

    let synced = 0;
    let errors = 0;

    for (const record of allSourceData) {
      try {
        // Map fields based on source table
        let userData;
        
        if (sourceTable === 'profiles') {
          userData = {
            user_id: record.id, // profiles.id maps to auth.users.id
            email: record.email || record.username,
            full_name: record.full_name || `${record.first_name || ''} ${record.last_name || ''}`.trim(),
            phone: record.phone,
            role: normalizeRole(record.role),
            tenant_id: record.preschool_id || record.organization_id,
            is_active: record.is_active !== false,
          };
        } else {
          // users table
          userData = {
            user_id: record.auth_user_id,
            email: record.email,
            full_name: record.full_name || `${record.first_name || ''} ${record.last_name || ''}`.trim(),
            phone: record.phone,
            role: normalizeRole(record.role),
            tenant_id: record.preschool_id || record.organization_id,
            is_active: record.is_active !== false,
          };
        }

        // Skip if essential fields are missing
        if (!userData.user_id || !userData.email) {
          console.log(`⚠️ Skipping record - missing user_id or email:`, record);
          continue;
        }

        // Insert or update user_profile
        const { error: upsertError } = await supabase
          .from('user_profiles')
          .upsert(userData, { 
            onConflict: 'user_id',
            ignoreDuplicates: false 
          });

        if (upsertError) {
          console.log(`❌ Error syncing user ${userData.email}:`, upsertError);
          errors++;
        } else {
          console.log(`✅ Synced: ${userData.email} (${userData.role})`);
          synced++;
        }

      } catch (_err) {
        console.log(`❌ Exception processing record:`, _err);
        errors++;
      }
    }

    console.log('\n' + '=' .repeat(60));
    console.log(`📊 Sync Summary:`);
    console.log(`   ✅ Successfully synced: ${synced}`);
    console.log(`   ❌ Errors: ${_errors}`);
    console.log(`   📋 Total processed: ${allSourceData.length}`);

    // Now test our superadmin functions
    console.log('\n🧪 Testing superadmin system after sync...');
    const { data: testResults, error: testError } = await supabase.rpc('test_superadmin_system');
    
    if (testError) {
      console.log('❌ Test function error:', testError);
    } else {
      console.log('✅ Test Results:');
      console.log(`   • Total Tests: ${testResults.total_tests}`);
      console.log(`   • Passed: ${testResults.passed}`);
      console.log(`   • Failed: ${testResults.failed}`);
      
      if (testResults.results) {
        testResults.results.forEach((result, index) => {
          const status = result.status === 'passed' ? '✅' : '❌';
          console.log(`   ${index + 1}. ${result.test}: ${status}`);
        });
      }
    }

  } catch (_error) {
    console._error('\n❌ Critical _error:', _error);
  }
}

// Helper function to normalize role values
function normalizeRole(role) {
  if (!role) return 'user';
  
  const normalized = String(role).trim().toLowerCase();
  
  // Map to our expected role format
  if (normalized.includes('super') || normalized === 'superadmin') {
    return 'super_admin';
  }
  if (normalized.includes('principal') || normalized === 'admin') {
    return 'principal_admin';
  }
  if (normalized.includes('teacher')) {
    return 'teacher';
  }
  if (normalized.includes('parent')) {
    return 'parent';
  }
  
  return 'user'; // default
}

// Run the sync
syncUserProfiles().then(() => {
  console.log('\n✅ User profile sync complete!');
}).catch(error => {
  console.error('❌ Sync failed:', _error);
  process.exit(1);
});