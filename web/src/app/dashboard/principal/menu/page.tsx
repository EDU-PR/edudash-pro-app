'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, ChefHat, Plus, RefreshCw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { PrincipalShell } from '@/components/dashboard/principal/PrincipalShell';
import { CreateWeeklyMenuModal } from '@/components/announcements/CreateWeeklyMenuModal';
import { SchoolMenuService } from '@/lib/services/schoolMenuService';
import type { WeeklyMenuDraft } from '@/lib/services/schoolMenu.types';
import { isWeeklyMenuBridgeEnabled, isWeeklyMenuDedicatedEnabled } from '@/lib/services/schoolMenuFeatureFlags';

export default function PrincipalMenuPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [userId, setUserId] = useState<string>();
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState<string>(() => SchoolMenuService.startOfWeekMonday(new Date()));
  const [availableWeeks, setAvailableWeeks] = useState<string[]>([]);
  const [weekDraft, setWeekDraft] = useState<WeeklyMenuDraft | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { profile, loading: profileLoading } = useUserProfile(userId);
  const { slug: tenantSlug } = useTenantSlug(userId);
  const weeklyMenuPublishingEnabled = isWeeklyMenuBridgeEnabled() || isWeeklyMenuDedicatedEnabled();

  const preschoolName = profile?.preschoolName;
  const preschoolId = profile?.preschoolId || profile?.organizationId;

  useEffect(() => {
    const initAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push('/sign-in');
        return;
      }

      setUserId(session.user.id);
      setAuthLoading(false);
    };

    void initAuth();
  }, [router, supabase]);

  const loadData = async () => {
    if (!preschoolId) return;
    setLoading(true);
    try {
      const [weeks, draft] = await Promise.all([
        SchoolMenuService.getAvailableWeeks(preschoolId),
        SchoolMenuService.getWeekMenuWithFallback(preschoolId, selectedWeek),
      ]);

      const mergedWeeks = weeks.includes(selectedWeek) ? weeks : [selectedWeek, ...weeks];
      setAvailableWeeks(Array.from(new Set(mergedWeeks)).sort((a, b) => b.localeCompare(a)));
      setWeekDraft(draft);
    } catch {
      setWeekDraft(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!preschoolId || authLoading || profileLoading) return;
    void loadData();
  }, [preschoolId, selectedWeek, authLoading, profileLoading]);

  if (authLoading || profileLoading) {
    return (
      <PrincipalShell tenantSlug={tenantSlug} preschoolName={preschoolName} preschoolId={preschoolId}>
        <div className="section">
          <div className="spinner" />
        </div>
      </PrincipalShell>
    );
  }

  return (
    <PrincipalShell tenantSlug={tenantSlug} preschoolName={preschoolName} preschoolId={preschoolId}>
      <div className="section" style={{ display: 'grid', gap: 16 }}>
        {!weeklyMenuPublishingEnabled && (
          <div className="card" style={{ color: 'var(--textLight)' }}>
            Weekly menu publishing is disabled by feature flag.
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 className="h1" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <ChefHat className="icon24" style={{ color: 'var(--primary)' }} />
              Weekly Menu
            </h1>
            <p style={{ margin: '8px 0 0 0', color: 'var(--textLight)' }}>
              Publish and manage school-wide weekly menus for parents.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="btn btnSecondary"
              onClick={() => void loadData()}
              disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <RefreshCw className="icon16" />
              Refresh
            </button>
            <button
              className="btn btnPrimary"
              onClick={() => setShowCreateModal(true)}
              disabled={!weeklyMenuPublishingEnabled}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <Plus className="icon16" />
              Upload Weekly Menu
            </button>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <CalendarDays className="icon16" style={{ color: 'var(--textLight)' }} />
          <label style={{ fontSize: 14, color: 'var(--textLight)' }}>Week:</label>
          <select
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
            style={{
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--surface-1)',
              fontSize: 14,
              minWidth: 220,
            }}
          >
            {availableWeeks.map((week) => (
              <option key={week} value={week}>
                {new Date(`${week}T00:00:00.000Z`).toLocaleDateString('en-ZA', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="card" style={{ textAlign: 'center', padding: 32 }}>
            <div className="spinner" style={{ margin: '0 auto' }} />
          </div>
        ) : !weekDraft ? (
          <div className="card" style={{ textAlign: 'center', padding: 32 }}>
            <p style={{ margin: 0, color: 'var(--textLight)' }}>
              No weekly menu published for this week yet.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {weekDraft.days.map((day) => {
              const date = new Date(`${day.date}T00:00:00.000Z`);
              return (
                <div key={day.date} className="card" style={{ border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 700, marginBottom: 10 }}>
                    {date.toLocaleDateString('en-ZA', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'short',
                    })}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--textLight)' }}>Breakfast</div>
                      <div style={{ fontSize: 14 }}>{day.breakfast.length ? day.breakfast.join(', ') : 'Not provided'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--textLight)' }}>Lunch</div>
                      <div style={{ fontSize: 14 }}>{day.lunch.length ? day.lunch.join(', ') : 'Not provided'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--textLight)' }}>Snack</div>
                      <div style={{ fontSize: 14 }}>{day.snack.length ? day.snack.join(', ') : 'Not provided'}</div>
                    </div>
                  </div>
                  {day.notes && (
                    <div style={{ marginTop: 10, fontSize: 13, color: 'var(--textLight)' }}>
                      Notes: {day.notes}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {weeklyMenuPublishingEnabled && showCreateModal && preschoolId && userId && (
        <CreateWeeklyMenuModal
          preschoolId={preschoolId}
          authorId={userId}
          onClose={() => setShowCreateModal(false)}
          onPublished={() => {
            setShowCreateModal(false);
            void loadData();
          }}
        />
      )}
    </PrincipalShell>
  );
}
