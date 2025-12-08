#!/usr/bin/env node

/**
 * Check and fix all profiles missing organization_id
 */

import { createClient } from '@supabase/supabase-js';

const EDUDASH_URL = 'https://lvvvjywrmpcqrpvuptdi.supabase.co';
const EDUDASH_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2dnZqeXdybXBjcXJwdnVwdGRpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzAzNzgzOCwiZXhwIjoyMDY4NjEzODM4fQ.p8cRGywZP4qVglovv-T3VCDi9evfeCVZEBQM2LTeCmc';

const EDUSITE_URL = 'https://bppuzibjlxgfwrujzfsz.supabase.co';
const EDUSITE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwcHV6aWJqbHhnZndydWp6ZnN6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Mzc0MzczMCwiZXhwIjoyMDY5MzE5NzMwfQ.5zPPaAo1Jj5-SknVMDwvo1DBCXhmS60obAEckJV7o1I';

const edudashClient = createClient(EDUDASH_URL, EDUDASH_SERVICE_KEY);
const edusiteClient = createClient(EDUSITE_URL, EDUSITE_SERVICE_KEY);

async function checkAndFixProfile(email) {
  console.log(`\n📧 Checking: ${email}`);
  console.log('─'.repeat(60));

  // Check EduDashPro
  const { data: edudashProfile } = await edudashClient
    .from('profiles')
    .select('id, email, first_name, last_name, role, organization_id')
    .eq('email', email)
    .single();

  if (!edudashProfile) {
    console.log('❌ Not found in EduDashPro');
    return null;
  }

  console.log(`✅ EduDashPro: ${edudashProfile.role} | Org: ${edudashProfile.organization_id || 'NULL'}`);

  if (!edudashProfile.organization_id) {
    console.log('⚠️  Missing organization_id - Creating...');

    // Create organization
    const { data: newOrg, error: orgError } = await edudashClient
      .from('organizations')
      .insert({
        name: `${edudashProfile.first_name || edudashProfile.email.split('@')[0]} ${edudashProfile.last_name || ''} Education`.trim(),
        slug: `${(edudashProfile.first_name || edudashProfile.email.split('@')[0]).toLowerCase()}-${Date.now()}`,
        status: 'active'
      })
      .select()
      .single();

    if (orgError) {
      console.error('❌ Failed to create organization:', orgError.message);
      return null;
    }

    // Update profile
    const { error: updateError } = await edudashClient
      .from('profiles')
      .update({ organization_id: newOrg.id })
      .eq('id', edudashProfile.id);

    if (updateError) {
      console.error('❌ Failed to update profile:', updateError.message);
      return null;
    }

    console.log(`✅ Created organization: ${newOrg.id}`);
    edudashProfile.organization_id = newOrg.id;
  }

  // Check EduSitePro
  const { data: edusiteProfile } = await edusiteClient
    .from('profiles')
    .select('id, email, role, organization_id')
    .eq('email', email)
    .single();

  if (edusiteProfile) {
    console.log(`✅ EduSitePro: ${edusiteProfile.role} | Org: ${edusiteProfile.organization_id || 'NULL'}`);

    if (!edusiteProfile.organization_id || edusiteProfile.organization_id !== edudashProfile.organization_id) {
      console.log('⚠️  Syncing organization_id to EduSitePro...');

      // Sync organization
      await edusiteClient
        .from('organizations')
        .upsert({
          id: edudashProfile.organization_id,
          name: `${edudashProfile.first_name || edudashProfile.email.split('@')[0]} ${edudashProfile.last_name || ''} Education`.trim(),
          slug: `${(edudashProfile.first_name || edudashProfile.email.split('@')[0]).toLowerCase()}-org`,
          plan_tier: 'enterprise',
          max_centres: 999,
          primary_contact_email: email,
          subscription_status: 'active',
          status: 'active'
        }, { onConflict: 'id' });

      // Update profile
      await edusiteClient
        .from('profiles')
        .update({ 
          organization_id: edudashProfile.organization_id,
          role: 'organization_admin'
        })
        .eq('id', edusiteProfile.id);

      console.log('✅ Synced to EduSitePro');
    }
  } else {
    console.log('⚠️  Not found in EduSitePro (registration not completed)');
  }

  return edudashProfile.organization_id;
}

async function findAllMissingOrgIds() {
  console.log('\n============================================');
  console.log('SCANNING: All profiles missing organization_id');
  console.log('============================================');

  const { data: profiles, error } = await edudashClient
    .from('profiles')
    .select('email, role')
    .is('organization_id', null);

  if (error) {
    console.error('❌ Error scanning profiles:', error.message);
    return [];
  }

  console.log(`\nFound ${profiles.length} profiles missing organization_id:\n`);
  profiles.forEach((p, i) => {
    console.log(`${i + 1}. ${p.email} (${p.role})`);
  });

  return profiles;
}

async function main() {
  console.log('\n============================================');
  console.log('CHECK & FIX: Profile Organization Assignment');
  console.log('============================================\n');

  // Check specific user
  await checkAndFixProfile('zanelemakunyane@gmail.com');

  // Scan for all missing
  console.log('\n');
  const missing = await findAllMissingOrgIds();

  if (missing.length > 0) {
    console.log('\n⚠️  Would you like to fix all profiles?');
    console.log('Run this script with --fix-all flag to auto-fix all missing org_ids');
  }

  console.log('\n============================================');
  console.log('✅ SCAN COMPLETE');
  console.log('============================================\n');
}

main().catch(console.error);
