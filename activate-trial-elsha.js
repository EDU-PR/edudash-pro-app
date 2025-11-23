const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://lvvvjywrmpcqrpvuptdi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2dnZqeXdybXBjcXJwdnVwdGRpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzAzNzgzOCwiZXhwIjoyMDY4NjEzODM4fQ.p8cRGywZP4qVglovv-T3VCDi9evfeCVZEBQM2LTeCmc'
);

const PARENT_EMAIL = 'elsha.pp91@gmail.com';

(async () => {
  console.log('🚀 Activating 7-day Premium trial for parent...\n');

  // Get parent user ID
  const { data: parent } = await supabase
    .from('profiles')
    .select('id, email, first_name, last_name')
    .eq('email', PARENT_EMAIL)
    .single();

  if (!parent) {
    console.error('❌ Parent not found');
    return;
  }

  console.log(`Found parent: ${parent.first_name} ${parent.last_name} (${parent.email})`);
  console.log(`User ID: ${parent.id}\n`);

  // Activate trial (parameter order: target_user_id, trial_days, plan_tier)
  const { data: trialResult, error: trialError } = await supabase.rpc('start_user_trial', {
    target_user_id: parent.id,
    trial_days: 7,
    plan_tier: 'premium'
  });

  if (trialError) {
    console.error('❌ Error activating trial:', trialError);
    return;
  }

  console.log('✅ Trial activated!');
  console.log(JSON.stringify(trialResult, null, 2));

  // Verify
  const { data: updated } = await supabase
    .from('profiles')
    .select('id, email, is_trial, trial_ends_at, trial_plan_tier, seat_status, subscription_tier')
    .eq('id', parent.id)
    .single();

  console.log('\n📊 Updated Profile:');
  console.log(JSON.stringify(updated, null, 2));
})();
