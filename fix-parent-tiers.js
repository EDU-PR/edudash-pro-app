const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://lvvvjywrmpcqrpvuptdi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2dnZqeXdybXBjcXJwdnVwdGRpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzAzNzgzOCwiZXhwIjoyMDY4NjEzODM4fQ.p8cRGywZP4qVglovv-T3VCDi9evfeCVZEBQM2LTeCmc'
);

(async () => {
  // Fix Elsha (20712ca4-d7e4-4d6c-83a2-f0f1602d1bbb)
  console.log('🔧 Fixing elsha.pp91@gmail.com...');
  
  const elshaId = '20712ca4-d7e4-4d6c-83a2-f0f1602d1bbb';
  
  // Create user_ai_tiers
  const { error: tierError1 } = await supabase
    .from('user_ai_tiers')
    .insert({
      user_id: elshaId,
      tier: 'parent_plus',
      assigned_reason: '7-day trial - parent_plus tier',
      is_active: true,
      expires_at: '2025-11-30T18:01:39.718Z'
    });
  
  if (tierError1) {
    console.log('❌ Error creating user_ai_tiers:', tierError1);
  } else {
    console.log('✅ Created user_ai_tiers record');
  }
  
  // Create or update user_ai_usage
  const { error: usageError1 } = await supabase
    .from('user_ai_usage')
    .upsert({
      user_id: elshaId,
      current_tier: 'parent_plus'
    });
  
  if (usageError1) {
    console.log('❌ Error updating user_ai_usage:', usageError1);
  } else {
    console.log('✅ Updated user_ai_usage');
  }
  
  // Fix dipsroboticsgm (86b23430-f625-4306-a64d-7ee266ce758b)
  console.log('\n🔧 Fixing dipsroboticsgm@gmail.com...');
  
  const dipsId = '86b23430-f625-4306-a64d-7ee266ce758b';
  
  // Activate trial in profile
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      is_trial: true,
      trial_ends_at: new Date(Date.now() + 7*24*60*60*1000).toISOString(),
      trial_plan_tier: 'premium',
      subscription_tier: 'premium',
      seat_status: 'active'
    })
    .eq('id', dipsId);
  
  if (profileError) {
    console.log('❌ Error updating profile:', profileError);
  } else {
    console.log('✅ Activated 7-day trial in profile');
  }
  
  console.log('\n✅ All done! Both parents now have parent_plus AI tier and trials.');
})();
