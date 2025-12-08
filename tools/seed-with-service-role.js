require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
// Try both possible environment variable names for service role
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                          process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ||
                          process.env.SUPABASE_SERVICE_KEY;

console.log('🔗 Supabase URL:', supabaseUrl ? 'Set' : 'Missing');
console.log('🔑 Service Role Key:', supabaseServiceKey ? 'Set' : 'Missing');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  console.log('💡 Make sure you have exported SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Create Supabase client with service role key (bypasses RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const defaultPlans = [
  {
    name: 'Free',
    tier: 'free',
    price_monthly: 0,
    price_annual: 0,
    max_teachers: 3,
    max_students: 50,
    features: [
      'Basic dashboard',
      'Student management', 
      'Basic reporting',
      'Email support'
    ],
    is_active: true
  },
  {
    name: 'Pro',
    tier: 'pro', 
    price_monthly: 199,
    price_annual: 1990,
    max_teachers: 10,
    max_students: 200,
    features: [
      'Advanced dashboard',
      'AI-powered insights',
      'Advanced reporting', 
      'WhatsApp integration',
      'Priority support',
      'Financial management'
    ],
    is_active: true
  },
  {
    name: 'Enterprise',
    tier: 'enterprise',
    price_monthly: 499,
    price_annual: 4990,
    max_teachers: 50,
    max_students: 1000,
    features: [
      'Full dashboard suite',
      'Custom AI models',
      'Advanced analytics',
      'Custom integrations', 
      'Dedicated support',
      'Multi-campus support',
      'API access',
      'Custom reporting'
    ],
    is_active: true
  },
  {
    name: 'Young Eagles',
    tier: 'young_eagles',
    price_monthly: 99,
    price_annual: 990,
    max_teachers: 5,
    max_students: 100, 
    features: [
      'Young Eagles program',
      'Special curriculum',
      'Parent engagement tools',
      'Progress tracking',
      'Community features'
    ],
    is_active: true
  }
];

async function seedSubscriptionPlans() {
  try {
    console.log('🌱 Seeding subscription plans with service role...\n');
    
    // Check current plans
    const { data: existingPlans } = await supabase
      .from('subscription_plans')
      .select('tier, name');
      
    console.log(`📊 Found ${existingPlans?.length || 0} existing plans`);
    if (existingPlans?.length > 0) {
      console.log('Existing plans:', existingPlans.map(p => `${p.name} (${p.tier})`).join(', '));
    }
    
    const existingTiers = new Set(existingPlans?.map(p => p.tier) || []);
    const plansToInsert = defaultPlans.filter(plan => !existingTiers.has(plan.tier));
    
    if (plansToInsert.length === 0) {
      console.log('✅ All default plans already exist in the database');
      return;
    }
    
    console.log(`\n📝 Inserting ${plansToInsert.length} new subscription plans...`);
    plansToInsert.forEach((plan, i) => {
      console.log(`${i + 1}. ${plan.name} (${plan.tier}) - R${plan.price_monthly}/month`);
    });
    
    const { data, error } = await supabase
      .from('subscription_plans')
      .insert(plansToInsert)
      .select('id, name, tier, price_monthly, max_teachers, is_active');
    
    if (error) {
      console.error('❌ Error inserting subscription plans:', _error);
      console.error('Code:', error.code);
      console.error('Message:', error.message);
      return;
    }
    
    console.log('\n✅ Successfully created subscription plans!');
    console.log(`📊 Created ${data?.length || 0} plans:\n`);
    
    data?.forEach((plan, index) => {
      console.log(`${index + 1}. ${plan.name} (${plan.tier})`);
      console.log(`   ID: ${plan.id}`);
      console.log(`   Monthly: R${plan.price_monthly}`);
      console.log(`   Teachers: ${plan.max_teachers}`);
      console.log(`   Active: ${plan.is_active ? '✅' : '❌'}`);
      console.log('');
    });
    
    console.log('🎉 Database seeding complete!');
    console.log('🔄 Try refreshing the admin panel - you should now see the plans!');
    
  } catch (_err) {
    console.error('💥 Unexpected error:', _err);
  }
}

// Also provide a function to check table structure if needed
async function checkTableStructure() {
  try {
    console.log('🔍 Checking table structure...');
    
    const { data: columns, error } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_name', 'subscription_plans')
      .eq('table_schema', 'public')
      .order('ordinal_position');
    
    if (error) {
      console.error('❌ Could not fetch table structure:', _error);
      return;
    }
    
    console.log('\n📋 subscription_plans table structure:');
    columns?.forEach(col => {
      console.log(`   ${col.column_name.padEnd(20)} ${col.data_type.padEnd(15)} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'.padEnd(8)} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
    });
    
  } catch (_err) {
    console.error('💥 Error checking table structure:', _err);
  }
}

// Run both functions
async function main() {
  await checkTableStructure();
  await seedSubscriptionPlans();
}

main();