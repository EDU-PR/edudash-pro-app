const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://lvvvjywrmpcqrpvuptdi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2dnZqeXdybXBjcXJwdnVwdGRpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzAzNzgzOCwiZXhwIjoyMDY4NjEzODM4fQ.p8cRGywZP4qVglovv-T3VCDi9evfeCVZEBQM2LTeCmc'
);

const DUPLICATE_IDS = [
  '22a3addf-191b-43f3-b7f4-c4b4788a8eee',
  '10f2dd6f-f33f-4e6a-9d42-7f8fcb1bce27'
];

(async () => {
  console.log('🔍 Checking duplicate student records...\n');

  // List all Sam Doe students first
  const { data: samStudents, error: listError } = await supabase
    .from('students')
    .select('id, first_name, last_name, is_active, preschool_id, parent_id, created_at')
    .or(`id.eq.${DUPLICATE_IDS[0]},id.eq.${DUPLICATE_IDS[1]},id.eq.0b0a096d-a56d-4c77-8de1-a39ca31d2f0d`)
    .order('created_at', { ascending: true });

  if (listError) {
    console.error('❌ Error listing students:', listError);
    return;
  }

  console.log('All Sam Doe students:');
  samStudents.forEach((s, i) => {
    console.log(`${i + 1}. ${s.id} - ${s.first_name} ${s.last_name} - Active: ${s.is_active} - Created: ${s.created_at}`);
  });

  console.log(`\n🗑️  Deleting ${DUPLICATE_IDS.length} duplicate students...`);

  const { data: deleted, error: deleteError } = await supabase
    .from('students')
    .delete()
    .in('id', DUPLICATE_IDS)
    .select();

  if (deleteError) {
    console.error('\n❌ Error deleting:', deleteError);
  } else {
    console.log(`\n✅ Deleted ${deleted.length} duplicate student records`);
    
    // Verify remaining students
    const { data: remaining } = await supabase
      .from('students')
      .select('id, first_name, last_name, is_active, parent_id')
      .ilike('first_name', 'Sam')
      .ilike('last_name', 'Doe');

    console.log('\nRemaining Sam Doe students:');
    console.log(JSON.stringify(remaining, null, 2));
  }
})();
