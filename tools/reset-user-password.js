#!/usr/bin/env node

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const serviceClient = createClient(url, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function resetUserPassword() {
  try {
    // Use an existing user from the database
    const targetEmail = 'elsha@youngeagles.org.za';
    const newPassword = 'TestPassword123!';
    
    console.log(`Resetting password for: ${targetEmail}`);
    console.log(`New password: ${newPassword}`);
    
    // First get the user from our users table
    const { data: user, error: userError } = await serviceClient
      .from('users')
      .select('*')
      .eq('email', targetEmail)
      .single();
      
    if (userError) {
      console.error('❌ User not found in users table:', userError.message);
      return;
    }
    
    console.log('✅ Found user in users table:');
    console.log(`   Name: ${user.first_name} ${user.last_name}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Auth User ID: ${user.auth_user_id}`);
    
    if (!user.auth_user_id) {
      console.log('❌ User has no auth_user_id - cannot reset password');
      return;
    }
    
    console.log('\nAttempting to update password in Supabase auth...');
    
    // Try to update the password using the auth admin API
    const { data: updateData, error: updateError } = await serviceClient.auth.admin.updateUserById(
      user.auth_user_id,
      {
        password: newPassword,
        email_confirm: true
      }
    );
    
    if (updateError) {
      console.error('❌ Password update failed:', updateError.message);
      
      // If update fails, the user might not exist in auth
      console.log('\n⚠️ User might not exist in Supabase auth.');
      console.log('Creating new auth user...');
      
      const { data: newAuthUser, error: createError } = await serviceClient.auth.admin.createUser({
        email: targetEmail,
        password: newPassword,
        email_confirm: true,
        user_metadata: {
          first_name: user.first_name,
          last_name: user.last_name
        }
      });
      
      if (createError) {
        console.error('❌ Could not create auth user:', createError.message);
        return;
      }
      
      console.log('✅ Created new auth user:', newAuthUser.user.id);
      
      // Update the users table with the new auth_user_id
      const { error: updateUserError } = await serviceClient
        .from('users')
        .update({ auth_user_id: newAuthUser.user.id })
        .eq('email', targetEmail);
        
      if (updateUserError) {
        console.error('❌ Could not update auth_user_id:', updateUserError.message);
        return;
      }
      
      console.log('✅ Updated users table with new auth_user_id');
      
    } else {
      console.log('✅ Password updated successfully');
    }
    
    console.log('\nTesting authentication...');
    
    // Test with anonymous client
    const anonClient = createClient(url, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
    
    const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
      email: targetEmail,
      password: newPassword
    });
    
    if (signInError) {
      console.error('❌ Authentication test failed:', signInError.message);
      return;
    }
    
    console.log('✅ Authentication successful!');
    console.log(`   User: ${signInData.user.email}`);
    console.log(`   ID: ${signInData.user.id}`);
    
    // Test profile fetch
    const { data: profile, error: profileError } = await anonClient
      .from('users')
      .select('*')
      .eq('auth_user_id', signInData.user.id)
      .single();
      
    if (profileError) {
      console.error('❌ Profile fetch failed:', profileError.message);
    } else {
      console.log('✅ Profile fetched successfully');
      console.log(`   Role: ${profile.role}`);
    }
    
    await anonClient.auth.signOut();
    
    console.log('\n🎉 Password reset completed successfully!');
    console.log('\n📋 Login credentials:');
    console.log(`   Email: ${targetEmail}`);
    console.log(`   Password: ${newPassword}`);
    console.log('\nYou can now use these credentials to test login in the web app.');
    
  } catch (_error) {
    console._error('❌ Unexpected _error:', _error.message);
  }
}

resetUserPassword().then(() => process.exit(0));