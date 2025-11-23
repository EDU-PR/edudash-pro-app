#!/usr/bin/env node

/**
 * Manually trigger sync for a specific approved registration
 * 
 * Usage: node trigger-sync-for-registration.js <parent-email>
 * Example: node trigger-sync-for-registration.js dipsroboticsgm@gmail.com
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function main() {
  const parentEmail = process.argv[2];

  if (!parentEmail) {
    console.error('❌ Usage: node trigger-sync-for-registration.js <parent-email>');
    console.error('   Example: node trigger-sync-for-registration.js dipsroboticsgm@gmail.com');
    process.exit(1);
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log(`🔍 Looking for approved registration with parent email: ${parentEmail}\n`);

  // Look for the registration in EduSitePro database
  // First check if we need to connect to a different database
  const edusiteUrl = process.env.EDUSITE_SUPABASE_URL || 'https://bppuzibjlxgfwrujzfsz.supabase.co';
  const edusiteKey = process.env.EDUSITE_SERVICE_ROLE_KEY || supabaseKey;

  const edusiteClient = createClient(edusiteUrl, edusiteKey);

  // Find registration by guardian email
  const { data: registration, error: regError } = await edusiteClient
    .from('registration_requests')
    .select('*')
    .eq('guardian_email', parentEmail)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (regError) {
    console.error('❌ Error fetching registration:', regError.message);
    process.exit(1);
  }

  if (!registration) {
    console.log(`⚠️  No approved registration found for: ${parentEmail}`);
    console.log('\n💡 Make sure:');
    console.log('   1. The email is correct');
    console.log('   2. The registration has been approved in EduSitePro');
    process.exit(1);
  }

  console.log('✅ Found approved registration:');
  console.log(`   Student: ${registration.student_first_name} ${registration.student_last_name}`);
  console.log(`   Parent: ${registration.guardian_name} (${registration.guardian_email})`);
  console.log(`   Date: ${new Date(registration.created_at).toLocaleString()}`);
  console.log(`   Status: ${registration.status}\n`);

  // Trigger the sync Edge Function
  console.log('🔄 Triggering sync to EduDashPro...\n');

  const { data: syncResult, error: syncError } = await supabase.functions.invoke(
    'sync-registration-to-edudash',
    {
      body: { registration_id: registration.id }
    }
  );

  if (syncError) {
    console.error('❌ Sync failed:', syncError.message);
    if (syncError.context) {
      console.error('   Details:', JSON.stringify(syncError.context, null, 2));
    }
    process.exit(1);
  }

  console.log('✅ Sync completed successfully!');
  if (syncResult) {
    console.log('\nResult:', JSON.stringify(syncResult, null, 2));
  }
  
  console.log('\n📧 Parent approval email should have been sent to:', parentEmail);
  console.log('🔐 Parent can now set their password and log in to EduDashPro');
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
