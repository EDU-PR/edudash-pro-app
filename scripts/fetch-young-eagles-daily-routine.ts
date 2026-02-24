/**
 * Fetch Young Eagles Daily Routine
 *
 * Fetches weekly programs and daily program blocks for Young Eagles preschool
 * so we can inspect and discuss the routine data.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function fetchYoungEaglesDailyRoutine(): Promise<void> {
  console.log('🔍 Fetching Young Eagles daily routine...\n');

  // 1. Find Young Eagles preschool
  const { data: preschools, error: preschoolError } = await supabase
    .from('preschools')
    .select('id, name')
    .or('name.ilike.%young%eagles%,name.ilike.%young eagles%');

  if (preschoolError) {
    console.error('❌ Error finding preschool:', preschoolError.message);
    // Fallback: list all preschools
    const { data: all } = await supabase.from('preschools').select('id, name').limit(20);
    console.log('Available preschools:', all);
    return;
  }

  if (!preschools?.length) {
    console.log('⚠️ No preschool found with "Young Eagles". Listing all preschools:');
    const { data: all } = await supabase.from('preschools').select('id, name').limit(20);
    console.log(all);
    return;
  }

  const preschool = preschools[0];
  console.log(`✅ School: ${preschool.name} (ID: ${preschool.id})\n`);

  // 2. Fetch weekly programs (published, recent)
  const today = new Date().toISOString().slice(0, 10);
  const { data: programs, error: programsError } = await supabase
    .from('weekly_programs')
    .select('id, title, summary, week_start_date, week_end_date, status, published_at, class_id, preschool_id')
    .eq('preschool_id', preschool.id)
    .order('week_start_date', { ascending: false })
    .limit(5);

  if (programsError) {
    console.error('❌ Error fetching weekly programs:', programsError.message);
    return;
  }

  if (!programs?.length) {
    console.log('⚠️ No weekly programs found for Young Eagles.');
    return;
  }

  console.log(`📅 Weekly Programs (${programs.length}):\n`);
  for (const p of programs) {
    console.log(`  - ${p.title}`);
    console.log(`    Week: ${p.week_start_date} to ${p.week_end_date}`);
    console.log(`    Status: ${p.status}, Published: ${p.published_at || 'N/A'}`);
    console.log('');
  }

  // 3. Fetch daily program blocks for the most recent program
  const programId = programs[0].id;
  const { data: blocks, error: blocksError } = await supabase
    .from('daily_program_blocks')
    .select('id, day_of_week, block_order, block_type, title, start_time, end_time, objectives, transition_cue, notes')
    .eq('weekly_program_id', programId)
    .order('day_of_week', { ascending: true })
    .order('block_order', { ascending: true });

  if (blocksError) {
    console.error('❌ Error fetching blocks:', blocksError.message);
    return;
  }

  const dayNames: Record<number, string> = {
    1: 'Monday',
    2: 'Tuesday',
    3: 'Wednesday',
    4: 'Thursday',
    5: 'Friday',
    6: 'Saturday',
    7: 'Sunday',
  };

  console.log(`\n📋 Daily Routine Blocks (${blocks?.length || 0} total) for "${programs[0].title}":\n`);

  const byDay: Record<number, typeof blocks> = {};
  for (const b of blocks || []) {
    if (!byDay[b.day_of_week]) byDay[b.day_of_week] = [];
    byDay[b.day_of_week].push(b);
  }

  for (let d = 1; d <= 7; d++) {
    const dayBlocks = byDay[d] || [];
    if (dayBlocks.length === 0) continue;
    console.log(`  ${dayNames[d] || `Day ${d}`}:`);
    for (const b of dayBlocks) {
      const start = (b.start_time as string)?.slice?.(0, 5) ?? '--:--';
      const end = (b.end_time as string)?.slice?.(0, 5) ?? '--:--';
      console.log(`    ${start}-${end}  ${b.title} (${b.block_type})`);
      if (b.transition_cue) console.log(`      Transition: ${b.transition_cue}`);
    }
    console.log('');
  }

  console.log('✅ Done.');
}

fetchYoungEaglesDailyRoutine().catch((e) => {
  console.error('💥 Error:', e);
  process.exit(1);
});
