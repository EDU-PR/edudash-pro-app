import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { ComparisonTable } from '../components/pricing/ComparisonTable';
import type { PlanId } from '../components/pricing/ComparisonTable';
import { useAuth } from '@/contexts/AuthContext';
import { normalizeRole } from '@/lib/rbac';
import { salesOrPricingPath } from '@/lib/sales';
import { navigateTo } from '@/lib/navigation/router-utils';
import { useTranslation } from 'react-i18next';
import { assertSupabase } from '@/lib/supabase';

type UserType = 'parents' | 'schools';

export default function PricingScreen() {
  const { t } = useTranslation();
  const [annual, setAnnual] = useState(false);
  const [userType, setUserType] = useState<UserType>('parents');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isOnTrial, setIsOnTrial] = useState(false);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();
  const roleNorm = normalizeRole(String(profile?.role || ''));
  const canRequestEnterprise = roleNorm === 'principal_admin' || roleNorm === 'super_admin';
  const isParent = profile?.role === 'parent';

  useEffect(() => {
    const checkAuthAndTrial = async () => {
      setIsLoggedIn(!!profile);
      
      if (profile?.id) {
        try {
          const { data: profileData } = await assertSupabase()
            .from('profiles')
            .select('is_trial, trial_ends_at')
            .eq('id', profile.id)
            .single();
          
          if (profileData?.is_trial && profileData.trial_ends_at) {
            const trialEnd = new Date(profileData.trial_ends_at);
            const now = new Date();
            setIsOnTrial(trialEnd > now);
          }
        } catch (err) {
          if (__DEV__) console.debug('Trial check failed:', err);
        }
      }
      setLoading(false);
    };
    checkAuthAndTrial();
    
    // Set user type based on role
    if (isParent) {
      setUserType('parents');
    } else if (canRequestEnterprise) {
      setUserType('schools');
    }
  }, [profile, isParent, canRequestEnterprise]);

  const priceStr = (monthly: number, originalPrice?: number): string => {
    if (annual) {
      const yearly = Math.round(monthly * 12 * 0.8); // 20% annual discount
      const originalYearly = originalPrice ? Math.round(originalPrice * 12 * 0.8) : null;
      if (originalYearly) {
        return `R${yearly} / year`;
      }
      return `R${yearly} / year (save 20%)`;
    }
    if (originalPrice && originalPrice > monthly) {
      return `R${monthly.toFixed(2)} / month`;
    }
    return `R${monthly.toFixed(2)} / month`;
  };

  // Parent plans matching PWA exactly
  const parentPlans = [
    {
      key: 'free',
      name: 'Free',
      price: 0,
      priceAnnual: 0,
      originalPrice: undefined,
      originalPriceAnnual: undefined,
      popular: false,
      features: [
        '10 AI queries/month',
        'Basic homework help',
        'Child progress tracking',
        'Teacher messaging',
        'Email support',
      ],
    },
    {
      key: 'parent-starter',
      name: 'Parent Starter',
      price: 49.50,
      priceAnnual: 475.00,
      originalPrice: 99.00,
      originalPriceAnnual: 950.00,
      popular: true,
      features: [
        '30 Homework Helper/month',
        'AI lesson support',
        'Child-safe explanations',
        'Progress tracking',
        'Email support',
        ...(isOnTrial ? [] : ['7-day free trial']),
      ],
    },
    {
      key: 'parent-plus',
      name: 'Parent Plus',
      price: 99.50,
      priceAnnual: 955.00,
      originalPrice: 199.00,
      originalPriceAnnual: 1910.00,
      popular: false,
      features: [
        '100 Homework Helper/month',
        'Priority processing',
        'Up to 3 children',
        'Advanced learning insights',
        'Priority support',
        'WhatsApp Connect',
        'Learning Resources',
        'Progress Analytics',
      ],
    },
  ];

  // School plans matching PWA exactly
  const schoolPlans = [
    {
      key: 'free',
      name: 'Free Plan',
      price: 0,
      priceAnnual: 0,
      originalPrice: undefined,
      originalPriceAnnual: undefined,
      popular: false,
      features: [
        'Basic dashboard',
        'Student management',
        'Parent communication',
        'Basic reporting',
      ],
    },
    {
      key: 'starter',
      name: 'Starter Plan',
      price: 299,
      priceAnnual: 2990,
      originalPrice: undefined,
      originalPriceAnnual: undefined,
      popular: true,
      features: [
        'Essential features',
        'AI-powered insights',
        'Parent portal',
        'WhatsApp notifications',
        'Email support',
        ...(isOnTrial ? [] : ['7-day free trial']),
      ],
    },
    {
      key: 'premium',
      name: 'Premium Plan',
      price: 599,
      priceAnnual: 5990,
      originalPrice: undefined,
      originalPriceAnnual: undefined,
      popular: false,
      features: [
        'All Starter features',
        'Advanced reporting',
        'Priority support',
        'Custom branding',
        'API access',
        'Advanced analytics',
      ],
    },
    {
      key: 'enterprise',
      name: 'Enterprise Plan',
      price: null,
      priceAnnual: null,
      originalPrice: undefined,
      originalPriceAnnual: undefined,
      popular: false,
      features: [
        'All Premium features',
        'Unlimited users',
        'Dedicated success manager',
        'SLA guarantee',
        'White-label solution',
        'Custom integrations',
        '24/7 priority support',
      ],
    },
  ];

  const activePlans = userType === 'parents' ? parentPlans : schoolPlans;

  if (loading) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: '#0a0a0f', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#00f5ff" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: '#0a0a0f' }}>
      <Stack.Screen options={{ title: t('pricing.title', { defaultValue: 'Pricing' }), headerStyle: { backgroundColor: '#0a0a0f' }, headerTitleStyle: { color: '#fff' }, headerTintColor: '#00f5ff' }} />
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Promo Banner for Parents */}
        {userType === 'parents' && (
          <LinearGradient
            colors={['rgb(99, 102, 241)', 'rgb(139, 92, 246)']}
            style={styles.promoBanner}
          >
            <Text style={styles.promoEmoji}>🔥</Text>
            <View style={styles.promoContent}>
              <Text style={styles.promoTitle}>LAUNCH SPECIAL: 50% OFF FOR 6 MONTHS!</Text>
              <Text style={styles.promoSubtitle}>
                🎁 Join before Dec 31, 2025 • R49.50/mo (was R99) or R99.50/mo (was R199) for 6 months
              </Text>
            </View>
            <Text style={styles.promoEmoji}>⚡</Text>
          </LinearGradient>
        )}

        {/* Hero Section */}
        <View style={styles.headerSection}>
          <View style={styles.badgeContainer}>
            <Text style={styles.badgeText}>🇿🇦 South African Pricing</Text>
          </View>
          <Text style={styles.title}>Choose Your Perfect Plan</Text>
          <Text style={styles.subtitle}>
            Transparent pricing for parents and schools across South Africa
          </Text>
          
          {!isOnTrial && (
            <View style={styles.trialBanner}>
              <Text style={styles.trialBannerText}>🎉 7-Day Free Trial • No Credit Card Required</Text>
            </View>
          )}
        </View>

        {/* User Type Toggle - Hide for parents, they only see parent plans */}
        {!isParent && (
          <View style={styles.userTypeToggle}>
            <TouchableOpacity
              onPress={() => setUserType('parents')}
              style={[styles.userTypeBtn, userType === 'parents' && styles.userTypeBtnActive]}
            >
              <Text style={[styles.userTypeBtnText, userType === 'parents' && styles.userTypeBtnTextActive]}>
                👨‍👩‍👧 For Parents
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setUserType('schools')}
              style={[styles.userTypeBtn, userType === 'schools' && styles.userTypeBtnActive]}
            >
              <Text style={[styles.userTypeBtnText, userType === 'schools' && styles.userTypeBtnTextActive]}>
                🏫 For Schools
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Billing Period Toggle */}
        <View style={styles.billingToggle}>
          <Text style={[styles.billingLabel, { color: annual ? '#6B7280' : '#fff' }]}>Monthly</Text>
          <TouchableOpacity
            onPress={() => setAnnual(!annual)}
            style={[styles.billingSwitch, annual && styles.billingSwitchActive]}
          >
            <View style={[
              styles.billingSwitchThumb,
              { marginLeft: annual ? 28 : 0 }
            ]} />
          </TouchableOpacity>
          <Text style={[styles.billingLabel, { color: annual ? '#fff' : '#6B7280' }]}>
            Annual <Text style={styles.billingSavings}>(Save 20%)</Text>
          </Text>
        </View>

        {/* Pricing Cards */}
        <View style={styles.plansGrid}>
          {activePlans.map((plan) => {
            const price = annual ? plan.priceAnnual : plan.price;
            const originalPrice = annual ? plan.originalPriceAnnual : plan.originalPrice;
            const isEnterprise = plan.price === null;
            const hasPromo = Boolean(userType === 'parents' && originalPrice && originalPrice > (price || 0));
            
            return (
              <View key={plan.key} style={styles.planCardWrapper}>
                <PlanCard
                  name={plan.name}
                  price={price}
                  originalPrice={originalPrice}
                  annual={annual}
                  popular={plan.popular}
                  isEnterprise={isEnterprise}
                  hasPromo={hasPromo}
                  features={plan.features}
                  userType={userType}
                  isLoggedIn={isLoggedIn}
                  onPress={() => {
                    if (isEnterprise) {
                      if (!canRequestEnterprise) {
                        Alert.alert('Restricted', 'Only principals or school admins can request Enterprise plans.');
                        return;
                      }
                      router.push('/sales/contact?plan=enterprise' as `/${string}`);
                      return;
                    }
                    if (price === 0) {
                      if (isLoggedIn) {
                        router.push('/dashboard/parent' as `/${string}`);
                      } else {
                        router.push('/(auth)/sign-in' as `/${string}`);
                      }
                      return;
                    }
                    // Map plan keys to subscription plan tier names (database uses underscores)
                    let planId = plan.key;
                    // Map parent plan keys (with hyphens) to tier names (with underscores)
                    if (plan.key === 'parent-starter') planId = 'parent_starter';
                    if (plan.key === 'parent-plus') planId = 'parent_plus';
                    // Map school plan keys
                    if (plan.key === 'starter') planId = 'school_starter';
                    if (plan.key === 'premium') planId = 'school_premium';
                    navigateTo.subscriptionSetup({ planId, billing: annual ? 'annual' : 'monthly', auto: '1' });
                  }}
                />
              </View>
            );
          })}
        </View>

        {/* Trust Badges */}
        <View style={styles.trustBadges}>
          <Text style={styles.trustTitle}>✅ Why Choose EduDash Pro?</Text>
          <View style={styles.trustList}>
            <Text style={styles.trustItem}>🔒 Multi-tenant security</Text>
            <Text style={styles.trustItem}>🇿🇦 Built for South Africa</Text>
            <Text style={styles.trustItem}>💳 No credit card required</Text>
            <Text style={styles.trustItem}>⭐ Cancel anytime</Text>
            <Text style={styles.trustItem}>🚀 Instant setup</Text>
          </View>
        </View>

        {/* Comparison table - full bleed width - filtered by user type */}
        <View style={styles.fullBleed}>
          <ComparisonTable
            annual={annual}
            visiblePlans={isParent ? ['free', 'parent-starter', 'parent-plus'] : undefined}
            onSelectPlan={(planId) => {
              if (planId === 'preschool-pro' || planId === 'enterprise') {
                if (!canRequestEnterprise) {
                  Alert.alert(t('common.restricted', { defaultValue: 'Restricted' }), t('pricing.restricted_submit_only', { defaultValue: 'Only principals or school admins can submit these requests.' }));
                  return;
                }
                router.push(`/sales/contact?plan=${planId}` as `/${string}`);
                return;
              }
              navigateTo.subscriptionSetup({ planId: planId, billing: annual ? 'annual' : 'monthly' });
            }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PlanCard({
  name,
  price,
  originalPrice,
  annual,
  popular,
  isEnterprise,
  hasPromo,
  features,
  userType,
  isLoggedIn,
  onPress,
}: {
  name: string;
  price: number | null;
  originalPrice?: number;
  annual: boolean;
  popular: boolean;
  isEnterprise: boolean;
  hasPromo: boolean;
  features: string[];
  userType: UserType;
  isLoggedIn: boolean;
  onPress: () => void;
}) {
  const displayPrice = price === null ? null : (annual ? price : price);
  const displayOriginalPrice = originalPrice ? (annual ? originalPrice * 12 * 0.8 : originalPrice) : null;

  return (
    <View style={[styles.card, popular && styles.cardPopular]}>
      {popular && (
        <View style={styles.popularBadge}>
          <Text style={styles.popularBadgeText}>Most Popular</Text>
        </View>
      )}
      {hasPromo && originalPrice && (
        <View style={styles.promoBadge}>
          <Text style={styles.promoBadgeText}>🔥 LIMITED TIME: 50% OFF</Text>
        </View>
      )}
      
      <Text style={[styles.cardTitle, popular && styles.cardTitlePopular]}>{name}</Text>
      
      <View style={styles.priceContainer}>
        {isEnterprise ? (
          <>
            <Text style={[styles.cardPrice, popular && styles.cardPricePopular]}>Custom</Text>
            <Text style={[styles.cardPriceSubtext, popular && styles.cardPriceSubtextPopular]}>Contact us for pricing</Text>
          </>
        ) : displayPrice === 0 ? (
          <>
            <Text style={[styles.cardPrice, popular && styles.cardPricePopular]}>Free</Text>
            <Text style={[styles.cardPriceSubtext, popular && styles.cardPriceSubtextPopular]}>Forever</Text>
          </>
        ) : (
          <>
            {hasPromo && displayOriginalPrice && (
              <Text style={[styles.originalPrice, popular && styles.originalPricePopular]}>
                R{displayOriginalPrice.toFixed(2)}
              </Text>
            )}
            <Text style={[styles.cardPrice, popular && styles.cardPricePopular]}>
              R{displayPrice?.toFixed(2)}
            </Text>
            <Text style={[styles.cardPriceSubtext, popular && styles.cardPriceSubtextPopular]}>
              per {annual ? 'year' : 'month'}
            </Text>
            {hasPromo && displayOriginalPrice && displayPrice && (
              <View style={styles.savingsBadge}>
                <Text style={[styles.savingsText, popular && styles.savingsTextPopular]}>
                  💰 Save R{(displayOriginalPrice - displayPrice).toFixed(2)}/{annual ? 'yr' : 'mo'}
                </Text>
              </View>
            )}
          </>
        )}
      </View>

      <View style={styles.featureList}>
        {features.map((feature, idx) => (
          <View key={idx} style={styles.featureItem}>
            <Text style={[styles.featureCheck, popular && styles.featureCheckPopular]}>✓</Text>
            <Text style={[styles.featureText, popular && styles.featureTextPopular]}>{feature}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.cta, popular && styles.ctaPopular]}
        onPress={onPress}
      >
        <Text style={[styles.ctaText, popular && styles.ctaTextPopular]}>
          {isEnterprise ? 'Contact Sales' : displayPrice === 0 ? (isLoggedIn ? 'Get Started Free' : 'Sign In to Subscribe') : 'Subscribe Now'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  
  // Promo Banner
  promoBanner: {
    padding: 20,
    marginBottom: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginHorizontal: -20,
    marginTop: -20,
    paddingHorizontal: 20,
  },
  promoEmoji: {
    fontSize: 32,
  },
  promoContent: {
    flex: 1,
  },
  promoTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  promoSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.95)',
    fontWeight: '600',
    lineHeight: 20,
  },
  
  // Header Section
  headerSection: {
    alignItems: 'center',
    marginBottom: 32,
    gap: 16,
  },
  badgeContainer: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: 'rgba(0, 245, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 255, 0.3)',
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 12,
    color: '#00f5ff',
    fontWeight: '600',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#9CA3AF',
    textAlign: 'center',
    maxWidth: 600,
  },
  trialBanner: {
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderWidth: 2,
    borderColor: '#fbbf24',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  trialBannerText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fbbf24',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  
  // User Type Toggle
  userTypeToggle: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 32,
    justifyContent: 'center',
  },
  userTypeBtn: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
  },
  userTypeBtnActive: {
    backgroundColor: '#00f5ff',
    borderColor: '#00f5ff',
  },
  userTypeBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  userTypeBtnTextActive: {
    color: '#0a0a0f',
  },
  
  // Billing Toggle
  billingToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 48,
  },
  billingLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  billingSwitch: {
    width: 56,
    height: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 14,
    padding: 4,
    justifyContent: 'center',
  },
  billingSwitchActive: {
    backgroundColor: '#00f5ff',
  },
  billingSwitchThumb: {
    width: 20,
    height: 20,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  billingSavings: {
    color: '#22c55e',
    fontSize: 12,
  },
  
  // Plan Cards
  plansGrid: {
    gap: 24,
    marginBottom: 48,
  },
  planCardWrapper: {
    width: '100%',
  },
  card: {
    backgroundColor: '#111113',
    borderRadius: 16,
    padding: 32,
    borderWidth: 1,
    borderColor: '#1f1f23',
    position: 'relative',
    alignItems: 'center',
  },
  cardPopular: {
    backgroundColor: '#00f5ff',
    borderColor: '#00f5ff',
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    left: 16,
    backgroundColor: '#fbbf24',
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderRadius: 20,
  },
  popularBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0a0a0f',
    textTransform: 'uppercase',
  },
  promoBadge: {
    position: 'absolute',
    top: -12,
    right: 16,
    backgroundColor: '#fbbf24',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#f59e0b',
    shadowColor: '#fbbf24',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  promoBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0a0a0f',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
  },
  cardTitlePopular: {
    color: '#0a0a0f',
  },
  priceContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  originalPrice: {
    fontSize: 18,
    textDecorationLine: 'line-through',
    color: 'rgba(255, 255, 255, 0.4)',
    fontWeight: '600',
    marginBottom: 4,
  },
  originalPricePopular: {
    color: 'rgba(10, 10, 15, 0.5)',
  },
  cardPrice: {
    fontSize: 48,
    fontWeight: '800',
    color: '#fff',
  },
  cardPricePopular: {
    color: '#0a0a0f',
  },
  cardPriceSubtext: {
    fontSize: 14,
    color: '#6B7280',
  },
  cardPriceSubtextPopular: {
    color: 'rgba(10, 10, 15, 0.7)',
  },
  savingsBadge: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderRadius: 12,
  },
  savingsText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#22c55e',
  },
  savingsTextPopular: {
    color: '#0a0a0f',
  },
  featureList: {
    width: '100%',
    marginBottom: 32,
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  featureCheck: {
    fontSize: 16,
    color: '#00f5ff',
  },
  featureCheckPopular: {
    color: '#0a0a0f',
  },
  featureText: {
    flex: 1,
    fontSize: 14,
    color: '#D1D5DB',
    lineHeight: 20,
  },
  featureTextPopular: {
    color: 'rgba(10, 10, 15, 0.9)',
  },
  cta: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 245, 255, 0.2)',
    borderWidth: 1,
    borderColor: '#00f5ff',
    alignItems: 'center',
  },
  ctaPopular: {
    backgroundColor: '#0a0a0f',
    borderColor: '#0a0a0f',
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0a0a0f',
  },
  ctaTextPopular: {
    color: '#fff',
  },
  
  // Trust Badges
  trustBadges: {
    padding: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 48,
    alignItems: 'center',
  },
  trustTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
  },
  trustList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 32,
  },
  trustItem: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  
  // Full bleed section
  fullBleed: {
    marginHorizontal: -20,
  },
});
