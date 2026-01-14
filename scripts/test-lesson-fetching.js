#!/usr/bin/env node

/**
 * Test Lesson Fetching Script
 * 
 * This script tests the lesson fetching functionality used in the teacher dashboard.
 * Run with: node scripts/test-lesson-fetching.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  console.log('Required: EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testLessonFetching() {
  console.log('🧪 Testing Lesson Fetching...\n');
  console.log('Supabase URL:', supabaseUrl);
  console.log('');

  try {
    // Test 1: Basic lessons query
    console.log('📚 Test 1: Fetching all lessons...');
    const { data: allLessons, error: allError, count: allCount } = await supabase
      .from('lessons')
      .select('*', { count: 'exact' })
      .limit(10);

    if (allError) {
      console.error('❌ Error fetching all lessons:', allError.message);
    } else {
      console.log(`✅ Found ${allCount || allLessons?.length || 0} total lessons`);
      if (allLessons?.length > 0) {
        console.log('   Sample lesson:', allLessons[0].title);
        console.log('   Status:', allLessons[0].status);
        console.log('   Subject:', allLessons[0].subject);
      }
    }
    console.log('');

    // Test 2: Active/Published lessons (used by featured/popular)
    console.log('📗 Test 2: Fetching active/published lessons...');
    const { data: activeLessons, error: activeError } = await supabase
      .from('lessons')
      .select('id, title, status, subject, is_ai_generated, created_at')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(10);

    if (activeError) {
      console.error('❌ Error fetching active lessons:', activeError.message);
    } else {
      console.log(`✅ Found ${activeLessons?.length || 0} active lessons`);
      activeLessons?.forEach((lesson, i) => {
        console.log(`   ${i + 1}. ${lesson.title} [${lesson.subject}] AI:${lesson.is_ai_generated}`);
      });
    }
    console.log('');

    // Test 3: Published lessons
    console.log('📘 Test 3: Fetching published lessons...');
    const { data: publishedLessons, error: publishedError } = await supabase
      .from('lessons')
      .select('id, title, status, subject, is_ai_generated')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(10);

    if (publishedError) {
      console.error('❌ Error fetching published lessons:', publishedError.message);
    } else {
      console.log(`✅ Found ${publishedLessons?.length || 0} published lessons`);
      publishedLessons?.forEach((lesson, i) => {
        console.log(`   ${i + 1}. ${lesson.title} [${lesson.subject}]`);
      });
    }
    console.log('');

    // Test 4: AI-generated lessons (used by My Lessons)
    console.log('🤖 Test 4: Fetching AI-generated lessons...');
    const { data: aiLessons, error: aiError } = await supabase
      .from('lessons')
      .select('id, title, status, subject, teacher_id, preschool_id')
      .eq('is_ai_generated', true)
      .order('created_at', { ascending: false })
      .limit(10);

    if (aiError) {
      console.error('❌ Error fetching AI lessons:', aiError.message);
    } else {
      console.log(`✅ Found ${aiLessons?.length || 0} AI-generated lessons`);
      aiLessons?.forEach((lesson, i) => {
        console.log(`   ${i + 1}. ${lesson.title} [${lesson.status}] teacher:${lesson.teacher_id?.substring(0, 8) || 'none'}`);
      });
    }
    console.log('');

    // Test 5: Lessons by status breakdown
    console.log('📊 Test 5: Status breakdown...');
    const { data: statusBreakdown } = await supabase
      .from('lessons')
      .select('status');

    if (statusBreakdown) {
      const breakdown = statusBreakdown.reduce((acc, l) => {
        acc[l.status] = (acc[l.status] || 0) + 1;
        return acc;
      }, {});
      console.log('✅ Lesson status breakdown:');
      Object.entries(breakdown).forEach(([status, count]) => {
        console.log(`   ${status}: ${count}`);
      });
    }
    console.log('');

    // Test 6: Non-draft lessons (used by search)
    console.log('🔍 Test 6: Non-draft lessons (for search)...');
    const { data: nonDraftLessons, error: nonDraftError } = await supabase
      .from('lessons')
      .select('id, title, status')
      .neq('status', 'draft')
      .limit(10);

    if (nonDraftError) {
      console.error('❌ Error fetching non-draft lessons:', nonDraftError.message);
    } else {
      console.log(`✅ Found ${nonDraftLessons?.length || 0} non-draft lessons`);
    }
    console.log('');

    // Test 7: Check teachers that have lessons
    console.log('👨‍🏫 Test 7: Teachers with lessons...');
    const { data: teachersWithLessons } = await supabase
      .from('lessons')
      .select('teacher_id')
      .not('teacher_id', 'is', null);

    if (teachersWithLessons) {
      const uniqueTeachers = [...new Set(teachersWithLessons.map(l => l.teacher_id))];
      console.log(`✅ Found ${uniqueTeachers.length} unique teachers with lessons`);
      uniqueTeachers.slice(0, 3).forEach((id, i) => {
        console.log(`   ${i + 1}. ${id}`);
      });
    }
    console.log('');

    // Test 8: Lessons with preschool_id
    console.log('🏫 Test 8: Lessons by preschool...');
    const { data: preschoolLessons } = await supabase
      .from('lessons')
      .select('preschool_id')
      .not('preschool_id', 'is', null);

    if (preschoolLessons) {
      const uniquePreschools = [...new Set(preschoolLessons.map(l => l.preschool_id))];
      console.log(`✅ Lessons belong to ${uniquePreschools.length} preschools`);
    }
    console.log('');

    // Test 9: Full lesson with all fields
    console.log('📋 Test 9: Sample lesson with all fields...');
    const { data: sampleLesson } = await supabase
      .from('lessons')
      .select('*')
      .limit(1)
      .single();

    if (sampleLesson) {
      console.log('✅ Sample lesson structure:');
      console.log('   Fields:', Object.keys(sampleLesson).join(', '));
      console.log('   id:', sampleLesson.id);
      console.log('   title:', sampleLesson.title);
      console.log('   status:', sampleLesson.status);
      console.log('   subject:', sampleLesson.subject);
      console.log('   age_group:', sampleLesson.age_group);
      console.log('   duration_minutes:', sampleLesson.duration_minutes);
      console.log('   is_ai_generated:', sampleLesson.is_ai_generated);
      console.log('   is_public:', sampleLesson.is_public);
      console.log('   is_featured:', sampleLesson.is_featured);
      console.log('   teacher_id:', sampleLesson.teacher_id?.substring(0, 8) || 'null');
      console.log('   preschool_id:', sampleLesson.preschool_id?.substring(0, 8) || 'null');
    }

  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
}

// Run the tests
testLessonFetching().then(() => {
  console.log('\n🏁 Lesson fetching tests complete!');
}).catch((error) => {
  console.error('💥 Tests failed:', error);
  process.exit(1);
});
