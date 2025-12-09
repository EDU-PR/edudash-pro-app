/**
 * Find Young Eagles Data
 * 
 * The dashboard shows "Young Eagles" as the school name, but it's not in preschools table.
 * Let's find where this data actually exists.
 * 
 * Usage: SUPABASE_URL=... SUPABASE_ANON_KEY=... npx ts-node scripts/find-young-eagles.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing required environment variables: SUPABASE_URL and SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function findYoungEaglesData(): Promise<void> {
  console.log('🔍 Searching for Young Eagles data across all tables...');
  
  const tablesToSearch = [
    'preschools',
    'organizations', 
    'profiles',
    'students',
    'classes',
    'attendance_records',
    'enrollment_applications',
    'users'
  ];
  
  for (const tableName of tablesToSearch) {
    console.log(`\\n📋 Checking ${tableName} table...`);
    
    try {
      // Get sample data from table
      const { data: sampleData, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(5);
      
      if (error) {
        console.log(`❌ Error querying ${tableName}:`, error.message);
        continue;
      }
      
      console.log(`✅ ${tableName}: ${sampleData?.length || 0} records`);
      
      if (sampleData && sampleData.length > 0) {
        console.log('Sample record:', sampleData[0]);
        
        // Look for Young Eagles in any string fields
        const hasYoungEagles = sampleData.some((record: any) => 
          JSON.stringify(record).toLowerCase().includes('young eagles')
        );
        
        if (hasYoungEagles) {
          console.log('🎯 FOUND "Young Eagles" in this table!');
          const recordsWithYoungEagles = sampleData.filter((record: any) =>
            JSON.stringify(record).toLowerCase().includes('young eagles')
          );
          console.log('Records containing Young Eagles:', recordsWithYoungEagles);
        }
      }
    } catch (err) {
      console.log(`⚠️ Could not access ${tableName}:`, err);
    }
  }
  
  console.log('\\n' + '='.repeat(60));
  console.log('🔍 SEARCHING FOR ANY TEACHER-LIKE DATA');
  console.log('='.repeat(60));
  
  // Search for any profiles/users that might be teachers
  try {
    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('*')
      .limit(10);
      
    console.log('\\n👥 All profiles found:', allProfiles?.length || 0);
    if (allProfiles && allProfiles.length > 0) {
      console.log('Roles in profiles:');
      const roles = [...new Set(allProfiles.map((p: any) => p.role))];
      console.log(roles);
      
      console.log('\\nSample profiles:');
      allProfiles.slice(0, 3).forEach((profile: any, i: number) => {
        console.log(`${i + 1}. ${profile.first_name} ${profile.last_name} (${profile.role})`);
      });
    }
  } catch (err) {
    console.log('Could not query profiles:', err);
  }
  
  // Check if there's an organizations table instead of preschools
  try {
    const { data: orgs } = await supabase
      .from('organizations')
      .select('*')
      .limit(5);
      
    console.log('\\n🏢 Organizations found:', orgs?.length || 0);
    if (orgs && orgs.length > 0) {
      orgs.forEach((org: any, i: number) => {
        console.log(`${i + 1}. ${org.name} (ID: ${org.id})`);
      });
    }
  } catch (err) {
    console.log('Could not query organizations:', err);
  }
  
  console.log('\\n' + '='.repeat(60));
  console.log('🎯 SUMMARY');
  console.log('='.repeat(60));
  console.log('The dashboard shows "Young Eagles" but we need to find:');
  console.log('1. Where the school data actually lives (organizations vs preschools)');
  console.log('2. Where teacher data is stored (profiles vs teachers table)');
  console.log('3. What the correct ID is for Young Eagles');
}

if (require.main === module) {
  findYoungEaglesData().catch(error => {
    console.error('💥 Search failed:', error);
    process.exit(1);
  });
}

export { findYoungEaglesData };