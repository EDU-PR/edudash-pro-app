const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://lvvvjywrmpcqrpvuptdi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2dnZqeXdybXBjcXJwdnVwdGRpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzAzNzgzOCwiZXhwIjoyMDY4NjEzODM4fQ.p8cRGywZP4qVglovv-T3VCDi9evfeCVZEBQM2LTeCmc'
);

const PARENT_ID = '20712ca4-d7e4-4d6c-83a2-f0f1602d1bbb';

(async () => {
  console.log('📝 Setting parent name to "Elsha Doe"...\n');

  const { data: updated, error: updateError } = await supabase
    .from('profiles')
    .update({
      first_name: 'Elsha',
      last_name: 'Doe',
    })
    .eq('id', PARENT_ID)
    .select('id, email, first_name, last_name, role, preschool_id, phone')
    .single();

  if (updateError) {
    console.error('❌ Error:', updateError);
  } else {
    console.log('✅ Parent profile updated:');
    console.log(JSON.stringify(updated, null, 2));
  }
})();
