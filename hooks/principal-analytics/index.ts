/**
 * usePrincipalAnalytics — thin orchestrator hook.
 * Re-exports types and helpers for consumer convenience.
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { fetchPrincipalAnalytics } from './fetchAnalyticsData';
import type { AnalyticsData } from './types';

export type {
  AnalyticsData,
  EnrollmentData,
  AttendanceData,
  FinanceData,
  StaffData,
  AcademicData,
} from './types';
export { formatCurrency, getStatusColor } from './types';

export function usePrincipalAnalytics() {
  const { user, profile } = useAuth();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = useCallback(async () => {
    if (!user || !supabase) { setLoading(false); return; }
    try {
      const schoolId = (profile as any)?.preschool_id || (profile as any)?.organization_id;
      if (!schoolId) { setError('No school associated with this account'); setLoading(false); return; }

      const { data: school } = await supabase
        .from('preschools').select('id, name').eq('id', schoolId).maybeSingle();
      if (!school) { setError('School not found'); setLoading(false); return; }

      const data = await fetchPrincipalAnalytics(school.id);
      setAnalytics(data);
      setError(null);
    } catch (err) {
      console.error('Error loading analytics:', err);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, profile]);

  useEffect(() => { loadAnalytics(); }, [loadAnalytics]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await loadAnalytics();
  }, [loadAnalytics]);

  return { analytics, loading, refreshing, error, refresh };
}
