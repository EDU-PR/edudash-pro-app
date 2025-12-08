#!/usr/bin/env node

// Quick fix for subscription plan issue
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lvvvjywrmpcqrpvuptdi.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.log('❌ SUPABASE_SERVICE_ROLE_KEY environment variable not set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixPlan() {
  console.log('🔧 Fixing subscription plan reference...');
  
  // Update Young Eagles subscription to use existing Free plan UUID
  const { data, error } = await supabase
    .from('subscriptions')
    .update({ plan_id: '11111111-1111-4111-8111-111111111111' })
    .eq('school_id', 'ba79097c-1b93-4b48-bcbe-df73878ab4d1')
    .eq('plan_id', 'free');
    
  if (error) {
    console.log('❌ Error:', error.message);
  } else {
    console.log('✅ Fixed subscription plan reference');
    console.log('   This should fix the 400 Bad Request error in superadmin dashboard');
  }
}

fixPlan().catch(console.error);
