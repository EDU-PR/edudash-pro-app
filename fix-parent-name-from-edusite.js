const { createClient } = require('@supabase/supabase-js');

const edusiteSupabase = createClient(
  'https://bppuzibjlxgfwrujzfsz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwcHV6aWJqbHhnZndydWp6ZnN6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMTM0OTY5NywiZXhwIjoyMDQ2OTI1Njk3fQ.KHIDRuKt96VC6_r7tN0g2ydKTJtqVT2gR14xQi8Ui-o'
);

const edudashSupabase = createClient(
  'https://lvvvjywrmpcqrpvuptdi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2dnZqeXdybXBjcXJwdnVwdGRpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzAzNzgzOCwiZXhwIjoyMDY4NjEzODM4fQ.p8cRGywZP4qVglovv-T3VCDi9evfeCVZEBQM2LTeCmc'
);

const REGISTRATION_ID = 'edaf1178-4852-4c2b-bd76-da4cbadb788a';
const PARENT_ID = '20712ca4-d7e4-4d6c-83a2-f0f1602d1bbb';

(async () => {
  console.log('🔍 Checking EduSitePro for full guardian name...\n');
  
  const { data: edusiteReg, error: edusiteError } = await edusiteSupabase
    .from('registration_requests')
    .select('guardian_name, guardian_email, student_first_name, student_last_name')
    .eq('id', REGISTRATION_ID)
    .single();

  if (edusiteError) {
    console.error('❌ Error:', edusiteError);
    return;
  }

  console.log('EduSitePro Registration:');
  console.log(JSON.stringify(edusiteReg, null, 2));

  // Use student's last name if guardian name is incomplete
  const guardianFirstName = edusiteReg.guardian_name.trim() || 'Parent';
  const guardianLastName = edusiteReg.student_last_name || '';

  console.log(`\n📝 Updating with:`);
  console.log(`  first_name: "${guardianFirstName}"`);
  console.log(`  last_name: "${guardianLastName}"`);

  const { data: updated, error: updateError } = await edudashSupabase
    .from('profiles')
    .update({
      first_name: guardianFirstName,
      last_name: guardianLastName,
    })
    .eq('id', PARENT_ID)
    .select('id, email, first_name, last_name, role, preschool_id')
    .single();

  if (updateError) {
    console.error('\n❌ Error:', updateError);
  } else {
    console.log('\n✅ Updated parent profile:');
    console.log(JSON.stringify(updated, null, 2));
  }
})();
