#!/usr/bin/env node

/**
 * Verify Dave Conradie tenant sync between platforms
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
  console.log('VERIFICATION: Dave Conradie Tenant Sync');
  console.log('============================================\n');

  // Check EduDashPro
  console.log('📍 EduDashPro (Education Platform)');
  const { data: edudashProfile } = await edudashClient
    .from('profiles')
    .select('id, email, role, organization_id')
    .eq('email', 'davecon12martin@outlook.com')
    .single();

  if (edudashProfile) {
    console.log(`   ✅ Profile found`);
    console.log(`   ID: ${edudashProfile.id}`);
    console.log(`   Role: ${edudashProfile.role}`);
    console.log(`   Org ID: ${edudashProfile.organization_id || 'NULL'}`);
  } else {
    console.log('   ❌ Profile not found');
  }

  // Check EduSitePro
  console.log('\n📍 EduSitePro (CMS Platform)');
  const { data: edusiteProfile } = await edusiteClient
    .from('profiles')
    .select('id, email, role, organization_id')
    .eq('email', 'davecon12martin@outlook.com')
    .single();

  if (edusiteProfile) {
    console.log(`   ✅ Profile found`);
    console.log(`   ID: ${edusiteProfile.id}`);
    console.log(`   Role: ${edusiteProfile.role}`);
    console.log(`   Org ID: ${edusiteProfile.organization_id || 'NULL'}`);
  } else {
    console.log('   ❌ Profile not found');
  }

  // Verify sync
  console.log('\n============================================');
  if (edudashProfile?.organization_id && edusiteProfile?.organization_id) {
    if (edudashProfile.organization_id === edusiteProfile.organization_id) {
      console.log('✅ SYNC SUCCESSFUL!');
      console.log(`\n🏢 Shared Organization ID: ${edudashProfile.organization_id}`);
      console.log('\n📧 Login: davecon12martin@outlook.com');
      console.log('\n🌐 Access both platforms:');
      console.log('   🎓 EduDashPro: https://edudashpro.org.za');
      console.log('   📝 EduSitePro: https://edusitepro.edudashpro.org.za');
    } else {
      console.log('⚠️  WARNING: Organization IDs do not match!');
      console.log(`   EduDashPro: ${edudashProfile.organization_id}`);
      console.log(`   EduSitePro: ${edusiteProfile.organization_id}`);
    }
  } else {
    console.log('❌ SYNC INCOMPLETE');
    if (!edudashProfile?.organization_id) {
      console.log('   - EduDashPro: Missing organization_id');
    }
    if (!edusiteProfile?.organization_id) {
      console.log('   - EduSitePro: Missing organization_id');
    }
  }
  console.log('============================================\n');
}

main().catch(console.error);
