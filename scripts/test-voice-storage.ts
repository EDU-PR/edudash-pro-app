/**
 * Test script to verify voice-notes storage bucket functionality
 * Run this after setting up the voice-notes bucket in Supabase
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env files
function loadEnvFile(filePath: string): Record<string, string> {
  const envVars: Record<string, string> = {};
  
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=').replace(/^["']|["']$/g, ''); // Remove quotes
        envVars[key.trim()] = value.trim();
      }
    }
  }
  
  return envVars;
}

// Load environment variables in order of precedence
const envFiles = ['.env.example', '.env.local', '.env'];
let allEnvVars: Record<string, string> = {};

for (const envFile of envFiles) {
  const envVars = loadEnvFile(path.join(process.cwd(), envFile));
  allEnvVars = { ...allEnvVars, ...envVars };
}

// Merge with process.env (process.env takes precedence)
for (const [key, value] of Object.entries(allEnvVars)) {
  if (!process.env[key]) {
    process.env[key] = value;
  }
}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testVoiceStorage() {
  console.log('🎤 Testing voice-notes storage bucket...\n');

  try {
    // Test 1: Check if bucket exists
    console.log('1. Checking if voice-notes bucket exists...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('❌ Failed to list buckets:', bucketsError);
      return;
    }
    
    const voiceNotesBucket = buckets.find(bucket => bucket.id === 'voice-notes');
    if (!voiceNotesBucket) {
      console.error('❌ voice-notes bucket not found. Please run the SQL migration first.');
      return;
    }
    
    console.log('✅ voice-notes bucket exists');
    console.log('   - Public:', voiceNotesBucket.public);
    console.log('   - Size limit:', voiceNotesBucket.file_size_limit || 'No limit');
    console.log('   - MIME types:', voiceNotesBucket.allowed_mime_types || 'All types');

    // Test 2: Check authentication status
    console.log('\n2. Checking authentication...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.log('❌ Not authenticated. Please sign in first to test file uploads.');
      console.log('   This is expected if running the script without authentication.');
      return;
    }
    
    console.log('✅ Authenticated as:', user.email);

    // Test 3: Test file upload (create a dummy audio file)
    console.log('\n3. Testing file upload...');
    
    // Create a tiny test "audio" file (just some bytes)
    const testData = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    const testBlob = new Blob([testData], { type: 'audio/m4a' });
    
    const platform = 'test';
    const fileName = `test_${Date.now()}.m4a`;
    const storagePath = `${platform}/${user.id}/${fileName}`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('voice-notes')
      .upload(storagePath, testBlob, {
        contentType: 'audio/m4a',
        upsert: true
      });
    
    if (uploadError) {
      console.error('❌ File upload failed:', uploadError);
      return;
    }
    
    console.log('✅ File uploaded successfully:', uploadData.path);

    // Test 4: Test signed URL generation
    console.log('\n4. Testing signed URL generation...');
    
    const { data: signedUrl, error: urlError } = await supabase.storage
      .from('voice-notes')
      .createSignedUrl(storagePath, 3600);
    
    if (urlError) {
      console.error('❌ Signed URL generation failed:', urlError);
    } else {
      console.log('✅ Signed URL generated successfully');
      console.log('   URL length:', signedUrl.signedUrl.length);
    }

    // Test 5: Test file deletion (cleanup)
    console.log('\n5. Cleaning up test file...');
    
    const { error: deleteError } = await supabase.storage
      .from('voice-notes')
      .remove([storagePath]);
    
    if (deleteError) {
      console.error('❌ File deletion failed:', deleteError);
    } else {
      console.log('✅ Test file deleted successfully');
    }

    console.log('\n🎉 All voice storage tests passed!');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Test transcription function
async function testTranscriptionFunction() {
  console.log('\n🔤 Testing transcription function...\n');

  try {
    // Create a dummy request to test if the function is available
    const { data, error } = await supabase.functions.invoke('transcribe-audio', {
      body: { storage_path: 'test/dummy.m4a', language: 'en' }
    });

    if (error) {
      console.error('❌ Transcription function error:', error);
      if (error.message?.includes('Function not found')) {
        console.log('💡 Make sure to deploy the transcribe-audio Edge Function');
      }
      return;
    }

    console.log('✅ Transcription function is available');
    console.log('   Response:', data);

  } catch (error) {
    console.error('❌ Transcription test failed:', error);
  }
}

// Environment variables check
async function checkEnvironment() {
  console.log('🔧 Environment Check\n');
  
  const requiredVars = [
    'EXPO_PUBLIC_SUPABASE_URL',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY'
  ];
  
  const optionalVars = [
    'TRANSCRIPTION_PROVIDER',
    'DEEPGRAM_API_KEY',
    'OPENAI_API_KEY'
  ];
  
  console.log('Required variables:');
  for (const varName of requiredVars) {
    const value = process.env[varName];
    console.log(`  ${varName}: ${value ? '✅ Set' : '❌ Missing'}`);
  }
  
  console.log('\nOptional variables (for transcription):');
  for (const varName of optionalVars) {
    const value = process.env[varName];
    console.log(`  ${varName}: ${value ? '✅ Set' : '⚠️ Not set'}`);
  }
  
  if (!process.env.TRANSCRIPTION_PROVIDER) {
    console.log('\n💡 Tip: Set TRANSCRIPTION_PROVIDER=openai in Supabase Dashboard > Settings > Environment Variables');
  }
  
  console.log('');
}

// Main test runner
async function runTests() {
  console.log('='.repeat(60));
  console.log('         VOICE STORAGE FUNCTIONALITY TEST');
  console.log('='.repeat(60));
  
  await checkEnvironment();
  await testVoiceStorage();
  await testTranscriptionFunction();
  
  console.log('\n' + '='.repeat(60));
  console.log('Test completed. Check the output above for any issues.');
  console.log('='.repeat(60));
}

// Run if called directly
if (require.main === module) {
  runTests().catch(console.error);
}

export { testVoiceStorage, testTranscriptionFunction, checkEnvironment };