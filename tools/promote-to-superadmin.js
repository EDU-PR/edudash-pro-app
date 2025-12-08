#!/usr/bin/env node

/**
 * Promote a user to superadmin for testing Phase 1
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function promoteToSuperadmin() {
  console.log('🔧 Promoting user to superadmin for testing...');
  
  try {
    // Try some common superadmin email addresses
    const emails = [
      'superadmin@edudashpro.org.za',
      'admin@edudashpro.com',
      'king@edudashpro.org.za',
      'test@example.com'
    ];
    
    console.log('🎯 Attempting to promote users...');
    
    for (const email of emails) {
      try {
        const { data: result, error } = await supabase.rpc('promote_user_to_superadmin', {
          target_email: email
        });
        
        if (!error && result) {
          console.log(`✅ ${result}`);
        } else if (error) {
          console.log(`⚠️ ${email}: ${_error.message}`);
        } else {
          console.log(`⚠️ ${email}: No result returned`);
        }
      } catch (_err) {
        console.log(`❌ ${email}: ${_err.message}`);
      }
    }
    
    console.log('\n🧪 Testing superadmin system after promotion...');
    const { data: testResults, error: testError } = await supabase.rpc('test_superadmin_system');
    
    if (testError) {
      console.log('❌ Test error:', testError);
    } else {
      console.log('✅ Test Results:');
      console.log(`   • Total Tests: ${testResults.total_tests}`);
      console.log(`   • Passed: ${testResults.passed}`);
      console.log(`   • Failed: ${testResults.failed}`);
      
      if (testResults.results) {
        testResults.results.forEach((result, index) => {
          const status = result.status === 'passed' ? '✅' : '❌';
          console.log(`   ${index + 1}. ${result.test}: ${status}`);
        });
      }
    }
    
  } catch (_error) {
    console._error('❌ Error:', _error);
  }
}

promoteToSuperadmin();