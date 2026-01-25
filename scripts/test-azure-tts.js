#!/usr/bin/env node
/**
 * Azure TTS Test Script
 * 
 * Tests Text-to-Speech functionality via the tts-proxy Edge Function.
 * 
 * Usage:
 *   node scripts/test-azure-tts.js <email> <password>
 * 
 * Or with environment variables:
 *   AUTH_EMAIL=user@example.com AUTH_PASSWORD=pass node scripts/test-azure-tts.js
 */

const { createClient } = require('@supabase/supabase-js');

// Load env if available
try {
  require('dotenv').config();
} catch (e) {
  // dotenv not installed, continue with process.env
}

async function main() {
  // Get credentials from args or env
  const email = process.argv[2] || process.env.AUTH_EMAIL;
  const password = process.argv[3] || process.env.AUTH_PASSWORD;
  
  const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  
  console.log('🔊 Azure TTS Test');
  console.log('=================\n');
  
  if (!SUPABASE_URL || !ANON_KEY) {
    console.error('❌ Missing SUPABASE_URL or ANON_KEY in environment');
    process.exit(1);
  }
  
  if (!email || !password) {
    console.log('Usage: node scripts/test-azure-tts.js <email> <password>\n');
    console.error('❌ Missing email/password. Provide as args or set AUTH_EMAIL/AUTH_PASSWORD env vars');
    process.exit(1);
  }
  
  console.log(`📍 Supabase URL: ${SUPABASE_URL}`);
  console.log(`📧 Email: ${email}\n`);
  
  // Create client and authenticate
  const supabase = createClient(SUPABASE_URL, ANON_KEY);
  
  console.log('🔐 Authenticating...');
  const { data: { session }, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (authError || !session) {
    console.error('❌ Authentication failed:', authError?.message || 'No session');
    process.exit(2);
  }
  
  console.log('✅ Authenticated successfully\n');
  
  // TTS test function
  async function testTTS(text, language, style = 'friendly') {
    console.log(`\n📝 Testing: "${text.substring(0, 50)}..."`);
    console.log(`   Language: ${language}, Style: ${style}`);
    
    try {
      const url = `${SUPABASE_URL}/functions/v1/tts-proxy`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          text,
          lang: language,
          style,
          format: 'mp3',
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.log(`   ❌ Error: ${JSON.stringify(data)}`);
        return null;
      }
      
      console.log(`   ✅ Provider: ${data.provider || 'unknown'}`);
      if (data.audio_url) {
        console.log(`   🔗 Audio URL: ${data.audio_url.substring(0, 80)}...`);
      }
      if (data.fallback) {
        console.log(`   ⚠️  Fallback: ${data.fallback}`);
      }
      
      return data;
    } catch (err) {
      console.log(`   ❌ Exception: ${err.message}`);
      return null;
    }
  }
  
  // Run tests
  console.log('🎯 Running TTS Tests...');
  
  // English test
  await testTTS('Hello! This is a test of the Azure Text-to-Speech system. How does it sound?', 'en', 'friendly');
  
  // Afrikaans test
  await testTTS('Hallo! Dit is \'n toets van die Azure Teks-na-Spraak stelsel.', 'af', 'friendly');
  
  // isiZulu test
  await testTTS('Sawubona! Lokhu kuhlola uhlelo lwe-Azure Text-to-Speech.', 'zu', 'friendly');
  
  // Test with different styles
  console.log('\n🎭 Testing different voice styles...');
  await testTTS('Important announcement: Please review the latest guidelines.', 'en', 'professional');
  await testTTS('Great job on completing your assignment!', 'en', 'cheerful');
  
  console.log('\n✅ TTS tests completed!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(3);
});
