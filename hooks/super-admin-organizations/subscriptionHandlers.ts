import { assertSupabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import { normalizeTierName, VALID_ORGANIZATION_TIERS } from '@/lib/tiers';
import { logger } from '@/lib/logger';
import {
  getEntityMeta,
  formatTierLabel,
  formatStatusLabel,
} from '@/lib/screen-styles/super-admin-organizations.styles';
import type { Organization } from '@/lib/screen-styles/super-admin-organizations.styles';
import type { ShowAlertFn } from './types';

/** Deps injected by the orchestrator hook */
export interface SubscriptionDeps {
  showAlert: ShowAlertFn;
  loadOrganizations: () => Promise<void>;
  setUpdatingSubscription: (v: boolean) => void;
}

/** Update an organization's subscription tier + status via RPC */
export async function updateEntitySubscription(
  org: Organization,
  nextTier: string,
  nextStatus: string,
  deps: SubscriptionDeps
): Promise<void> {
  const { showAlert, loadOrganizations, setUpdatingSubscription } = deps;
  const { entityType, actualId } = getEntityMeta(org);
  setUpdatingSubscription(true);
  try {
    const { data, error } = await assertSupabase().rpc(
      'superadmin_update_entity_subscription',
      {
        p_entity_type: entityType,
        p_entity_id: actualId,
        p_subscription_tier: nextTier,
        p_subscription_status: nextStatus,
        p_subscription_plan_id: org.subscription_plan_id || null,
      }
    );
    if (error) throw error;
    if (!data) throw new Error('Update failed');

    track('superadmin_subscription_updated', {
      org_id: actualId,
      org_type: entityType,
      subscription_tier: nextTier,
      subscription_status: nextStatus,
    });
    showAlert({ title: 'Success', message: 'Subscription updated successfully' });
    await loadOrganizations();
  } catch (error: any) {
    logger.error('Failed to update subscription:', error);
    showAlert({ title: 'Error', message: error?.message || 'Failed to update subscription' });
  } finally {
    setUpdatingSubscription(false);
  }
}

/** Show tier picker alert and trigger update */
export function openTierPicker(
  org: Organization,
  deps: SubscriptionDeps
): void {
  const currentStatus = org.subscription_status || 'active';
  deps.showAlert({
    title: 'Select Subscription Tier',
    message: `Choose a tier for ${org.name}:`,
    buttons: [
      ...VALID_ORGANIZATION_TIERS.map(tier => ({
        text: formatTierLabel(tier),
        onPress: () => updateEntitySubscription(org, tier, currentStatus, deps),
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ],
  });
}

/** Show status picker alert and trigger update */
export function openStatusPicker(
  org: Organization,
  deps: SubscriptionDeps
): void {
  const currentTier = normalizeTierName(org.subscription_tier || 'free');
  const statuses = ['active', 'pending', 'trialing', 'past_due', 'suspended', 'canceled'];
  deps.showAlert({
    title: 'Select Subscription Status',
    message: `Set status for ${org.name}:`,
    buttons: [
      ...statuses.map(status => ({
        text: formatStatusLabel(status),
        onPress: () => updateEntitySubscription(org, currentTier, status, deps),
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ],
  });
}
