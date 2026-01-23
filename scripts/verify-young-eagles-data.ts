/**
 * Verify Young Eagles Data Access
 * 
 * Checks that the principal can see all students and parent data
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lvvvjywrmpcqrpvuptdi.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2dnZqeXdybXBjcXJwdnVwdGRpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzAzNzgzOCwiZXhwIjoyMDY4NjEzODM4fQ.p8cRGywZP4qVglovv-T3VCDi9evfeCVZEBQM2LTeCmc';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function verifyYoungEaglesData(): Promise<void> {
  console.log('🔍 Verifying Young Eagles data access...\n');

  // Step 1: Find Young Eagles preschool
  console.log('📋 Step 1: Finding Young Eagles preschool...');
  const { data: preschools, error: preschoolError } = await supabase
    .from('preschools')
    .select('id, name, created_at')
    .ilike('name', '%young%eagles%');

  if (preschoolError) {
    console.error('❌ Error finding preschool:', preschoolError.message);
    
    // Try organizations table
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, name')
      .ilike('name', '%young%eagles%');
    
    if (orgs && orgs.length > 0) {
      console.log('✅ Found in organizations table:', orgs);
    }
    return;
  }

  if (!preschools || preschools.length === 0) {
    console.log('⚠️ No preschool found with "Young Eagles" name');
    
    // List all preschools
    const { data: allPreschools } = await supabase
      .from('preschools')
      .select('id, name')
      .limit(10);
    console.log('\n📋 Available preschools:', allPreschools);
    return;
  }

  const preschool = preschools[0];
  console.log(`✅ Found: ${preschool.name} (ID: ${preschool.id})`);

  // Step 2: Find the principal
  console.log('\n📋 Step 2: Finding principal for this school...');
  const { data: principals, error: principalError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email, role')
    .eq('preschool_id', preschool.id)
    .in('role', ['principal', 'principal_admin', 'admin']);

  if (principalError) {
    console.error('❌ Error finding principals:', principalError.message);
  } else {
    console.log(`✅ Found ${principals?.length || 0} principals:`, principals);
  }

  // Step 3: Get all students for this preschool
  console.log('\n📋 Step 3: Fetching students with parent info...');
  const { data: students, error: studentError } = await supabase
    .from('students')
    .select(`
      id,
      first_name,
      last_name,
      date_of_birth,
      parent_id,
      guardian_id,
      class_id,
      status,
      is_active,
      classes!students_class_id_fkey(name),
      parent:profiles!students_parent_id_fkey(id, first_name, last_name, email, phone),
      guardian:profiles!students_guardian_id_fkey(id, first_name, last_name, email, phone)
    `)
    .eq('preschool_id', preschool.id);

  if (studentError) {
    console.error('❌ Error fetching students:', studentError.message);
  } else {
    console.log(`\n✅ Found ${students?.length || 0} students:\n`);
    
    if (students && students.length > 0) {
      students.forEach((student, index) => {
        const parentInfo = student.parent || student.guardian;
        console.log(`${index + 1}. ${student.first_name} ${student.last_name}`);
        console.log(`   - Status: ${student.status || 'N/A'}, Active: ${student.is_active}`);
        console.log(`   - DOB: ${student.date_of_birth || 'Not set'}`);
        console.log(`   - Class: ${(student.classes as any)?.name || 'Unassigned'}`);
        console.log(`   - Parent ID: ${student.parent_id || 'None'}, Guardian ID: ${student.guardian_id || 'None'}`);
        if (parentInfo) {
          console.log(`   - Parent/Guardian: ${parentInfo.first_name} ${parentInfo.last_name} (${parentInfo.email})`);
          console.log(`   - Phone: ${parentInfo.phone || 'Not set'}`);
        } else {
          console.log(`   - ⚠️ NO PARENT/GUARDIAN DATA FOUND`);
        }
        console.log('');
      });
    }
  }

  // Step 4: Get all parents directly linked to this school
  console.log('\n📋 Step 4: Fetching all parents in this school...');
  const { data: parents, error: parentError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email, phone, role')
    .eq('preschool_id', preschool.id)
    .eq('role', 'parent');

  if (parentError) {
    console.error('❌ Error fetching parents:', parentError.message);
  } else {
    console.log(`✅ Found ${parents?.length || 0} parent profiles:`);
    parents?.forEach((parent, i) => {
      console.log(`   ${i + 1}. ${parent.first_name} ${parent.last_name} - ${parent.email}`);
    });
  }

  // Step 5: Check for classes
  console.log('\n📋 Step 5: Fetching classes...');
  const { data: classes, error: classError } = await supabase
    .from('classes')
    .select('id, name, grade_level, teacher_id')
    .eq('preschool_id', preschool.id);

  if (classError) {
    console.error('❌ Error fetching classes:', classError.message);
  } else {
    console.log(`✅ Found ${classes?.length || 0} classes:`, classes?.map(c => c.name));
  }

  console.log('\n✅ Data verification complete!');
}

verifyYoungEaglesData().catch(console.error);
