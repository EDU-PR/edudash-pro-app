const { createClient } = require('@supabase/supabase-js');

const EDUDASH_URL = 'https://lvvvjywrmpcqrpvuptdi.supabase.co';
const EDUDASH_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2dnZqeXdybXBjcXJwdnVwdGRpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzAzNzgzOCwiZXhwIjoyMDY4NjEzODM4fQ.p8cRGywZP4qVglovv-T3VCDi9evfeCVZEBQM2LTeCmc';

const edudash = createClient(EDUDASH_URL, EDUDASH_SERVICE_KEY);

const STUDENT_ID = '880747ac-e1fc-4083-88e2-f3c92e684aef';

async function cleanup() {
  console.log('🧹 Cleaning up student:', STUDENT_ID);
  console.log('');

  // Delete from student_parent_relationships
  console.log('1️⃣  Deleting from student_parent_relationships...');
  const { error: relError } = await edudash
    .from('student_parent_relationships')
    .delete()
    .eq('student_id', STUDENT_ID);

  if (relError) {
    console.log('❌ Error:', relError.message);
  } else {
    console.log('✅ Deleted relationship records');
  }

  // Delete from students
  console.log('\n2️⃣  Deleting from students...');
  const { error: studentError } = await edudash
    .from('students')
    .delete()
    .eq('id', STUDENT_ID);

  if (studentError) {
    console.log('❌ Error:', studentError.message);
  } else {
    console.log('✅ Deleted student record');
  }

  console.log('\n✅ Cleanup complete!');
}

cleanup().catch(console.error);
