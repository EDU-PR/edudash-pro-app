#!/usr/bin/env node

/**
 * Manually trigger sync-approval-to-edusite for existing approved registrations
 * This creates parent accounts in EduSitePro for registrations that were approved before the trigger was set up
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function main() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('🔍 Finding approved registrations in EduDashPro...\n');

  // Note: This will work from the web app context where RLS allows reading
  // Or you can run this from Supabase dashboard SQL editor
  
  console.log('📧 Triggering sync-approval-to-edusite Edge Function...\n');
  
  // Call the Edge Function directly for the specific registration
  const { data, error } = await supabase.functions.invoke('sync-approval-to-edusite', {
    body: {
      record: {
        id: 'registration-id-here', // You'll need to get this from the database
        guardian_email: 'dipsroboticsgm@gmail.com',
        guardian_name: 'Test 1',
        guardian_phone: null,
        student_first_name: 'Child',
        student_last_name: 'ONE',
        status: 'approved',
      },
      old_record: {
        status: 'pending'
      }
    }
  });

  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  console.log('✅ Success!', data);
  console.log('\n📧 Parent account should now be created in EduSitePro');
  console.log('🔐 Password reset email sent to: dipsroboticsgm@gmail.com');
}

main().catch(console.error);
