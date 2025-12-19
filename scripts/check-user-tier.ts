#!/usr/bin/env ts-node
/**
 * Check User Tier Status
 * 
 * This script checks if a user's tier was correctly updated in the database
 * after a PayFast payment. It queries:
 * - user_ai_usage.current_tier
 * - user_ai_tiers.tier
 * - payment_transactions (to see payment status)
 * 
 * Usage:
 *   npx ts-node scripts/check-user-tier.ts <user_email>
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkUserTier(userEmail: string) {
  console.log(`\n🔍 Checking tier status for: ${userEmail}\n`);

  // 1. Get user ID from auth
  const { data: authData, error: authError } = await supabase.auth.admin.getUserByEmail(userEmail);
  if (authError || !authData?.user) {
    console.error('❌ User not found:', authError?.message);
    return;
  }

  const userId = authData.user.id;
  console.log(`✅ User ID: ${userId}\n`);

  // 2. Check user_ai_usage.current_tier
  console.log('📊 Checking user_ai_usage table...');
  const { data: usage, error: usageError } = await supabase
    .from('user_ai_usage')
    .select('current_tier, exams_generated_this_month, explanations_requested_this_month, chat_messages_today, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (usageError) {
    console.error('❌ Error querying user_ai_usage:', usageError.message);
  } else if (usage) {
    console.log('   ✅ user_ai_usage.current_tier:', usage.current_tier || '(null)');
    console.log('   📅 Last updated:', usage.updated_at || '(null)');
    console.log('   📈 Usage stats:', {
      exams: usage.exams_generated_this_month,
      explanations: usage.explanations_requested_this_month,
      chat: usage.chat_messages_today,
    });
  } else {
    console.log('   ⚠️  No user_ai_usage record found');
  }

  // 3. Check user_ai_tiers.tier
  console.log('\n📊 Checking user_ai_tiers table...');
  const { data: tierRow, error: tierError } = await supabase
    .from('user_ai_tiers')
    .select('tier, created_at, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (tierError) {
    console.error('❌ Error querying user_ai_tiers:', tierError.message);
  } else if (tierRow) {
    console.log('   ✅ user_ai_tiers.tier:', tierRow.tier || '(null)');
    console.log('   📅 Created:', tierRow.created_at || '(null)');
    console.log('   📅 Last updated:', tierRow.updated_at || '(null)');
  } else {
    console.log('   ⚠️  No user_ai_tiers record found');
  }

  // 4. Check payment_transactions
  console.log('\n💳 Checking payment_transactions...');
  const { data: payments, error: paymentError } = await supabase
    .from('payment_transactions')
    .select('id, status, tier, amount, currency, completed_at, created_at, metadata')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5);

  if (paymentError) {
    console.error('❌ Error querying payment_transactions:', paymentError.message);
  } else if (payments && payments.length > 0) {
    console.log(`   ✅ Found ${payments.length} payment transaction(s):`);
    payments.forEach((tx, idx) => {
      console.log(`\n   Transaction ${idx + 1}:`);
      console.log(`      ID: ${tx.id}`);
      console.log(`      Status: ${tx.status}`);
      console.log(`      Tier: ${tx.tier || '(null)'}`);
      console.log(`      Amount: ${tx.currency || 'ZAR'} ${tx.amount || '(null)'}`);
      console.log(`      Created: ${tx.created_at || '(null)'}`);
      console.log(`      Completed: ${tx.completed_at || '(null)'}`);
      if (tx.metadata) {
        const meta = typeof tx.metadata === 'string' ? JSON.parse(tx.metadata) : tx.metadata;
        console.log(`      Scope: ${meta.scope || '(null)'}`);
        console.log(`      Plan Tier: ${meta.plan_tier || '(null)'}`);
      }
    });
  } else {
    console.log('   ⚠️  No payment_transactions found for this user');
  }

  // 5. Summary
  console.log('\n📋 Summary:');
  const effectiveTier = usage?.current_tier || tierRow?.tier || 'free';
  console.log(`   Effective Tier: ${effectiveTier}`);
  console.log(`   Source: ${usage?.current_tier ? 'user_ai_usage' : tierRow?.tier ? 'user_ai_tiers' : 'default (free)'}`);
  
  const hasCompletedPayment = payments?.some(tx => tx.status === 'completed' && tx.tier);
  if (hasCompletedPayment && effectiveTier === 'free') {
    console.log('\n   ⚠️  WARNING: User has completed payment but tier is still "free"!');
    console.log('   This suggests the tier update trigger may not have fired.');
  } else if (hasCompletedPayment && effectiveTier !== 'free') {
    console.log('\n   ✅ Tier correctly updated after payment!');
  }

  console.log('');
}

// Main
const userEmail = process.argv[2];
if (!userEmail) {
  console.error('❌ Usage: npx ts-node scripts/check-user-tier.ts <user_email>');
  process.exit(1);
}

checkUserTier(userEmail).catch(console.error);

