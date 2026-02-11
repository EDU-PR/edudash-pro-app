'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2, RefreshCcw, Star } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { TeacherShell } from '@/components/dashboard/teacher/TeacherShell';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { ReputationRatingSummary } from '@/components/dashboard/teacher/reputation/ReputationRatingSummary';
import { HiringProfileForm } from '@/components/dashboard/teacher/reputation/HiringProfileForm';
import { ReferencesList } from '@/components/dashboard/teacher/reputation/ReferencesList';
import type {
  CandidateProfileRow,
  ProfileBasicsRow,
  RatingSummaryRow,
  ReferenceViewModel,
  TeacherReferenceRow,
} from '@/components/dashboard/teacher/reputation/types';
import { STAFF_ROLES, toNumber } from '@/components/dashboard/teacher/reputation/types';

export default function TeacherReputationPage() {
  const router = useRouter();
  const supabase = createClient();
  const [userId, setUserId] = useState<string>();
  const [authLoading, setAuthLoading] = useState(true);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [candidateProfile, setCandidateProfile] = useState<CandidateProfileRow | null>(null);
  const [summary, setSummary] = useState<RatingSummaryRow | null>(null);
  const [references, setReferences] = useState<ReferenceViewModel[]>([]);

  const { profile, loading: profileLoading } = useUserProfile(userId);
  const { slug: tenantSlug } = useTenantSlug(userId);

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

  const role = String(profile?.role || '').toLowerCase();
  const isStaff = STAFF_ROLES.includes(role);

  const ensureCandidateProfile = useCallback(async (targetUserId: string): Promise<CandidateProfileRow> => {
    const { data: existing, error: existingError } = await supabase
      .from('candidate_profiles')
      .select('*')
      .eq('user_id', targetUserId)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing) return existing as CandidateProfileRow;

    const { data: basics, error: basicsError } = await supabase
      .from('profiles')
      .select('first_name, last_name, email')
      .eq('id', targetUserId)
      .maybeSingle();
    if (basicsError) throw basicsError;

    const { data: authData } = await supabase.auth.getUser();
    const authEmail = authData?.user?.email || '';
    const typedBasics = (basics || {}) as ProfileBasicsRow;

    const payload = {
      user_id: targetUserId,
      email: typedBasics.email || authEmail || '',
      first_name: typedBasics.first_name || '',
      last_name: typedBasics.last_name || '',
      is_public: false,
      location_city: null,
      location_province: null,
      location_lat: null,
      location_lng: null,
      location_source: null,
      preferred_radius_km: 25,
      location_updated_at: null,
      location: null,
      preferred_location_lat: null,
      preferred_location_lng: null,
      willing_to_commute_km: 25,
    };

    const { data: inserted, error: insertError } = await supabase
      .from('candidate_profiles')
      .insert(payload)
      .select('*')
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        const { data: afterConflict, error: conflictFetchError } = await supabase
          .from('candidate_profiles')
          .select('*')
          .eq('user_id', targetUserId)
          .single();
        if (conflictFetchError) throw conflictFetchError;
        return afterConflict as CandidateProfileRow;
      }
      throw insertError;
    }

    return inserted as CandidateProfileRow;
  }, [supabase]);

  const loadData = useCallback(async () => {
    if (!userId) return;
    if (!isStaff) {
      setErrorMessage('This page is available to teachers and school admins only.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      const profileRow = await ensureCandidateProfile(userId);
      setCandidateProfile(profileRow);

      const { data: summaryData, error: summaryError } = await supabase
        .from('teacher_rating_summary')
        .select('*')
        .eq('candidate_profile_id', profileRow.id)
        .maybeSingle();
      if (summaryError) throw summaryError;
      const typedSummary = (summaryData || null) as RatingSummaryRow | null;
      setSummary(
        typedSummary
          ? {
            ...typedSummary,
            rating_count: toNumber(typedSummary.rating_count),
            avg_rating: toNumber(typedSummary.avg_rating),
            avg_communication: toNumber(typedSummary.avg_communication),
            avg_classroom: toNumber(typedSummary.avg_classroom),
            avg_planning: toNumber(typedSummary.avg_planning),
            avg_professionalism: toNumber(typedSummary.avg_professionalism),
            avg_parent_engagement: toNumber(typedSummary.avg_parent_engagement),
            avg_reliability: toNumber(typedSummary.avg_reliability),
          }
          : null,
      );

      const { data: referenceData, error: referencesError } = await supabase
        .from('teacher_references')
        .select(`
          id,
          candidate_profile_id,
          teacher_user_id,
          organization_id,
          principal_id,
          rating_overall,
          rating_communication,
          rating_classroom,
          rating_planning,
          rating_professionalism,
          rating_parent_engagement,
          rating_reliability,
          title,
          comment,
          is_anonymous,
          created_at
        `)
        .eq('candidate_profile_id', profileRow.id)
        .order('created_at', { ascending: false });
      if (referencesError) throw referencesError;

      const referenceRows = (referenceData || []) as TeacherReferenceRow[];

      const organizationIds = [...new Set(referenceRows.map((row) => row.organization_id).filter(Boolean))];
      const principalIds = [...new Set(referenceRows.map((row) => row.principal_id).filter(Boolean))];

      const schoolNameMap = new Map<string, string>();
      if (organizationIds.length > 0) {
        const [{ data: preschoolRows }, { data: organizationRows }] = await Promise.all([
          supabase
            .from('preschools')
            .select('id, name')
            .in('id', organizationIds),
          supabase
            .from('organizations')
            .select('id, name')
            .in('id', organizationIds),
        ]);

        (preschoolRows || []).forEach((row: { id: string; name: string | null }) => {
          if (row.id) schoolNameMap.set(row.id, row.name || 'School');
        });
        (organizationRows || []).forEach((row: { id: string; name: string | null }) => {
          if (row.id && !schoolNameMap.has(row.id)) {
            schoolNameMap.set(row.id, row.name || 'School');
          }
        });
      }

      const principalNameMap = new Map<string, string>();
      if (principalIds.length > 0) {
        const { data: principalRows } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', principalIds);

        (principalRows || []).forEach((row: { id: string; first_name: string | null; last_name: string | null }) => {
          const fullName = `${row.first_name || ''} ${row.last_name || ''}`.trim();
          principalNameMap.set(row.id, fullName || 'Principal');
        });
      }

      const mappedReferences: ReferenceViewModel[] = referenceRows.map((row) => ({
        ...row,
        school_name: schoolNameMap.get(row.organization_id) || 'School',
        principal_name: row.is_anonymous ? null : (principalNameMap.get(row.principal_id) || null),
      }));
      setReferences(mappedReferences);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load teacher reputation.';
      setErrorMessage(message);
      setCandidateProfile(null);
      setSummary(null);
      setReferences([]);
    } finally {
      setLoading(false);
    }
  }, [ensureCandidateProfile, isStaff, supabase, userId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

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
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl" style={{ background: 'linear-gradient(135deg, #f59e0b, #ec4899)' }}>
                <Star className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="h1">My Reputation</h1>
                <p className="muted">Review your references and manage your hiring visibility profile.</p>
              </div>
            </div>

            <button
              onClick={() => void loadData()}
              disabled={loading}
              className="px-4 py-2 rounded-lg text-sm font-semibold border border-slate-600 text-slate-200 hover:bg-slate-800/60 disabled:opacity-50 inline-flex items-center gap-2"
            >
              <RefreshCcw className="w-4 h-4" />
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
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

        {loading ? (
          <div className="section">
            <div className="card p-md text-sm text-gray-400 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading reputation details...
            </div>
          </div>
        ) : (
          <>
            <ReputationRatingSummary summary={summary} />

            {candidateProfile && (
              <HiringProfileForm
                candidateProfile={candidateProfile}
                onSaved={(updated) => setCandidateProfile(updated)}
                onError={(message) => setErrorMessage(message)}
              />
            )}

            <ReferencesList references={references} />
          </>
        )}
      </div>
    </TeacherShell>
  );
}
