/** useParentDashboardData — orchestrator for parent dashboard data */
import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '@/lib/logger';
import type { ChildCard, UrgentMetrics, UsageStats } from './types';
import { EMPTY_URGENT, EMPTY_USAGE } from './types';
import { fetchUrgentMetrics } from './fetchUrgentMetrics';
import { fetchDashboardChildren } from './fetchDashboardChildren';
export type { ChildCard, UrgentMetrics, UsageStats } from './types';
export function useParentDashboardData() {
  const { user, profile } = useAuth();
  const { t } = useTranslation();
  const [children, setChildren] = useState<any[]>([]);
  const [childrenCards, setChildrenCards] = useState<ChildCard[]>([]);
  const [activeChildId, setActiveChildId] = useState<string | null>(null);
  const [urgentMetrics, setUrgentMetrics] = useState<UrgentMetrics>(EMPTY_URGENT);
  const [usage, setUsage] = useState<UsageStats>(EMPTY_USAGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastUserIdRef = useRef<string | null>(null);
  // Reset on user switch
  useEffect(() => {
    const nextUserId = user?.id ?? null;
    if (lastUserIdRef.current !== nextUserId) {
      setChildren([]); setChildrenCards([]); setActiveChildId(null);
      setUrgentMetrics(EMPTY_URGENT); setUsage(EMPTY_USAGE);
      setError(null); setLoading(true);
      AsyncStorage.removeItem('@edudash_active_child_id').catch(() => {});
    }
    lastUserIdRef.current = nextUserId;
  }, [user?.id]);
  const loadDashboardData = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true); setError(null);
      const schoolId = (profile as any)?.preschool_id || (profile as any)?.organization_id || null;
      const result = await fetchDashboardChildren(user.id, profile?.id || null, schoolId, activeChildId, t);
      setChildren(result.children);
      setChildrenCards(result.cards);
      if (result.urgentMetrics) setUrgentMetrics(result.urgentMetrics);
      setUsage(result.usage);
      if (result.cards.length > 0 && !activeChildId) {
        const savedChildId = await AsyncStorage.getItem('@edudash_active_child_id');
        const validId = savedChildId && result.cards.find(c => c.id === savedChildId)
          ? savedChildId : result.cards[0].id;
        setActiveChildId(validId);
      }
    } catch (err) {
      logger.error('Failed to load dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, [user?.id, t, activeChildId, profile]);
  // Mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadDashboardData(); }, [user?.id, profile?.id]);
  // Persist active child + reload metrics
  useEffect(() => {
    if (!activeChildId) return;
    AsyncStorage.setItem('@edudash_active_child_id', activeChildId).catch(() => {});
    if (childrenCards.find(c => c.id === activeChildId)) {
      fetchUrgentMetrics(activeChildId).then(m => { if (m) setUrgentMetrics(m); });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChildId]);
  // Realtime: student_fees changes
  useEffect(() => {
    if (!activeChildId) return;
    const supabase = assertSupabase();
    const sub = supabase
      .channel(`parent-dashboard-fees-${activeChildId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_fees', filter: `student_id=eq.${activeChildId}` },
        () => { fetchUrgentMetrics(activeChildId).then(m => { if (m) setUrgentMetrics(m); }); })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [activeChildId]);
  return {
    children, childrenCards, activeChildId, setActiveChildId,
    urgentMetrics, setUrgentMetrics, usage,
    loading, error, setError, loadDashboardData,
  };
}
