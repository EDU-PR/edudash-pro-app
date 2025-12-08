/**
 * Debug script for voice notes upload issue
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
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        envVars[key.trim()] = value.trim();
      }
    }
  }
  
  return envVars;
}

// Load environment variables
const envFiles = ['.env.example', '.env.local', '.env'];
let allEnvVars: Record<string, string> = {};

for (const envFile of envFiles) {
  const envVars = loadEnvFile(path.join(process.cwd(), envFile));
  allEnvVars = { ...allEnvVars, ...envVars };
}

// Merge with process.env
for (const [key, value] of Object.entries(allEnvVars)) {
  if (!process.env[key]) {
    process.env[key] = value;
  }
}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function debugVoiceUpload() {
  console.log('🔍 Debugging Voice Upload Issue\n');

  try {
    // Test 1: Check if we can authenticate
    console.log('1. Testing authentication...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.log('❌ Not authenticated. Testing with anonymous access...');
      console.log('   This is normal for this test - we need to test with a real user session.\n');
    } else {
      console.log('✅ Authenticated as:', user.email);
    }

    // Test 2: List buckets to confirm voice-notes exists
    console.log('2. Checking storage buckets...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('❌ Error listing buckets:', bucketsError);
      return;
    }
    
    const voiceNotesBucket = buckets.find(b => b.id === 'voice-notes');
    if (voiceNotesBucket) {
      console.log('✅ voice-notes bucket found');
      console.log('   - Public:', voiceNotesBucket.public);
      console.log('   - Size limit:', voiceNotesBucket.file_size_limit || 'unlimited');
      console.log('   - MIME types:', voiceNotesBucket.allowed_mime_types || 'all types');
    } else {
      console.log('❌ voice-notes bucket not found!');
      console.log('Available buckets:', buckets.map(b => b.id).join(', '));
    }

    // Test 3: Check storage policies (this will show if RLS is properly configured)
    console.log('\n3. Testing storage access policies...');
    
    // Try to list objects (should work if bucket exists, might be empty)
    const { data: objects, error: listError } = await supabase.storage
      .from('voice-notes')
      .list('', { limit: 1 });
    
    if (listError) {
      console.log('❌ Cannot list objects in voice-notes bucket:');
      console.log('   Error:', listError.message);
      console.log('   This suggests RLS policies may not be properly configured.');
    } else {
      console.log('✅ Can list objects in voice-notes bucket');
      console.log('   Found', objects.length, 'objects');
    }

    // Test 4: Test upload without authentication (should fail with proper RLS)
    console.log('\n4. Testing upload permissions (this should fail without auth)...');
    
    const testBlob = new Blob(['test audio data'], { type: 'audio/m4a' });
    const testPath = `test/upload-test-${Date.now()}.m4a`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('voice-notes')
      .upload(testPath, testBlob, {
        contentType: 'audio/m4a',
        upsert: false
      });
    
    if (uploadError) {
      console.log('❌ Upload failed (this is expected without auth):');
      console.log('   Error:', uploadError.message);
      
      // Check if it's an RLS policy error
      if (uploadError.message.includes('policy') || uploadError.message.includes('RLS') || uploadError.message.includes('permission')) {
        console.log('✅ This confirms RLS policies are active');
      } else if (uploadError.message.includes('JWT')) {
        console.log('✅ Authentication required (RLS working)');
      } else {
        console.log('⚠️ Unexpected error type - might need investigation');
      }
    } else {
      console.log('⚠️ Upload succeeded without auth - RLS might not be configured!');
      console.log('   Path:', uploadData.path);
      
      // Clean up the test file
      await supabase.storage.from('voice-notes').remove([testPath]);
    }

    // Test 5: Check the specific error pattern from your app
    console.log('\n5. Testing the exact upload pattern from your app...');
    
    const mockUserId = 'a1fd12d2-5f09-4a23-822d-f3071bfc544b'; // From your error log
    const mockPath = `android/${mockUserId}/dash_${Date.now()}_test.m4a`;
    
    console.log('   Trying path:', mockPath);
    
    const { data: mockUpload, error: mockError } = await supabase.storage
      .from('voice-notes')
      .upload(mockPath, testBlob, {
        contentType: 'audio/m4a',
        upsert: true
      });
    
    if (mockError) {
      console.log('❌ Upload failed with your app\'s path pattern:');
      console.log('   Error:', mockError.message);
      console.log('   Status:', (mockError as any).statusCode || 'unknown');
      
      if ((mockError as any).statusCode === '400' || mockError.message.includes('400')) {
        console.log('🎯 This matches your original 400 error!');
        console.log('💡 Solution: The RLS policies need to be configured to allow this path pattern');
      }
    } else {
      console.log('✅ Upload succeeded with your app\'s path pattern');
      await supabase.storage.from('voice-notes').remove([mockPath]);
    }

    console.log('\n6. Recommendations:');
    
    if (voiceNotesBucket && listError && uploadError) {
      console.log('📋 The voice-notes bucket exists but RLS policies are blocking access.');
      console.log('📋 You need to run the SQL migration to create proper RLS policies.');
      console.log('📋 Go to Supabase Dashboard > SQL Editor and run the voice notes setup SQL.');
    } else if (!voiceNotesBucket) {
      console.log('📋 The voice-notes bucket is missing entirely.');
      console.log('📋 Create it manually in Supabase Dashboard > Storage or run the SQL migration.');
    } else {
      console.log('📋 Storage setup looks correct. The issue might be elsewhere.');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the debug
debugVoiceUpload().catch(console.error);