/**
 * Phase 3D: Organization Generalization Testing Script
 * 
 * Validates that the organization system works correctly:
 * 1. Terminology mapping works for all organization types
 * 2. Dynamic greetings are organization-aware
 * 3. Role capabilities are organization-specific
 * 4. Backward compatibility with preschool system maintained
 * 
 * Run with: npx ts-node scripts/test-phase3-organization-system.ts
 */

import { 
  OrganizationType,
  ORGANIZATION_CONFIGS 
} from '../lib/types/organization';

import {
  getOrganizationConfig,
  getTerminology,
  getDynamicGreeting,
  getRoleCapabilities,
  mapTerm,
  getAvailableRoles,
  isFeatureEnabled
} from '../lib/organization';

console.log('🧪 Phase 3D: Organization System Test Suite\n');
console.log('='.repeat(60));

// Test counters
let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.error(`❌ ${name}`);
    console.error(`   Error: ${error}`);
    failed++;
  }
}

// ============================================================================
// TEST 1: Terminology Mapping
// ============================================================================
console.log('\n📋 Test 1: Terminology Mapping');
console.log('-'.repeat(60));

test('Preschool terminology: member -> student', () => {
  const term = mapTerm('member', OrganizationType.PRESCHOOL);
  if (term !== 'student') throw new Error(`Expected 'student', got '${term}'`);
});

test('Corporate terminology: member -> employee', () => {
  const term = mapTerm('member', OrganizationType.CORPORATE);
  if (term !== 'employee') throw new Error(`Expected 'employee', got '${term}'`);
});

test('Sports Club terminology: member -> athlete', () => {
  const term = mapTerm('member', OrganizationType.SPORTS_CLUB);
  if (term !== 'athlete') throw new Error(`Expected 'athlete', got '${term}'`);
});

test('K12 School terminology: group -> class', () => {
  const term = mapTerm('group', OrganizationType.K12_SCHOOL);
  if (term !== 'class') throw new Error(`Expected 'class', got '${term}'`);
});

test('Corporate terminology: leader -> trainer', () => {
  const term = mapTerm('leader', OrganizationType.CORPORATE);
  if (term !== 'trainer') throw new Error(`Expected 'trainer', got '${term}'`);
});

test('University terminology: leader -> professor', () => {
  const term = mapTerm('leader', OrganizationType.UNIVERSITY);
  if (term !== 'professor') throw new Error(`Expected 'professor', got '${term}'`);
});

// ============================================================================
// TEST 2: Dynamic Greetings
// ============================================================================
console.log('\n👋 Test 2: Dynamic Greetings');
console.log('-'.repeat(60));

test('Preschool teacher greeting includes "teacher"', () => {
  const greeting = getDynamicGreeting(OrganizationType.PRESCHOOL, 'teacher');
  if (!greeting.toLowerCase().includes('teach') && !greeting.toLowerCase().includes('assist')) {
    throw new Error(`Greeting doesn't seem teacher-appropriate: "${greeting}"`);
  }
});

test('Corporate trainer greeting exists', () => {
  const greeting = getDynamicGreeting(OrganizationType.CORPORATE, 'trainer');
  if (!greeting || greeting.length === 0) {
    throw new Error('No greeting returned for corporate trainer');
  }
});

test('Sports coach greeting includes "coach" or "training"', () => {
  const greeting = getDynamicGreeting(OrganizationType.SPORTS_CLUB, 'coach');
  const lowerGreeting = greeting.toLowerCase();
  if (!lowerGreeting.includes('coach') && !lowerGreeting.includes('training') && !lowerGreeting.includes('assist')) {
    throw new Error(`Greeting doesn't seem coach-appropriate: "${greeting}"`);
  }
});

test('University professor greeting exists', () => {
  const greeting = getDynamicGreeting(OrganizationType.UNIVERSITY, 'professor');
  if (!greeting || greeting.length === 0) {
    throw new Error('No greeting returned for university professor');
  }
});

// ============================================================================
// TEST 3: Role Capabilities
// ============================================================================
console.log('\n🎯 Test 3: Role Capabilities');
console.log('-'.repeat(60));

test('Preschool teacher has capabilities', () => {
  const caps = getRoleCapabilities(OrganizationType.PRESCHOOL, 'teacher');
  if (!caps || caps.length === 0) {
    throw new Error('No capabilities returned for preschool teacher');
  }
});

test('Corporate trainer has capabilities', () => {
  const caps = getRoleCapabilities(OrganizationType.CORPORATE, 'trainer');
  if (!caps || caps.length === 0) {
    throw new Error('No capabilities returned for corporate trainer');
  }
});

test('Sports coach has capabilities', () => {
  const caps = getRoleCapabilities(OrganizationType.SPORTS_CLUB, 'coach');
  if (!caps || caps.length === 0) {
    throw new Error('No capabilities returned for sports coach');
  }
});

test('University professor has capabilities', () => {
  const caps = getRoleCapabilities(OrganizationType.UNIVERSITY, 'professor');
  if (!caps || caps.length === 0) {
    throw new Error('No capabilities returned for university professor');
  }
});

// ============================================================================
// TEST 4: Feature Flags
// ============================================================================
console.log('\n⚙️  Test 4: Feature Flags');
console.log('-'.repeat(60));

test('Preschool has grading enabled', () => {
  const enabled = isFeatureEnabled(OrganizationType.PRESCHOOL, 'hasGrading');
  if (!enabled) throw new Error('Preschool should have grading enabled');
});

test('Sports club has grading disabled', () => {
  const enabled = isFeatureEnabled(OrganizationType.SPORTS_CLUB, 'hasGrading');
  if (enabled) throw new Error('Sports club should NOT have grading enabled');
});

test('All org types have messaging', () => {
  for (const orgType of Object.values(OrganizationType)) {
    const enabled = isFeatureEnabled(orgType, 'hasMessaging');
    if (!enabled) throw new Error(`${orgType} should have messaging enabled`);
  }
});

// ============================================================================
// TEST 5: Available Roles
// ============================================================================
console.log('\n👥 Test 5: Available Roles');
console.log('-'.repeat(60));

test('Preschool has at least 4 roles', () => {
  const roles = getAvailableRoles(OrganizationType.PRESCHOOL);
  if (roles.length < 4) throw new Error(`Expected at least 4 roles, got ${roles.length}`);
});

test('Corporate has employee role', () => {
  const roles = getAvailableRoles(OrganizationType.CORPORATE);
  if (!roles.includes('employee')) throw new Error('Corporate should have employee role');
});

test('Sports club has athlete role', () => {
  const roles = getAvailableRoles(OrganizationType.SPORTS_CLUB);
  if (!roles.includes('athlete')) throw new Error('Sports club should have athlete role');
});

test('University has student role', () => {
  const roles = getAvailableRoles(OrganizationType.UNIVERSITY);
  if (!roles.includes('student')) throw new Error('University should have student role');
});

// ============================================================================
// TEST 6: Organization Config Completeness
// ============================================================================
console.log('\n📦 Test 6: Organization Config Completeness');
console.log('-'.repeat(60));

test('All 8 organization types are configured', () => {
  const types = Object.values(OrganizationType);
  if (types.length !== 8) throw new Error(`Expected 8 org types, got ${types.length}`);
  
  for (const type of types) {
    const config = getOrganizationConfig(type);
    if (!config) throw new Error(`No config for ${type}`);
  }
});

test('All org types have complete terminology', () => {
  for (const orgType of Object.values(OrganizationType)) {
    const terminology = getTerminology(orgType);
    const requiredFields = ['member', 'leader', 'admin', 'group', 'guardian', 'activity', 'assessment', 'organization'];
    
    for (const field of requiredFields) {
      if (!terminology[field as keyof typeof terminology]) {
        throw new Error(`${orgType} missing terminology field: ${field}`);
      }
    }
  }
});

test('All org types have at least one role', () => {
  for (const orgType of Object.values(OrganizationType)) {
    const roles = getAvailableRoles(orgType);
    if (roles.length === 0) throw new Error(`${orgType} has no roles defined`);
  }
});

// ============================================================================
// TEST 7: Backward Compatibility
// ============================================================================
console.log('\n🔄 Test 7: Backward Compatibility');
console.log('-'.repeat(60));

test('Preschool config exists (legacy support)', () => {
  const config = getOrganizationConfig(OrganizationType.PRESCHOOL);
  if (!config) throw new Error('Preschool config not found');
  if (config.type !== OrganizationType.PRESCHOOL) throw new Error('Preschool type mismatch');
});

test('Preschool terminology matches legacy expectations', () => {
  const terminology = getTerminology(OrganizationType.PRESCHOOL);
  if (terminology.member !== 'student') throw new Error('Preschool member should be student');
  if (terminology.leader !== 'teacher') throw new Error('Preschool leader should be teacher');
  if (terminology.admin !== 'principal') throw new Error('Preschool admin should be principal');
  if (terminology.group !== 'class') throw new Error('Preschool group should be class');
});

test('Fallback to preschool for unknown org type', () => {
  const config = getOrganizationConfig('unknown_org_type' as any);
  if (config.type !== OrganizationType.PRESCHOOL) {
    throw new Error('Should fallback to preschool for unknown org types');
  }
});

// ============================================================================
// RESULTS SUMMARY
// ============================================================================
console.log('\n' + '='.repeat(60));
console.log('📊 Test Results Summary');
console.log('='.repeat(60));
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

if (failed === 0) {
  console.log('\n🎉 All tests passed! Phase 3D validation complete.');
  process.exit(0);
} else {
  console.log(`\n⚠️  ${failed} test(s) failed. Please review the errors above.`);
  process.exit(1);
}
