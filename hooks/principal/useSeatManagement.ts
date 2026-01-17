// Custom hook for seat management - WARP.md compliant (≤200 lines)

import { useCallback, useEffect, useState } from 'react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { getEffectiveLimits } from '@/lib/ai/limits';
import {
  loadSubscriptionForSchool,
  loadSchoolLabel,
  loadTeachersForSchool,
  findTeacherIdByEmail,
  startSchoolFreeTrial,
  bulkAssignTeachers,
} from '@/lib/utils/seat-management-api';
import type { Teacher, SeatManagementState, SeatManagementActions } from '@/components/principal/seats/types';

interface UseSeatManagementProps {
  effectiveSchoolId: string | null;
}

interface UseSeatManagementReturn extends SeatManagementState, SeatManagementActions {
  seats: { used: number; total: number } | null;
}

export function useSeatManagement({ effectiveSchoolId }: UseSeatManagementProps): UseSeatManagementReturn {
  const { seats, assignSeat, revokeSeat, refresh } = useSubscription();
  
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [subscriptionLoaded, setSubscriptionLoaded] = useState(false);
  const [schoolLabel, setSchoolLabel] = useState<string | null>(null);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [pendingTeacherId, setPendingTeacherId] = useState<string | null>(null);
  const [canManageAI, setCanManageAI] = useState(false);

  // Load subscription
  const loadSubscription = useCallback(async () => {
    if (!effectiveSchoolId) return;
    setLoading(true); setError(null);
    try {
      const subId = await loadSubscriptionForSchool(effectiveSchoolId);
      if (subId) setSubscriptionId(subId);
    } catch (e: any) { setError(e?.message || 'Load failed'); }
    finally { setLoading(false); setSubscriptionLoaded(true); }
  }, [effectiveSchoolId]);

  // Load teachers
  const loadTeachers = useCallback(async () => {
    if (!effectiveSchoolId) return;
    try {
      const list = await loadTeachersForSchool(effectiveSchoolId, subscriptionId);
      setTeachers(list);
    } catch (e) { console.debug('Failed to load teachers', e); }
  }, [effectiveSchoolId, subscriptionId]);

  useEffect(() => { loadSubscription(); }, [loadSubscription]);
  useEffect(() => { loadTeachers(); }, [loadTeachers]);
  useEffect(() => {
    if (!effectiveSchoolId) return;
    loadSchoolLabel(effectiveSchoolId).then(setSchoolLabel);
  }, [effectiveSchoolId]);
  useEffect(() => {
    (async () => { try { const limits = await getEffectiveLimits(); setCanManageAI(!!limits.canOrgAllocate); } catch {} })();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await loadSubscription(); await loadTeachers(); setRefreshing(false);
  }, [loadSubscription, loadTeachers]);

  const onAssign = async (email: string) => {
    if (!subscriptionId || !email) { setError('Missing subscription or email'); return; }
    setAssigning(true); setError(null); setSuccess(null);
    const userId = await findTeacherIdByEmail(email);
    if (!userId) { setError('Teacher not found by email'); setAssigning(false); return; }
    try {
      await assignSeat(subscriptionId, userId);
      setTeachers(prev => prev.map(t => t.id === userId ? { ...t, hasSeat: true } : t));
      setSuccess('Seat assigned successfully');
      await loadTeachers(); try { await refresh(); } catch {}
    } catch (err: any) { setError(err?.message || 'Failed to assign seat'); }
    finally { setAssigning(false); }
  };

  const onRevoke = async (email: string) => {
    if (!subscriptionId || !email) { setError('Missing subscription or email'); return; }
    setRevoking(true); setError(null); setSuccess(null);
    const userId = await findTeacherIdByEmail(email);
    if (!userId) { setError('Teacher not found by email'); setRevoking(false); return; }
    try {
      await revokeSeat(subscriptionId, userId);
      setTeachers(prev => prev.map(t => t.id === userId ? { ...t, hasSeat: false } : t));
      setSuccess('Seat revoked successfully');
      await loadTeachers();
    } catch (err: any) { setError(err?.message || 'Failed to revoke seat'); }
    finally { setRevoking(false); }
  };

  const onAssignTeacher = async (teacherId: string, email: string) => {
    if (!subscriptionId) { setError('No active subscription'); return; }
    setPendingTeacherId(teacherId); setError(null); setSuccess(null);
    try {
      await assignSeat(subscriptionId, teacherId);
      setTeachers(prev => prev.map(t => t.id === teacherId ? { ...t, hasSeat: true } : t));
      setSuccess(`Seat assigned to ${email}`);
      await loadTeachers(); try { await refresh(); } catch {}
    } catch (err: any) { setError(err?.message || `Failed to assign seat to ${email}`); }
    finally { setPendingTeacherId(null); }
  };

  const onRevokeTeacher = async (teacherId: string, email: string) => {
    if (!subscriptionId) { setError('No active subscription'); return; }
    setPendingTeacherId(teacherId); setError(null); setSuccess(null);
    try {
      await revokeSeat(subscriptionId, teacherId);
      setTeachers(prev => prev.map(t => t.id === teacherId ? { ...t, hasSeat: false } : t));
      setSuccess(`Seat revoked for ${email}`);
      await loadTeachers(); try { await refresh(); } catch {}
    } catch (err: any) { setError(err?.message || `Failed to revoke seat for ${email}`); }
    finally { setPendingTeacherId(null); }
  };

  const onAssignAllTeachers = async () => {
    if (!subscriptionId || !effectiveSchoolId) { setError('No active subscription'); return; }
    setAssigning(true); setError(null); setSuccess(null);
    try {
      const { assigned, skipped } = await bulkAssignTeachers(subscriptionId, effectiveSchoolId);
      setSuccess(`Assigned ${assigned} teacher(s).${skipped > 0 ? ` ${skipped} skipped.` : ''}`);
      await loadTeachers();
    } catch (e: any) { setError(e?.message || 'Bulk assignment failed'); }
    finally { setAssigning(false); }
  };

  const onStartFreeTrial = async () => {
    if (!effectiveSchoolId) return;
    setError(null); setSuccess(null);
    try {
      const newSubId = await startSchoolFreeTrial(effectiveSchoolId);
      if (newSubId) setSubscriptionId(newSubId);
      setSuccess('Free trial started. You can now assign seats.');
      await loadSubscription(); await loadTeachers();
    } catch (e: any) { setError(e?.message || 'Failed to start trial'); }
  };

  return {
    effectiveSchoolId, subscriptionId, subscriptionLoaded, schoolLabel, teachers,
    loading, refreshing, error, success, assigning, revoking, pendingTeacherId, canManageAI, seats,
    onRefresh, onAssign, onRevoke, onAssignTeacher, onRevokeTeacher, onAssignAllTeachers,
    onStartFreeTrial, setError, setSuccess,
  };
}
