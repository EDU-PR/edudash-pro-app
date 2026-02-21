'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ParentShell } from '@/components/dashboard/parent/ParentShell';
import { StationeryChecklistWidget } from '@/components/dashboard/parent/StationeryChecklistWidget';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { useChildrenData } from '@/lib/hooks/parent/useChildrenData';
import { ClipboardCheck, RefreshCw } from 'lucide-react';

export default function ParentStationeryPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [featureLoading, setFeatureLoading] = useState(false);
  const [stationeryEnabled, setStationeryEnabled] = useState(false);
  const [enabledSchoolIds, setEnabledSchoolIds] = useState<string[]>([]);

  const { profile, loading: profileLoading } = useUserProfile(userId);
  const { childrenCards, loading: childrenLoading, refetch } = useChildrenData(userId);

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
    };
    void init();
  }, [router, supabase]);

  useEffect(() => {
    let cancelled = false;
    const loadFeature = async () => {
      const schoolIds = Array.from(new Set(childrenCards.map((child) => child.preschoolId).filter(Boolean))) as string[];
      if (!schoolIds.length) {
        if (!cancelled) {
          setStationeryEnabled(false);
          setEnabledSchoolIds([]);
        }
        return;
      }

      setFeatureLoading(true);
      try {
        const [{ data: preschools }, { data: orgs }] = await Promise.all([
          supabase.from('preschools').select('id, settings').in('id', schoolIds),
          supabase.from('organizations').select('id, settings').in('id', schoolIds),
        ]);

        const ids = new Set<string>();
        [...(preschools || []), ...(orgs || [])].forEach((row: any) => {
          if (row?.settings?.features?.stationery?.enabled) {
            ids.add(String(row.id));
          }
        });

        if (!cancelled) {
          const list = Array.from(ids);
          setEnabledSchoolIds(list);
          setStationeryEnabled(list.length > 0);
        }
      } finally {
        if (!cancelled) setFeatureLoading(false);
      }
    };

    void loadFeature();
    return () => {
      cancelled = true;
    };
  }, [childrenCards, supabase]);

  const visibleChildren = useMemo(
    () => childrenCards.filter((child) => child.preschoolId && enabledSchoolIds.includes(child.preschoolId)),
    [childrenCards, enabledSchoolIds]
  );

  const loading = !userId || profileLoading || childrenLoading;

  return (
    <ParentShell
      tenantSlug={profile?.preschoolSlug}
      userEmail={profile?.email}
      userName={profile?.firstName}
      preschoolName={profile?.preschoolName || profile?.organizationName}
      hasOrganization={Boolean(profile?.organizationId || profile?.preschoolId)}
      hideHeader
    >
      <div className="section" style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 className="h1" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <ClipboardCheck className="icon24" style={{ color: 'var(--primary)' }} />
              Stationery Checklist
            </h1>
            <p style={{ margin: '8px 0 0', color: 'var(--textLight)' }}>
              Track bought items, what is still needed, and expected delivery dates for each child.
            </p>
          </div>
          <button
            className="btn btnSecondary"
            onClick={() => {
              void refetch();
            }}
            disabled={loading || featureLoading}
          >
            <RefreshCw className="icon14" />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="card" style={{ textAlign: 'center', padding: 24 }}>
            <div className="spinner" style={{ margin: '0 auto' }} />
          </div>
        ) : childrenCards.length === 0 ? (
          <div className="card" style={{ color: 'var(--textLight)' }}>
            No linked children found yet. Add a child to start stationery tracking.
          </div>
        ) : !stationeryEnabled ? (
          <div className="card" style={{ color: 'var(--textLight)' }}>
            Stationery tracking is currently disabled by your school. Ask the principal/admin to enable it in school settings.
          </div>
        ) : (
          <StationeryChecklistWidget childrenCards={visibleChildren} />
        )}
      </div>
    </ParentShell>
  );
}

