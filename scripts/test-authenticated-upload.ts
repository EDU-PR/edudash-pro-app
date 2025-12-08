/**
 * Test authenticated file upload to voice-notes bucket
 * This script will help debug the exact 400 error you're seeing
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

// Test different file sizes and formats
const testCases = [
  {
    name: 'Tiny test file (like your 162 bytes)',
    data: new Uint8Array(162).fill(42), // Fill with some data
    contentType: 'audio/m4a'
  },
  {
    name: 'Small audio-like file',
    data: new Uint8Array(1024).fill(0), // 1KB of zeros
    contentType: 'audio/mp4'
  },
  {
    name: 'Realistic audio size',
    data: new Uint8Array(50000), // 50KB
    contentType: 'audio/m4a'
  }
];

async function testAuthenticatedUpload() {
  console.log('🔐 Testing Authenticated Voice Upload\n');

  try {
    // First, check if we can get user info (should fail without auth)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.log('❌ Not authenticated. This test needs a real user session.');
      console.log('💡 To test properly, you need to sign in through your app first.');
      console.log('💡 Alternatively, we can test the upload formats...\n');
    } else {
      console.log('✅ Authenticated as:', user.email);
      console.log('   User ID:', user.id);
    }

    const mockUserId = user?.id || 'a1fd12d2-5f09-4a23-822d-f3071bfc544b';

    // Test each case
    for (const [index, testCase] of testCases.entries()) {
      console.log(`${index + 1}. Testing: ${testCase.name}`);
      console.log(`   Size: ${testCase.data.length} bytes`);
      console.log(`   Content-Type: ${testCase.contentType}`);
      
      const fileName = `test_${Date.now()}_${index}.m4a`;
      const storagePath = `android/${mockUserId}/${fileName}`;
      
      console.log(`   Path: ${storagePath}`);
      
      // Create blob
      const blob = new Blob([testCase.data], { type: testCase.contentType });
      console.log(`   Blob size: ${blob.size}`);
      console.log(`   Blob type: ${blob.type}`);
      
      // Try File constructor if available
      let body: any = blob;
      try {
        if (typeof File !== 'undefined') {
          body = new File([blob], fileName, { type: testCase.contentType });
          console.log(`   Using File object: ${body.name}`);
        } else {
          console.log(`   Using Blob object (File not available)`);
        }
      } catch (e) {
        console.log(`   File constructor failed, using Blob:`, e.message);
      }

      // Test upload
      try {
        const uploadStart = Date.now();
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('voice-notes')
          .upload(storagePath, body, {
            contentType: testCase.contentType,
            upsert: true
          });
        
        const uploadTime = Date.now() - uploadStart;
        
        if (uploadError) {
          console.log(`   ❌ Upload failed (${uploadTime}ms):`, uploadError.message);
          
          if (uploadError.message.includes('400')) {
            console.log('   🎯 This matches your 400 error!');
            
            // Try different approaches
            console.log('   📋 Trying alternative upload methods...');
            
            // Try with different content type
            const { error: altError1 } = await supabase.storage
              .from('voice-notes')
              .upload(storagePath + '_alt1', body, {
                contentType: 'application/octet-stream',
                upsert: true
              });
            
            if (altError1) {
              console.log('     ❌ Alternative 1 (octet-stream) failed:', altError1.message);
            } else {
              console.log('     ✅ Alternative 1 (octet-stream) succeeded!');
            }
            
            // Try without explicit content type
            const { error: altError2 } = await supabase.storage
              .from('voice-notes')
              .upload(storagePath + '_alt2', body, {
                upsert: true
              });
            
            if (altError2) {
              console.log('     ❌ Alternative 2 (no content-type) failed:', altError2.message);
            } else {
              console.log('     ✅ Alternative 2 (no content-type) succeeded!');
            }
          }
          
        } else {
          console.log(`   ✅ Upload succeeded (${uploadTime}ms):`, uploadData.path);
          
          // Test signed URL generation
          try {
            const { data: signedUrl, error: urlError } = await supabase.storage
              .from('voice-notes')
              .createSignedUrl(storagePath, 300);
            
            if (urlError) {
              console.log(`   ❌ Signed URL failed:`, urlError.message);
            } else {
              console.log(`   ✅ Signed URL generated: ${signedUrl.signedUrl.length} chars`);
            }
          } catch (e) {
            console.log(`   ❌ Signed URL error:`, e.message);
          }
          
          // Clean up
          try {
            await supabase.storage.from('voice-notes').remove([storagePath]);
            console.log(`   🗑️ Cleaned up test file`);
          } catch (e) {
            console.log(`   ⚠️ Cleanup failed:`, e.message);
          }
        }
        
      } catch (e) {
        console.log(`   ❌ Unexpected error:`, e.message);
      }
      
      console.log('');
    }

    // Test the exact path from your error log
    console.log('🎯 Testing exact path from your error log...');
    const exactPath = 'android/a1fd12d2-5f09-4a23-822d-f3071bfc544b/dash_1759178754156_vgfrqps733.m4a';
    console.log(`   Path: ${exactPath}`);
    
    // Create a small test file like your error
    const smallData = new Uint8Array(162);
    // Fill with some realistic audio header-like data
    smallData[0] = 0x00; smallData[1] = 0x00; smallData[2] = 0x00; smallData[3] = 0x18; // mp4 box size
    smallData[4] = 0x66; smallData[5] = 0x74; smallData[6] = 0x79; smallData[7] = 0x70; // "ftyp"
    
    const testBlob = new Blob([smallData], { type: 'audio/m4a' });
    
    try {
      const body = typeof File !== 'undefined' 
        ? new File([testBlob], 'test.m4a', { type: 'audio/m4a' })
        : testBlob;
        
      const { data, error } = await supabase.storage
        .from('voice-notes')
        .upload(exactPath + '_test', body, {
          contentType: 'audio/m4a',
          upsert: true
        });
      
      if (error) {
        console.log('   ❌ Exact path test failed:', error.message);
        console.log('   📋 This confirms the issue is with this specific setup');
        
        // Additional debugging
        console.log('\n🔍 Additional debugging info:');
        console.log('   - Request would be multipart/form-data');
        console.log('   - Content-Length would be around 162 bytes (matches your log)');
        console.log('   - User is authenticated (matches your log)');
        console.log('   - Path structure is correct');
        
        if (error.message.includes('policy') || error.message.includes('RLS')) {
          console.log('   💡 This is still an RLS policy issue');
          console.log('   💡 Check if the policies were created correctly in Supabase');
        } else if (error.message.includes('bucket')) {
          console.log('   💡 Bucket configuration issue');
        } else if (error.message.includes('size') || error.message.includes('limit')) {
          console.log('   💡 File size or validation issue');
        } else {
          console.log('   💡 Unknown issue - check Supabase logs for details');
        }
        
      } else {
        console.log('   ✅ Exact path test succeeded:', data.path);
        await supabase.storage.from('voice-notes').remove([exactPath + '_test']);
      }
      
    } catch (e) {
      console.log('   ❌ Exact path test error:', e.message);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testAuthenticatedUpload().catch(console.error);