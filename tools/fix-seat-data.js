#!/usr/bin/env node

// Fix seat count mismatch and add missing data
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lvvvjywrmpcqrpvuptdi.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.log('❌ SUPABASE_SERVICE_ROLE_KEY environment variable not set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixData() {
  console.log('🔧 Fixing seat management data issues...\n');

  const youngEaglesSchoolId = 'ba79097c-1b93-4b48-bcbe-df73878ab4d1';
  const subscriptionId = 'fb229579-bed3-486b-ae39-38a0a260b801';

  try {
    // 1. Fix the subscription seats_used count (should be 1, not 3)
    console.log('1. Fixing subscription seats_used count...');
    
    // Count actual seats
    const { data: actualSeats, error: countError } = await supabase
      .from('subscription_seats')
      .select('user_id')
      .eq('subscription_id', subscriptionId);
      
    if (countError) {
      console.log('❌ Error counting seats:', countError.message);
    } else {
      const actualCount = actualSeats.length;
      console.log(`   Found ${actualCount} actual seat assignments`);
      
      // Update subscription with correct count
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({ seats_used: actualCount })
        .eq('id', subscriptionId);
        
      if (updateError) {
        console.log('❌ Error updating seats_used:', updateError.message);
      } else {
        console.log(`✅ Updated seats_used to ${actualCount}`);
      }
    }

    // 2. Add missing 'free' subscription plan (causing superadmin 400 error)
    console.log('\n2. Adding missing free subscription plan...');
    
    const { error: planError } = await supabase
      .from('subscription_plans')
      .upsert({
        id: 'free',
        name: 'Free',
        price_monthly: 0,
        price_annual: 0
      }, {
        onConflict: 'id',
        ignoreDuplicates: true
      });
      
    if (planError) {
      console.log('❌ Error adding free plan:', planError.message);
    } else {
      console.log('✅ Added/updated free subscription plan');
    }

    // 3. Check current teacher assignments and show what needs to be done
    console.log('\n3. Checking teacher seat assignments...');
    
    // Get teachers for Young Eagles
    const { data: teachers, error: teacherError } = await supabase
      .from('profiles')
      .select('id, email, role')
      .eq('preschool_id', youngEaglesSchoolId)
      .eq('role', 'teacher');
      
    if (teacherError) {
      console.log('❌ Error fetching teachers:', teacherError.message);
    } else {
      console.log(`✅ Found ${teachers.length} teachers:`);
      
      for (const teacher of teachers) {
        // Check if teacher has seat
        const { data: seatCheck } = await supabase
          .from('subscription_seats')
          .select('subscription_id')
          .eq('subscription_id', subscriptionId)
          .eq('user_id', teacher.id);
          
        const hasSeat = seatCheck && seatCheck.length > 0;
        console.log(`   - ${teacher.email}: ${hasSeat ? '✅ Has seat' : '❌ No seat'}`);
      }
    }

    console.log('\n🎉 Data fixes completed!');
    console.log('\nNext steps:');
    console.log('1. Apply the RLS policy fixes (fix-rls-seat-management.sql) in Supabase dashboard');
    console.log('2. Test the seat management page - it should now show the correct data');
    console.log('3. The superadmin dashboard should no longer have 400 errors');

  } catch (_error) {
    console.log('❌ Unexpected _error:', _error.message);
  }
}

fixData().catch(console.error);