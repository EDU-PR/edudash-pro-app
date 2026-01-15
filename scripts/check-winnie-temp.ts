import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SERVICE_ROLE_KEY || !SUPABASE_URL) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY or EXPO_PUBLIC_SUPABASE_URL');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  console.log('🔍 Searching for Winnie K Mathebula...\n');
  
  // Search profiles for Winnie
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email, role, preschool_id')
    .or('first_name.ilike.%Winnie%,last_name.ilike.%Mathebula%');
  
  if (profilesError) {
    console.error('Error searching profiles:', profilesError);
  } else {
    console.log('📋 Profiles found:', profiles?.length || 0);
    profiles?.forEach(p => {
      console.log(`  - ${p.first_name} ${p.last_name} (${p.email}) - Role: ${p.role}, Preschool: ${p.preschool_id}`);
    });
  }
  
  // Search students for any children linked to Winnie
  if (profiles && profiles.length > 0) {
    const parentIds = profiles.map(p => p.id);
    console.log('\n🔍 Searching for children of these parents...\n');
    
    for (const parentId of parentIds) {
      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select(`
          id, 
          first_name, 
          last_name, 
          is_active, 
          class_id,
          preschool_id,
          parent_id,
          guardian_id,
          classes!students_class_id_fkey(id, name, grade_level)
        `)
        .or(`parent_id.eq.${parentId},guardian_id.eq.${parentId}`);
      
      if (studentsError) {
        console.error('Error searching students:', studentsError);
      } else if (students && students.length > 0) {
        console.log(`�� Children linked to parent ${parentId}:`);
        students.forEach(s => {
          const className = (s.classes as any)?.name || 'No class';
          console.log(`  - ${s.first_name} ${s.last_name} | Active: ${s.is_active} | Class: ${className}`);
          console.log(`    ID: ${s.id} | Preschool: ${s.preschool_id}`);
        });
      }
    }
  }
  
  // Also search for Young Eagles preschool
  console.log('\n🔍 Searching for Young Eagles preschool...\n');
  const { data: preschools, error: preschoolsError } = await supabase
    .from('preschools')
    .select('id, name')
    .ilike('name', '%Young Eagles%');
  
  if (preschoolsError) {
    console.error('Error searching preschools:', preschoolsError);
  } else {
    console.log('🏫 Young Eagles preschools found:', preschools?.length || 0);
    preschools?.forEach(p => {
      console.log(`  - ${p.name} (ID: ${p.id})`);
    });
    
    // If we found Young Eagles, search for students there
    if (preschools && preschools.length > 0) {
      for (const school of preschools) {
        console.log(`\n👶 Students in ${school.name}:`);
        const { data: schoolStudents, error: schoolStudentsError } = await supabase
          .from('students')
          .select(`
            id, 
            first_name, 
            last_name, 
            is_active, 
            parent_id,
            guardian_id,
            classes!students_class_id_fkey(id, name, grade_level)
          `)
          .eq('preschool_id', school.id)
          .order('last_name');
        
        if (schoolStudentsError) {
          console.error('Error:', schoolStudentsError);
        } else {
          console.log(`  Total students: ${schoolStudents?.length || 0}`);
          schoolStudents?.forEach(s => {
            const className = (s.classes as any)?.name || 'No class';
            console.log(`  - ${s.first_name} ${s.last_name} | Active: ${s.is_active} | Class: ${className}`);
          });
        }
      }
    }
  }
}

main().catch(console.error);
