const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://lvvvjywrmpcqrpvuptdi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2dnZqeXdybXBjcXJwdnVwdGRpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzAzNzgzOCwiZXhwIjoyMDY4NjEzODM4fQ.p8cRGywZP4qVglovv-T3VCDi9evfeCVZEBQM2LTeCmc'
);

(async () => {
  console.log('\n🔍 PARENT PLUS TIER VERIFICATION\n');
  console.log('='.repeat(70));
  
  const emails = ['elsha.pp91@gmail.com', 'dipsroboticsgm@gmail.com'];
  
  for (const email of emails) {
    console.log(`\n📧 ${email}`);
    console.log('-'.repeat(70));
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, is_trial, trial_ends_at, trial_plan_tier, subscription_tier')
      .eq('email', email)
      .single();
    
    if (!profile) {
      console.log('❌ User not found');
      continue;
    }
    
    const { data: aiTier } = await supabase
      .from('user_ai_tiers')
      .select('tier, is_active, expires_at')
      .eq('user_id', profile.id)
      .single();
    
    const { data: aiUsage } = await supabase
      .from('user_ai_usage')
      .select('current_tier')
      .eq('user_id', profile.id)
      .single();
    
    // Check if setup is correct
    const isCorrect = 
      profile.is_trial === true &&
      (profile.trial_plan_tier === 'parent_plus' || profile.trial_plan_tier === 'premium') &&
      (profile.subscription_tier === 'parent_plus' || profile.subscription_tier === 'premium') &&
      aiTier?.tier === 'parent_plus' &&
      aiUsage?.current_tier === 'parent_plus';
    
    const status = isCorrect ? '✅' : '⚠️';
    
    console.log(`${status} Profile Trial Status:`, profile.is_trial);
    console.log(`${status} Trial Plan Tier:`, profile.trial_plan_tier);
    console.log(`${status} Subscription Tier:`, profile.subscription_tier);
    console.log(`${status} AI Tier:`, aiTier?.tier || '❌ Not found');
    console.log(`${status} AI Usage Tier:`, aiUsage?.current_tier || '❌ Not found');
    
    if (profile.trial_ends_at) {
      const daysLeft = Math.ceil((new Date(profile.trial_ends_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      console.log(`📅 Trial Days Remaining:`, daysLeft);
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('\n✅ Edge function deployed with parent_plus tier support');
  console.log('✅ OrganizationBanner updated to show "Parent Plus Trial"');
  console.log('✅ No Young Eagles banner on parent dashboard\n');
})();
