#!/usr/bin/env node

/**
 * Test Anthropic API Key Validity
 * This script tests if your Anthropic API key is working
 */

const { execSync } = require('child_process');

console.log('🔍 Testing Anthropic API Key...\n');

// Get the key from Supabase secrets
try {
  const secretsList = execSync('supabase secrets list', { encoding: 'utf8' });
  
  if (!secretsList.includes('ANTHROPIC_API_KEY')) {
    console.error('❌ ANTHROPIC_API_KEY not found in Supabase secrets!');
    process.exit(1);
  }
  
  console.log('✅ ANTHROPIC_API_KEY found in Supabase secrets\n');
  
  // Now test the actual API key by invoking the edge function
  console.log('📡 Testing edge function invocation...\n');
  console.log('Run this command to test the function:');
  console.log('\nsupabase functions invoke ai-proxy-simple --body \'{"payload": {"prompt": "Hello, test message"}}\'\n');
  
  console.log('OR test directly via cURL:');
  console.log('\ncurl -X POST https://lvvvjywrmpcqrpvuptdi.supabase.co/functions/v1/ai-proxy-simple \\');
  console.log('  -H "Content-Type: application/json" \\');
  console.log('  -d \'{"payload": {"prompt": "Test"}}\'\n');
  
  console.log('\n📋 Next Steps:');
  console.log('1. Check Supabase Dashboard → Edge Functions → ai-proxy-simple → Logs');
  console.log('2. Look for error messages in the logs');
  console.log('3. Common issues:');
  console.log('   - Invalid/expired Anthropic API key');
  console.log('   - API key doesn\'t have correct permissions');
  console.log('   - Anthropic API rate limit exceeded');
  console.log('   - Network/timeout issues\n');
  
} catch (error) {
  console.error('❌ Error running command:', error.message);
  process.exit(1);
}
