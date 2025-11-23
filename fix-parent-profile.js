const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://lvvvjywrmpcqrpvuptdi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2dnZqeXdybXBjcXJwdnVwdGRpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzAzNzgzOCwiZXhwIjoyMDY4NjEzODM4fQ.p8cRGywZP4qVglovv-T3VCDi9evfeCVZEBQM2LTeCmc'
);

const PARENT_ID = '20712ca4-d7e4-4d6c-83a2-f0f1602d1bbb';
const REGISTRATION_ID = 'edaf1178-4852-4c2b-bd76-da4cbadb788a';

(async () => {
  console.log('🔍 Fetching registration data...');
  
  // Get registration data
  const { data: reg, error: regError } = await supabase
    .from('registration_requests')
    .select('guardian_name, guardian_email, organization_id')
    .eq('id', REGISTRATION_ID)
    .single();

  if (regError) {
    console.error('❌ Error fetching registration:', regError);
    return;
  }

  console.log('Registration data:', reg);

  // Parse guardian name (format: "FirstName LastName")
  const nameParts = reg.guardian_name.trim().split(' ');
  const first_name = nameParts[0] || '';
  const last_name = nameParts.slice(1).join(' ') || '';

  console.log(`\n📝 Updating parent profile:`);
  console.log(`  first_name: "${first_name}"`);
  console.log(`  last_name: "${last_name}"`);
  console.log(`  email: "${reg.guardian_email}"`);
  console.log(`  preschool_id: "${reg.organization_id}"`);

  // Update parent profile
  const { data: updated, error: updateError } = await supabase
    .from('profiles')
    .update({
      first_name: first_name,
      last_name: last_name,
      email: reg.guardian_email,
      preschool_id: reg.organization_id,
    })
    .eq('id', PARENT_ID)
    .select()
    .single();

  if (updateError) {
    console.error('\n❌ Error updating profile:', updateError);
  } else {
    console.log('\n✅ Profile updated successfully:');
    console.log(JSON.stringify(updated, null, 2));
  }
})();
