import { useState, useEffect, useCallback } from 'react';
import { Platform, Vibration } from 'react-native';
import { assertSupabase } from '@/lib/supabase';
import { adminUpdateSubscriptionPlan, listActivePlans, type SubscriptionPlan } from '@/lib/subscriptions/rpc-subscriptions';
import { track } from '@/lib/analytics';
import { validateTierAssignment, ORGANIZATION_MIN_MONTHLY_PRICE, isValidOrganizationTier } from '@/lib/tiers';
import { logger } from '@/lib/logger';
import type { AlertButton } from '@/components/ui/AlertModal';

import type { PlanChangeSubscription, PlanChangeSchool, ButtonState } from './usePlanChange.types';
import { sortPlansByTier, getPlanPrice } from './usePlanChange.types';

interface UsePlanChangeOptions {
  subscription: PlanChangeSubscription | null;
  school: PlanChangeSchool | null;
  visible: boolean;
  onSuccess: () => void;
  onClose: () => void;
  showAlert: (opts: {
    title: string;
    message: string;
    type?: 'info' | 'warning' | 'success' | 'error';
    buttons?: AlertButton[];
  }) => void;
}

export function usePlanChange({ subscription, school, visible, onSuccess, onClose, showAlert }: UsePlanChangeOptions) {
  const [loading, setLoading] = useState(false);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [buttonState, setButtonState] = useState<ButtonState>('default');
  const [buttonMessage, setButtonMessage] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [billingFrequency, setBillingFrequency] = useState<'monthly' | 'annual'>('monthly');
  const [seatsTotal, setSeatsTotal] = useState('1');
  const [reason, setReason] = useState('');

  // Reset form when subscription/visibility changes
  useEffect(() => {
    if (subscription && visible) {
      setSelectedPlanId(subscription.plan_id);
      setBillingFrequency(subscription.billing_frequency as 'monthly' | 'annual');
      setSeatsTotal(String(subscription.seats_total));
      setReason('');
      setButtonState('default');
      setButtonMessage('');
      track('sa_subs_upgrade_modal_opened', { subscription_id: subscription.id, school_id: subscription.school_id });
    }
    if (!visible) { setButtonState('default'); setButtonMessage(''); }
  }, [subscription, visible]);

  // Fetch plans when modal opens
  useEffect(() => { if (visible) fetchPlans(); }, [visible]);

  const fetchPlans = useCallback(async () => {
    try {
      setPlansLoading(true);
      const data = await listActivePlans(assertSupabase());
      const orgPlans = data.filter(p => {
        const t = (p.tier || '').toLowerCase();
        return t === 'free' || t.startsWith('school_') || isValidOrganizationTier(p.tier);
      });
      setPlans(sortPlansByTier(orgPlans));
    } catch (error: any) {
      logger.error('Failed to fetch plans:', error);
      showAlert({ title: 'Error', message: 'Failed to load subscription plans' });
    } finally {
      setPlansLoading(false);
    }
  }, [showAlert]);

  const getCurrentPlan = useCallback(() => {
    return plans.find(p => p.id === subscription?.plan_id || p.tier === subscription?.plan_id);
  }, [plans, subscription]);

  const getSelectedPlan = useCallback(() => {
    return plans.find(p => p.id === selectedPlanId || p.tier === selectedPlanId);
  }, [plans, selectedPlanId]);

  const isPaymentRequired = useCallback(() => {
    const cur = getCurrentPlan();
    const sel = getSelectedPlan();
    if (!cur || !sel) return false;
    const curPrice = getPlanPrice(cur, billingFrequency);
    const newPrice = getPlanPrice(sel, billingFrequency);
    return newPrice > 0 || (curPrice > 0 && newPrice !== curPrice);
  }, [getCurrentPlan, getSelectedPlan, billingFrequency]);

  const vibratePattern = (pattern: number[]) => {
    if (Platform.OS !== 'web') {
      try { Vibration.vibrate(pattern); } catch { /* no-op */ }
    }
  };

  const handlePlanSelect = useCallback((plan: SubscriptionPlan) => {
    const old = getCurrentPlan();
    setSelectedPlanId(plan.id);
    setSeatsTotal(String(plan.max_teachers || 1));
    track('sa_subs_upgrade_plan_selected', {
      subscription_id: subscription?.id, old_plan: old?.tier || old?.id,
      new_plan: plan.tier || plan.id, freq: billingFrequency,
    });
  }, [getCurrentPlan, subscription, billingFrequency]);

  const handleDirectUpdate = useCallback(async () => {
    if (!subscription) return;
    try {
      setLoading(true); setButtonState('default');
      await adminUpdateSubscriptionPlan(assertSupabase(), {
        subscriptionId: subscription.id, newPlanId: selectedPlanId, billingFrequency,
        seatsTotal: parseInt(seatsTotal) || 1, reason: reason || 'Plan changed by SuperAdmin',
        metadata: { changed_via: 'superadmin_dashboard', payment_required: false },
      });
      track('sa_subs_upgrade_succeeded', { subscription_id: subscription.id, new_plan: selectedPlanId, freq: billingFrequency });
      setButtonState('success'); setButtonMessage('Plan updated successfully!');
      vibratePattern([100, 50, 100]);
      setTimeout(() => { onSuccess(); onClose(); }, 2000);
    } catch (error: any) {
      logger.error('Failed to update subscription:', error);
      track('sa_subs_upgrade_failed', { subscription_id: subscription.id, error: error.message });
      setButtonState('error'); setButtonMessage(error.message || 'Failed to update subscription');
      vibratePattern([200, 100, 200]);
      setTimeout(() => { setButtonState('default'); setButtonMessage(''); }, 4000);
    } finally { setLoading(false); }
  }, [subscription, selectedPlanId, billingFrequency, seatsTotal, reason, onSuccess, onClose]);

  const handlePaymentFlow = useCallback(async () => {
    if (!subscription || !school) return;
    try {
      setLoading(true); setButtonState('default');
      const newPlan = getSelectedPlan();
      const amount = getPlanPrice(newPlan, billingFrequency);
      track('sa_subs_upgrade_payment_notification_sent', { subscription_id: subscription.id, plan: selectedPlanId, freq: billingFrequency, school_id: school.id });
      await adminUpdateSubscriptionPlan(assertSupabase(), {
        subscriptionId: subscription.id, newPlanId: selectedPlanId, billingFrequency,
        seatsTotal: parseInt(seatsTotal) || 1, reason: reason || 'Plan change by SuperAdmin - requires payment confirmation',
        metadata: { changed_via: 'superadmin_dashboard', payment_required: true, previous_status: subscription.status, payment_amount: amount },
      });
      try {
        const { notifyPaymentRequired } = await import('@/lib/notify');
        await notifyPaymentRequired(school.id, subscription.id, selectedPlanId, amount);
      } catch (notifyErr) { logger.warn('Failed to send payment notification:', notifyErr); }
      setButtonState('success'); setButtonMessage('✅ School notified to complete payment');
      vibratePattern([100, 50, 100]);
      track('sa_subs_upgrade_notification_sent', { subscription_id: subscription.id, new_plan: selectedPlanId, freq: billingFrequency, amount });
      setTimeout(() => { onSuccess(); onClose(); }, 2500);
    } catch (error: any) {
      logger.error('Payment notification error:', error);
      track('sa_subs_upgrade_failed', { subscription_id: subscription.id, error: `Notification error: ${error.message}` });
      setButtonState('error'); setButtonMessage(error.message || 'Failed to notify school for payment');
      vibratePattern([200, 100, 200]);
      setTimeout(() => { setButtonState('default'); setButtonMessage(''); }, 4000);
    } finally { setLoading(false); }
  }, [subscription, school, getSelectedPlan, selectedPlanId, billingFrequency, seatsTotal, reason, onSuccess, onClose]);

  const handleConfirm = useCallback(async () => {
    if (!subscription || !school) return;
    const currentPlan = getCurrentPlan();
    const newPlan = getSelectedPlan();
    if (!currentPlan || !newPlan) {
      showAlert({ title: 'Error', message: 'Please select a valid plan' });
      return;
    }
    const tierValidation = validateTierAssignment(newPlan.tier, 'organization');
    if (!tierValidation.valid) {
      showAlert({
        title: 'Invalid Tier for Organization',
        message: `${tierValidation.error}\n\nSchools must use school-level tiers (minimum R${ORGANIZATION_MIN_MONTHLY_PRICE}/month).`,
      });
      return;
    }
    // Web: skip native confirm dialog
    if (Platform.OS === 'web') {
      track('sa_subs_upgrade_confirmed', { subscription_id: subscription.id, target_plan: newPlan.tier || newPlan.id, freq: billingFrequency, seats: parseInt(seatsTotal) || 1 });
      if (isPaymentRequired()) { await handlePaymentFlow(); } else { await handleDirectUpdate(); }
      return;
    }
    // Native: show confirmation via AlertModal
    const paymentNote = isPaymentRequired() ? '\n\nThis change may redirect you to PayFast for payment confirmation.' : '';
    showAlert({
      title: 'Confirm Plan Change',
      message: `Change plan for ${school.name} from "${currentPlan.name}" to "${newPlan.name}"?${paymentNote}`,
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm', onPress: async () => {
            track('sa_subs_upgrade_confirmed', { subscription_id: subscription.id, target_plan: newPlan.tier || newPlan.id, freq: billingFrequency, seats: parseInt(seatsTotal) || 1 });
            if (isPaymentRequired()) { await handlePaymentFlow(); } else { await handleDirectUpdate(); }
          },
        },
      ],
    });
  }, [subscription, school, getCurrentPlan, getSelectedPlan, billingFrequency, seatsTotal, isPaymentRequired, handlePaymentFlow, handleDirectUpdate, showAlert]);

  return {
    loading, plansLoading, plans, buttonState, buttonMessage,
    selectedPlanId, billingFrequency, seatsTotal, reason,
    setBillingFrequency, setSeatsTotal, setReason,
    getCurrentPlan, getSelectedPlan, isPaymentRequired,
    handlePlanSelect, handleConfirm,
  };
}
