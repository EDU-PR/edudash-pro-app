'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, ChefHat, RefreshCw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { ParentShell } from '@/components/dashboard/parent/ParentShell';
import { SchoolMenuService } from '@/lib/services/schoolMenuService';
import type { WeeklyMenuDraft } from '@/lib/services/schoolMenu.types';
import { isWeeklyMenuBridgeEnabled, isWeeklyMenuDedicatedEnabled } from '@/lib/services/schoolMenuFeatureFlags';

interface ParentSchool {
  id: string;
  name: string;
}

export default function ParentMenuPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [userId, setUserId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [schools, setSchools] = useState<ParentSchool[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);

  const [selectedWeek, setSelectedWeek] = useState<string>(() => SchoolMenuService.startOfWeekMonday(new Date()));
  const [availableWeeks, setAvailableWeeks] = useState<string[]>([]);
  const [weekDraft, setWeekDraft] = useState<WeeklyMenuDraft | null>(null);
  const weeklyMenuVisible = isWeeklyMenuBridgeEnabled() || isWeeklyMenuDedicatedEnabled();

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/sign-in');
        return;
      }
      setUserId(user.id);
    };

    void init();
  }, [router, supabase]);

  useEffect(() => {
    if (!userId) return;

    const loadProfileId = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('auth_user_id', userId)
        .maybeSingle();

      setProfileId((data as any)?.id || userId);
    };

    void loadProfileId();
  }, [supabase, userId]);

  useEffect(() => {
    if (!profileId) return;

    const loadSchools = async () => {
      const { data: children } = await supabase
        .from('students')
        .select('preschool_id, preschools:preschool_id(name)')
        .or(`parent_id.eq.${profileId},guardian_id.eq.${profileId}`);

      const mapped = new Map<string, string>();
      for (const row of children || []) {
        const id = (row as any).preschool_id as string | null;
        if (!id) continue;
        const schoolName = Array.isArray((row as any).preschools)
          ? (row as any).preschools[0]?.name
          : (row as any).preschools?.name;
        mapped.set(id, schoolName || 'My School');
      }

      const schoolList = Array.from(mapped.entries()).map(([id, name]) => ({ id, name }));
      setSchools(schoolList);
      if (schoolList.length > 0) {
        setSelectedSchoolId(schoolList[0].id);
      } else {
        setLoading(false);
      }
    };

    void loadSchools();
  }, [profileId, supabase]);

  const loadMenu = async () => {
    if (!selectedSchoolId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [weeks, draft] = await Promise.all([
        SchoolMenuService.getAvailableWeeks(selectedSchoolId),
        SchoolMenuService.getWeekMenuWithFallback(selectedSchoolId, selectedWeek),
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
    if (!selectedSchoolId) return;
    void loadMenu();
  }, [selectedSchoolId, selectedWeek]);

  return (
    <ParentShell hideHeader={true}>
      <div className="section" style={{ display: 'grid', gap: 16 }}>
        {!weeklyMenuVisible && (
          <div className="card" style={{ color: 'var(--textLight)' }}>
            Weekly menu is currently disabled by feature flag.
          </div>
        )}

        <div>
          <h1 className="h1" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ChefHat className="icon24" style={{ color: 'var(--primary)' }} />
            Daily Menu
          </h1>
          <p style={{ margin: '8px 0 0 0', color: 'var(--textLight)' }}>
            See what your children are eating this week.
          </p>
        </div>

        <div className="card" style={{ display: 'grid', gap: 10 }}>
          {schools.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 14, color: 'var(--textLight)' }}>School:</label>
              <select
                value={selectedSchoolId || ''}
                onChange={(e) => setSelectedSchoolId(e.target.value)}
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--surface-1)',
                  fontSize: 14,
                }}
              >
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>{school.name}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
            <button
              className="btn btnSecondary"
              onClick={() => void loadMenu()}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <RefreshCw className="icon16" />
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="card" style={{ textAlign: 'center', padding: 30 }}>
            <div className="spinner" style={{ margin: '0 auto' }} />
          </div>
        ) : !weeklyMenuVisible ? (
          <div className="card" style={{ textAlign: 'center', padding: 30, color: 'var(--textLight)' }}>
            Weekly menu is temporarily unavailable.
          </div>
        ) : !selectedSchoolId ? (
          <div className="card" style={{ textAlign: 'center', padding: 30, color: 'var(--textLight)' }}>
            No linked school found for your children.
          </div>
        ) : !weekDraft ? (
          <div className="card" style={{ textAlign: 'center', padding: 30, color: 'var(--textLight)' }}>
            No menu has been published for this week yet.
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
    </ParentShell>
  );
}
