/**
 * Principal Hub — Recent Activities Fetcher
 *
 * Queries `activity_logs` for the school and falls back to
 * synthetic entries when no logs exist.
 *
 * @module hooks/principal-hub/fetchActivities
 */

import { assertSupabase } from '@/lib/supabase';
import type { ActivitySummary } from './types';

/**
 * Load the most recent activity-log entries for a school.
 *
 * If the table is empty, returns synthetic "current status" entries
 * so the dashboard never shows a blank section.
 */
export async function fetchRecentActivities(
  preschoolId: string,
  fallback: { studentsCount: number; applicationsCount: number },
): Promise<ActivitySummary[]> {
  const supabase = assertSupabase();

  const { data: rows } = await supabase
    .from('activity_logs')
    .select('activity_type, description, created_at, user_name, organization_id')
    .eq('organization_id', preschoolId)
    .order('created_at', { ascending: false })
    .limit(8);

  // Extra client-side guard for cross-tenant leakage
  const scoped = (rows || []).filter((a: any) => a?.organization_id === preschoolId);

  if (scoped.length > 0) {
    return scoped.map((activity: any) => {
      const at = activity.activity_type;
      let type: ActivitySummary['type'] = 'enrollment';
      let icon = 'information-circle';

      if (at?.includes('student') || at?.includes('enrollment')) {
        type = 'enrollment';
        icon = 'people';
      } else if (at?.includes('application') || at?.includes('apply')) {
        type = 'application';
        icon = 'document-text';
      }

      return {
        type,
        title: activity.description || `${at} activity`,
        timestamp: activity.created_at,
        icon,
      };
    });
  }

  // Synthetic fallback
  return [
    {
      type: 'enrollment',
      title: `${fallback.studentsCount} students currently enrolled`,
      timestamp: new Date().toISOString(),
      icon: 'people',
    },
    {
      type: 'application',
      title: `${fallback.applicationsCount} pending applications`,
      timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      status: 'pending',
      icon: 'document-text',
    },
  ];
}
