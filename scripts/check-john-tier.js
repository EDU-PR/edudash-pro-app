#!/usr/bin/env node
/**
 * Check John's tier status in the database
 * Usage: node scripts/check-john-tier.js
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');

async function checkJohnTier() {
  const email = 'dipsroboticsgm@gmail.com'; // John's email based on previous context
  
  // Try to use Supabase client first
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log(`\n🔍 Checking tier for: ${email}\n`);
  
  try {
    // Get user ID from auth
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) {
      console.log('⚠️  Cannot access auth.users via client, trying profiles table...');
    } else {
      const user = users?.find(u => u.email === email);
      if (user) {
        console.log(`✅ Found user in auth.users: ${user.id}`);
      }
    }
    
    // Get profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, organization_id, preschool_id, subscription_tier, role')
      .eq('email', email)
      .maybeSingle();
    
    if (profileError) {
      console.error('❌ Error fetching profile:', profileError);
    } else if (!profile) {
      console.error('❌ Profile not found');
      return;
    }
    
    console.log('\n📋 Profile Data:');
    console.log(`   ID: ${profile.id}`);
    console.log(`   Email: ${profile.email}`);
    console.log(`   Role: ${profile.role}`);
    console.log(`   Organization ID: ${profile.organization_id || 'NULL'}`);
    console.log(`   Preschool ID: ${profile.preschool_id || 'NULL'}`);
    console.log(`   Subscription Tier (profiles): ${profile.subscription_tier || 'NULL'}`);
    
    // Check user_ai_usage
    const { data: usage, error: usageError } = await supabase
      .from('user_ai_usage')
      .select('current_tier, chat_messages_today, exams_generated_this_month, updated_at')
      .eq('user_id', profile.id)
      .maybeSingle();
    
    if (usageError) {
      console.error('❌ Error fetching user_ai_usage:', usageError);
    } else {
      console.log('\n📊 User AI Usage:');
      if (usage) {
        console.log(`   Current Tier: ${usage.current_tier || 'NULL'}`);
        console.log(`   Chat Messages Today: ${usage.chat_messages_today || 0}`);
        console.log(`   Exams This Month: ${usage.exams_generated_this_month || 0}`);
        console.log(`   Last Updated: ${usage.updated_at || 'NULL'}`);
      } else {
        console.log('   ⚠️  No record found in user_ai_usage');
      }
    }
    
    // Check user_ai_tiers
    const { data: tierRow, error: tierError } = await supabase
      .from('user_ai_tiers')
      .select('tier, expires_at, is_active, updated_at')
      .eq('user_id', profile.id)
      .maybeSingle();
    
    if (tierError) {
      console.error('❌ Error fetching user_ai_tiers:', tierError);
    } else {
      console.log('\n🎯 User AI Tiers:');
      if (tierRow) {
        console.log(`   Tier: ${tierRow.tier || 'NULL'}`);
        console.log(`   Is Active: ${tierRow.is_active}`);
        console.log(`   Expires At: ${tierRow.expires_at || 'NULL'}`);
        console.log(`   Updated At: ${tierRow.updated_at || 'NULL'}`);
      } else {
        console.log('   ⚠️  No record found in user_ai_tiers');
      }
    }
    
    // Check organization tier if org_id exists
    if (profile.organization_id) {
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('id, name, plan_tier, subscription_tier')
        .eq('id', profile.organization_id)
        .maybeSingle();
      
      if (orgError) {
        console.error('❌ Error fetching organization:', orgError);
      } else if (org) {
        console.log('\n🏢 Organization:');
        console.log(`   Name: ${org.name}`);
        console.log(`   Plan Tier: ${org.plan_tier || 'NULL'}`);
        console.log(`   Subscription Tier: ${org.subscription_tier || 'NULL'}`);
      }
    }
    
    // Check payment_transactions for recent payments
    const { data: payments, error: paymentsError } = await supabase
      .from('payment_transactions')
      .select('id, tier, status, amount, created_at')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (paymentsError) {
      console.error('❌ Error fetching payments:', paymentsError);
    } else if (payments && payments.length > 0) {
      console.log('\n💳 Recent Payments:');
      payments.forEach((p, i) => {
        console.log(`   ${i + 1}. Tier: ${p.tier || 'NULL'}, Status: ${p.status}, Amount: ${p.amount || 'NULL'}, Date: ${p.created_at}`);
      });
    } else {
      console.log('\n💳 Recent Payments: None found');
    }
    
    // Determine effective tier based on SubscriptionContext logic
    console.log('\n🔍 Tier Resolution Logic:');
    const effectiveTier = usage?.current_tier || tierRow?.tier || profile.subscription_tier || 'free';
    console.log(`   Effective Tier: ${effectiveTier}`);
    console.log(`   Source: ${usage?.current_tier ? 'user_ai_usage' : tierRow?.tier ? 'user_ai_tiers' : profile.subscription_tier ? 'profiles' : 'default (free)'}`);
    
    console.log('\n✅ Check complete!\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkJohnTier();

