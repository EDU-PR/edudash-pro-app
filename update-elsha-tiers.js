const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://lvvvjywrmpcqrpvuptdi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2dnZqeXdybXBjcXJwdnVwdGRpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzAzNzgzOCwiZXhwIjoyMDY4NjEzODM4fQ.p8cRGywZP4qVglovv-T3VCDi9evfeCVZEBQM2LTeCmc'
);

(async () => {
  console.log('🔧 Updating elsha.pp91@gmail.com AI tiers...');
  
  const elshaId = '20712ca4-d7e4-4d6c-83a2-f0f1602d1bbb';
  
  // Update user_ai_tiers
  const { error: tierError } = await supabase
    .from('user_ai_tiers')
    .update({
      tier: 'parent_plus',
      is_active: true,
      expires_at: '2025-11-30T18:01:39.718Z'
    })
    .eq('user_id', elshaId);
  
  if (tierError) {
    console.log('❌ Error updating user_ai_tiers:', tierError);
  } else {
    console.log('✅ Updated user_ai_tiers to parent_plus');
  }
  
  // Update user_ai_usage
  const { error: usageError } = await supabase
    .from('user_ai_usage')
    .update({ current_tier: 'parent_plus' })
    .eq('user_id', elshaId);
  
  if (usageError) {
    console.log('❌ Error updating user_ai_usage:', usageError);
  } else {
    console.log('✅ Updated user_ai_usage to parent_plus');
  }
  
  console.log('\n✅ Elsha now has parent_plus AI tier!');
})();
