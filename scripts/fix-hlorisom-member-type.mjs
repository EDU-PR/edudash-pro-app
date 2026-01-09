/**
 * Fix member_type for hlorisom@soilofafrica.org
 * Sets member_type to 'youth_president' in organization_members table
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lvvvjywrmpcqrpvuptdi.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const SOA_ORG_ID = '63b6139a-e21f-447c-b322-376fb0828992';
const USER_EMAIL = 'hlorisom@soilofafrica.org';

async function fixMemberType() {
  console.log('\n🔧 Fixing member_type for hlorisom@soilofafrica.org...\n');

  try {
    // Step 1: Get user ID from profiles
    console.log('📋 Step 1: Finding user in profiles table...');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, organization_id, preschool_id')
      .eq('email', USER_EMAIL)
      .single();

    if (profileError || !profile) {
      console.error('❌ User not found:', profileError?.message || 'No profile found');
      return;
    }

    console.log('✅ User found:');
    console.log(`   User ID: ${profile.id}`);
    console.log(`   Email: ${profile.email}`);
    console.log(`   Organization ID: ${profile.organization_id}`);
    console.log(`   Preschool ID: ${profile.preschool_id}`);

    // Step 2: Check if organization_members record exists
    console.log('\n📋 Step 2: Checking organization_members table...');
    const { data: existingMember, error: memberCheckError } = await supabase
      .from('organization_members')
      .select('id, member_type, membership_status, seat_status')
      .eq('user_id', profile.id)
      .eq('organization_id', SOA_ORG_ID)
      .maybeSingle();

    if (memberCheckError) {
      console.error('❌ Error checking organization_members:', memberCheckError.message);
      return;
    }

    if (existingMember) {
      console.log('✅ Existing member record found:');
      console.log(`   Member ID: ${existingMember.id}`);
      console.log(`   Current member_type: ${existingMember.member_type || 'NULL'}`);
      console.log(`   Membership Status: ${existingMember.membership_status}`);
      console.log(`   Seat Status: ${existingMember.seat_status}`);

      // Update existing record
      console.log('\n🔄 Updating member_type to youth_president...');
      const { data: updatedMember, error: updateError } = await supabase
        .from('organization_members')
        .update({
          member_type: 'youth_president',
          membership_status: existingMember.membership_status || 'active',
          seat_status: existingMember.seat_status || 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingMember.id)
        .select()
        .single();

      if (updateError) {
        console.error('❌ Error updating member record:', updateError.message);
        return;
      }

      console.log('✅ Member record updated successfully:');
      console.log(`   New member_type: ${updatedMember.member_type}`);
    } else {
      console.log('⚠️  No existing member record found. Creating new record...');

      // Create new organization_members record
      const { data: newMember, error: insertError } = await supabase
        .from('organization_members')
        .insert({
          organization_id: SOA_ORG_ID,
          user_id: profile.id,
          member_type: 'youth_president',
          membership_status: 'active',
          seat_status: 'active',
          membership_tier: 'standard',
          wing: 'youth',
        })
        .select()
        .single();

      if (insertError) {
        console.error('❌ Error creating member record:', insertError.message);
        return;
      }

      console.log('✅ New member record created successfully:');
      console.log(`   Member ID: ${newMember.id}`);
      console.log(`   member_type: ${newMember.member_type}`);
    }

    // Step 3: Verify the fix
    console.log('\n📋 Step 3: Verifying the fix...');
    const { data: verifyMember, error: verifyError } = await supabase
      .from('organization_members')
      .select('id, member_type, membership_status, seat_status, organization_id')
      .eq('user_id', profile.id)
      .eq('organization_id', SOA_ORG_ID)
      .single();

    if (verifyError || !verifyMember) {
      console.error('❌ Verification failed:', verifyError?.message || 'Record not found');
      return;
    }

    if (verifyMember.member_type !== 'youth_president') {
      console.error(`❌ Verification failed: member_type is "${verifyMember.member_type}", expected "youth_president"`);
      return;
    }

    console.log('✅ Verification successful!');
    console.log('\n📊 Final Status:');
    console.log(`   User: ${USER_EMAIL}`);
    console.log(`   User ID: ${profile.id}`);
    console.log(`   Organization ID: ${verifyMember.organization_id}`);
    console.log(`   Member Type: ${verifyMember.member_type} ✅`);
    console.log(`   Membership Status: ${verifyMember.membership_status}`);
    console.log(`   Seat Status: ${verifyMember.seat_status}`);
    console.log('\n✅ Member type successfully set to youth_president!');
    console.log('   The user should now route to the youth president dashboard on next login.\n');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

fixMemberType();
