/**
 * Manual Student Deletion Cleanup Script
 * Deletes student_guardians records and student records that failed to cascade
 */

const { createClient } = require('@supabase/supabase-js');

// EduDashPro database
const EDUDASH_URL = 'https://lvvvjywrmpcqrpvuptdi.supabase.co';
const EDUDASH_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2dnZqeXdybXBjcXJwdnVwdGRpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzAzNzgzOCwiZXhwIjoyMDY4NjEzODM4fQ.p8cRGywZP4qVglovv-T3VCDi9evfeCVZEBQM2LTeCmc';

const edudash = createClient(EDUDASH_URL, EDUDASH_SERVICE_KEY);

const STUDENT_ID = '880747ac-e1fc-4083-88e2-f3c92e684aef';

async function fixStudentDeletion() {
  console.log('🔍 Checking student_guardians records for student:', STUDENT_ID);

  // Step 1: Check if records exist
  const { data: guardianRecords, error: checkError } = await edudash
    .from('student_guardians')
    .select('*')
    .eq('student_id', STUDENT_ID);

  if (checkError) {
    console.error('❌ Error checking student_guardians:', checkError);
    return;
  }

  console.log(`Found ${guardianRecords?.length || 0} guardian records`);
  if (guardianRecords && guardianRecords.length > 0) {
    console.log('Guardian records:', JSON.stringify(guardianRecords, null, 2));
  }

  // Step 2: Delete student_guardians records
  if (guardianRecords && guardianRecords.length > 0) {
    console.log('\n🗑️  Deleting student_guardians records...');
    const { error: deleteGuardiansError } = await edudash
      .from('student_guardians')
      .delete()
      .eq('student_id', STUDENT_ID);

    if (deleteGuardiansError) {
      console.error('❌ Error deleting student_guardians:', deleteGuardiansError);
      return;
    }
    console.log('✅ student_guardians records deleted');
  }

  // Step 3: Check if student still exists
  const { data: student, error: studentError } = await edudash
    .from('students')
    .select('*')
    .eq('id', STUDENT_ID)
    .single();

  if (studentError && studentError.code !== 'PGRST116') {
    console.error('❌ Error checking student:', studentError);
    return;
  }

  if (student) {
    console.log('\n👤 Student still exists:', student.first_name, student.last_name);
    console.log('🗑️  Deleting student record...');
    
    const { error: deleteStudentError } = await edudash
      .from('students')
      .delete()
      .eq('id', STUDENT_ID);

    if (deleteStudentError) {
      console.error('❌ Error deleting student:', deleteStudentError);
      return;
    }
    console.log('✅ Student record deleted');
  } else {
    console.log('✅ Student already deleted');
  }

  console.log('\n🎉 Cleanup complete!');
}

fixStudentDeletion().catch(console.error);
