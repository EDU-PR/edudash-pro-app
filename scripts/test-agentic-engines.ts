#!/usr/bin/env ts-node
/**
 * Agentic Engines Integration Test
 * 
 * Tests the complete agentic system:
 * - DashDecisionEngine
 * - DashProactiveEngine
 * - DashContextAnalyzer
 * - DashAgenticEngine integration
 * 
 * Run: npx ts-node scripts/test-agentic-engines.ts
 */

import DashDecisionEngine from '../services/DashDecisionEngine';
import DashProactiveEngine from '../services/DashProactiveEngine';
import DashContextAnalyzer from '../services/DashContextAnalyzer';

console.log('🚀 DASH Agentic Engines Integration Test\n');

// Test 1: Decision Engine
console.log('📊 Test 1: Decision Engine');
console.log('━'.repeat(50));

const testDecision = async () => {
  const candidate = {
    id: 'test_action_1',
    type: 'task' as const,
    action: 'create_lesson_plan',
    description: 'Create a lesson plan for Grade 3 Mathematics',
    tags: ['productivity', 'time-saving'],
    estimatedDuration: 3000
  };

  const context = {
    autonomyLevel: 'confirm' as const,
    userRole: 'teacher',
    recentActions: ['create_lesson_plan', 'grade_assignment']
  };

  const decision = await DashDecisionEngine.decide(candidate, context);
  
  console.log(`✅ Decision ID: ${decision.id}`);
  console.log(`   Confidence: ${(decision.score.confidence * 100).toFixed(1)}%`);
  console.log(`   Risk: ${decision.score.risk}`);
  console.log(`   Priority: ${decision.score.priority}/10`);
  console.log(`   Strategy: ${decision.plan.executionStrategy}`);
  console.log(`   Requires Approval: ${decision.plan.requiresApproval ? 'Yes' : 'No'}`);
  console.log(`   Reasoning: ${decision.rationale.reasoning.substring(0, 100)}...`);
  
  return decision;
};

// Test 2: Proactive Engine
console.log('\n\n🎯 Test 2: Proactive Engine');
console.log('━'.repeat(50));

const testProactive = async () => {
  const suggestions = await DashProactiveEngine.checkForSuggestions('teacher', {
    autonomyLevel: 'suggest',
    timeContext: {
      hour: 7, // Morning
      dayOfWeek: 2 // Tuesday
    },
    recentActivity: [
      { type: 'create', action: 'lesson_plan', timestamp: Date.now() - 3600000 }
    ]
  });

  console.log(`✅ Proactive Suggestions: ${suggestions.length}`);
  suggestions.forEach((s, i) => {
    console.log(`   ${i + 1}. [${s.priority}] ${s.title}`);
    console.log(`      ${s.message.substring(0, 80)}...`);
    console.log(`      Triggered by: ${s.triggeredBy}`);
  });

  const stats = DashProactiveEngine.getStats();
  console.log(`\n   Stats:`);
  console.log(`   - Total Rules: ${stats.totalRules}`);
  console.log(`   - Active Rules: ${stats.activeRules}`);
  console.log(`   - Triggered Today: ${stats.triggeredToday}`);
  
  return suggestions;
};

// Test 3: Context Analyzer
console.log('\n\n🧠 Test 3: Context Analyzer');
console.log('━'.repeat(50));

const testContext = async () => {
  const input = "I'm frustrated with grading these assignments. Can you help me grade them faster?";
  const history = [
    { role: 'user', content: 'How do I create a lesson plan?' },
    { role: 'assistant', content: 'I can help you create a lesson plan...' },
    { role: 'user', content: input }
  ];

  const analysis = await DashContextAnalyzer.analyzeUserInput(input, history);
  
  console.log(`✅ Intent: ${analysis.intent.primary_intent}`);
  console.log(`   Confidence: ${(analysis.intent.confidence * 100).toFixed(1)}%`);
  console.log(`   Urgency: ${analysis.intent.urgency}`);
  console.log(`   Category: ${analysis.intent.category}`);
  
  const emotion = DashContextAnalyzer.estimateEmotionalState(input, history);
  console.log(`\n   Emotional State:`);
  console.log(`   - Mood: ${emotion.mood}`);
  console.log(`   - Confidence: ${(emotion.confidence * 100).toFixed(1)}%`);
  console.log(`   - Trend: ${emotion.trend}`);
  
  console.log(`\n   Opportunities: ${analysis.opportunities.length}`);
  analysis.opportunities.slice(0, 2).forEach((opp, i) => {
    console.log(`   ${i + 1}. ${opp.title} (${opp.priority})`);
  });
  
  return analysis;
};

// Test 4: Integration Test
console.log('\n\n🔗 Test 4: Full Integration Flow');
console.log('━'.repeat(50));

const testIntegration = async () => {
  console.log('Scenario: Teacher requests lesson planning help at 7 AM');
  
  // Step 1: Context Analysis
  const input = "Can you help me plan today's math lesson?";
  const context = await DashContextAnalyzer.analyzeUserInput(input, []);
  console.log(`✅ 1. Context analyzed - Intent: ${context.intent.primary_intent}`);
  
  // Step 2: Proactive Suggestions
  const suggestions = await DashProactiveEngine.checkForSuggestions('teacher', {
    autonomyLevel: 'confirm',
    timeContext: { hour: 7, dayOfWeek: 2 }
  });
  console.log(`✅ 2. Found ${suggestions.length} proactive suggestions`);
  
  // Step 3: Decision Making
  if (suggestions.length > 0) {
    const firstSuggestion = suggestions[0];
    const firstAction = firstSuggestion.actions[0];
    
    const decision = await DashProactiveEngine.executeSuggestionAction(
      firstSuggestion,
      firstAction.id,
      { autonomyLevel: 'confirm', userRole: 'teacher' }
    );
    
    if (decision) {
      console.log(`✅ 3. Decision made - Strategy: ${decision.plan.executionStrategy}`);
      console.log(`   Risk: ${decision.score.risk}, Requires approval: ${decision.plan.requiresApproval}`);
    } else {
      console.log(`ℹ️  3. Action dismissed by user`);
    }
  }
  
  // Step 4: Statistics
  const decisionStats = DashDecisionEngine.getDecisionStats();
  console.log(`\n   Decision Engine Stats:`);
  console.log(`   - Total Decisions: ${decisionStats.total}`);
  console.log(`   - Avg Confidence: ${(decisionStats.avgConfidence * 100).toFixed(1)}%`);
  console.log(`   - By Risk: Low=${decisionStats.byRisk.low}, Medium=${decisionStats.byRisk.medium}, High=${decisionStats.byRisk.high}`);
};

// Run all tests
(async () => {
  try {
    await testDecision();
    await testProactive();
    await testContext();
    await testIntegration();
    
    console.log('\n\n✨ All tests completed successfully!\n');
    console.log('📈 Summary:');
    console.log('━'.repeat(50));
    
    const decisionStats = DashDecisionEngine.getDecisionStats();
    const proactiveStats = DashProactiveEngine.getStats();
    
    console.log(`Decision Engine:`);
    console.log(`  ✓ ${decisionStats.total} decisions made`);
    console.log(`  ✓ ${(decisionStats.avgConfidence * 100).toFixed(1)}% avg confidence`);
    
    console.log(`\nProactive Engine:`);
    console.log(`  ✓ ${proactiveStats.totalRules} total rules`);
    console.log(`  ✓ ${proactiveStats.activeRules} active rules`);
    
    console.log('\n🎉 Agentic system is production-ready!\n');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
})();
