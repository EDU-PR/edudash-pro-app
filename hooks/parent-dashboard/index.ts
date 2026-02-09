/** useParentDashboard — orchestrator hook */
import { useState, useEffect, useCallback, useRef } from 'react';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { logError, log } from '@/lib/debug';
import type { ParentDashboardData } from '@/types/dashboard';
import { createEmptyParentData } from '@/lib/dashboard/utils';
import { fetchParentDashboardData } from './fetchData';
export const useParentDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<ParentDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingFromCache, setIsLoadingFromCache] = useState(false);
  const childIdsRef = useRef<string[]>([]);
  const lastUserIdRef = useRef<string | null>(null);
  // Reset on user switch
  useEffect(() => {
    const next = user?.id ?? null;
    if (lastUserIdRef.current !== next) {
      setData(null); setError(null); setLoading(true); setIsLoadingFromCache(false);
      childIdsRef.current = [];
    }
    lastUserIdRef.current = next;
  }, [user?.id]);
  const fetchData = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true); setError(null);
      if (!user?.id) {
        if (!authLoading) setData(null);
        setLoading(false);
        return;
      }
      if (!forceRefresh) setIsLoadingFromCache(true);
      const result = await fetchParentDashboardData(user.id, authLoading, forceRefresh);
      setIsLoadingFromCache(false);
      if (!result) { setLoading(false); return; }
      if (result.fromCache) { setData(result.data); setLoading(false); return; }
      setData(result.data);
    } catch (err) {
      logError('Failed to fetch parent dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      setData(createEmptyParentData());
    } finally {
      setLoading(false); setIsLoadingFromCache(false);
    }
  }, [user?.id, authLoading]);
  // Mount
  useEffect(() => {
    if (!authLoading && user?.id) fetchData();
    else if (!authLoading && !user) { setData(null); setLoading(false); setError(null); }
  }, [fetchData, authLoading, user]);
  // Realtime attendance
  useEffect(() => {
    if (!user?.id || childIdsRef.current.length === 0) return;
    const supabase = assertSupabase();
    const ids = childIdsRef.current;
    const channel = supabase
      .channel(`parent-dashboard-attendance-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, (payload) => {
        const sid = (payload.new as any)?.student_id || (payload.old as any)?.student_id;
        if (ids.includes(sid)) {
          log('[ParentDashboard] Attendance updated for child:', sid);
          fetchData(true);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, fetchData]);
  // Sync childIdsRef
  useEffect(() => {
    if (data?.children) childIdsRef.current = data.children.map(c => c.id);
  }, [data?.children]);
  const refresh = useCallback(() => fetchData(true), [fetchData]);
  return { data, loading, error, refresh, isLoadingFromCache };
};
