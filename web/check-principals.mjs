#!/usr/bin/env node

/**
 * Check principals and superadmin in EduSitePro
 */

import { createClient } from '@supabase/supabase-js';

const EDUSITE_URL = 'https://bppuzibjlxgfwrujzfsz.supabase.co';
const EDUSITE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwcHV6aWJqbHhnZndydWp6ZnN6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Mzc0MzczMCwiZXhwIjoyMDY5MzE5NzMwfQ.5zPPaAo1Jj5-SknVMDwvo1DBCXhmS60obAEckJV7o1I';

const edusiteClient = createClient(EDUSITE_URL, EDUSITE_SERVICE_KEY);

const EMAILS = [
  'am.makunyaneann@gmail.com',
  'info@soa.co.za',
  'superadmin@edudashpro.org.za'
];

async function main() {
  console.log('\n============================================');
  console.log('CHECK: Principals and SuperAdmin');
  console.log('============================================\n');

  for (const email of EMAILS) {
    console.log(`\n📧 ${email}`);
    console.log('─'.repeat(60));

    // Check profile
    const { data: profile } = await edusiteClient
      .from('profiles')
      .select('*')
      .eq('email', email)
      .single();

    if (profile) {
      console.log(`   ✅ Profile found in EduSitePro`);
      console.log(`      Role: ${profile.role}`);
      console.log(`      Org ID: ${profile.organization_id || '❌ NULL'}`);
    } else {
      console.log(`   ⚠️  No profile in EduSitePro`);
    }

    // Check registration request
    const { data: regRequest } = await edusiteClient
      .from('organization_registration_requests')
      .select('*')
      .eq('email', email)
      .single();

    if (regRequest) {
      console.log(`   ✅ Registration request found`);
      console.log(`      Status: ${regRequest.status}`);
      console.log(`      Org Name: ${regRequest.organization_name}`);
      console.log(`      Org Slug: ${regRequest.organization_slug}`);
      console.log(`      Created Org ID: ${regRequest.created_organization_id || 'Not created yet'}`);
    } else {
      console.log(`   ⚠️  No registration request`);
    }

    // Recommendation
    if (regRequest?.created_organization_id) {
      console.log(`\n   💡 FIX: Assign org_id: ${regRequest.created_organization_id}`);
    } else if (email === 'superadmin@edudashpro.org.za') {
      console.log(`\n   💡 SuperAdmin: Should NOT have org_id (platform-wide access)`);
    } else {
      console.log(`\n   💡 FIX: Create organization first, then assign`);
    }
  }

  console.log('\n\n============================================\n');
}

main().catch(console.error);
