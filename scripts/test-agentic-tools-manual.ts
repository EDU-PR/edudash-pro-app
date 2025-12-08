#!/usr/bin/env tsx
/**
 * Manual Test Script for Agentic Tool System
 * 
 * Run: tsx scripts/test-agentic-tools-manual.ts
 * 
 * Tests tool execution with real Supabase database
 */

import { DashToolRegistry } from '../services/dash-ai/DashToolRegistry';
import { initializeTools } from '../services/dash-ai/tools';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function main() {
  log('\n=== Agentic Tool System Manual Test ===\n', 'cyan');

  // Initialize tools
  log('Initializing tool registry...', 'blue');
  initializeTools();
  
  const stats = DashToolRegistry.getStats();
  log(`✓ Registered ${stats.totalTools} tools\n`, 'green');

  // Check environment
  if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
    log('✗ Missing Supabase credentials in environment', 'red');
    log('  Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY', 'yellow');
    process.exit(1);
  }

  // Initialize Supabase client
  const supabase = createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  );

  log('✓ Connected to Supabase\n', 'green');

  // Test scenarios
  const scenarios = [
    {
      name: 'Teacher queries students in organization',
      context: {
        userId: 'test-teacher-id',
        organizationId: 'test-org-id',
        role: 'teacher' as const,
        tier: 'starter' as const,
        hasOrganization: true,
        isGuest: false,
        supabaseClient: supabase
      },
      params: {
        query_type: 'list_students',
        limit: 10
      }
    },
    {
      name: 'Parent queries students in organization',
      context: {
        userId: 'test-parent-id',
        organizationId: 'test-org-id',
        role: 'parent' as const,
        tier: 'free' as const,
        hasOrganization: true,
        isGuest: false,
        supabaseClient: supabase
      },
      params: {
        query_type: 'list_students',
        limit: 5
      }
    },
    {
      name: 'Independent parent queries without organization',
      context: {
        userId: 'independent-parent-id',
        organizationId: null,
        role: 'parent' as const,
        tier: 'free' as const,
        hasOrganization: false,
        isGuest: false,
        supabaseClient: supabase
      },
      params: {
        query_type: 'list_students',
        limit: 5
      }
    },
    {
      name: 'Guest user blocked from tool execution',
      context: {
        userId: 'guest-user-id',
        organizationId: null,
        role: 'guest' as const,
        tier: 'free' as const,
        hasOrganization: false,
        isGuest: true,
        supabaseClient: supabase
      },
      params: {
        query_type: 'list_students',
        limit: 5
      }
    },
    {
      name: 'Teacher queries classes',
      context: {
        userId: 'test-teacher-id',
        organizationId: 'test-org-id',
        role: 'teacher' as const,
        tier: 'starter' as const,
        hasOrganization: true,
        isGuest: false,
        supabaseClient: supabase
      },
      params: {
        query_type: 'list_classes',
        limit: 10
      }
    },
    {
      name: 'Principal queries teachers',
      context: {
        userId: 'test-principal-id',
        organizationId: 'test-org-id',
        role: 'principal' as const,
        tier: 'premium' as const,
        hasOrganization: true,
        isGuest: false,
        supabaseClient: supabase
      },
      params: {
        query_type: 'list_teachers',
        limit: 20
      }
    }
  ];

  let passCount = 0;
  let failCount = 0;

  for (const scenario of scenarios) {
    log(`\nTest: ${scenario.name}`, 'blue');
    log(`  Role: ${scenario.context.role}, Tier: ${scenario.context.tier}`);
    log(`  Has Org: ${scenario.context.hasOrganization}, Guest: ${scenario.context.isGuest}`);
    log(`  Query: ${scenario.params.query_type}, Limit: ${scenario.params.limit}`);

    const startTime = Date.now();
    
    try {
      const result = await DashToolRegistry.executeTool(
        'query_database',
        scenario.params,
        scenario.context
      );

      const executionTime = Date.now() - startTime;

      if (result.success) {
        log(`  ✓ Success (${executionTime}ms)`, 'green');
        
        if (result.data) {
          const count = Array.isArray(result.data) ? result.data.length : 0;
          log(`  → Returned ${count} rows`, 'cyan');
          
          // Log sample data (first row only)
          if (count > 0 && Array.isArray(result.data)) {
            const firstRow = result.data[0];
            const keys = Object.keys(firstRow).slice(0, 5); // First 5 columns
            log(`  → Sample columns: ${keys.join(', ')}`, 'cyan');
          }
        }
        
        passCount++;
      } else {
        // Guest users are expected to fail
        if (scenario.context.isGuest && result.error?.includes('Guest')) {
          log(`  ✓ Expected failure: ${result.error}`, 'green');
          passCount++;
        } else {
          log(`  ✗ Failed: ${result.error}`, 'red');
          failCount++;
        }
      }

      if (result.metadata) {
        log(`  → Execution time: ${result.metadata.executionTime}ms`, 'cyan');
      }
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      log(`  ✗ Error (${executionTime}ms): ${error.message}`, 'red');
      failCount++;
    }
  }

  // Summary
  log('\n=== Test Summary ===', 'cyan');
  log(`Total: ${scenarios.length}`, 'blue');
  log(`Passed: ${passCount}`, 'green');
  log(`Failed: ${failCount}`, failCount > 0 ? 'red' : 'green');

  // Registry stats
  const finalStats = DashToolRegistry.getStats();
  log('\n=== Registry Statistics ===', 'cyan');
  log(`Total tools: ${finalStats.totalTools}`, 'blue');
  log(`Total executions: ${finalStats.recentExecutions}`, 'blue');
  log(`Success count: ${finalStats.successCount}`, 'green');
  log(`Success rate: ${finalStats.successRate.toFixed(1)}%`, 'green');

  log('\n=== Tools by Category ===', 'cyan');
  Object.entries(finalStats.toolsByCategory).forEach(([category, count]) => {
    log(`  ${category}: ${count}`, 'blue');
  });

  log('\n=== Tools by Risk Level ===', 'cyan');
  Object.entries(finalStats.toolsByRisk).forEach(([risk, count]) => {
    log(`  ${risk}: ${count}`, 'blue');
  });

  // Check for actual data from production DB
  log('\n=== Production Database Check ===', 'cyan');
  
  try {
    const { count: studentCount } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true });
    
    log(`Students in database: ${studentCount || 0}`, studentCount ? 'green' : 'yellow');

    const { count: teacherCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'teacher');
    
    log(`Teachers in database: ${teacherCount || 0}`, teacherCount ? 'green' : 'yellow');

    if (!studentCount && !teacherCount) {
      log('\n⚠ Warning: No data in production database', 'yellow');
      log('  Tests will pass validation but return empty results', 'yellow');
      log('  To test with real data, seed your database first', 'yellow');
    }
  } catch (error: any) {
    log(`\n⚠ Could not check database: ${error.message}`, 'yellow');
  }

  log('\n✓ Manual test complete\n', 'green');

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch(error => {
  log(`\nFatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
