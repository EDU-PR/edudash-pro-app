import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lvvvjywrmpcqrpvuptdi.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

const COMMUNITY_SCHOOL_ID = '00000000-0000-0000-0000-000000000001';
const MAIN_SCHOOL_ID = '00000000-0000-0000-0000-000000000003';

async function verifyOrgAssignment() {
  console.log('\n🔍 Verifying organization assignment for king@soilofafrica.org...\n');

  // Step 1: Check profiles table directly by email
  console.log('📋 Checking profiles table...');
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, role, organization_id, preschool_id, full_name')
    .eq('email', 'king@soilofafrica.org')
    .single();

  if (profileError) {
    console.error('❌ Error fetching profile:', profileError);
    return;
  }

  if (!profile) {
    console.error('❌ Profile not found for king@soilofafrica.org');
    return;
  }

  console.log('✅ Profile found:');
  console.log(`   User ID: ${profile.id}`);
  console.log(`   Email: ${profile.email}`);
  console.log(`   Organization ID: ${profile.organization_id}`);
  console.log(`   Preschool ID: ${profile.preschool_id}`);
  console.log(`   Role: ${profile.role}`);
  console.log(`   Full Name: ${profile.full_name}`);

  const profileOrgId = profile.organization_id || profile.preschool_id;
  const isCommunityInProfile = profileOrgId === COMMUNITY_SCHOOL_ID;
  const isMainInProfile = profileOrgId === MAIN_SCHOOL_ID;

  console.log(`\n   ${isCommunityInProfile ? '✅' : '❌'} Points to Community School: ${isCommunityInProfile}`);
  console.log(`   ${isMainInProfile ? '❌' : '✅'} Points to Main School: ${isMainInProfile}`);

  // Step 2: Check organization_members table
  console.log('\n👥 Checking organization_members table...');
  const { data: orgMembers, error: orgMembersError } = await supabase
    .from('organization_members')
    .select('id, user_id, organization_id, role, seat_status, created_at')
    .eq('user_id', profile.id);

  if (orgMembersError) {
    console.error('❌ Error fetching organization_members:', orgMembersError);
    return;
  }

  if (orgMembers && orgMembers.length > 0) {
    console.log(`⚠️  Found ${orgMembers.length} organization_members entry/entries:`);
    orgMembers.forEach((member, idx) => {
      const isCommunity = member.organization_id === COMMUNITY_SCHOOL_ID;
      const isMain = member.organization_id === MAIN_SCHOOL_ID;
      console.log(`\n   Entry ${idx + 1}:`);
      console.log(`     Organization ID: ${member.organization_id}`);
      console.log(`     Role: ${member.role || 'N/A'}`);
      console.log(`     Seat Status: ${member.seat_status || 'N/A'}`);
      console.log(`     ${isCommunity ? '✅' : isMain ? '❌' : '⚠️ '} ${isCommunity ? 'Community School' : isMain ? 'Main School' : 'Other Organization'}`);
    });

    // Check for conflicts
    const hasMainSchoolEntry = orgMembers.some(m => m.organization_id === MAIN_SCHOOL_ID);
    const hasCommunityEntry = orgMembers.some(m => m.organization_id === COMMUNITY_SCHOOL_ID);

    if (hasMainSchoolEntry && isCommunityInProfile) {
      console.log('\n⚠️  CONFLICT DETECTED:');
      console.log('   - profiles table points to Community School');
      console.log('   - organization_members table has entry for Main School');
      console.log('   - This will cause the app to route to Main School!');
    } else if (hasCommunityEntry && isMainInProfile) {
      console.log('\n⚠️  CONFLICT DETECTED:');
      console.log('   - profiles table points to Main School');
      console.log('   - organization_members table has entry for Community School');
    } else if (!hasCommunityEntry && isCommunityInProfile) {
      console.log('\n✅ No conflict: organization_members table has no entries');
      console.log('   Profile table assignment will be used');
    }
  } else {
    console.log('✅ No entries in organization_members table');
    console.log('   Profile table assignment will be used');
  }

  // Step 4: Summary
  console.log('\n📊 SUMMARY:');
  console.log(`   Profile Organization ID: ${profileOrgId || 'NULL'}`);
  console.log(`   Profile Points To: ${isCommunityInProfile ? 'Community School ✅' : isMainInProfile ? 'Main School ❌' : 'Other/None'}`);
  
  if (orgMembers && orgMembers.length > 0) {
    const orgMemberOrgIds = orgMembers.map(m => m.organization_id);
    console.log(`   Organization Members: ${orgMemberOrgIds.join(', ')}`);
    
    if (orgMemberOrgIds.includes(MAIN_SCHOOL_ID) && isCommunityInProfile) {
      console.log('\n🔧 RECOMMENDED FIX:');
      console.log('   1. Delete or update organization_members entry for Main School');
      console.log('   2. Ensure organization_members entry exists for Community School');
      console.log('   3. OR: Update code to prioritize profiles.organization_id over organization_members');
    }
  }

  console.log('\n');
}

verifyOrgAssignment().catch(console.error);
