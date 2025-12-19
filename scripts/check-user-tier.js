#!/usr/bin/env node
/**
 * Check User Tier Status (using PostgreSQL pooler)
 * 
 * This script checks if a user's tier was correctly updated in the database
 * after a PayFast payment. It queries directly via PostgreSQL pooler:
 * - user_ai_usage.current_tier
 * - user_ai_tiers.tier
 * - payment_transactions (to see payment status)
 * 
 * Usage:
 *   node scripts/check-user-tier.js <user_email>
 * 
 * Requires:
 *   - SUPABASE_DB_PASSWORD environment variable
 *   - Or set DATABASE_URL with full connection string
 */

// Try to load .env file if dotenv is available
try {
  require('dotenv').config();
} catch {
  // dotenv not installed, that's okay
}

const { Client } = require('pg');

// Get database connection from environment
const DATABASE_URL = process.env.DATABASE_URL;
const SUPABASE_DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;
const SUPABASE_PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'lvvvjywrmpcqrpvuptdi';

// Build connection config
let dbConfig;

if (DATABASE_URL) {
  // Use full connection string if provided
  dbConfig = { connectionString: DATABASE_URL };
} else if (SUPABASE_DB_PASSWORD) {
  // Use pooler connection
  dbConfig = {
    host: `aws-0-ap-southeast-1.pooler.supabase.com`,
    port: 6543,
    user: `postgres.${SUPABASE_PROJECT_REF}`,
    password: SUPABASE_DB_PASSWORD,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
  };
} else {
  console.error('❌ Missing database credentials.');
  console.error('');
  console.error('Option 1: Set DATABASE_URL with full connection string:');
  console.error('   export DATABASE_URL="postgresql://postgres.xxx:password@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"');
  console.error('');
  console.error('Option 2: Set SUPABASE_DB_PASSWORD:');
  console.error('   export SUPABASE_DB_PASSWORD="your-db-password"');
  console.error('');
  console.error('Get your database password from:');
  console.error('   https://supabase.com/dashboard/project/lvvvjywrmpcqrpvuptdi/settings/database');
  process.exit(1);
}

async function checkUserTier(userEmail) {
  console.log(`\n🔍 Checking tier status for: ${userEmail}\n`);

  const client = new Client(dbConfig);
  
  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // 1. Get user ID from auth.users by email
    const userQuery = `
      SELECT id, email, created_at
      FROM auth.users
      WHERE email = $1
      LIMIT 1;
    `;
    
    const userResult = await client.query(userQuery, [userEmail]);
    
    if (userResult.rows.length === 0) {
      console.error('❌ User not found in auth.users');
      
      // Try to find similar emails
      const similarQuery = `
        SELECT id, email
        FROM auth.users
        WHERE email ILIKE $1
        LIMIT 5;
      `;
      const similarResult = await client.query(similarQuery, [`%${userEmail}%`]);
      if (similarResult.rows.length > 0) {
        console.log('   Found similar emails:');
        similarResult.rows.forEach(row => {
          console.log(`      - ${row.email} (${row.id})`);
        });
      }
      return;
    }

    const userId = userResult.rows[0].id;
    console.log(`✅ User ID: ${userId}`);
    console.log(`   Email: ${userResult.rows[0].email}`);
    console.log(`   Created: ${userResult.rows[0].created_at}\n`);

    // 2. Check user_ai_usage.current_tier
    console.log('📊 Checking user_ai_usage table...');
    const usageQuery = `
      SELECT 
        current_tier,
        exams_generated_this_month,
        explanations_requested_this_month,
        chat_messages_today,
        updated_at
      FROM public.user_ai_usage
      WHERE user_id = $1;
    `;
    
    const usageResult = await client.query(usageQuery, [userId]);
    
    if (usageResult.rows.length === 0) {
      console.log('   ⚠️  No user_ai_usage record found');
    } else {
      const usage = usageResult.rows[0];
      console.log('   ✅ user_ai_usage.current_tier:', usage.current_tier || '(null)');
      console.log('   📅 Last updated:', usage.updated_at || '(null)');
      console.log('   📈 Usage stats:', {
        exams: usage.exams_generated_this_month,
        explanations: usage.explanations_requested_this_month,
        chat: usage.chat_messages_today,
      });
    }

    // 3. Check user_ai_tiers.tier
    console.log('\n📊 Checking user_ai_tiers table...');
    const tierQuery = `
      SELECT tier, created_at, updated_at
      FROM public.user_ai_tiers
      WHERE user_id = $1;
    `;
    
    const tierResult = await client.query(tierQuery, [userId]);
    
    if (tierResult.rows.length === 0) {
      console.log('   ⚠️  No user_ai_tiers record found');
    } else {
      const tierRow = tierResult.rows[0];
      console.log('   ✅ user_ai_tiers.tier:', tierRow.tier || '(null)');
      console.log('   📅 Created:', tierRow.created_at || '(null)');
      console.log('   📅 Last updated:', tierRow.updated_at || '(null)');
    }

    // 4. Check payment_transactions
    console.log('\n💳 Checking payment_transactions...');
    const paymentQuery = `
      SELECT 
        id,
        status,
        tier,
        amount,
        currency,
        completed_at,
        created_at,
        metadata
      FROM public.payment_transactions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 5;
    `;
    
    const paymentResult = await client.query(paymentQuery, [userId]);
    
    if (paymentResult.rows.length === 0) {
      console.log('   ⚠️  No payment_transactions found for this user');
    } else {
      console.log(`   ✅ Found ${paymentResult.rows.length} payment transaction(s):`);
      paymentResult.rows.forEach((tx, idx) => {
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
    }

    // 5. Summary
    console.log('\n📋 Summary:');
    const usage = usageResult.rows[0];
    const tierRow = tierResult.rows[0];
    const effectiveTier = usage?.current_tier || tierRow?.tier || 'free';
    console.log(`   Effective Tier: ${effectiveTier}`);
    console.log(`   Source: ${usage?.current_tier ? 'user_ai_usage' : tierRow?.tier ? 'user_ai_tiers' : 'default (free)'}`);
    
    const hasCompletedPayment = paymentResult.rows.some(tx => tx.status === 'completed' && tx.tier);
    if (hasCompletedPayment && effectiveTier === 'free') {
      console.log('\n   ⚠️  WARNING: User has completed payment but tier is still "free"!');
      console.log('   This suggests the tier update trigger may not have fired.');
      console.log('   Check the database trigger: trigger_auto_update_tier_on_payment');
    } else if (hasCompletedPayment && effectiveTier !== 'free') {
      console.log('\n   ✅ Tier correctly updated after payment!');
    } else if (!hasCompletedPayment) {
      console.log('\n   ℹ️  No completed payments found. Tier may be from a different source.');
    }

    console.log('');

  } catch (error) {
    console.error('❌ Database error:', error.message);
    if (error.code === '28P01') {
      console.error('   Authentication failed. Check your database password.');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('   Connection refused. Check your database host and port.');
    }
    throw error;
  } finally {
    await client.end();
  }
}

// Main
const userEmail = process.argv[2];
if (!userEmail) {
  console.error('❌ Usage: node scripts/check-user-tier.js <user_email>');
  console.error('   Example: node scripts/check-user-tier.js user@example.com');
  console.error('');
  console.error('Required environment variables:');
  console.error('   - SUPABASE_DB_PASSWORD (recommended)');
  console.error('   - Or DATABASE_URL (full connection string)');
  process.exit(1);
}

checkUserTier(userEmail).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
