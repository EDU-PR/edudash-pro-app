/**
 * Hook for subscription upgrade management
 */
import { useState, useEffect, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { assertSupabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import { createCheckout } from '@/lib/payments';
import { adminUpdateSubscriptionPlan } from '@/lib/subscriptions/rpc-subscriptions';
import { navigateTo } from '@/lib/navigation/router-utils';
import { getReturnUrl, getCancelUrl } from '@/lib/payments/urls';
import { SubscriptionPlan, UPGRADE_REASONS, DEFAULT_REASON, UpgradeReason } from './types';
import { takeFirst } from './utils';
import { 
  REVENUECAT_CONFIG, 
  purchaseProduct, 
  ensureInitialized, 
  identifyRevenueCatUser 
} from '@/lib/revenuecat/config';

interface UseSubscriptionUpgradeParams {
  currentTier: string;
  reasonKey: string;
  feature?: string;
}

interface UseSubscriptionUpgradeReturn {
  plans: SubscriptionPlan[];
  loading: boolean;
  annual: boolean;
  setAnnual: (annual: boolean) => void;
  selectedPlan: string | null;
  setSelectedPlan: (planId: string | null) => void;
  upgrading: boolean;
  expanded: Record<string, boolean>;
  setExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  screenMounted: boolean;
  renderError: string | null;
  reason: UpgradeReason;
  handleUpgrade: (planId: string) => Promise<void>;
  isLaunchPromoActive: boolean;
  promoPercentOff: number;
}

export function useSubscriptionUpgrade({
  currentTier,
  reasonKey,
  feature
}: UseSubscriptionUpgradeParams): UseSubscriptionUpgradeReturn {
  const { profile } = useAuth();
  const { refresh: refreshSubscription } = useSubscription();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [annual, setAnnual] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [screenMounted, setScreenMounted] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  
  const promoEndDate = new Date('2025-12-31T23:59:59.999Z');
  const isLaunchPromoActive = new Date() <= promoEndDate;
  // Note: Database stores BASE prices. Promo (50% off) is applied at display time for monthly only.

  // Get reason with customization
  const reason = { ...(UPGRADE_REASONS[reasonKey] || DEFAULT_REASON) };
  if (feature && reasonKey === 'feature_needed') {
    reason.subtitle = `${feature} requires a higher tier plan`;
  }

  const loadPlans = useCallback(async () => {
    let timedOut = false;
    const timeoutId = setTimeout(() => { timedOut = true; }, 10000);

    try {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const { data, error } = await assertSupabase()
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('price_monthly', { ascending: true });

      clearTimeout(timeoutId);

      if (timedOut) {
        console.warn('loadPlans timed out');
        return;
      }

      if (error) throw new Error(error.message || 'Failed to fetch plans');
      
      const plansData = Array.isArray(data) ? data : [];
      const userRole = profile?.role?.toLowerCase() || '';
      const isParentOrStudent = userRole === 'parent' || userRole === 'student' || userRole === 'learner';
      const currentTierLower = currentTier.toLowerCase();
      
      const filteredPlans = plansData.filter(plan => {
        if (!plan || !plan.tier) return false;
        const planTier = plan.tier.toLowerCase();
        if (planTier === currentTierLower) return false;
        
        if (isParentOrStudent) {
          return planTier === 'free' || planTier.includes('parent');
        }
        
        if (userRole === 'super_admin' || userRole === 'superadmin') {
          return !planTier.includes('parent');
        }
        
        return !planTier.includes('parent') && planTier !== 'enterprise';
      });
      
      setPlans(filteredPlans);
      if (filteredPlans.length > 0) {
        setSelectedPlan(filteredPlans[0].id);
      }
      
      track('upgrade_post_plans_loaded', { 
        plans_count: filteredPlans.length,
        current_tier: currentTier 
      });
      
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error('Plans loading failed:', error);
      setPlans([]);
      track('upgrade_post_load_failed', { 
        error: error?.message || String(error),
        current_tier: currentTier 
      });
    } finally {
      setLoading(false);
    }
  }, [currentTier, profile]);

  useEffect(() => {
    const initializeScreen = async () => {
      try {
        setScreenMounted(true);
        await new Promise(resolve => setTimeout(resolve, 50));
        await loadPlans();
        track('upgrade_post_screen_viewed', {
          current_tier: currentTier,
          reason: reasonKey,
          feature: feature,
          user_role: profile?.role,
        });
      } catch (error: any) {
        console.error('❌ Screen initialization failed:', error);
        setRenderError(error.message || 'Initialization failed');
        setLoading(false);
      }
    };
    
    initializeScreen();
    return () => { setScreenMounted(false); };
  }, [currentTier, reasonKey, feature, loadPlans, profile?.role]);

  const handleUpgrade = useCallback(async (planId: string) => {
    if (!planId) {
      Alert.alert('Error', 'No plan selected');
      return;
    }
    
    const plan = plans.find(p => p.id === planId);
    if (!plan) {
      Alert.alert('Error', 'Selected plan not found');
      return;
    }

    if (!profile) {
      Alert.alert('Error', 'User profile not loaded. Please try again.');
      return;
    }

    if (!screenMounted) return;
    setUpgrading(true);
    
    try {
      const isEnterprise = plan.tier.toLowerCase() === 'enterprise';
      const price = annual ? plan.price_annual : plan.price_monthly;

      if (isEnterprise) {
        Alert.alert(
          'Enterprise Upgrade',
          'Enterprise plans require custom setup. Our sales team will contact you.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Contact Sales', 
              onPress: () => {
                track('enterprise_upgrade_contact', { from_tier: currentTier, reason: reasonKey });
                navigateTo.contact();
              }
            },
          ]
        );
        return;
      }

      // Zero-cost downgrade
      if (price === 0) {
        track('downgrade_attempt', { from_tier: currentTier, to_tier: plan.tier, billing: annual ? 'annual' : 'monthly' });

        const { data: sub, error: subErr } = await assertSupabase()
          .from('subscriptions')
          .select('id')
          .eq('school_id', profile.organization_id)
          .eq('status', 'active')
          .maybeSingle();
        if (subErr || !sub?.id) throw new Error('Active subscription not found');

        await adminUpdateSubscriptionPlan(assertSupabase(), {
          subscriptionId: sub.id,
          newPlanId: plan.id,
          billingFrequency: annual ? 'annual' : 'monthly',
          seatsTotal: plan.max_teachers || 1,
          reason: 'Downgrade to Free via upgrade screen',
          metadata: { changed_via: 'principal_upgrade_screen', payment_required: false, downgrade: true },
        });

        Alert.alert('Plan Updated', 'Your subscription has been changed to the Free plan.');
        track('downgrade_succeeded', { to_tier: plan.tier });
        try { router.back(); } catch { router.replace('/screens/principal-dashboard'); }
        return;
      }

      track('upgrade_attempt', {
        from_tier: currentTier,
        to_tier: plan.tier,
        billing: annual ? 'annual' : 'monthly',
        price: price,
        reason: reasonKey,
      });

      const userEmail = profile.email || (await assertSupabase().auth.getUser()).data.user?.email;
      const isIndividualPlan = plan.tier.includes('parent') || profile.role === 'student' || profile.role === 'learner';
      const scope = isIndividualPlan ? 'user' : 'school';
      
      // For individual plans (parent/student/learner) on mobile, use RevenueCat (Google Play / App Store)
      if (isIndividualPlan && Platform.OS !== 'web') {
        try {
          // CRITICAL: Identify user with RevenueCat before purchase
          // This ensures the webhook knows which Supabase user made the purchase
          if (profile?.id) {
            console.log('[useSubscriptionUpgrade] Identifying user with RevenueCat:', profile.id);
            await ensureInitialized();
            await identifyRevenueCatUser(profile.id);
          } else {
            throw new Error('User profile not found. Please log in again.');
          }
          
          // Map plan tier to RevenueCat product ID
          const tierLower = plan.tier.toLowerCase().replace(/-/g, '_');
          let productId: string;
          
          if (tierLower === 'parent_starter' || tierLower === 'starter') {
            productId = annual 
              ? REVENUECAT_CONFIG.PRODUCT_IDS.STARTER_ANNUAL 
              : REVENUECAT_CONFIG.PRODUCT_IDS.STARTER_MONTHLY;
          } else if (tierLower === 'parent_plus' || tierLower === 'premium' || tierLower === 'pro') {
            productId = annual 
              ? REVENUECAT_CONFIG.PRODUCT_IDS.PREMIUM_ANNUAL 
              : REVENUECAT_CONFIG.PRODUCT_IDS.PREMIUM_MONTHLY;
          } else {
            throw new Error(`Unknown plan tier for RevenueCat: ${plan.tier}`);
          }
          
          track('revenuecat_purchase_started', {
            plan_tier: plan.tier,
            product_id: productId,
            billing: annual ? 'annual' : 'monthly',
          });
          
          const purchaseResult = await purchaseProduct(productId);
          
          if (purchaseResult.success) {
            track('revenuecat_purchase_success', {
              plan_tier: plan.tier,
              product_id: productId,
            });
            
            // SINGLE SOURCE OF TRUTH: Update profiles.subscription_tier
            // Database trigger automatically syncs to user_ai_tiers and user_ai_usage
            try {
              const newTier = tierLower.startsWith('parent_') ? tierLower : `parent_${tierLower}`;
              console.log('[useSubscriptionUpgrade] Updating profiles.subscription_tier to:', newTier);
              
              const { error: profileError } = await assertSupabase()
                .from('profiles')
                .update({ subscription_tier: newTier })
                .eq('id', profile?.id);
              
              if (profileError) {
                console.error('Failed to update profiles.subscription_tier:', profileError);
              } else {
                console.log('Successfully updated profiles.subscription_tier to:', newTier);
              }
            } catch (dbErr) {
              console.error('Failed to update tier in DB:', dbErr);
              // Don't fail - RevenueCat webhook will sync
            }
            
            // Refresh subscription context to update UI immediately
            refreshSubscription();
            
            Alert.alert(
              'Purchase Successful!',
              `You are now subscribed to ${plan.name}. Enjoy your premium features!`,
              [{ text: 'OK', onPress: () => { try { router.back(); } catch { router.replace('/'); } } }]
            );
          } else {
            if (purchaseResult.error?.includes('cancelled')) {
              track('revenuecat_purchase_cancelled', { plan_tier: plan.tier });
              // User cancelled - don't show error
            } else {
              throw new Error(purchaseResult.error || 'Purchase failed');
            }
          }
          return;
        } catch (rcError: any) {
          track('revenuecat_purchase_failed', {
            plan_tier: plan.tier,
            error: rcError.message,
          });
          throw rcError;
        }
      }
      
      // For school plans or web, use PayFast checkout
      const result = await createCheckout({
        scope: scope as 'user' | 'school',
        schoolId: scope === 'school' ? profile.organization_id : undefined,
        userId: profile.id,
        planTier: plan.tier,
        billing: (annual ? 'annual' : 'monthly') as 'annual' | 'monthly',
        seats: isIndividualPlan ? 1 : plan.max_teachers,
        email_address: userEmail || undefined,
        return_url: getReturnUrl(),
        cancel_url: getCancelUrl(),
      });
      
      if (result.error) throw new Error(result.error);
      if (!result.redirect_url) throw new Error('No payment URL received');

      track('upgrade_checkout_redirected', { to_tier: plan.tier, billing: annual ? 'annual' : 'monthly' });
      
      try {
        await WebBrowser.openBrowserAsync(result.redirect_url, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
          showTitle: true,
          toolbarColor: '#0b1220',
        });
      } catch {
        // Fallback to Linking
        const { Linking } = require('react-native');
        const canOpen = await Linking.canOpenURL(result.redirect_url);
        if (canOpen) {
          await Linking.openURL(result.redirect_url);
        } else {
          Alert.alert('Unable to Open Payment', 'Cannot open the payment page.');
        }
      }
      
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to start upgrade';
      Alert.alert('Upgrade Failed', errorMessage);
      track('upgrade_failed', { to_tier: plan.tier, error: errorMessage });
    } finally {
      if (screenMounted) setUpgrading(false);
    }
  }, [plans, profile, annual, currentTier, reasonKey, screenMounted, refreshSubscription]);

  return {
    plans,
    loading,
    annual,
    setAnnual,
    selectedPlan,
    setSelectedPlan,
    upgrading,
    expanded,
    setExpanded,
    screenMounted,
    renderError,
    reason,
    handleUpgrade,
    isLaunchPromoActive,
    promoPercentOff: isLaunchPromoActive ? 50 : 0,
  };
}
