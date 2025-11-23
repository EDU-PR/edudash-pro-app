#!/usr/bin/env node

/**
 * Manually trigger bulk sync from EduSitePro
 * This will sync all approved registrations from EduSitePro to EduDashPro
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function main() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('🔄 Triggering bulk sync from EduSitePro...\n');

  const { data, error } = await supabase.functions.invoke('sync-registrations-from-edusite');

  if (error) {
    console.error('❌ Sync failed:', error.message);
    if (error.context) {
      console.error('   Details:', JSON.stringify(error.context, null, 2));
    }
    process.exit(1);
  }

  console.log('✅ Sync completed successfully!\n');
  
  if (data) {
    console.log('Results:', JSON.stringify(data, null, 2));
  }
  
  console.log('\n📧 Parent approval emails have been sent to all newly synced registrations');
  console.log('🔐 Parents can now set their passwords and log in to EduDashPro');
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
