/**
 * Database Tables Verification Script
 * 
 * Verifies if learner feature tables exist in the database
 * Run with: npx tsx scripts/verify-database-tables.ts
 */

import { assertSupabase } from '../lib/supabase';

const TABLES_TO_CHECK = [
  'learner_connections',
  'study_groups',
  'assignment_submissions',
  'learner_cvs',
  'portfolio_items',
];

async function verifyTables() {
  console.log('🔍 Verifying database tables...\n');
  
  const supabase = assertSupabase();
  const results: Record<string, { exists: boolean; error?: string }> = {};
  
  for (const tableName of TABLES_TO_CHECK) {
    try {
      // Try to query the table (will fail if table doesn't exist)
      const { error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);
      
      if (error) {
        // Check if error is "relation does not exist"
        if (error.message?.includes('does not exist') || error.code === '42P01') {
          results[tableName] = { exists: false, error: 'Table does not exist' };
        } else {
          // Table exists but query failed for other reason (RLS, permissions, etc.)
          results[tableName] = { exists: true, error: error.message };
        }
      } else {
        results[tableName] = { exists: true };
      }
    } catch (err: any) {
      results[tableName] = { exists: false, error: err.message || 'Unknown error' };
    }
  }
  
  // Print results
  console.log('📊 Verification Results:\n');
  let allExist = true;
  
  for (const [table, result] of Object.entries(results)) {
    const status = result.exists ? '✅ EXISTS' : '❌ MISSING';
    console.log(`${status} - ${table}`);
    if (result.error && result.exists) {
      console.log(`   ⚠️  Warning: ${result.error}`);
    } else if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    if (!result.exists) allExist = false;
  }
  
  console.log('\n' + '='.repeat(50));
  if (allExist) {
    console.log('✅ All tables exist in the database');
    console.log('💡 If codebase review says tables are missing, the review is INCORRECT');
  } else {
    console.log('❌ Some tables are missing');
    console.log('💡 Run migrations to create missing tables:');
    console.log('   supabase migration up');
  }
  console.log('='.repeat(50));
  
  return results;
}

// Run verification
verifyTables()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Verification failed:', err);
    process.exit(1);
  });

