#!/usr/bin/env node

/**
 * Script to create a principal account for Community School
 * Usage: node tools/create-community-principal.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   EXPO_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const COMMUNITY_SCHOOL_ID = '00000000-0000-0000-0000-000000000001';
const EMAIL = 'king@soilofafrica.org';
const PASSWORD = 'Olivia@17';

async function createCommunityPrincipal() {
  try {
    console.log('🔧 Creating Community School principal account...');
    console.log(`   Email: ${EMAIL}`);
    console.log(`   School ID: ${COMMUNITY_SCHOOL_ID}\n`);

    // Step 1: Create auth user
    console.log('📝 Step 1: Creating auth user...');
    const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true, // Skip email verification
      user_metadata: {
        full_name: 'King',
        role: 'principal',
      },
    });

    if (authError) {
      console.error('❌ Auth creation failed:', authError.message);
      return;
    }

    if (!authData.user) {
      console.error('❌ No user returned from auth creation');
      return;
    }

    console.log(`✅ Auth user created: ${authData.user.id}\n`);

    // Step 2: Update profile to assign as principal to Community School
    console.log('📝 Step 2: Updating profile...');
    const { data: profileData, error: profileError } = await serviceClient
      .from('profiles')
      .update({
        role: 'principal',
        organization_id: COMMUNITY_SCHOOL_ID,
        preschool_id: COMMUNITY_SCHOOL_ID,
        full_name: 'King',
        updated_at: new Date().toISOString(),
      })
      .eq('id', authData.user.id)
      .select()
      .single();

    if (profileError) {
      console.error('❌ Profile update failed:', profileError.message);
      console.log('   Attempting to create profile manually...');
      
      // Try to insert if update failed (profile might not exist yet)
      const { data: insertData, error: insertError } = await serviceClient
        .from('profiles')
        .insert({
          id: authData.user.id,
          email: EMAIL,
          role: 'principal',
          organization_id: COMMUNITY_SCHOOL_ID,
          preschool_id: COMMUNITY_SCHOOL_ID,
          full_name: 'King',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        console.error('❌ Profile insert failed:', insertError.message);
        return;
      }

      console.log('✅ Profile created:', insertData);
    } else {
      console.log('✅ Profile updated:', profileData);
    }

    console.log('\n✅ Community School principal account created successfully!');
    console.log(`   User ID: ${authData.user.id}`);
    console.log(`   Email: ${EMAIL}`);
    console.log(`   Password: ${PASSWORD}`);
    console.log(`   Role: principal`);
    console.log(`   Organization: Community School (${COMMUNITY_SCHOOL_ID})`);

    // Step 3: Test authentication
    console.log('\n📝 Step 3: Testing authentication...');
    const anonClient = createClient(
      SUPABASE_URL,
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
      email: EMAIL,
      password: PASSWORD
    });

    if (signInError) {
      console.error('❌ Authentication test failed:', signInError.message);
      return;
    }

    console.log('✅ Authentication successful!');
    console.log(`   User: ${signInData.user.email}`);
    console.log(`   ID: ${signInData.user.id}`);

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

createCommunityPrincipal();
