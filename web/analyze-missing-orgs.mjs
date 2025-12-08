#!/usr/bin/env node

/**
 * Comprehensive Profile Organization Assignment Strategy
 * 
 * This script analyzes all profiles without organization_id and determines
 * the correct fix strategy based on role.
 */

import { createClient } from '@supabase/supabase-js';

const EDUDASH_URL = 'https://lvvvjywrmpcqrpvuptdi.supabase.co';
const EDUDASH_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2dnZqeXdybXBjcXJwdnVwdGRpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzAzNzgzOCwiZXhwIjoyMDY4NjEzODM4fQ.p8cRGywZP4qVglovv-T3VCDi9evfeCVZEBQM2LTeCmc';

const edudashClient = createClient(EDUDASH_URL, EDUDASH_SERVICE_KEY);

// Roles that REQUIRE organization_id
const ROLES_NEED_ORG = ['admin', 'principal', 'teacher', 'instructor', 'student', 'superadmin'];

// Roles that are OK without organization_id (access via relationships)
const ROLES_OK_WITHOUT_ORG = ['parent'];

async function main() {
  console.log('\n============================================');
  console.log('PROFILE ORGANIZATION ASSIGNMENT ANALYSIS');
  console.log('============================================\n');

  // Get all profiles without organization_id
  const { data: profiles, error } = await edudashClient
    .from('profiles')
    .select('id, email, first_name, last_name, role, organization_id')
    .is('organization_id', null)
    .order('role, email');

  if (error) {
    console.error('❌ Error fetching profiles:', error.message);
    process.exit(1);
  }

  console.log(`Found ${profiles.length} profiles without organization_id\n`);

  // Group by role
  const byRole = profiles.reduce((acc, p) => {
    acc[p.role] = acc[p.role] || [];
    acc[p.role].push(p);
    return acc;
  }, {});

  // Categorize
  const needsFixing = [];
  const okAsIs = [];

  for (const [role, roleProfiles] of Object.entries(byRole)) {
    console.log(`\n📋 Role: ${role.toUpperCase()} (${roleProfiles.length} profiles)`);
    
    if (ROLES_NEED_ORG.includes(role)) {
      console.log('   ⚠️  REQUIRES organization_id');
      needsFixing.push(...roleProfiles);
      roleProfiles.forEach(p => {
        console.log(`      - ${p.email} (${p.first_name} ${p.last_name})`);
      });
    } else if (ROLES_OK_WITHOUT_ORG.includes(role)) {
      console.log('   ✅ OK without organization_id (accesses via children)');
      okAsIs.push(...roleProfiles);
    } else {
      console.log('   ⚠️  UNKNOWN ROLE - Manual review needed');
      needsFixing.push(...roleProfiles);
      roleProfiles.forEach(p => {
        console.log(`      - ${p.email}`);
      });
    }
  }

  // Summary
  console.log('\n\n============================================');
  console.log('SUMMARY');
  console.log('============================================\n');
  
  console.log(`✅ OK without org_id: ${okAsIs.length} (parents)`);
  console.log(`⚠️  NEEDS FIXING: ${needsFixing.length}\n`);

  if (needsFixing.length > 0) {
    console.log('Profiles that need organization_id:\n');
    needsFixing.forEach((p, i) => {
      console.log(`${i + 1}. ${p.email} (${p.role}) - ${p.first_name} ${p.last_name}`);
    });
    
    console.log('\n📝 Next Steps:');
    console.log('1. Check EduSitePro for registration requests');
    console.log('2. Create organizations if missing');
    console.log('3. Assign organization_id to profiles');
    console.log('4. Sync to EduDashPro if needed\n');
  }

  console.log('============================================\n');
}

main().catch(console.error);
