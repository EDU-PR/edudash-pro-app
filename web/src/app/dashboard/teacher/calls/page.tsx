'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Filter, Loader2, Phone } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { TeacherShell } from '@/components/dashboard/teacher/TeacherShell';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { QuickCallModal, useCall } from '@/components/calls';
import { CallHistoryItem } from '@/components/dashboard/teacher/calls/CallHistoryItem';
import type { CallRecord, CallStatus, CallType, FilterType, ProfileMini, RawCallRow } from '@/components/dashboard/teacher/calls/types';
import { getHiddenCallIds, hideCallIds, isMissed } from '@/components/dashboard/teacher/calls/types';

export default function TeacherCallsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [userId, setUserId] = useState<string>();
  const [authLoading, setAuthLoading] = useState(true);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loadingCalls, setLoadingCalls] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showQuickCall, setShowQuickCall] = useState(false);

  const { profile, loading: profileLoading } = useUserProfile(userId);
  const { slug: tenantSlug } = useTenantSlug(userId);
  const { startVoiceCall, startVideoCall } = useCall();

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/sign-in');
        return;
      }
      setUserId(user.id);
      setAuthLoading(false);
    };
    void init();
  }, [router, supabase]);

  const loadCalls = useCallback(async () => {
    if (!userId) return;
    setLoadingCalls(true);
    setErrorMessage(null);
    try {
      const { data, error } = await supabase
        .from('active_calls')
        .select('id, caller_id, callee_id, call_type, status, started_at, ended_at, duration_seconds')
        .or(`caller_id.eq.${userId},callee_id.eq.${userId}`)
        .order('started_at', { ascending: false })
        .limit(80);

      if (error) throw error;

      const rows = (data || []) as RawCallRow[];

      // Fetch profiles separately (active_calls has no FK to profiles)
      const peerIds = [...new Set(
        rows.flatMap((row) => [row.caller_id, row.callee_id]).filter(Boolean),
      )];

      const profileMap = new Map<string, ProfileMini>();
      if (peerIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, avatar_url')
          .in('id', peerIds);

        (profileData || []).forEach((row: { id: string; first_name: string | null; last_name: string | null; avatar_url?: string | null }) => {
          profileMap.set(row.id, { first_name: row.first_name, last_name: row.last_name, avatar_url: row.avatar_url });
        });
      }

      // Filter out locally hidden calls
      const hiddenIds = getHiddenCallIds();

      const mapped = rows
        .filter((row) => !hiddenIds.has(row.id))
        .map((row): CallRecord => {
          const callType: CallType = row.call_type === 'video' ? 'video' : 'voice';
          const direction: CallDirection = row.caller_id === userId ? 'outgoing' : 'incoming';
          const status = String(row.status || 'completed');
          const normalizedStatus: CallStatus =
            status === 'missed' ||
            status === 'declined' ||
            status === 'no_answer' ||
            status === 'ringing' ||
            status === 'connected' ||
            status === 'ended' ||
            status === 'rejected' ||
            status === 'busy'
              ? status
              : 'completed';

          return {
            id: row.id,
            caller_id: row.caller_id,
            callee_id: row.callee_id,
            call_type: callType,
            direction,
            status: normalizedStatus,
            started_at: row.started_at,
            ended_at: row.ended_at,
            duration_seconds: row.duration_seconds,
            caller_profile: profileMap.get(row.caller_id) || null,
            callee_profile: profileMap.get(row.callee_id) || null,
          };
        });
      setCalls(mapped);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load call history';
      setErrorMessage(message);
    } finally {
      setLoadingCalls(false);
    }
  }, [userId, supabase]);

  useEffect(() => {
    void loadCalls();
  }, [loadCalls]);

  const filteredCalls = useMemo(() => {
    if (filter === 'all') return calls;
    if (filter === 'missed') return calls.filter((call) => isMissed(call.status));
    if (filter === 'incoming') return calls.filter((call) => call.direction === 'incoming');
    if (filter === 'outgoing') return calls.filter((call) => call.direction === 'outgoing');
    if (filter === 'video') return calls.filter((call) => call.call_type === 'video');
    if (filter === 'voice') return calls.filter((call) => call.call_type === 'voice');
    return calls;
  }, [calls, filter]);

  const counts = useMemo(() => ({
    all: calls.length,
    missed: calls.filter((call) => isMissed(call.status)).length,
    incoming: calls.filter((call) => call.direction === 'incoming').length,
    outgoing: calls.filter((call) => call.direction === 'outgoing').length,
    video: calls.filter((call) => call.call_type === 'video').length,
    voice: calls.filter((call) => call.call_type === 'voice').length,
  }), [calls]);

  const handleClearHistory = useCallback(() => {
    if (!userId || calls.length === 0) return;
    const confirmed = confirm('Hide your call history? Records are kept for the other party.');
    if (!confirmed) return;

    const ids = calls.map((call) => call.id);
    hideCallIds(ids);
    setCalls([]);
  }, [calls, userId]);

  const loading = authLoading || profileLoading;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  const filterButtons: { key: FilterType; label: string; color: string }[] = [
    { key: 'all', label: 'All', color: 'var(--primary)' },
    { key: 'missed', label: 'Missed', color: '#ef4444' },
    { key: 'incoming', label: 'Incoming', color: '#10b981' },
    { key: 'outgoing', label: 'Outgoing', color: '#3b82f6' },
    { key: 'video', label: 'Video', color: '#8b5cf6' },
    { key: 'voice', label: 'Voice', color: '#22c55e' },
  ];

  return (
    <TeacherShell
      tenantSlug={tenantSlug}
      userEmail={profile?.email}
      userName={profile?.firstName}
      preschoolName={profile?.preschoolName}
      userId={userId}
      hideHeader={true}
    >
      <div className="container">
        <div className="section">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="h1">Calls</h1>
              <p className="muted">Review call history and start new calls with parents and staff.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowQuickCall(true)}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}
              >
                New Call
              </button>
              {calls.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  className="px-4 py-2 rounded-lg text-sm font-semibold border border-red-500/40 text-red-300 hover:bg-red-900/20"
                >
                  Hide History
                </button>
              )}
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="section">
            <div className="card p-md border border-red-500/40 bg-red-950/20 text-red-200 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          </div>
        )}

        <div className="section">
          <div className="card p-md">
            <div className="flex gap-2 flex-wrap mb-4 items-center">
              <Filter className="w-4 h-4 text-gray-400" />
              {filterButtons.map((btn) => (
                <button
                  key={btn.key}
                  onClick={() => setFilter(btn.key)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                  style={{
                    background: filter === btn.key ? btn.color : 'rgba(148, 163, 184, 0.12)',
                    color: filter === btn.key ? '#fff' : '#cbd5e1',
                  }}
                >
                  {btn.label} ({counts[btn.key]})
                </button>
              ))}
            </div>

            {loadingCalls ? (
              <div className="text-sm text-gray-400 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading call history...
              </div>
            ) : filteredCalls.length === 0 ? (
              <div className="text-center py-14">
                <Phone className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-white mb-1">No calls found</h3>
                <p className="text-sm text-gray-400">
                  {filter === 'all'
                    ? 'Your teacher call history will appear here.'
                    : `No ${filter} calls found.`}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredCalls.map((call) => (
                  <CallHistoryItem
                    key={call.id}
                    call={call}
                    onVoiceCall={startVoiceCall}
                    onVideoCall={startVideoCall}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <QuickCallModal
        isOpen={showQuickCall}
        onClose={() => setShowQuickCall(false)}
        onVoiceCall={(targetId, targetName) => startVoiceCall(targetId, targetName)}
        onVideoCall={(targetId, targetName) => startVideoCall(targetId, targetName)}
        currentUserId={userId}
        preschoolId={profile?.preschoolId}
      />
    </TeacherShell>
  );
}
