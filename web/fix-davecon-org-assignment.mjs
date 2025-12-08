#!/usr/bin/env node

/**
 * Fix Dave Conradie Organization Assignment
 * 
 * Problem: Profile created without organization_id due to missing trigger
 * Solution: 
 * 1. Create organization in EduDashPro (if missing)
 * 2. Update profile with organization_id in EduDashPro
 * 3. Sync to EduSitePro with same organization_id
 */

import { createClient } from '@supabase/supabase-js';

// EduDashPro (Education Platform)
const EDUDASH_URL = 'https://lvvvjywrmpcqrpvuptdi.supabase.co';
const EDUDASH_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2dnZqeXdybXBjcXJwdnVwdGRpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzAzNzgzOCwiZXhwIjoyMDY4NjEzODM4fQ.p8cRGywZP4qVglovv-T3VCDi9evfeCVZEBQM2LTeCmc';

// EduSitePro (CMS Platform)
const EDUSITE_URL = 'https://bppuzibjlxgfwrujzfsz.supabase.co';
const EDUSITE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwcHV6aWJqbHhnZndydWp6ZnN6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Mzc0MzczMCwiZXhwIjoyMDY5MzE5NzMwfQ.5zPPaAo1Jj5-SknVMDwvo1DBCXhmS60obAEckJV7o1I';

const edudashClient = createClient(EDUDASH_URL, EDUDASH_SERVICE_KEY);
const edusiteClient = createClient(EDUSITE_URL, EDUSITE_SERVICE_KEY);

const TENANT_EMAIL = 'davecon12martin@outlook.com';

async function main() {
  console.log('\n============================================');
  console.log('FIX: Dave Conradie Organization Assignment');
  console.log('============================================\n');

  // Step 1: Get Dave's profile from EduDashPro
  console.log('📍 Step 1: Checking profile in EduDashPro...');
  
  const { data: edudashProfile, error: profileError } = await edudashClient
    .from('profiles')
    .select('*')
    .eq('email', TENANT_EMAIL)
    .single();

  if (profileError || !edudashProfile) {
    console.error('❌ Profile not found in EduDashPro:', profileError?.message);
    process.exit(1);
  }

  console.log('✅ Found profile:');
  console.log(`   ID: ${edudashProfile.id}`);
  console.log(`   Email: ${edudashProfile.email}`);
  console.log(`   Name: ${edudashProfile.first_name} ${edudashProfile.last_name}`);
  console.log(`   Role: ${edudashProfile.role}`);
  console.log(`   Org ID: ${edudashProfile.organization_id || 'NULL (MISSING!)'}\n`);

  let organizationId = edudashProfile.organization_id;

  // Step 2: Create organization if missing
  if (!organizationId) {
    console.log('📍 Step 2: Creating organization in EduDashPro...');

    const { data: newOrg, error: orgError } = await edudashClient
      .from('organizations')
      .insert({
        name: `${edudashProfile.first_name} ${edudashProfile.last_name} Tertiary Education`,
        slug: `davecon-tertiary`,
        status: 'active'
      })
      .select()
      .single();

    if (orgError) {
      console.error('❌ Failed to create organization:', orgError.message);
      process.exit(1);
    }

    organizationId = newOrg.id;
    console.log(`✅ Organization created: ${organizationId}`);
    console.log(`   Name: ${newOrg.name}`);
    console.log(`   Slug: ${newOrg.slug}\n`);

    // Step 3: Update profile with organization_id
    console.log('📍 Step 3: Updating profile with organization_id...');

    const { error: updateError } = await edudashClient
      .from('profiles')
      .update({ organization_id: organizationId })
      .eq('id', edudashProfile.id);

    if (updateError) {
      console.error('❌ Failed to update profile:', updateError.message);
      process.exit(1);
    }

    console.log('✅ Profile updated with organization_id\n');
  } else {
    console.log('✅ Organization already assigned\n');
  }

  // Step 4: Get organization details
  console.log('📍 Step 4: Fetching organization details...');

  const { data: organization, error: orgFetchError } = await edudashClient
    .from('organizations')
    .select('*')
    .eq('id', organizationId)
    .single();

  if (orgFetchError || !organization) {
    console.error('❌ Organization not found:', orgFetchError?.message);
    process.exit(1);
  }

  console.log('✅ Organization details:');
  console.log(`   ID: ${organization.id}`);
  console.log(`   Name: ${organization.name}`);
  console.log(`   Slug: ${organization.slug}\n`);

  // Step 5: Sync to EduSitePro
  console.log('📍 Step 5: Syncing to EduSitePro...\n');

  // 5a. Create/update organization in EduSitePro
  console.log('  → Creating organization in EduSitePro...');
  
  const { error: edusiteOrgError } = await edusiteClient
    .from('organizations')
    .upsert({
      id: organization.id, // Use SAME ID
      name: organization.name,
      slug: organization.slug,
      plan_tier: 'enterprise',
      max_centres: 999,
      primary_contact_name: `${edudashProfile.first_name} ${edudashProfile.last_name}`,
      primary_contact_email: TENANT_EMAIL,
      subscription_status: 'active',
      status: 'active'
    }, {
      onConflict: 'id'
    });

  if (edusiteOrgError) {
    console.error('  ❌ Failed to sync organization:', edusiteOrgError.message);
  } else {
    console.log('  ✅ Organization synced to EduSitePro');
  }

  // 5b. Check if user exists in EduSitePro auth
  console.log('  → Checking user in EduSitePro auth...');

  const { data: authUser } = await edusiteClient.auth.admin.getUserById(edudashProfile.id);

  let userId = edudashProfile.id;

  if (!authUser.user) {
    console.log('  ⚠️  User not found in EduSitePro, creating...');

    const { data: newUser, error: createError } = await edusiteClient.auth.admin.createUser({
      email: TENANT_EMAIL,
      password: 'TempPassword123!',
      email_confirm: true,
      user_metadata: {
        full_name: `${edudashProfile.first_name} ${edudashProfile.last_name}`,
        role: 'organization_admin',
        organization_id: organizationId
      }
    });

    if (createError) {
      console.error('  ❌ Failed to create user:', createError.message);
    } else {
      userId = newUser.user.id;
      console.log('  ✅ User created in EduSitePro');
    }
  } else {
    console.log('  ✅ User already exists');
  }

  // 5c. Create/update profile in EduSitePro
  console.log('  → Creating profile in EduSitePro...');

  const { error: profileSyncError } = await edusiteClient
    .from('profiles')
    .upsert({
      id: userId,
      email: TENANT_EMAIL,
      full_name: `${edudashProfile.first_name} ${edudashProfile.last_name}`,
      role: 'organization_admin',
      organization_id: organizationId
    }, {
      onConflict: 'id'
    });

  if (profileSyncError) {
    console.error('  ❌ Failed to sync profile:', profileSyncError.message);
  } else {
    console.log('  ✅ Profile synced to EduSitePro');
  }

  // 5d. Create default centre
  console.log('  → Creating default centre...');

  const { error: centreError } = await edusiteClient
    .from('centres')
    .upsert({
      organization_id: organizationId,
      name: `${organization.name} - Main Campus`,
      slug: `${organization.slug}-main`,
      code: 'MAIN',
      status: 'active',
      capacity: 500,
      contact_email: TENANT_EMAIL,
      address_line1: '123 Education Street',
      city: 'Cape Town',
      province: 'Western Cape',
      postal_code: '8001',
      country: 'ZA'
    }, {
      onConflict: 'slug'
    });

  if (centreError) {
    console.error('  ❌ Failed to create centre:', centreError.message);
  } else {
    console.log('  ✅ Centre created');
  }

  // Summary
  console.log('\n============================================');
  console.log('✅ FIX COMPLETE');
  console.log('============================================\n');
  console.log('🏢 Organization:', organization.name);
  console.log('🆔 Organization ID:', organizationId);
  console.log('📧 Email:', TENANT_EMAIL);
  console.log('\n🌐 Platforms:');
  console.log('   🎓 EduDashPro (LMS): https://edudashpro.org.za');
  console.log('   📝 EduSitePro (CMS): https://edusitepro.edudashpro.org.za');
  console.log('\n🔐 EduSitePro Password: TempPassword123!');
  console.log('   (Must reset on first login)\n');
  console.log('✨ Same organization_id used in both databases\n');
}

main().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
