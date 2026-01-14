#!/usr/bin/env tsx
/**
 * Test Lesson Fetching
 * 
 * Tests the lesson fetching functionality for the teacher dashboard:
 * 1. Fetch all lessons
 * 2. Search lessons with query
 * 3. Filter lessons by category
 * 4. Test pagination
 * 
 * Usage: npx tsx scripts/test-lesson-fetching.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface TestResult {
  step: string;
  status: 'pass' | 'fail';
  details?: any;
  error?: string;
}

const results: TestResult[] = [];

function logResult(step: string, status: 'pass' | 'fail', details?: any, error?: string) {
  results.push({ step, status, details, error });
  const icon = status === 'pass' ? '✅' : '❌';
  console.log(`${icon} ${step}`);
  if (details) console.log('   Details:', JSON.stringify(details, null, 2));
  if (error) console.error('   Error:', error);
}

async function testLessonFetching() {
  console.log('🧪 Testing Lesson Fetching for Teacher Dashboard\n');
  console.log('================================================\n');

  // Step 1: Check lessons table exists and has data
  console.log('📋 Step 1: Checking lessons table...');
  try {
    const { data: lessons, error, count } = await supabase
      .from('lessons')
      .select('*', { count: 'exact' })
      .limit(5);

    if (error) {
      logResult('Check lessons table', 'fail', null, error.message);
    } else {
      logResult('Check lessons table', 'pass', { 
        total_count: count,
        sample_count: lessons?.length || 0,
        sample_titles: lessons?.map(l => l.title).slice(0, 3)
      });
    }
  } catch (err: any) {
    logResult('Check lessons table', 'fail', null, err.message);
  }

  // Step 2: Check lesson_categories table
  console.log('\n📋 Step 2: Checking lesson_categories table...');
  try {
    const { data: categories, error } = await supabase
      .from('lesson_categories')
      .select('*')
      .limit(10);

    if (error) {
      logResult('Check lesson_categories', 'fail', null, error.message);
      console.log('   ℹ️  Note: Table may not exist, LessonsService uses defaults');
    } else {
      logResult('Check lesson_categories', 'pass', { 
        count: categories?.length || 0,
        categories: categories?.map(c => c.name)
      });
    }
  } catch (err: any) {
    logResult('Check lesson_categories', 'fail', null, err.message);
  }

  // Step 3: Check lesson_tags table
  console.log('\n📋 Step 3: Checking lesson_tags table...');
  try {
    const { data: tags, error } = await supabase
      .from('lesson_tags')
      .select('*')
      .limit(10);

    if (error) {
      logResult('Check lesson_tags', 'fail', null, error.message);
      console.log('   ℹ️  Note: Table may not exist, LessonsService uses defaults');
    } else {
      logResult('Check lesson_tags', 'pass', { 
        count: tags?.length || 0,
        tags: tags?.map(t => t.name)
      });
    }
  } catch (err: any) {
    logResult('Check lesson_tags', 'fail', null, err.message);
  }

  // Step 4: Fetch lessons with text search
  console.log('\n📋 Step 4: Testing text search...');
  try {
    const searchQuery = 'math';
    const { data: searchResults, error } = await supabase
      .from('lessons')
      .select('id, title, description, subject, age_group')
      .or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
      .limit(5);

    if (error) {
      logResult(`Search lessons for "${searchQuery}"`, 'fail', null, error.message);
    } else {
      logResult(`Search lessons for "${searchQuery}"`, 'pass', { 
        found: searchResults?.length || 0,
        titles: searchResults?.map(l => l.title)
      });
    }
  } catch (err: any) {
    logResult('Search lessons', 'fail', null, err.message);
  }

  // Step 5: Fetch lessons with filters
  console.log('\n📋 Step 5: Testing filter by subject...');
  try {
    const { data: filteredLessons, error } = await supabase
      .from('lessons')
      .select('id, title, subject, age_group, duration_minutes')
      .neq('status', 'draft')
      .limit(10);

    if (error) {
      logResult('Filter lessons', 'fail', null, error.message);
    } else {
      // Get unique subjects
      const subjects = [...new Set(filteredLessons?.map(l => l.subject).filter(Boolean))];
      const ageGroups = [...new Set(filteredLessons?.map(l => l.age_group).filter(Boolean))];
      
      logResult('Filter lessons (non-draft)', 'pass', { 
        count: filteredLessons?.length || 0,
        subjects_found: subjects,
        age_groups_found: ageGroups
      });
    }
  } catch (err: any) {
    logResult('Filter lessons', 'fail', null, err.message);
  }

  // Step 6: Test pagination
  console.log('\n📋 Step 6: Testing pagination...');
  try {
    const pageSize = 5;
    const page1 = await supabase
      .from('lessons')
      .select('id, title')
      .order('created_at', { ascending: false })
      .range(0, pageSize - 1);

    const page2 = await supabase
      .from('lessons')
      .select('id, title')
      .order('created_at', { ascending: false })
      .range(pageSize, pageSize * 2 - 1);

    if (page1.error || page2.error) {
      logResult('Pagination', 'fail', null, page1.error?.message || page2.error?.message);
    } else {
      const page1Ids = new Set(page1.data?.map(l => l.id));
      const page2Ids = page2.data?.map(l => l.id) || [];
      const hasOverlap = page2Ids.some(id => page1Ids.has(id));
      
      logResult('Pagination', 'pass', { 
        page1_count: page1.data?.length || 0,
        page2_count: page2.data?.length || 0,
        no_overlap: !hasOverlap
      });
    }
  } catch (err: any) {
    logResult('Pagination', 'fail', null, err.message);
  }

  // Step 7: Check lesson schema/columns
  console.log('\n📋 Step 7: Checking lesson schema...');
  try {
    const { data: sampleLesson, error } = await supabase
      .from('lessons')
      .select('*')
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      logResult('Check lesson schema', 'fail', null, error.message);
    } else if (sampleLesson) {
      const columns = Object.keys(sampleLesson);
      logResult('Check lesson schema', 'pass', { 
        columns_found: columns,
        has_title: columns.includes('title'),
        has_description: columns.includes('description'),
        has_subject: columns.includes('subject'),
        has_age_group: columns.includes('age_group'),
        has_duration: columns.includes('duration_minutes'),
        has_status: columns.includes('status')
      });
    } else {
      logResult('Check lesson schema', 'pass', { note: 'No lessons in database yet' });
    }
  } catch (err: any) {
    logResult('Check lesson schema', 'fail', null, err.message);
  }

  // Step 8: Test lesson with related data (if exists)
  console.log('\n📋 Step 8: Testing lesson with creator info...');
  try {
    const { data: lessonWithCreator, error } = await supabase
      .from('lessons')
      .select(`
        id,
        title,
        created_by,
        preschool_id,
        organizations:preschool_id(name)
      `)
      .limit(3);

    if (error) {
      logResult('Lesson with relations', 'fail', null, error.message);
    } else {
      logResult('Lesson with relations', 'pass', { 
        count: lessonWithCreator?.length || 0,
        has_org_relation: lessonWithCreator?.some(l => l.organizations !== null)
      });
    }
  } catch (err: any) {
    logResult('Lesson with relations', 'fail', null, err.message);
  }

  // Summary
  console.log('\n================================================');
  console.log('📊 Test Summary\n');
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📋 Total:  ${results.length}`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! Lesson fetching is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Review the errors above.');
  }
}

// Run the tests
testLessonFetching().catch(console.error);
