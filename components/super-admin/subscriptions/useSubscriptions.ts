/**
 * Hook for Super Admin Subscriptions management
 * Extracted from app/screens/super-admin-subscriptions.tsx
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { Alert } from 'react-native';
import { assertSupabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import type {
  Subscription,
  School,
  SubscriptionPlan,
  CreateSubscriptionForm,
  UseSubscriptionsResult,
} from './types';
import { INITIAL_CREATE_FORM } from './utils';

export function useSubscriptions(): UseSubscriptionsResult {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<CreateSubscriptionForm>(INITIAL_CREATE_FORM);
  const [showPlanChangeModal, setShowPlanChangeModal] = useState(false);
  const [selectedSubscriptionForChange, setSelectedSubscriptionForChange] = useState<Subscription | null>(null);
  const [selectedSchoolForChange, setSelectedSchoolForChange] = useState<School | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch subscriptions with school data
      let subQuery = assertSupabase()
        .from('subscriptions')
        .select(`
          *,
          preschools!subscriptions_school_id_fkey (
            id,
            name,
            tenant_slug,
            subscription_tier,
            email
          )
        `)
        .eq('owner_type', 'school')
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        subQuery = subQuery.eq('status', filter);
      }

      const { data: subsData, error: subsError } = await subQuery;
      if (subsError) throw subsError;

      // Transform the data
      const transformedSubs = (subsData || []).map((sub) => ({
        ...sub,
        school: Array.isArray(sub.preschools) ? sub.preschools[0] : sub.preschools,
      }));

      setSubscriptions(transformedSubs);

      // Fetch schools for creation via secure RPC
      let schoolsData: any[] = [];
      try {
        const { data, error } = await assertSupabase().rpc('public_list_schools');
        if (error) throw error;
        schoolsData = data || [];
      } catch (schoolErr: any) {
        console.error('School RPC error:', schoolErr?.message || schoolErr);
        schoolsData = [];
      }
      setSchools(schoolsData || []);

      // Fetch available subscription plans via secure RPC
      let plansData: any[] = [];
      try {
        const { data, error } = await assertSupabase().rpc('public_list_plans');
        if (error) throw error;
        plansData = (data || []).map((p: any) => {
          const normalizedName = p.name === 'Pro Plan' ? 'Pro Plus' : p.name;
          return { ...p, name: normalizedName };
        });
        // Order tiers from free to highest
        const order: Record<string, number> = { free: 0, starter: 1, basic: 2, premium: 3, pro: 4, enterprise: 5 };
        plansData.sort((a: any, b: any) => {
          const at = (a.tier || '').toLowerCase();
          const bt = (b.tier || '').toLowerCase();
          const ao = order[at] ?? 999;
          const bo = order[bt] ?? 999;
          if (ao !== bo) return ao - bo;
          return (a.price_monthly ?? 0) - (b.price_monthly ?? 0);
        });
      } catch (planErr: any) {
        console.error('Plan RPC error:', planErr?.message || planErr);
        plansData = [];
      }
      setPlans(plansData || []);
    } catch (e) {
      console.error('Failed to fetch subscription data:', e);
      Alert.alert('Error', 'Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const updateSubscriptionStatus = useCallback(
    async (id: string, status: 'active' | 'cancelled' | 'expired') => {
      try {
        const { error } = await assertSupabase()
          .from('subscriptions')
          .update({ status })
          .eq('id', id);

        if (error) throw error;

        track('subscription_status_updated', { subscription_id: id, status });
        setSubscriptions((prev) => prev.map((sub) => (sub.id === id ? { ...sub, status } : sub)));
        Alert.alert('Success', `Subscription ${status}`);
      } catch (e: any) {
        console.error('Failed to update subscription status:', e);
        Alert.alert('Error', e.message || 'Failed to update subscription');
      }
    },
    []
  );

  const createSubscription = useCallback(async () => {
    if (!createForm.school_id || !createForm.plan_tier) {
      Alert.alert('Error', 'Please select a school and plan');
      return;
    }

    const selectedSchool = schools.find((s) => s.id === createForm.school_id);
    if (!selectedSchool) {
      Alert.alert('Error', 'Selected school is invalid. Please refresh and try again.');
      return;
    }

    setCreating(true);
    try {
      const selectedPlan = plans.find((p) => {
        const key = p.tier || p.id || p.name?.toLowerCase()?.replace(/\s+/g, '_');
        return key === createForm.plan_tier || p.id === createForm.plan_id;
      });

      if (!selectedPlan) {
        Alert.alert('Error', 'Selected plan not found');
        return;
      }

      const seatsTotal = parseInt(createForm.seats_total) || selectedPlan.max_teachers || 10;
      const startDate = new Date();
      const endDate = new Date(startDate);

      if (createForm.billing_frequency === 'annual') {
        endDate.setFullYear(endDate.getFullYear() + 1);
      } else {
        endDate.setMonth(endDate.getMonth() + 1);
      }

      const isPaidPlan = (selectedPlan.price_monthly || 0) > 0 || (selectedPlan.price_annual || 0) > 0;
      const startTrial = (selectedPlan.tier || '').toLowerCase() === 'free';

      const { data: newId, error } = await assertSupabase().rpc('admin_create_school_subscription', {
        p_school_id: createForm.school_id,
        p_plan_id: selectedPlan.id,
        p_billing_frequency: createForm.billing_frequency,
        p_seats_total: seatsTotal,
        p_start_trial: startTrial,
      });

      if (error) throw error;

      // Update school subscription metadata
      await assertSupabase().rpc('update_preschool_subscription', {
        p_preschool_id: createForm.school_id,
        p_subscription_tier: createForm.plan_tier,
        p_subscription_status: 'active',
        p_subscription_plan_id: selectedPlan.id,
      });

      track('subscription_created_by_admin', {
        subscription_id: newId,
        school_id: createForm.school_id,
        plan_tier: createForm.plan_tier,
        seats_total: seatsTotal,
      });

      try {
        const { notifySubscriptionCreated } = await import('@/lib/notify');
        await notifySubscriptionCreated(createForm.school_id, createForm.plan_tier);
      } catch {
        console.warn('Failed to send notification');
      }

      if (isPaidPlan) {
        const amount =
          createForm.billing_frequency === 'annual'
            ? selectedPlan.price_annual || 0
            : selectedPlan.price_monthly || 0;

        try {
          const { notifyPaymentRequired, notifySubscriptionPendingPayment } = await import('@/lib/notify');
          await notifyPaymentRequired(createForm.school_id, newId, createForm.plan_tier, amount);
          await notifySubscriptionPendingPayment(createForm.school_id, newId, selectedPlan.name);
        } catch {
          console.warn('Failed to send payment notifications');
        }

        Alert.alert(
          'Paid Subscription Created',
          `Subscription created with status 'pending_payment'.\n\n✅ The school principal has been notified via email and push notification to complete payment.\n\n💡 The school will have limited access until payment is confirmed via PayFast.`,
          [
            { text: 'OK', style: 'default' },
            {
              text: 'Manual Override',
              style: 'destructive',
              onPress: () => {
                Alert.alert(
                  'Manual Activation',
                  'You can manually activate this subscription from the subscriptions list if needed for exceptional circumstances.',
                  [{ text: 'Understood', style: 'default' }]
                );
              },
            },
          ]
        );
      } else {
        Alert.alert('Success', 'Free subscription created and activated successfully!');
      }

      setShowCreateModal(false);
      setCreateForm({ ...INITIAL_CREATE_FORM, seats_total: '1' });
      await fetchData();
    } catch (e: any) {
      console.error('Failed to create subscription:', e);
      Alert.alert('Error', e.message || 'Failed to create subscription');
    } finally {
      setCreating(false);
    }
  }, [createForm, schools, plans, fetchData]);

  const handleManualActivation = useCallback(
    (subscription: Subscription) => {
      Alert.alert(
        'Manually Activate Subscription',
        `Are you sure you want to activate the subscription for ${subscription.school?.name || 'Unknown School'} without payment confirmation?\n\nThis should only be used in exceptional circumstances and will be logged for audit purposes.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Activate',
            style: 'default',
            onPress: async () => {
              try {
                const { error } = await assertSupabase()
                  .from('subscriptions')
                  .update({
                    status: 'active',
                    metadata: {
                      ...subscription.metadata,
                      manual_activation: true,
                      manual_activation_by: 'superadmin',
                      manual_activation_at: new Date().toISOString(),
                      manual_activation_reason: 'SuperAdmin override - no payment confirmation',
                    },
                  })
                  .eq('id', subscription.id);

                if (error) throw error;

                track('subscription_manually_activated', {
                  subscription_id: subscription.id,
                  school_id: subscription.school_id,
                  original_status: subscription.status,
                  reason: 'superadmin_override',
                });

                Alert.alert('Success', 'Subscription activated manually. This action has been logged.');
                await fetchData();
              } catch (e: any) {
                console.error('Failed to manually activate subscription:', e);
                Alert.alert('Error', e.message || 'Failed to activate subscription');
              }
            },
          },
        ]
      );
    },
    [fetchData]
  );

  const deleteSubscription = useCallback(
    (id: string, schoolName: string) => {
      Alert.alert(
        'Confirm Delete',
        `Are you sure you want to delete the subscription for ${schoolName}? This action cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                const { error } = await assertSupabase().from('subscriptions').delete().eq('id', id);

                if (error) throw error;

                track('subscription_deleted_by_admin', { subscription_id: id });
                Alert.alert('Success', 'Subscription deleted');
                await fetchData();
              } catch (e: any) {
                console.error('Failed to delete subscription:', e);
                Alert.alert('Error', e.message || 'Failed to delete subscription');
              }
            },
          },
        ]
      );
    },
    [fetchData]
  );

  const openPlanChangeModal = useCallback((subscription: Subscription) => {
    setSelectedSubscriptionForChange(subscription);
    setSelectedSchoolForChange(subscription.school || null);
    setShowPlanChangeModal(true);
  }, []);

  const closePlanChangeModal = useCallback(() => {
    setShowPlanChangeModal(false);
    setSelectedSubscriptionForChange(null);
    setSelectedSchoolForChange(null);
  }, []);

  const handlePlanChangeSuccess = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  const availableSchools = useMemo(
    () => schools.filter((school) => !subscriptions.some((sub) => sub.school_id === school.id && sub.status === 'active')),
    [schools, subscriptions]
  );

  return {
    // State
    loading,
    refreshing,
    subscriptions,
    schools,
    plans,
    filter,
    showCreateModal,
    creating,
    createForm,
    showPlanChangeModal,
    selectedSubscriptionForChange,
    selectedSchoolForChange,
    // Computed
    availableSchools,
    // Actions
    fetchData,
    onRefresh,
    updateSubscriptionStatus,
    createSubscription,
    deleteSubscription,
    handleManualActivation,
    openPlanChangeModal,
    closePlanChangeModal,
    handlePlanChangeSuccess,
    setFilter,
    setShowCreateModal,
    setCreateForm,
  };
}
