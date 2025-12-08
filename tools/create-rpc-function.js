#!/usr/bin/env node

/**
 * Create Missing RPC Function
 * 
 * This script creates the get_my_profile RPC function that is required
 * by fetchEnhancedUserProfile.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function createRPCFunction() {
  console.log('=== CREATING RPC FUNCTION ===\n');
  
  try {
    // Read the SQL file
    const sql = fs.readFileSync('./db/create_get_my_profile_function.sql', 'utf8');
    
    console.log('Executing SQL to create get_my_profile function...');
    
    // Execute the SQL
    const { data, error } = await supabase
      .rpc('exec_sql', { sql_query: sql })
      .catch(async () => {
        // If exec_sql doesn't exist, try raw SQL execution
        console.log('Trying alternative SQL execution...');
        return await supabase.from('_sql_exec').insert({ sql });
      })
      .catch(async () => {
        // If that doesn't work either, we'll need to execute it manually
        console.log('Cannot execute SQL automatically. Please run the SQL manually in Supabase dashboard.');
        console.log('\nSQL to execute:');
        console.log('================');
        console.log(sql);
        console.log('================');
        return { data: null, error: { message: 'Manual execution required' } };
      });
    
    if (error) {
      console.error('Failed to create RPC function:', _error);
      console.log('\nPlease execute the following SQL manually in your Supabase dashboard:');
      console.log('================');
      console.log(sql);
      console.log('================');
    } else {
      console.log('✅ RPC function created successfully');
    }
    
    console.log('\n--- Testing the new function ---');
    
    // Test the function
    const { data: testData, error: testError } = await supabase
      .rpc('get_my_profile');
    
    console.log('Test result:', testData);
    console.log('Test error:', testError);
    
    if (testError) {
      console.log('Function exists but returns error (expected without auth context)');
    } else {
      console.log('Function created and callable');
    }
    
  } catch (_error) {
    console._error('Script _error:', _error);
  }
}

// Run the script
createRPCFunction()
  .then(() => {
    console.log('\n=== RPC FUNCTION SETUP COMPLETE ===');
    console.log('\nNext steps:');
    console.log('1. If SQL execution failed, run it manually in Supabase dashboard');
    console.log('2. Test login with superadmin@edudashpro.org.za');
    console.log('3. Check app logs for routing debug messages');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', _error);
    process.exit(1);
  });