/** Standalone async functions for feature-flag CRUD operations. */

import { assertSupabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import { logger } from '@/lib/logger';
import { writeSuperAdminAudit } from '@/lib/audit/superAdminAudit';
import type { FeatureFlag, FeatureFlagForm } from '@/lib/screen-styles/super-admin-feature-flags.styles';
import type { FetchFlagsResult } from './types';

// ─── Mock Data (fallback when table doesn't exist) ────────────────────

export function buildMockFlags(creatorId: string): FeatureFlag[] {
  const now = new Date().toISOString();
  const base = { target_schools: [] as string[], created_at: now, updated_at: now, created_by: creatorId, updated_by: creatorId };

  return [
    {
      id: '1', name: 'AI Lesson Generation', key: 'ai_lesson_generation',
      description: 'Enables AI-powered lesson generation for teachers',
      is_enabled: true, rollout_percentage: 100,
      target_roles: ['teacher', 'principal'], environment: 'production', ...base,
    },
    {
      id: '2', name: 'Advanced Analytics', key: 'advanced_analytics',
      description: 'Enhanced analytics and reporting features',
      is_enabled: false, rollout_percentage: 50,
      target_roles: ['principal'], environment: 'staging', ...base,
    },
    {
      id: '3', name: 'Mobile Push Notifications', key: 'mobile_push_notifications',
      description: 'Real-time push notifications for mobile users',
      is_enabled: true, rollout_percentage: 75,
      target_roles: ['all'], environment: 'production', ...base,
    },
  ];
}

// ─── Fetch ────────────────────────────────────────────────────────────

export async function fetchFlags(): Promise<FetchFlagsResult> {
  const { data, error } = await assertSupabase()
    .from('feature_flags')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('Feature flags fetch error:', error);
    if (error.code === '42P01') return { data: null, error: true, useMock: true };
    return { data: null, error: true };
  }
  return { data, error: false };
}

// ─── Toggle ───────────────────────────────────────────────────────────

export async function toggleFlagInDb(
  flagId: string, newStatus: boolean, profileId: string,
): Promise<void> {
  const { error } = await assertSupabase()
    .from('feature_flags')
    .update({ is_enabled: newStatus, updated_at: new Date().toISOString(), updated_by: profileId })
    .eq('id', flagId);
  if (error) logger.warn('Database update failed:', error);
}

// ─── Create ───────────────────────────────────────────────────────────

export async function createFlagInDb(
  formData: FeatureFlagForm, profileId: string,
): Promise<void> {
  const { error } = await assertSupabase()
    .from('feature_flags')
    .insert([{
      name: formData.name, key: formData.key,
      description: formData.description, is_enabled: formData.is_enabled,
      rollout_percentage: formData.rollout_percentage,
      target_roles: formData.target_roles, target_schools: [],
      environment: formData.environment,
      created_by: profileId, updated_by: profileId,
    }]);
  if (error) logger.warn('Database insert failed:', error);
}

// ─── Update ───────────────────────────────────────────────────────────

export async function updateFlagInDb(
  flagId: string, formData: FeatureFlagForm, profileId: string,
): Promise<void> {
  const { error } = await assertSupabase()
    .from('feature_flags')
    .update({
      name: formData.name, description: formData.description,
      is_enabled: formData.is_enabled, rollout_percentage: formData.rollout_percentage,
      target_roles: formData.target_roles, environment: formData.environment,
      updated_at: new Date().toISOString(), updated_by: profileId,
    })
    .eq('id', flagId);
  if (error) logger.warn('Database update failed:', error);
}

// ─── Delete ───────────────────────────────────────────────────────────

export async function deleteFlagFromDb(flagId: string): Promise<void> {
  const { error } = await assertSupabase()
    .from('feature_flags')
    .delete()
    .eq('id', flagId);
  if (error) logger.warn('Database delete failed:', error);
}

// ─── Audit + Tracking ────────────────────────────────────────────────

export async function logAuditAction(
  profileId: string, action: string, details: Record<string, unknown>,
): Promise<void> {
  await writeSuperAdminAudit({
    actorProfileId: profileId,
    action,
    description: action.replace(/_/g, ' '),
    metadata: details,
  });
}

export function trackFlagEvent(
  event: string, data: Record<string, unknown>,
): void {
  track(event, data);
}
