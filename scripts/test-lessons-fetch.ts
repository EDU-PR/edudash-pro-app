/**
 * Test Script: Lesson Fetching
 * 
 * Tests the lessons fetching functionality for the teacher dashboard.
 * Uses service role key to bypass RLS for testing.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
// Use service role key to bypass RLS for testing
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testLessonsFetch() {
  console.log('🧪 Testing Lesson Fetching for Teacher Dashboard\n');
  console.log('=' .repeat(60));
  
  // Test 1: Check lessons table schema
  console.log('\n📋 Test 1: Checking lessons table columns...');
  try {
    const { data, error } = await supabase
      .from('lessons')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('❌ Error:', error.message);
    } else {
      console.log('✅ Lessons table accessible');
      if (data && data.length > 0) {
        console.log('   Columns:', Object.keys(data[0]).join(', '));
      } else {
        console.log('   No lessons found - table is empty');
      }
    }
  } catch (e: any) {
    console.error('❌ Exception:', e.message);
  }
  
  // Test 2: Count total lessons
  console.log('\n📋 Test 2: Counting total lessons...');
  try {
    const { count, error } = await supabase
      .from('lessons')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error('❌ Error:', error.message);
    } else {
      console.log(`✅ Total lessons in database: ${count}`);
    }
  } catch (e: any) {
    console.error('❌ Exception:', e.message);
  }
  
  // Test 3: Fetch lessons with various filters
  console.log('\n📋 Test 3: Fetching lessons with status filter...');
  try {
    const statuses = ['draft', 'published', 'archived'];
    
    for (const status of statuses) {
      const { data, count, error } = await supabase
        .from('lessons')
        .select('id, title, status', { count: 'exact' })
        .eq('status', status)
        .limit(3);
      
      if (error) {
        console.error(`   ❌ Status '${status}':`, error.message);
      } else {
        console.log(`   ✅ Status '${status}': ${count} lessons`);
        if (data && data.length > 0) {
          data.forEach((lesson: any) => {
            console.log(`      - ${lesson.title || 'Untitled'} (${lesson.id.slice(0, 8)}...)`);
          });
        }
      }
    }
  } catch (e: any) {
    console.error('❌ Exception:', e.message);
  }
  
  // Test 4: Check for teacher_id column (used in filtering)
  console.log('\n📋 Test 4: Checking teacher filtering capability...');
  try {
    // First get a sample teacher ID from profiles
    const { data: teachers, error: teacherError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'teacher')
      .limit(1);
    
    if (teacherError) {
      console.error('   ❌ Error fetching teachers:', teacherError.message);
    } else if (teachers && teachers.length > 0) {
      const teacherId = teachers[0].id;
      console.log(`   Found teacher: ${teachers[0].full_name} (${teacherId.slice(0, 8)}...)`);
      
      // Try to fetch lessons by teacher
      const { data: lessons, count, error: lessonsError } = await supabase
        .from('lessons')
        .select('id, title', { count: 'exact' })
        .eq('teacher_id', teacherId);
      
      if (lessonsError) {
        // Maybe the column is named differently
        console.log('   ⚠️  teacher_id column not found, trying created_by...');
        
        const { data: lessons2, count: count2, error: error2 } = await supabase
          .from('lessons')
          .select('id, title', { count: 'exact' })
          .eq('created_by', teacherId);
        
        if (error2) {
          console.error('   ❌ created_by also failed:', error2.message);
        } else {
          console.log(`   ✅ Lessons by teacher (created_by): ${count2}`);
        }
      } else {
        console.log(`   ✅ Lessons by teacher: ${count}`);
      }
    } else {
      console.log('   ⚠️  No teachers found in profiles table');
    }
  } catch (e: any) {
    console.error('❌ Exception:', e.message);
  }
  
  // Test 5: Check preschool_id filtering (multi-tenant)
  console.log('\n📋 Test 5: Checking multi-tenant filtering...');
  try {
    const { data: preschools, error: preschoolError } = await supabase
      .from('preschools')
      .select('id, name')
      .limit(3);
    
    if (preschoolError) {
      console.error('   ❌ Error fetching preschools:', preschoolError.message);
    } else if (preschools && preschools.length > 0) {
      console.log(`   Found ${preschools.length} preschools:`);
      
      for (const preschool of preschools) {
        const { count, error: countError } = await supabase
          .from('lessons')
          .select('*', { count: 'exact', head: true })
          .eq('preschool_id', preschool.id);
        
        if (countError) {
          console.log(`   ⚠️  ${preschool.name}: preschool_id column may not exist`);
        } else {
          console.log(`   ✅ ${preschool.name}: ${count} lessons`);
        }
      }
    } else {
      console.log('   ⚠️  No preschools found');
    }
  } catch (e: any) {
    console.error('❌ Exception:', e.message);
  }
  
  // Test 6: Fetch a sample lesson with full details
  console.log('\n📋 Test 6: Fetching sample lesson with full details...');
  try {
    const { data, error } = await supabase
      .from('lessons')
      .select('*')
      .eq('status', 'published')
      .limit(1)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        console.log('   ⚠️  No published lessons found');
      } else {
        console.error('   ❌ Error:', error.message);
      }
    } else if (data) {
      console.log('   ✅ Sample lesson:');
      console.log(`      Title: ${data.title}`);
      console.log(`      Status: ${data.status}`);
      console.log(`      Subject: ${data.subject || 'N/A'}`);
      console.log(`      Grade: ${data.grade_level || data.grade || 'N/A'}`);
      console.log(`      Duration: ${data.duration || 'N/A'}`);
      console.log(`      Created: ${data.created_at}`);
    }
  } catch (e: any) {
    console.error('❌ Exception:', e.message);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🏁 Lesson fetching tests complete!\n');
}

// Run the tests
testLessonsFetch().catch(console.error);
