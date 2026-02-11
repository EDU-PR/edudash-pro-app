/**
 * useStableProfile — Extracts primitive values from the AuthContext profile
 * object so that downstream effects/callbacks only re-fire when actual values
 * change, not when the profile object reference changes.
 *
 * This is the #1 fix for the "[DashProfile] Updated user context" firing 6×.
 *
 * @module hooks/dash-assistant/useStableProfile
 * @max-lines 80
 */

import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export interface StableProfile {
  userId: string | undefined;
  role: string;
  email: string | undefined;
  fullName: string | undefined;
  firstName: string | undefined;
  dateOfBirth: string | undefined;
  organizationId: string | undefined;
  preschoolId: string | undefined;
  schoolType: string | undefined;
  organizationType: string | undefined;
  memberType: string | undefined;
  usageType: string | undefined;
  preferredLanguage: string | undefined;
  subscriptionTier: string | undefined;
}

/**
 * Returns a stable object whose identity only changes when one of the
 * extracted primitive values changes. Safe to use in effect dependency
 * arrays without causing cascading re-runs.
 */
export function useStableProfile(): StableProfile {
  const { user, profile } = useAuth();
  const profileAny = profile as any;

  const userId = user?.id;
  const role = (profile?.role || '').toLowerCase();
  const email = profile?.email;
  const fullName = profile?.full_name;
  const firstName = profile?.first_name;
  const dateOfBirth = profile?.date_of_birth;
  const organizationId = profile?.organization_id || profile?.preschool_id;
  const preschoolId = profile?.preschool_id;
  const schoolType =
    profileAny?.organization_membership?.school_type ||
    profileAny?.school_type ||
    undefined;
  const organizationType = profileAny?.organization_type || undefined;
  const memberType = profileAny?.organization_membership?.member_type || undefined;
  const usageType = profileAny?.usage_type || undefined;
  const preferredLanguage = profileAny?.preferred_language || undefined;
  const subscriptionTier = profileAny?.subscription_tier || undefined;

  return useMemo<StableProfile>(
    () => ({
      userId,
      role,
      email,
      fullName,
      firstName,
      dateOfBirth,
      organizationId,
      preschoolId,
      schoolType,
      organizationType,
      memberType,
      usageType,
      preferredLanguage,
      subscriptionTier,
    }),
    [
      userId,
      role,
      email,
      fullName,
      firstName,
      dateOfBirth,
      organizationId,
      preschoolId,
      schoolType,
      organizationType,
      memberType,
      usageType,
      preferredLanguage,
      subscriptionTier,
    ],
  );
}
