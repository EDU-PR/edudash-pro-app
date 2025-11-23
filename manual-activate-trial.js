const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://lvvvjywrmpcqrpvuptdi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2dnZqeXdybXBjcXJwdnVwdGRpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzAzNzgzOCwiZXhwIjoyMDY4NjEzODM4fQ.p8cRGywZP4qVglovv-T3VCDi9evfeCVZEBQM2LTeCmc'
);

const PARENT_EMAIL = 'elsha.pp91@gmail.com';

(async () => {
  console.log('🚀 Manually activating 7-day Premium trial...\n');

  // Calculate trial end date (7 days from now)
  const trialEndDate = new Date();
  trialEndDate.setDate(trialEndDate.getDate() + 7);

  // Update profile directly
  const { data: updated, error: updateError } = await supabase
    .from('profiles')
    .update({
      is_trial: true,
      trial_ends_at: trialEndDate.toISOString(),
      trial_plan_tier: 'premium',
      trial_started_at: new Date().toISOString(),
      trial_granted_at: new Date().toISOString(),
      seat_status: 'active', // Activate the seat
      subscription_tier: 'premium' // Upgrade to premium during trial
    })
    .eq('email', PARENT_EMAIL)
    .select('id, email, first_name, last_name, is_trial, trial_ends_at, trial_plan_tier, seat_status, subscription_tier')
    .single();

  if (updateError) {
    console.error('❌ Error:', updateError);
    return;
  }

  console.log('✅ Trial activated successfully!\n');
  console.log('📊 Updated Profile:');
  console.log(JSON.stringify(updated, null, 2));

  // Calculate days
  const now = new Date();
  const endDate = new Date(updated.trial_ends_at);
  const daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

  console.log(`\n🎉 Trial Details:`);
  console.log(`   Status: ${updated.is_trial ? 'ACTIVE ✅' : 'INACTIVE'}`);
  console.log(`   Tier: ${updated.trial_plan_tier}`);
  console.log(`   Days Remaining: ${daysRemaining}`);
  console.log(`   Expires: ${endDate.toLocaleDateString()}`);
  console.log(`   Seat Status: ${updated.seat_status}`);
  console.log(`   Subscription: ${updated.subscription_tier}`);
})();
