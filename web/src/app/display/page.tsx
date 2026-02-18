'use client';

import { type CSSProperties, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { useDisplayData } from '@/lib/display/useDisplayData';
import type { DisplayData } from '@/lib/display/types';
import {
  BookOpen,
  UtensilsCrossed,
  Megaphone,
  Lightbulb,
  Clock,
  MonitorPlay,
  CalendarDays,
  Sparkles,
} from 'lucide-react';

const SECTION_ROTATION_SEC = 45;
const DISPLAY_DATA_REFRESH_MS = 10 * 60 * 1000;
const SECTIONS = ['routine', 'lessons', 'menu', 'announcements', 'insights'] as const;
const SECTION_LABELS: Record<(typeof SECTIONS)[number], string> = {
  routine: 'Routine',
  lessons: 'Lessons',
  menu: 'Menu',
  announcements: 'Announcements',
  insights: 'Insights',
};

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso.slice(11, 16);
  }
}

const sectionCardClass = 'rounded-3xl border p-6 shadow-xl backdrop-blur-md sm:p-8';
const sectionCardStyle: CSSProperties = {
  borderColor: 'color-mix(in srgb, var(--primary) 20%, var(--border))',
  background: 'linear-gradient(150deg, color-mix(in srgb, var(--surface-1) 88%, black) 0%, color-mix(in srgb, var(--surface-2) 96%, var(--primary-subtle)) 100%)',
  boxShadow: '0 0 0 1px rgba(255,255,255,0.02), 0 20px 60px -28px rgba(0,0,0,0.8), 0 0 72px -42px rgba(var(--primary-rgb),0.5)',
};

function SectionRoutine({ data }: { data: NonNullable<DisplayData> }) {
  const { routine, themeLabel } = data;
  if (!routine && !themeLabel) {
    return (
      <section className={sectionCardClass} style={sectionCardStyle}>
        <h2 className="mb-4 flex items-center gap-3 text-2xl font-bold">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl shadow-md" style={{ backgroundColor: 'rgba(0, 245, 255, 0.15)' }}>
            <Clock className="h-6 w-6" style={{ color: 'var(--cyan, #00f5ff)' }} />
          </span>
          <span style={{ color: 'var(--text-primary)' }}>Today&apos;s routine</span>
        </h2>
        <EmptySectionNotice message="No routine or theme available yet. Add blocks in planning to show them on room display." />
      </section>
    );
  }
  return (
    <section className={sectionCardClass} style={sectionCardStyle}>
      <h2 className="mb-4 flex items-center gap-3 text-2xl font-bold">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl shadow-md" style={{ backgroundColor: 'rgba(0, 245, 255, 0.15)' }}>
          <Clock className="h-6 w-6" style={{ color: 'var(--cyan, #00f5ff)' }} />
        </span>
        <span style={{ color: 'var(--text-primary)' }}>Today&apos;s routine</span>
      </h2>
      {themeLabel && (
        <p className="mb-4 text-lg" style={{ color: 'var(--text-secondary)' }}>Theme: {themeLabel}</p>
      )}
      {routine?.blocks?.length ? (
        <ul className="space-y-3">
          {routine.blocks.map((block) => (
            <li key={block.id} className="flex items-center gap-4 rounded-xl border px-3 py-2 text-lg" style={{ background: 'rgba(0,0,0,0.18)', borderColor: 'var(--border)' }}>
              <span className="min-w-[5rem] font-mono text-sm" style={{ color: 'var(--cyan)' }}>
                {block.startTime ?? '–'}–{block.endTime ?? '–'}
              </span>
              <span style={{ color: 'var(--text-primary)' }}>{block.title}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-slate-400">No routine blocks for today.</p>
      )}
    </section>
  );
}

function SectionLessons({ data }: { data: NonNullable<DisplayData> }) {
  const { lessons } = data;
  if (!lessons?.length) {
    return (
      <section className={sectionCardClass} style={sectionCardStyle}>
        <h2 className="mb-4 flex items-center gap-3 text-2xl font-bold">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl shadow-md" style={{ backgroundColor: 'rgba(245, 158, 11, 0.2)' }}>
            <BookOpen className="h-6 w-6 text-amber-400" />
          </span>
          <span style={{ color: 'var(--text-primary)' }}>Lessons of the day</span>
        </h2>
        <EmptySectionNotice message="No lessons scheduled yet. Publish today&apos;s lesson plan to populate this section." />
      </section>
    );
  }
  return (
    <section className={sectionCardClass} style={sectionCardStyle}>
      <h2 className="mb-4 flex items-center gap-3 text-2xl font-bold">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl shadow-md" style={{ backgroundColor: 'rgba(245, 158, 11, 0.2)' }}>
          <BookOpen className="h-6 w-6 text-amber-400" />
        </span>
        <span style={{ color: 'var(--text-primary)' }}>Lessons of the day</span>
      </h2>
      <ul className="space-y-5">
        {lessons.map((lesson) => (
          <li key={lesson.id} className="border-b pb-5 last:border-0 last:pb-0" style={{ borderColor: 'color-mix(in srgb, var(--border) 75%, transparent)' }}>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="font-mono text-lg text-cyan-400">
                {formatTime(lesson.scheduled_at)}
              </span>
              <span className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{lesson.title}</span>
              {lesson.duration_minutes != null && (
                <span className="text-slate-400">{lesson.duration_minutes} min</span>
              )}
            </div>
            {lesson.description && (
              <p className="mt-1 text-slate-300">{lesson.description}</p>
            )}
            {lesson.steps?.length ? (
              <div className="mt-3 pl-4">
                <p className="mb-1 text-sm font-medium text-slate-400">Steps</p>
                <ol className="list-decimal space-y-1 text-lg" style={{ color: 'var(--text-secondary)' }}>
                  {lesson.steps.slice(0, 5).map((step, i) => (
                    <li key={i}>
                      {step.title}
                      {step.duration ? ` (${step.duration})` : ''}
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
            {lesson.media?.resources?.length ? (
              <div className="mt-2 text-slate-400">
                Resources: {lesson.media.resources.map((r) => r.title).join(', ')}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function SectionMenu({ data }: { data: NonNullable<DisplayData> }) {
  const { menuToday } = data;
  if (!menuToday) return null;
  const hasAny =
    menuToday.breakfast?.length ||
    menuToday.lunch?.length ||
    menuToday.snack?.length;
  if (!hasAny) {
    return (
      <section className={sectionCardClass} style={sectionCardStyle}>
        <h2 className="mb-4 flex items-center gap-3 text-2xl font-bold">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl shadow-md" style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)' }}>
            <UtensilsCrossed className="h-6 w-6 text-emerald-400" />
          </span>
          <span style={{ color: 'var(--text-primary)' }}>Today&apos;s menu</span>
        </h2>
        <EmptySectionNotice message="No menu items for today. Add breakfast, lunch or snack items in weekly menu." />
      </section>
    );
  }
  return (
    <section className={sectionCardClass} style={sectionCardStyle}>
      <h2 className="mb-4 flex items-center gap-3 text-2xl font-bold">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl shadow-md" style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)' }}>
          <UtensilsCrossed className="h-6 w-6 text-emerald-400" />
        </span>
        <span style={{ color: 'var(--text-primary)' }}>Today&apos;s menu</span>
      </h2>
      <div className="grid gap-4 text-xl sm:grid-cols-3">
        {menuToday.breakfast?.length ? (
          <div>
            <p className="mb-1 font-medium text-slate-400">Breakfast</p>
            <ul style={{ color: 'var(--text-primary)' }}>
              {menuToday.breakfast.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {menuToday.lunch?.length ? (
          <div>
            <p className="mb-1 font-medium text-slate-400">Lunch</p>
            <ul style={{ color: 'var(--text-primary)' }}>
              {menuToday.lunch.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {menuToday.snack?.length ? (
          <div>
            <p className="mb-1 font-medium text-slate-400">Snack</p>
            <ul style={{ color: 'var(--text-primary)' }}>
              {menuToday.snack.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function SectionAnnouncements({ data }: { data: NonNullable<DisplayData> }) {
  const { announcements } = data;
  if (!announcements?.length) {
    return (
      <section className={sectionCardClass} style={sectionCardStyle}>
        <h2 className="mb-4 flex items-center gap-3 text-2xl font-bold">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl shadow-md" style={{ backgroundColor: 'rgba(251, 113, 133, 0.2)' }}>
            <Megaphone className="h-6 w-6 text-rose-400" />
          </span>
          <span style={{ color: 'var(--text-primary)' }}>Announcements</span>
        </h2>
        <EmptySectionNotice message="No announcements published for today." />
      </section>
    );
  }
  return (
    <section className={sectionCardClass} style={sectionCardStyle}>
      <h2 className="mb-4 flex items-center gap-3 text-2xl font-bold">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl shadow-md" style={{ backgroundColor: 'rgba(251, 113, 133, 0.2)' }}>
          <Megaphone className="h-6 w-6 text-rose-400" />
        </span>
        <span style={{ color: 'var(--text-primary)' }}>Announcements</span>
      </h2>
      <ul className="space-y-4">
        {announcements.map((a) => (
          <li key={a.id} className="rounded-xl border px-3 py-2" style={{ background: 'rgba(0,0,0,0.18)', borderColor: 'var(--border)' }}>
            <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{a.title}</p>
            <p className="text-slate-300">{a.body_preview}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SectionInsights({ data }: { data: NonNullable<DisplayData> }) {
  const { insights } = data;
  if (!insights?.bullets?.length) {
    return (
      <section className={sectionCardClass} style={sectionCardStyle}>
        <h2 className="mb-4 flex items-center gap-3 text-2xl font-bold">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl shadow-md" style={{ backgroundColor: 'rgba(250, 204, 21, 0.2)' }}>
            <Lightbulb className="h-6 w-6 text-yellow-400" />
          </span>
          <span style={{ color: 'var(--text-primary)' }}>Insights</span>
        </h2>
        <EmptySectionNotice message="No AI insights yet. Insights appear once enough routine and lesson activity is available." />
      </section>
    );
  }
  return (
    <section className={sectionCardClass} style={sectionCardStyle}>
      <h2 className="mb-4 flex items-center gap-3 text-2xl font-bold">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl shadow-md" style={{ backgroundColor: 'rgba(250, 204, 21, 0.2)' }}>
          <Lightbulb className="h-6 w-6 text-yellow-400" />
        </span>
        <span style={{ color: 'var(--text-primary)' }}>{insights.title}</span>
      </h2>
      <ul className="list-disc space-y-2 pl-5 text-lg" style={{ color: 'var(--text-secondary)' }}>
        {insights.bullets.map((b, i) => (
          <li key={i}>{b}</li>
        ))}
      </ul>
    </section>
  );
}

function DisplayPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgParam = searchParams.get('org');
  const classParam = searchParams.get('class');
  const tokenParam = searchParams.get('token');
  const codeParam = searchParams.get('code')?.trim().toUpperCase() || null;
  const [userId, setUserId] = useState<string | undefined>();
  const [tokenData, setTokenData] = useState<DisplayData | null>(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [displayLinkUrl, setDisplayLinkUrl] = useState<string | null>(null);
  const [displayJoinCode, setDisplayJoinCode] = useState<string | null>(null);
  const [joinCodeInput, setJoinCodeInput] = useState('');

  const supabase = useMemo(() => createClient(), []);
  const { profile } = useUserProfile(userId);

  const orgId = orgParam || profile?.preschoolId || profile?.organizationId || null;
  const classId = classParam || null;
  const useTokenFlow = !!(orgParam && tokenParam);
  const useCodeFlow = !!codeParam && !orgParam && !tokenParam;
  const useTvFlow = useTokenFlow || useCodeFlow;

  const fetchByToken = useCallback(async () => {
    if (!orgParam || !tokenParam) return;
    setTokenLoading(true);
    setTokenError(null);
    try {
      const params = new URLSearchParams({ org: orgParam, token: tokenParam });
      if (classParam) params.set('class', classParam);
      const res = await fetch(`/api/display/data?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Request failed: ${res.status}`);
      }
      const json = await res.json();
      setTokenData(json as DisplayData);
    } catch (e) {
      setTokenError(e instanceof Error ? e.message : 'Failed to load display');
      setTokenData(null);
    } finally {
      setTokenLoading(false);
    }
  }, [orgParam, tokenParam, classParam]);

  const fetchByCode = useCallback(async () => {
    if (!codeParam) return;
    setTokenLoading(true);
    setTokenError(null);
    try {
      const res = await fetch(`/api/display/data?code=${encodeURIComponent(codeParam)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Request failed: ${res.status}`);
      }
      const json = await res.json();
      setTokenData(json as DisplayData);
    } catch (e) {
      setTokenError(e instanceof Error ? e.message : 'Failed to load display');
      setTokenData(null);
    } finally {
      setTokenLoading(false);
    }
  }, [codeParam]);

  useEffect(() => {
    if (useTokenFlow) {
      fetchByToken();
    } else if (useCodeFlow) {
      fetchByCode();
    }
  }, [useTokenFlow, useCodeFlow, fetchByToken, fetchByCode]);

  // Only run 10-min auto-refresh when on TV (token or code flow) and we have loaded data
  useEffect(() => {
    if (!useTvFlow || !tokenData) return;
    const fn = useCodeFlow ? fetchByCode : fetchByToken;
    const t = setInterval(fn, DISPLAY_DATA_REFRESH_MS);
    return () => clearInterval(t);
  }, [useTvFlow, useCodeFlow, tokenData, fetchByToken, fetchByCode]);

  const { data: sessionData, loading: sessionLoading, error: sessionError, refetch: refetchSession } = useDisplayData({
    orgId: useTvFlow ? null : orgId,
    classId,
    enabled: !!orgId && !useTvFlow,
  });

  const data = useTvFlow ? tokenData : sessionData;
  const loading = useTvFlow ? tokenLoading : sessionLoading;
  const error = useTvFlow ? tokenError : sessionError;
  const refetch = useTvFlow ? (useCodeFlow ? fetchByCode : fetchByToken) : refetchSession;

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user?.id) setUserId(session.user.id);
    };
    init();
  }, [supabase]);

  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [nowLabel, setNowLabel] = useState(() => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

  useEffect(() => {
    const tick = () => setNowLabel(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    const t = setInterval(tick, 30000);
    return () => clearInterval(t);
  }, []);

  const visibleSections = useMemo(() => {
    if (!data) return SECTIONS;
    const out: (typeof SECTIONS)[number][] = [];
    if (data.routine?.blocks?.length || data.themeLabel) out.push('routine');
    if (data.lessons?.length) out.push('lessons');
    if (data.menuToday && (data.menuToday.breakfast?.length || data.menuToday.lunch?.length || data.menuToday.snack?.length))
      out.push('menu');
    if (data.announcements?.length) out.push('announcements');
    if (data.insights?.bullets?.length) out.push('insights');
    return out.length ? out : SECTIONS;
  }, [data]);

  useEffect(() => {
    const t = setInterval(() => {
      setCurrentSectionIndex((i) => (i + 1) % Math.max(1, visibleSections.length));
    }, SECTION_ROTATION_SEC * 1000);
    return () => clearInterval(t);
  }, [visibleSections.length]);

  const showRotation = visibleSections.length > 1;
  const currentSection = visibleSections[currentSectionIndex] ?? visibleSections[0];
  const activeSection = currentSection ?? 'routine';
  const rotationProgressPct = showRotation ? ((currentSectionIndex + 1) / visibleSections.length) * 100 : 100;

  const quickStats = [
    { label: 'Routine blocks', value: data?.routine?.blocks?.length ?? 0 },
    { label: 'Lessons', value: data?.lessons?.length ?? 0 },
    { label: 'Menu items', value: (data?.menuToday?.breakfast?.length ?? 0) + (data?.menuToday?.lunch?.length ?? 0) + (data?.menuToday?.snack?.length ?? 0) },
    { label: 'Announcements', value: data?.announcements?.length ?? 0 },
  ];

  if (!useTvFlow && !orgId && !userId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 sm:p-8">
        <div
          className="w-full max-w-lg rounded-3xl p-8 sm:p-10 shadow-2xl backdrop-blur-xl"
          style={{
            background: 'linear-gradient(145deg, var(--surface-1) 0%, var(--surface-2) 50%, var(--card) 100%)',
            border: '1px solid var(--border)',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.05), 0 25px 50px -12px rgba(0,0,0,0.5), 0 0 80px -20px var(--primary-subtle)',
          }}
        >
          <div className="flex justify-center mb-6">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl text-2xl"
              style={{ background: 'var(--primary-subtle)', color: 'var(--primary)' }}
            >
              <Clock className="h-8 w-8" />
            </div>
          </div>
          <h1 className="text-center text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: 'var(--text-primary)' }}>
            Room Display
          </h1>
          <p className="mt-2 text-center text-sm" style={{ color: 'var(--muted)' }}>
            Show routine, lessons, menu and announcements on a TV. This page does not auto-refresh.
          </p>

          <div className="mt-8 rounded-2xl p-5" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)' }}>
            <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
              How to get the link on the TV
            </h2>
            <ol className="mt-4 space-y-3 text-[var(--text-secondary)]">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ background: 'var(--primary)', color: 'white' }}>1</span>
                On your phone or laptop, <strong style={{ color: 'var(--text-primary)' }}>sign in</strong> to EduDash Pro.
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ background: 'var(--primary)', color: 'white' }}>2</span>
                Open <strong style={{ color: 'var(--text-primary)' }}>Dashboard</strong> and tap or click <strong style={{ color: 'var(--primary)' }}>&quot;Get TV link&quot;</strong>.
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ background: 'var(--primary)', color: 'white' }}>3</span>
                Copy the link, then on the <strong style={{ color: 'var(--text-primary)' }}>TV browser</strong> open that link. No sign-in needed on the TV.
              </li>
            </ol>
          </div>

          <p className="mt-4 text-center text-xs" style={{ color: 'var(--muted)' }}>
            Or on the TV, add <code className="rounded px-1.5 py-0.5" style={{ background: 'var(--surface-2)' }}>?org=...&amp;token=...</code> to the URL (get the full link from a signed-in device).
          </p>

          {/* Enter join code on TV */}
          <div className="mt-6 rounded-2xl p-5" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)' }}>
            <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
              On the TV: enter join code
            </h2>
            <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
              Open this page on the TV, then type the 6-character code from your phone or laptop.
            </p>
            <div className="mt-4 flex gap-2">
              <input
                type="text"
                inputMode="text"
                maxLength={8}
                placeholder="e.g. ABC123"
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                className="flex-1 rounded-xl border px-4 py-3 text-center text-lg font-mono font-bold tracking-widest"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
              <button
                type="button"
                onClick={() => {
                  const code = joinCodeInput.trim().toUpperCase();
                  if (code.length >= 4) router.push(`/display?code=${encodeURIComponent(code)}`);
                }}
                className="rounded-xl px-6 py-3 text-base font-semibold text-white shrink-0"
                style={{ background: 'var(--primary)' }}
              >
                Go
              </button>
            </div>
          </div>

          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={() => router.push('/sign-in')}
              className="rounded-xl px-8 py-3.5 text-base font-semibold text-white transition-all hover:opacity-90 hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: 'var(--primary)', boxShadow: '0 4px 14px 0 rgba(124, 58, 237, 0.4)' }}
            >
              Sign in to get TV link
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-xl" style={{ color: 'var(--muted)' }}>Loading display…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
        <p className="text-xl" style={{ color: 'var(--danger)' }}>{error}</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="rounded-xl px-6 py-3 font-medium text-white transition-colors hover:opacity-90"
          style={{ background: 'var(--primary)' }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-xl" style={{ color: 'var(--muted)' }}>No data for this organisation.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-10" style={{ background: 'radial-gradient(1200px 550px at 8% -5%, rgba(var(--primary-rgb),0.22), transparent 65%), radial-gradient(900px 500px at 95% 8%, rgba(0,245,255,0.12), transparent 62%), var(--background)' }}>
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--surface-1)]/80 to-[var(--surface-2)]/60 px-6 py-5 shadow-lg backdrop-blur-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl" style={{ color: 'var(--text-primary)' }}>
            EduDash Pro – Room Display
          </h1>
          <p className="mt-1 text-lg" style={{ color: 'var(--text-secondary)' }}>
            {data.dayName}, {data.dateLabel}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
            <span className="rounded-full border px-3 py-1" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
              {useTvFlow ? 'TV mode' : 'Preview mode'}
            </span>
            {useTvFlow && (
              <span className="rounded-full border px-3 py-1" style={{ borderColor: 'color-mix(in srgb, var(--success) 25%, var(--border))', background: 'color-mix(in srgb, var(--success) 16%, transparent)', color: 'var(--text-primary)' }}>
                Auto-refresh every 10 min
              </span>
            )}
          </div>
        </div>

        {userId && !useTvFlow && (
          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={async () => {
                setLinkError(null);
                setLinkCopied(false);
                setDisplayLinkUrl(null);
                setDisplayJoinCode(null);
                try {
                  const res = await fetch('/api/display/link');
                  if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error || 'Failed to get link');
                  }
                  const { url, joinCode } = await res.json();
                  setDisplayLinkUrl(url);
                  if (joinCode) setDisplayJoinCode(joinCode);
                  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(joinCode ? `${joinCode} (or open: ${url})` : url);
                    setLinkCopied(true);
                    setTimeout(() => setLinkCopied(false), 3000);
                  }
                } catch (e) {
                  setLinkError(e instanceof Error ? e.message : 'Failed');
                }
              }}
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90"
              style={{ background: linkCopied ? 'var(--success)' : 'var(--primary)' }}
            >
              {linkCopied ? 'Copied! Open on TV' : 'Get TV link'}
            </button>
            {displayJoinCode && (
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Join code: <span className="select-all font-mono text-lg font-bold tracking-widest" style={{ color: 'var(--primary)' }}>{displayJoinCode}</span>
                <span className="ml-1 text-xs" style={{ color: 'var(--muted)' }}>(type on TV)</span>
              </p>
            )}
            {displayLinkUrl && (
              <p className="max-w-xs break-all text-xs" style={{ color: 'var(--muted)' }}>
                Or open: <span className="select-all font-mono" style={{ color: 'var(--cyan)' }}>{displayLinkUrl}</span>
              </p>
            )}
            {linkError && <p className="text-xs" style={{ color: 'var(--danger)' }}>{linkError}</p>}
          </div>
        )}
        {showRotation && (
          <div className="flex flex-wrap items-center gap-2">
            {visibleSections.map((s, i) => (
              <button
                key={s}
                type="button"
                onClick={() => setCurrentSectionIndex(i)}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                  activeSection === s
                    ? 'text-white shadow-md'
                    : 'hover:opacity-90'
                }`}
                style={
                  activeSection === s
                    ? { background: 'var(--primary)' }
                    : { background: 'var(--surface-2)', color: 'var(--text-secondary)' }
                }
              >
                {SECTION_LABELS[s]}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="mx-auto mb-8 max-w-5xl">
        <div className="flex items-center justify-between text-xs" style={{ color: 'var(--muted)' }}>
          <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {data.dayName}</span>
          <span>{showRotation ? `${currentSectionIndex + 1}/${visibleSections.length} sections` : 'Single section'}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }}>
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${rotationProgressPct}%`, background: 'linear-gradient(90deg, var(--primary), var(--cyan))' }} />
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-8">
        {showRotation ? (
          <>
            {activeSection === 'routine' && <SectionRoutine data={data} />}
            {activeSection === 'lessons' && <SectionLessons data={data} />}
            {activeSection === 'menu' && <SectionMenu data={data} />}
            {activeSection === 'announcements' && <SectionAnnouncements data={data} />}
            {activeSection === 'insights' && <SectionInsights data={data} />}
          </>
        ) : (
          <>
            <SectionRoutine data={data} />
            <SectionLessons data={data} />
            <SectionMenu data={data} />
            <SectionAnnouncements data={data} />
            <SectionInsights data={data} />
          </>
        )}
      </div>

      <footer className="mt-12 text-center text-sm" style={{ color: 'var(--muted)' }}>
        <p className="inline-flex items-center gap-2 rounded-full border px-4 py-2" style={{ borderColor: 'var(--border)', background: 'rgba(0,0,0,0.2)' }}>
          <Sparkles className="h-4 w-4" style={{ color: 'var(--primary)' }} />
          {useTvFlow ? 'Auto refresh: every 10 minutes.' : 'Preview mode on signed-in device.'} Use fullscreen (F11) for TV.
        </p>
      </footer>
    </div>
  );
}

export default function DisplayPage() {
  return (
    <Suspense
      fallback={(
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-xl" style={{ color: 'var(--muted)' }}>Loading display…</p>
        </div>
      )}
    >
      <DisplayPageClient />
    </Suspense>
  );
}
