/**
 * Check Aftercare Registrations
 * Queries the aftercare_registrations table to see current registrations
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env' });
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL');
  console.error('Required: SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  console.error('\nCurrent env vars:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing');
  console.error('  EXPO_PUBLIC_SUPABASE_URL:', process.env.EXPO_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing');
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing');
  console.error('  NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const COMMUNITY_SCHOOL_ID = '00000000-0000-0000-0000-000000000001';

async function checkAftercareRegistrations() {
  console.log('🔍 Checking aftercare registrations...\n');

  try {
    // Get all registrations
    const { data: registrations, error } = await supabase
      .from('aftercare_registrations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === '42P01') {
        console.error('❌ Table "aftercare_registrations" does not exist');
        console.error('   You may need to run the migration to create the table.');
        return;
      }
      throw error;
    }

    if (!registrations || registrations.length === 0) {
      console.log('📭 No aftercare registrations found.');
      return;
    }

    console.log(`✅ Found ${registrations.length} registration(s):\n`);

    // Group by status
    const byStatus = registrations.reduce((acc, reg) => {
      const status = reg.status || 'unknown';
      if (!acc[status]) acc[status] = [];
      acc[status].push(reg);
      return acc;
    }, {} as Record<string, typeof registrations>);

    // Summary
    console.log('📊 Summary by Status:');
    Object.entries(byStatus).forEach(([status, regs]) => {
      console.log(`   ${status}: ${regs.length}`);
    });
    console.log('');

    // Detailed list
    registrations.forEach((reg, index) => {
      console.log(`${index + 1}. ${reg.child_first_name} ${reg.child_last_name} (Grade ${reg.child_grade})`);
      console.log(`   Parent: ${reg.parent_first_name} ${reg.parent_last_name}`);
      console.log(`   Email: ${reg.parent_email}`);
      console.log(`   Phone: ${reg.parent_phone}`);
      console.log(`   Status: ${reg.status}`);
      console.log(`   Payment Reference: ${reg.payment_reference || 'N/A'}`);
      console.log(`   Fee: R${reg.registration_fee} (Original: R${reg.registration_fee_original})`);
      console.log(`   POP Uploaded: ${reg.proof_of_payment_url ? '✅ Yes' : '❌ No'}`);
      console.log(`   Created: ${new Date(reg.created_at).toLocaleString()}`);
      console.log('');
    });

    // Payment status breakdown
    const withPOP = registrations.filter(r => r.proof_of_payment_url).length;
    const withoutPOP = registrations.length - withPOP;
    const paid = registrations.filter(r => r.status === 'paid' || r.status === 'enrolled').length;
    const pending = registrations.filter(r => r.status === 'pending_payment').length;

    console.log('💰 Payment Status:');
    console.log(`   Paid/Enrolled: ${paid}`);
    console.log(`   Pending Payment: ${pending}`);
    console.log(`   With POP Uploaded: ${withPOP}`);
    console.log(`   Without POP: ${withoutPOP}`);

  } catch (err: any) {
    console.error('❌ Error checking registrations:', err.message);
    if (err.details) console.error('   Details:', err.details);
    if (err.hint) console.error('   Hint:', err.hint);
  }
}

checkAftercareRegistrations();
