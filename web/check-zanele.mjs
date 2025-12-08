#!/usr/bin/env node

/**
 * Check Zanele Makunyane in both databases
 */

import { createClient } from '@supabase/supabase-js';

const EDUDASH_URL = 'https://lvvvjywrmpcqrpvuptdi.supabase.co';
const EDUDASH_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2dnZqeXdybXBjcXJwdnVwdGRpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzAzNzgzOCwiZXhwIjoyMDY4NjEzODM4fQ.p8cRGywZP4qVglovv-T3VCDi9evfeCVZEBQM2LTeCmc';

const EDUSITE_URL = 'https://bppuzibjlxgfwrujzfsz.supabase.co';
const EDUSITE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwcHV6aWJqbHhnZndydWp6ZnN6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Mzc0MzczMCwiZXhwIjoyMDY5MzE5NzMwfQ.5zPPaAo1Jj5-SknVMDwvo1DBCXhmS60obAEckJV7o1I';

const edudashClient = createClient(EDUDASH_URL, EDUDASH_SERVICE_KEY);
const edusiteClient = createClient(EDUSITE_URL, EDUSITE_SERVICE_KEY);

async function main() {
  console.log('\n============================================');
  console.log('CHECK: zanelemakunyane@gmail.com');
  console.log('============================================\n');

  // Check EduDashPro
  console.log('📍 EduDashPro (Education Platform)');
  const { data: edudashProfile } = await edudashClient
    .from('profiles')
    .select('*')
    .eq('email', 'zanelemakunyane@gmail.com')
    .single();

  if (edudashProfile) {
    console.log(`   ✅ Profile found`);
    console.log(`   ID: ${edudashProfile.id}`);
    console.log(`   Name: ${edudashProfile.first_name} ${edudashProfile.last_name}`);
    console.log(`   Role: ${edudashProfile.role}`);
    console.log(`   Org ID: ${edudashProfile.organization_id || '❌ NULL (MISSING!)'}`);
  } else {
    console.log('   ⚠️  Profile not found');
  }

  // Check EduSitePro
  console.log('\n📍 EduSitePro (CMS Platform)');
  const { data: edusiteProfile } = await edusiteClient
    .from('profiles')
    .select('*')
    .eq('email', 'zanelemakunyane@gmail.com')
    .single();

  if (edusiteProfile) {
    console.log(`   ✅ Profile found`);
    console.log(`   ID: ${edusiteProfile.id}`);
    console.log(`   Name: ${edusiteProfile.full_name}`);
    console.log(`   Role: ${edusiteProfile.role}`);
    console.log(`   Org ID: ${edusiteProfile.organization_id || '❌ NULL (MISSING!)'}`);
  } else {
    console.log('   ⚠️  Profile not found');
  }

  // Check for registration request in EduSitePro
  console.log('\n📍 EduSitePro Registration Requests');
  const { data: regRequest } = await edusiteClient
    .from('organization_registration_requests')
    .select('*')
    .eq('email', 'zanelemakunyane@gmail.com')
    .single();

  if (regRequest) {
    console.log(`   ✅ Registration request found`);
    console.log(`   Status: ${regRequest.status}`);
    console.log(`   Org Name: ${regRequest.organization_name}`);
    console.log(`   Org Slug: ${regRequest.organization_slug}`);
    console.log(`   Created Org ID: ${regRequest.created_organization_id || 'Not created yet'}`);
  } else {
    console.log('   ⚠️  No registration request found');
  }

  // Summary
  console.log('\n============================================');
  console.log('ANALYSIS');
  console.log('============================================\n');

  if (edudashProfile && edusiteProfile) {
    if (edudashProfile.organization_id && edusiteProfile.organization_id) {
      if (edudashProfile.organization_id === edusiteProfile.organization_id) {
        console.log('✅ Profiles synced correctly with same org_id');
      } else {
        console.log('⚠️  WARNING: Different organization_ids in each database!');
        console.log(`   EduDashPro: ${edudashProfile.organization_id}`);
        console.log(`   EduSitePro: ${edusiteProfile.organization_id}`);
      }
    } else {
      console.log('❌ Missing organization_id in one or both databases');
      if (!edudashProfile.organization_id) {
        console.log('   - EduDashPro: Missing');
      }
      if (!edusiteProfile.organization_id) {
        console.log('   - EduSitePro: Missing');
      }
      
      if (regRequest?.created_organization_id) {
        console.log(`\n💡 Suggestion: Use organization_id from registration: ${regRequest.created_organization_id}`);
      }
    }
  } else if (edudashProfile && !edusiteProfile) {
    console.log('⚠️  User exists in EduDashPro but not EduSitePro');
    console.log('   This is expected if they registered directly in the app');
  } else if (!edudashProfile && edusiteProfile) {
    console.log('⚠️  User exists in EduSitePro but not EduDashPro');
    console.log('   This should NOT happen - registration should sync both');
  } else {
    console.log('❌ User not found in either database');
  }

  console.log('\n============================================\n');
}

main().catch(console.error);
