require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

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
    is_active: true,
    description: 'Perfect for small schools getting started'
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
    is_active: true,
    description: 'Ideal for growing schools with advanced needs'
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
    is_active: true,
    description: 'Complete solution for large educational institutions'
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
    is_active: true,
    description: 'Special program for Young Eagles schools'
  }
];

async function seedSubscriptionPlans() {
  try {
    console.log('🌱 Seeding subscription plans...\n');
    
    // First, check if plans already exist
    const { data: existingPlans } = await supabase
      .from('subscription_plans')
      .select('tier')
      .in('tier', defaultPlans.map(p => p.tier));
    
    const existingTiers = new Set(existingPlans?.map(p => p.tier) || []);
    const plansToInsert = defaultPlans.filter(plan => !existingTiers.has(plan.tier));
    
    if (plansToInsert.length === 0) {
      console.log('✅ All default plans already exist in the database');
      return;
    }
    
    console.log(`📝 Inserting ${plansToInsert.length} new subscription plans...`);
    
    const { data, error } = await supabase
      .from('subscription_plans')
      .insert(plansToInsert)
      .select();
    
    if (error) {
      console.error('❌ Error inserting subscription plans:', _error);
      console.error('Details:', error.details);
      console.error('Hint:', error.hint);
      return;
    }
    
    console.log('✅ Successfully created subscription plans!');
    console.log(`📊 Created ${data?.length || 0} plans:\n`);
    
    data?.forEach((plan, index) => {
      console.log(`${index + 1}. ${plan.name} (${plan.tier})`);
      console.log(`   Monthly: R${plan.price_monthly}`);
      console.log(`   Annual: R${plan.price_annual}`);
      console.log(`   Teachers: ${plan.max_teachers}`);
      console.log(`   Students: ${plan.max_students}`);
      console.log(`   Features: ${plan.features?.length || 0} included`);
      console.log('');
    });
    
    console.log('🎉 Database seeding complete!');
    console.log('🔄 You can now try creating subscriptions in the admin panel');
    
  } catch (_err) {
    console.error('💥 Unexpected error:', _err);
  }
}

seedSubscriptionPlans();