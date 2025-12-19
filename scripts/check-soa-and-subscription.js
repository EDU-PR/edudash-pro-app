#!/usr/bin/env node
/**
 * Check SOA codes and user subscription status
 * 
 * Usage:
 *   node scripts/check-soa-and-subscription.js
 * 
 * Requires:
 *   - SUPABASE_DB_PASSWORD environment variable
 */

// Try to load .env file if dotenv is available
try {
  require('dotenv').config();
} catch {
  // dotenv not installed, that's okay
}

const { Client } = require('pg');

const SUPABASE_DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;
const SUPABASE_PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'lvvvjywrmpcqrpvuptdi';
const USER_EMAIL = 'dipsroboticsgm@gmail.com';

if (!SUPABASE_DB_PASSWORD) {
  console.error('❌ Missing SUPABASE_DB_PASSWORD environment variable.');
  console.error('   Set it in your .env file or export it:');
  console.error('   export SUPABASE_DB_PASSWORD="your_password"');
  process.exit(1);
}

const dbConfig = {
  host: 'aws-0-ap-southeast-1.pooler.supabase.com',
  port: 6543,
  user: `postgres.${SUPABASE_PROJECT_REF}`,
  password: SUPABASE_DB_PASSWORD,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
};

async function checkSOAAndSubscription() {
  let client;
  
  try {
    console.log('🔍 Connecting to database...');
    client = new Client(dbConfig);
    await client.connect();
    console.log('✅ Connected to database.\n');

    // 1. Check for SOA codes in courses table
    console.log('📚 Checking for SOA codes in courses...');
    const soaCourses = await client.query(`
      SELECT 
        c.id,
        c.title,
        c.course_code,
        c.is_active,
        c.created_at,
        o.id as organization_id,
        o.name as organization_name,
        o.slug as organization_slug
      FROM courses c
      LEFT JOIN organizations o ON c.organization_id = o.id
      WHERE 
        UPPER(c.course_code) LIKE '%SOA%'
        OR UPPER(c.title) LIKE '%SOA%'
        OR (o.name IS NOT NULL AND UPPER(o.name) LIKE '%SOA%')
      ORDER BY c.created_at DESC
    `);

    if (soaCourses.rows.length > 0) {
      console.log(`✅ Found ${soaCourses.rows.length} course(s) related to SOA:\n`);
      soaCourses.rows.forEach((course, idx) => {
        console.log(`   ${idx + 1}. Course: ${course.title}`);
        console.log(`      Code: ${course.course_code || 'N/A'}`);
        console.log(`      Active: ${course.is_active ? 'Yes' : 'No'}`);
        console.log(`      Organization: ${course.organization_name || 'N/A'}`);
        console.log(`      Created: ${course.created_at}`);
        console.log('');
      });
    } else {
      console.log('❌ No courses found with SOA in code, title, or organization name.\n');
    }

    // 2. Check for SOA in organizations
    console.log('🏢 Checking for SOA in organizations...');
    const soaOrgs = await client.query(`
      SELECT 
        id,
        name,
        slug,
        type,
        status,
        created_at
      FROM organizations
      WHERE 
        UPPER(name) LIKE '%SOA%'
        OR UPPER(slug) LIKE '%SOA%'
      ORDER BY created_at DESC
    `);

    if (soaOrgs.rows.length > 0) {
      console.log(`✅ Found ${soaOrgs.rows.length} organization(s) related to SOA:\n`);
      soaOrgs.rows.forEach((org, idx) => {
        console.log(`   ${idx + 1}. Organization: ${org.name}`);
        console.log(`      Slug: ${org.slug || 'N/A'}`);
        console.log(`      Type: ${org.type || 'N/A'}`);
        console.log(`      Status: ${org.status || 'N/A'}`);
        console.log(`      Created: ${org.created_at}`);
        console.log('');
      });
    } else {
      console.log('❌ No organizations found with SOA in name or slug.\n');
    }

    // 3. Get user ID from email
    console.log(`👤 Checking user: ${USER_EMAIL}...`);
    const userRes = await client.query(`
      SELECT id, email, created_at, email_confirmed_at
      FROM auth.users
      WHERE email = $1
    `, [USER_EMAIL]);

    if (userRes.rows.length === 0) {
      console.log(`❌ User not found: ${USER_EMAIL}\n`);
      return;
    }

    const userId = userRes.rows[0].id;
    console.log(`✅ User found:`);
    console.log(`   User ID: ${userId}`);
    console.log(`   Email: ${userRes.rows[0].email}`);
    console.log(`   Email Confirmed: ${userRes.rows[0].email_confirmed_at ? 'Yes' : 'No'}`);
    console.log(`   Created: ${userRes.rows[0].created_at}\n`);

    // 4. Check user_ai_usage (current tier)
    console.log('📊 Checking user_ai_usage (current tier)...');
    const usageRes = await client.query(`
      SELECT 
        current_tier,
        exams_generated_this_month,
        explanations_requested_this_month,
        chat_messages_today,
        updated_at
      FROM user_ai_usage
      WHERE user_id = $1
    `, [userId]);

    if (usageRes.rows.length > 0) {
      const usage = usageRes.rows[0];
      console.log(`✅ User AI Usage:`);
      console.log(`   Current Tier: ${usage.current_tier || 'free'}`);
      console.log(`   Exams Generated (this month): ${usage.exams_generated_this_month || 0}`);
      console.log(`   Explanations Requested (this month): ${usage.explanations_requested_this_month || 0}`);
      console.log(`   Chat Messages (today): ${usage.chat_messages_today || 0}`);
      console.log(`   Last Updated: ${usage.updated_at}\n`);
    } else {
      console.log('❌ No user_ai_usage record found (user has free tier).\n');
    }

    // 5. Check user_ai_tiers
    console.log('🎯 Checking user_ai_tiers...');
    const tierRes = await client.query(`
      SELECT 
        tier,
        created_at,
        updated_at
      FROM user_ai_tiers
      WHERE user_id = $1
    `, [userId]);

    if (tierRes.rows.length > 0) {
      const tier = tierRes.rows[0];
      console.log(`✅ User AI Tier:`);
      console.log(`   Tier: ${tier.tier}`);
      console.log(`   Created: ${tier.created_at}`);
      console.log(`   Updated: ${tier.updated_at}\n`);
    } else {
      console.log('❌ No user_ai_tiers record found.\n');
    }

    // 6. Check payment_transactions
    console.log('💳 Checking payment_transactions...');
    const paymentsRes = await client.query(`
      SELECT 
        id,
        status,
        tier,
        amount,
        currency,
        subscription_plan_id,
        completed_at,
        created_at,
        metadata
      FROM payment_transactions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 10
    `, [userId]);

    if (paymentsRes.rows.length > 0) {
      console.log(`✅ Found ${paymentsRes.rows.length} payment transaction(s):\n`);
      paymentsRes.rows.forEach((payment, idx) => {
        console.log(`   ${idx + 1}. Transaction ID: ${payment.id}`);
        console.log(`      Status: ${payment.status}`);
        console.log(`      Tier: ${payment.tier || 'N/A'}`);
        console.log(`      Amount: ${payment.currency || 'ZAR'} ${payment.amount || '0.00'}`);
        console.log(`      Plan ID: ${payment.subscription_plan_id || 'N/A'}`);
        console.log(`      Completed: ${payment.completed_at || 'Not completed'}`);
        console.log(`      Created: ${payment.created_at}`);
        if (payment.metadata) {
          const meta = typeof payment.metadata === 'string' ? JSON.parse(payment.metadata) : payment.metadata;
          if (meta.plan_tier) console.log(`      Plan Tier: ${meta.plan_tier}`);
          if (meta.scope) console.log(`      Scope: ${meta.scope}`);
        }
        console.log('');
      });
    } else {
      console.log('❌ No payment transactions found.\n');
    }

    // 7. Check subscriptions table (if exists)
    console.log('📋 Checking subscriptions table...');
    try {
      const subscriptionsRes = await client.query(`
        SELECT 
          id,
          user_id,
          tier,
          status,
          amount,
          payment_method,
          payment_id,
          pf_payment_id,
          subscription_start,
          subscription_end,
          next_billing_date,
          cancelled_at,
          created_at
        FROM subscriptions
        WHERE user_id = $1
        ORDER BY created_at DESC
      `, [userId]);

      if (subscriptionsRes.rows.length > 0) {
        console.log(`✅ Found ${subscriptionsRes.rows.length} subscription(s):\n`);
        subscriptionsRes.rows.forEach((sub, idx) => {
          console.log(`   ${idx + 1}. Subscription ID: ${sub.id}`);
          console.log(`      Tier: ${sub.tier || 'N/A'}`);
          console.log(`      Status: ${sub.status || 'N/A'}`);
          console.log(`      Amount: ${sub.amount || 'N/A'}`);
          console.log(`      Payment Method: ${sub.payment_method || 'N/A'}`);
          console.log(`      Payment ID: ${sub.payment_id || 'N/A'}`);
          console.log(`      PayFast Payment ID: ${sub.pf_payment_id || 'N/A'}`);
          console.log(`      Start: ${sub.subscription_start}`);
          console.log(`      End: ${sub.subscription_end || 'N/A'}`);
          console.log(`      Next Billing: ${sub.next_billing_date || 'N/A'}`);
          console.log(`      Cancelled: ${sub.cancelled_at || 'No'}`);
          console.log(`      Created: ${sub.created_at}`);
          console.log('');
        });
      } else {
        console.log('❌ No subscriptions found in subscriptions table.\n');
      }
    } catch (err) {
      console.log('⚠️  subscriptions table may not exist or has different schema.\n');
    }

    // 8. Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const effectiveTier = usageRes.rows[0]?.current_tier || tierRes.rows[0]?.tier || 'free';
    const completedPayments = paymentsRes.rows.filter(p => p.status === 'completed').length;
    
    console.log(`User: ${USER_EMAIL}`);
    console.log(`Effective Tier: ${effectiveTier}`);
    console.log(`Completed Payments: ${completedPayments}`);
    console.log(`SOA Courses Found: ${soaCourses.rows.length}`);
    console.log(`SOA Organizations Found: ${soaOrgs.rows.length}`);
    
    if (effectiveTier === 'free' && completedPayments > 0) {
      console.log('\n⚠️  WARNING: User has completed payments but tier is still FREE!');
    } else if (effectiveTier !== 'free') {
      console.log(`\n✅ User has active subscription: ${effectiveTier}`);
    } else {
      console.log('\nℹ️  User is on free tier (no active subscription).');
    }

  } catch (error) {
    console.error('❌ Database query error:', error.message);
    console.error(error.stack);
  } finally {
    if (client) {
      await client.end();
      console.log('\n✅ Database connection closed.');
    }
  }
}

// Run the check
checkSOAAndSubscription().catch(console.error);

