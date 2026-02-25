'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { PrincipalShell } from '@/components/dashboard/principal/PrincipalShell';
import { 
  Sparkles, Calendar, BookOpen, Users, MapPin, ChevronDown, ChevronUp,
  Loader2, CheckCircle, AlertCircle, Save, RefreshCw, Play
} from 'lucide-react';

interface YearPlanConfig {
  academic_year: number;
  school_type: 'preschool' | 'primary' | 'combined';
  age_groups: string[];
  terms_per_year: number;
  focus_areas: string[];
  include_excursions: boolean;
  include_parent_meetings: boolean;
  include_staff_training: boolean;
  include_special_events: boolean;
  budget_considerations: 'low' | 'medium' | 'high';
  school_context: string;
}

interface GeneratedTerm {
  term_number: number;
  name: string;
  start_date: string;
  end_date: string;
  theme: string;
  description: string;
  weekly_themes: {
    week: number;
    theme: string;
    focus_area: string;
    key_activities: string[];
    developmental_goals: string[];
  }[];
  excursions: {
    title: string;
    destination: string;
    week: number;
    learning_objectives: string[];
    estimated_cost: number;
  }[];
  meetings: {
    title: string;
    type: string;
    week: number;
    purpose: string;
  }[];
  special_events: {
    title: string;
    date: string;
    description: string;
  }[];
}

interface GeneratedYearPlan {
  academic_year: number;
  school_name: string;
  overview: string;
  terms: GeneratedTerm[];
  annual_goals: string[];
  key_dates: { date: string; event: string }[];
  budget_summary: {
    category: string;
    estimated_cost: number;
  }[];
  monthly_entries?: YearPlanMonthlyEntry[];
  operational_highlights?: YearPlanOperationalHighlight[];
}

type YearPlanMonthlyBucket =
  | 'holidays_closures'
  | 'meetings_admin'
  | 'excursions_extras'
  | 'donations_fundraisers';

interface YearPlanMonthlyEntry {
  month_index: number;
  bucket: YearPlanMonthlyBucket;
  subtype?: string | null;
  title: string;
  details?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  source?: 'ai' | 'manual' | 'synced';
  is_published?: boolean;
  published_to_calendar?: boolean;
}

interface YearPlanOperationalHighlight {
  title: string;
  description: string;
}

const AGE_GROUPS = [
  { value: '0-2', label: 'Infants (0-2 years)' },
  { value: '2-3', label: 'Toddlers (2-3 years)' },
  { value: '3-4', label: 'Junior (3-4 years)' },
  { value: '4-5', label: 'Senior (4-5 years)' },
  { value: '5-6', label: 'Grade R (5-6 years)' },
];

const FOCUS_AREAS = [
  { value: 'cognitive', label: 'Cognitive Development' },
  { value: 'physical', label: 'Physical Development' },
  { value: 'social', label: 'Social & Emotional' },
  { value: 'language', label: 'Language & Communication' },
  { value: 'creative', label: 'Creative Arts' },
  { value: 'numeracy', label: 'Early Numeracy' },
  { value: 'literacy', label: 'Early Literacy' },
  { value: 'stem', label: 'STEM Foundation' },
  { value: 'life_skills', label: 'Life Skills' },
];

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const MOCK_FALLBACK_ENABLED =
  process.env.NEXT_PUBLIC_AI_YEAR_PLANNER_MOCK_FALLBACK === 'true' && process.env.NODE_ENV !== 'production';

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function monthIndexFromDateString(value: string, fallback: number): number {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  const candidate = raw.includes('T') ? raw.split('T')[0] : raw;
  const month = Number(candidate.split('-')[1]);
  if (Number.isFinite(month) && month >= 1 && month <= 12) return month;
  return fallback;
}

function normalizeMonthlyBucket(value: unknown): YearPlanMonthlyBucket {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'holidays_closures' || raw.includes('holiday') || raw.includes('closure')) return 'holidays_closures';
  if (raw === 'meetings_admin' || raw.includes('meeting') || raw.includes('admin')) return 'meetings_admin';
  if (raw === 'excursions_extras' || raw.includes('excursion') || raw.includes('extra')) return 'excursions_extras';
  if (raw === 'donations_fundraisers' || raw.includes('donation') || raw.includes('fundraiser')) return 'donations_fundraisers';
  return 'holidays_closures';
}

function inferSubtype(bucket: YearPlanMonthlyBucket, text: string): string {
  const value = String(text || '').toLowerCase();
  if (bucket === 'holidays_closures') {
    if (value.includes('holiday')) return 'holiday';
    if (value.includes('close') || value.includes('break')) return 'closure';
    return 'other';
  }
  if (bucket === 'meetings_admin') {
    if (value.includes('staff')) return 'staff_meeting';
    if (value.includes('parent')) return 'parent_meeting';
    if (value.includes('training')) return 'training';
    return 'other';
  }
  if (bucket === 'excursions_extras') {
    if (value.includes('excursion') || value.includes('trip') || value.includes('visit')) return 'excursion';
    return 'extra_mural';
  }
  if (value.includes('donation') || value.includes('drive')) return 'donation_drive';
  return 'fundraiser';
}

function calculateMonthDate(termStart: string, weekNumber: number): string {
  const date = new Date(`${termStart}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return termStart;
  date.setUTCDate(date.getUTCDate() + Math.max(0, weekNumber - 1) * 7);
  return date.toISOString().split('T')[0];
}

function deriveMonthlyEntries(plan: GeneratedYearPlan): YearPlanMonthlyEntry[] {
  const entries: YearPlanMonthlyEntry[] = [];

  (plan.key_dates || []).forEach((item, idx) => {
    const monthIndex = monthIndexFromDateString(item.date, (idx % 12) + 1);
    entries.push({
      month_index: monthIndex,
      bucket: 'holidays_closures',
      subtype: inferSubtype('holidays_closures', item.event),
      title: item.event,
      details: null,
      start_date: item.date || null,
      end_date: item.date || null,
      source: 'ai',
      is_published: false,
      published_to_calendar: false,
    });
  });

  (plan.terms || []).forEach((term) => {
    const termStartMonth = monthIndexFromDateString(term.start_date, 1);
    entries.push({
      month_index: termStartMonth,
      bucket: 'holidays_closures',
      subtype: 'closure',
      title: `${term.name} starts`,
      details: `${term.start_date} to ${term.end_date}`,
      start_date: term.start_date,
      end_date: term.end_date,
      source: 'ai',
      is_published: false,
      published_to_calendar: false,
    });

    (term.meetings || []).forEach((meeting) => {
      const date = calculateMonthDate(term.start_date, meeting.week || 1);
      entries.push({
        month_index: monthIndexFromDateString(date, termStartMonth),
        bucket: 'meetings_admin',
        subtype: inferSubtype('meetings_admin', `${meeting.type} ${meeting.title}`),
        title: meeting.title,
        details: meeting.purpose || null,
        start_date: date,
        end_date: date,
        source: 'ai',
        is_published: false,
        published_to_calendar: false,
      });
    });

    (term.excursions || []).forEach((excursion) => {
      const date = calculateMonthDate(term.start_date, excursion.week || 1);
      entries.push({
        month_index: monthIndexFromDateString(date, termStartMonth),
        bucket: 'excursions_extras',
        subtype: inferSubtype('excursions_extras', excursion.title),
        title: excursion.title,
        details: excursion.destination || null,
        start_date: date,
        end_date: date,
        source: 'ai',
        is_published: false,
        published_to_calendar: false,
      });
    });
  });

  const unique = new Map<string, YearPlanMonthlyEntry>();
  entries.forEach((entry) => {
    const key = `${entry.month_index}:${entry.bucket}:${entry.title.toLowerCase()}`;
    if (!unique.has(key)) unique.set(key, entry);
  });

  return Array.from(unique.values()).sort(
    (a, b) => a.month_index - b.month_index || a.bucket.localeCompare(b.bucket),
  );
}

function monthlyBucketLabel(bucket: YearPlanMonthlyBucket): string {
  if (bucket === 'holidays_closures') return 'Holidays & Closures';
  if (bucket === 'meetings_admin') return 'Meetings & Admin';
  if (bucket === 'excursions_extras') return 'Excursions & Extras';
  return 'Donations & Fundraisers';
}

function groupMonthlyEntries(entries: YearPlanMonthlyEntry[]): Map<number, YearPlanMonthlyEntry[]> {
  const grouped = new Map<number, YearPlanMonthlyEntry[]>();
  for (const entry of entries) {
    const list = grouped.get(entry.month_index) || [];
    list.push(entry);
    grouped.set(entry.month_index, list);
  }
  for (const [monthIndex, list] of grouped.entries()) {
    grouped.set(
      monthIndex,
      [...list].sort((a, b) => a.bucket.localeCompare(b.bucket) || a.title.localeCompare(b.title)),
    );
  }
  return grouped;
}

function normalizeGeneratedPlan(plan: GeneratedYearPlan, schoolName: string): GeneratedYearPlan {
  const monthlyInput = Array.isArray((plan as any).monthly_entries)
    ? ((plan as any).monthly_entries as any[])
    : Array.isArray((plan as any).monthlyEntries)
      ? ((plan as any).monthlyEntries as any[])
      : [];

  const monthlyEntries: YearPlanMonthlyEntry[] = monthlyInput
    .map((entry, index) => {
      const month_index = Number(entry?.month_index ?? entry?.monthIndex ?? entry?.month ?? monthIndexFromDateString(entry?.start_date || '', (index % 12) + 1));
      if (!Number.isFinite(month_index) || month_index < 1 || month_index > 12) return null;
      const title = String(entry?.title || entry?.name || '').trim();
      if (!title) return null;
      const bucket = normalizeMonthlyBucket(entry?.bucket ?? entry?.category ?? entry?.column);
      const subtype = String(entry?.subtype || inferSubtype(bucket, title)).trim() || 'other';
      return {
        month_index,
        bucket,
        subtype,
        title,
        details: entry?.details ? String(entry.details) : (entry?.description ? String(entry.description) : null),
        start_date: entry?.start_date ? String(entry.start_date) : null,
        end_date: entry?.end_date ? String(entry.end_date) : null,
        source: 'ai',
        is_published: Boolean(entry?.is_published),
        published_to_calendar: Boolean(entry?.published_to_calendar),
      } as YearPlanMonthlyEntry;
    })
    .filter((entry: YearPlanMonthlyEntry | null): entry is YearPlanMonthlyEntry => Boolean(entry));

  const fallbackMonthly = monthlyEntries.length > 0 ? monthlyEntries : deriveMonthlyEntries(plan);

  const highlightsInput = Array.isArray((plan as any).operational_highlights)
    ? ((plan as any).operational_highlights as any[])
    : Array.isArray((plan as any).operationalHighlights)
      ? ((plan as any).operationalHighlights as any[])
      : [];

  const operationalHighlights: YearPlanOperationalHighlight[] = highlightsInput
    .map((item) => {
      if (typeof item === 'string') {
        const description = item.trim();
        if (!description) return null;
        return { title: 'Highlight', description };
      }
      const title = String(item?.title || 'Highlight').trim();
      const description = String(item?.description || item?.details || '').trim();
      if (!description) return null;
      return { title, description };
    })
    .filter((item: YearPlanOperationalHighlight | null): item is YearPlanOperationalHighlight => Boolean(item));

  return {
    ...plan,
    school_name: plan.school_name || schoolName,
    monthly_entries: fallbackMonthly,
    operational_highlights:
      operationalHighlights.length > 0
        ? operationalHighlights
        : [
            {
              title: 'Operational Rhythm',
              description: 'Balanced monthly cadence across closures, meetings, excursions, and family engagement events.',
            },
          ],
  };
}

async function persistMonthlyEntriesFallback(params: {
  supabase: ReturnType<typeof createClient>;
  preschoolId: string;
  userId: string;
  academicYear: number;
  monthlyEntries: YearPlanMonthlyEntry[];
  syncCalendar: boolean;
}): Promise<{ monthlySaved: number; syncedEntries: number }> {
  const { supabase, preschoolId, userId, academicYear, monthlyEntries, syncCalendar } = params;
  if (monthlyEntries.length === 0) {
    return { monthlySaved: 0, syncedEntries: 0 };
  }

  const normalized = monthlyEntries.map((entry) => ({
    preschool_id: preschoolId,
    created_by: userId,
    academic_year: academicYear,
    month_index: entry.month_index,
    bucket: entry.bucket,
    subtype: entry.subtype || inferSubtype(entry.bucket, entry.title),
    title: entry.title,
    details: entry.details || null,
    start_date: entry.start_date || null,
    end_date: entry.end_date || null,
    source: 'ai' as const,
    is_published: syncCalendar ? true : Boolean(entry.is_published),
    published_to_calendar: false,
  }));

  const deleteExisting = await supabase
    .from('year_plan_monthly_entries')
    .delete()
    .eq('preschool_id', preschoolId)
    .eq('academic_year', academicYear)
    .eq('created_by', userId)
    .in('source', ['ai', 'synced']);
  if (deleteExisting.error) throw deleteExisting.error;

  const inserted = await supabase
    .from('year_plan_monthly_entries')
    .insert(normalized)
    .select('id, academic_year, month_index, bucket, subtype, title, details, start_date, end_date');
  if (inserted.error) throw inserted.error;

  if (!syncCalendar) {
    return { monthlySaved: normalized.length, syncedEntries: 0 };
  }

  let syncedEntries = 0;
  for (const entry of inserted.data || []) {
    const startDate = entry.start_date || `${entry.academic_year}-${pad2(Number(entry.month_index))}-01`;
    const endDate = entry.end_date || startDate;

    if (entry.bucket === 'meetings_admin') {
      const meeting = await supabase.from('school_meetings').insert({
        preschool_id: preschoolId,
        created_by: userId,
        title: entry.title,
        description: entry.details || '',
        meeting_type: entry.subtype || 'other',
        meeting_date: startDate,
        start_time: '09:00',
        end_time: '10:00',
        agenda_items: [],
        invited_roles: ['teacher', 'parent'],
        status: 'draft',
      });
      if (meeting.error) throw meeting.error;
    } else if (entry.bucket === 'excursions_extras') {
      const excursion = await supabase.from('school_excursions').insert({
        preschool_id: preschoolId,
        created_by: userId,
        title: entry.title,
        description: entry.details || '',
        destination: entry.details || 'Local venue',
        excursion_date: startDate,
        learning_objectives: [],
        status: 'draft',
        estimated_cost_per_child: 0,
      });
      if (excursion.error) throw excursion.error;
    } else {
      const eventType =
        entry.bucket === 'donations_fundraisers'
          ? String(entry.subtype || '').toLowerCase().includes('donation')
            ? 'donation_drive'
            : 'fundraiser'
          : 'holiday';
      const schoolEvent = await supabase.from('school_events').insert({
        preschool_id: preschoolId,
        created_by: userId,
        title: entry.title,
        description: entry.details || '',
        event_type: eventType,
        start_date: startDate,
        end_date: endDate,
        all_day: true,
        is_recurring: false,
        target_audience: ['parent', 'teacher'],
        rsvp_enabled: false,
        send_notifications: true,
        status: 'scheduled',
      });
      if (schoolEvent.error) throw schoolEvent.error;
    }

    const updateRow = await supabase
      .from('year_plan_monthly_entries')
      .update({ published_to_calendar: true, is_published: true, source: 'synced' })
      .eq('id', entry.id);
    if (updateRow.error) throw updateRow.error;
    syncedEntries += 1;
  }

  return { monthlySaved: normalized.length, syncedEntries };
}

export default function AIYearPlannerPage() {
  const router = useRouter();
  const supabase = createClient();
  const [userId, setUserId] = useState<string>();
  const [generating, setGenerating] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<GeneratedYearPlan | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [expandedTerms, setExpandedTerms] = useState<number[]>([]);

  const [config, setConfig] = useState<YearPlanConfig>({
    academic_year: new Date().getFullYear(),
    school_type: 'preschool',
    age_groups: ['3-4', '4-5', '5-6'],
    terms_per_year: 4,
    focus_areas: ['cognitive', 'physical', 'social', 'language', 'creative'],
    include_excursions: true,
    include_parent_meetings: true,
    include_staff_training: true,
    include_special_events: true,
    budget_considerations: 'medium',
    school_context: '',
  });

  const { profile } = useUserProfile(userId);
  const { slug: tenantSlug } = useTenantSlug(userId);
  const preschoolName = profile?.preschoolName || 'Your School';
  const preschoolId = profile?.preschoolId;

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/sign-in');
        return;
      }
      setUserId(session.user.id);
    };
    initAuth();
  }, [router, supabase]);

  const toggleAgeGroup = (value: string) => {
    setConfig(prev => ({
      ...prev,
      age_groups: prev.age_groups.includes(value)
        ? prev.age_groups.filter(g => g !== value)
        : [...prev.age_groups, value]
    }));
  };

  const toggleFocusArea = (value: string) => {
    setConfig(prev => ({
      ...prev,
      focus_areas: prev.focus_areas.includes(value)
        ? prev.focus_areas.filter(f => f !== value)
        : [...prev.focus_areas, value]
    }));
  };

  const toggleTerm = (termNumber: number) => {
    setExpandedTerms(prev => 
      prev.includes(termNumber) 
        ? prev.filter(t => t !== termNumber)
        : [...prev, termNumber]
    );
  };

  const generateYearPlan = useCallback(async () => {
    if (!preschoolId) {
      setError('School ID not found');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      // Build the prompt for the AI
      const prompt = buildAIPrompt(config, preschoolName);

      // Call canonical web AI endpoint (proxies to supabase/functions/ai-proxy)
      const response = await fetch('/api/ai-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'principal',
          service_type: 'lesson_generation',
          enable_tools: false,
          prefer_openai: false,
          stream: false,
          payload: {
            prompt,
            // Keep these constraints in system context (ai-proxy schema)
            context: `You are an expert Early Childhood Development (ECD) curriculum specialist in South Africa.
You help principals plan their academic year according to CAPS (Curriculum and Assessment Policy Statement) guidelines.
You create comprehensive, practical year plans that consider the South African school calendar, public holidays, and developmentally appropriate practices.
Always respond with valid JSON that matches the requested structure. Output only JSON, no markdown.`,
          },
          metadata: {
            role: 'principal',
            source: 'ai_year_planner',
            planner_version: 'v2',
            strict_json: true,
            response_format: 'json',
            requested_terms: config.terms_per_year,
          },
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.message || result?.error || 'Failed to generate year plan');
      }
      
      // Parse the AI response
      let planData: GeneratedYearPlan;
      try {
        // Extract JSON from the response (handle markdown code blocks)
        let jsonStr = result.content || '';
        if (jsonStr.includes('```json')) {
          jsonStr = jsonStr.split('```json')[1].split('```')[0];
        } else if (jsonStr.includes('```')) {
          jsonStr = jsonStr.split('```')[1].split('```')[0];
        }
        planData = JSON.parse(jsonStr.trim());
      } catch (parseError) {
        console.error('Parse error:', parseError);
        if (MOCK_FALLBACK_ENABLED) {
          planData = generateMockPlan(config, preschoolName);
        } else {
          throw new Error('AI response was not valid JSON. Please try again.');
        }
      }

      const normalizedPlan = normalizeGeneratedPlan(planData, preschoolName);
      setGeneratedPlan(normalizedPlan);
      setExpandedTerms([1]); // Expand first term by default
    } catch (err: any) {
      console.error('Error generating year plan:', err);
      setError(err.message || 'Failed to generate year plan. Please try again.');
      if (MOCK_FALLBACK_ENABLED) {
        setGeneratedPlan(normalizeGeneratedPlan(generateMockPlan(config, preschoolName), preschoolName));
      } else {
        setGeneratedPlan(null);
      }
    } finally {
      setGenerating(false);
    }
  }, [preschoolId, preschoolName, config]);

  const saveYearPlan = async (syncCalendar = false) => {
    if (!generatedPlan || !preschoolId || !userId) return;

    setSaving(true);
    setError(null);

    try {
      const normalizedPlan = normalizeGeneratedPlan(generatedPlan, preschoolName);
      const planPayload = {
        ...normalizedPlan,
        config: {
          age_groups: config.age_groups,
        },
      };

      let fallbackStats: { monthlySaved: number; syncedEntries: number } | null = null;

      const { data: v2Data, error: v2Error } = await supabase.rpc('save_ai_year_plan_v2', {
        p_preschool_id: preschoolId,
        p_created_by: userId,
        p_plan: planPayload,
        p_sync_calendar: syncCalendar,
      });

      if (!v2Error && (!v2Data || (v2Data as any).success !== false)) {
        setSaveMessage(syncCalendar ? 'Year plan saved and published to calendar.' : 'Year plan draft saved successfully.');
      } else {
        console.warn('[AI Year Planner] save_ai_year_plan_v2 unavailable, using legacy fallback.', v2Error);

        const { data: legacyData, error: legacyError } = await supabase.rpc('save_ai_year_plan', {
          p_preschool_id: preschoolId,
          p_created_by: userId,
          p_plan: planPayload,
        });
        if (legacyError) throw legacyError;
        if (legacyData && (legacyData as any).success === false) {
          throw new Error((legacyData as any)?.message || 'Save failed.');
        }

        fallbackStats = await persistMonthlyEntriesFallback({
          supabase,
          preschoolId,
          userId,
          academicYear: normalizedPlan.academic_year,
          monthlyEntries: normalizedPlan.monthly_entries || [],
          syncCalendar,
        });

        if (syncCalendar) {
          setSaveMessage(
            `Saved using legacy fallback and published ${fallbackStats.syncedEntries}/${fallbackStats.monthlySaved} monthly entries to calendar.`,
          );
        } else {
          setSaveMessage(`Saved using legacy fallback with ${fallbackStats.monthlySaved} monthly entries.`);
        }
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error saving year plan:', err);
      setError(err.message || 'Failed to save year plan. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PrincipalShell tenantSlug={tenantSlug} preschoolName={preschoolName} preschoolId={preschoolId} hideRightSidebar={true}>
      <div className="section" style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{ padding: 12, background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', borderRadius: 12 }}>
            <Sparkles size={28} color="white" />
          </div>
          <div>
            <h1 className="h1">AI Year Plan Generator</h1>
            <p style={{ color: 'var(--muted)' }}>
              Let Dash AI help you create a comprehensive academic year plan
            </p>
          </div>
        </div>

        {/* Help Text for ECD newcomers */}
        <div className="card" style={{ background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)', marginBottom: 24, marginTop: 16 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ fontSize: 24 }}>💡</div>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4, color: '#166534' }}>New to ECD Planning?</div>
              <p style={{ fontSize: 14, color: '#15803d', lineHeight: 1.6 }}>
                Don&apos;t worry! This AI-powered tool will guide you through creating a professional year plan 
                aligned with South Africa&apos;s CAPS curriculum. Just configure your preferences below and let 
                Dash AI generate a complete plan with themes, activities, excursions, and meetings.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="card" style={{ background: '#fef2f2', borderColor: '#fecaca', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#dc2626' }}>
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          </div>
        )}

        {saveSuccess && (
          <div className="card" style={{ background: '#f0fdf4', borderColor: '#bbf7d0', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#16a34a' }}>
              <CheckCircle size={20} />
              <span>{saveMessage || 'Year plan saved successfully! Check your Year Planner and Curriculum Themes.'}</span>
            </div>
          </div>
        )}

        {/* Configuration Panel */}
        {!generatedPlan && (
          <div className="card" style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>Configure Your Year Plan</h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
              {/* Academic Year */}
              <div>
                <label style={{ display: 'block', fontWeight: 500, marginBottom: 8 }}>Academic Year</label>
                <select
                  value={config.academic_year}
                  onChange={(e) => setConfig(prev => ({ ...prev, academic_year: parseInt(e.target.value) }))}
                  className="input"
                  style={{ width: '100%' }}
                >
                  <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
                  <option value={new Date().getFullYear() + 1}>{new Date().getFullYear() + 1}</option>
                </select>
              </div>

              {/* Terms Per Year */}
              <div>
                <label style={{ display: 'block', fontWeight: 500, marginBottom: 8 }}>Terms Per Year</label>
                <select
                  value={config.terms_per_year}
                  onChange={(e) => setConfig(prev => ({ ...prev, terms_per_year: parseInt(e.target.value) }))}
                  className="input"
                  style={{ width: '100%' }}
                >
                  <option value={3}>3 Terms</option>
                  <option value={4}>4 Terms (Recommended)</option>
                </select>
              </div>

              {/* Budget Level */}
              <div>
                <label style={{ display: 'block', fontWeight: 500, marginBottom: 8 }}>Budget Considerations</label>
                <select
                  value={config.budget_considerations}
                  onChange={(e) => setConfig(prev => ({ ...prev, budget_considerations: e.target.value as any }))}
                  className="input"
                  style={{ width: '100%' }}
                >
                  <option value="low">Low Budget (Minimal costs)</option>
                  <option value="medium">Medium Budget (Balanced)</option>
                  <option value="high">Higher Budget (More resources)</option>
                </select>
              </div>
            </div>

            {/* Age Groups */}
            <div style={{ marginTop: 24 }}>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: 12 }}>Age Groups at Your School</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {AGE_GROUPS.map(group => (
                  <button
                    key={group.value}
                    onClick={() => toggleAgeGroup(group.value)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 20,
                      border: '2px solid',
                      borderColor: config.age_groups.includes(group.value) ? '#8b5cf6' : 'var(--border)',
                      background: config.age_groups.includes(group.value) ? '#8b5cf620' : 'transparent',
                      color: config.age_groups.includes(group.value) ? '#8b5cf6' : 'var(--text)',
                      cursor: 'pointer',
                      fontWeight: 500,
                      fontSize: 14,
                    }}
                  >
                    {group.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Focus Areas */}
            <div style={{ marginTop: 24 }}>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: 12 }}>Developmental Focus Areas</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {FOCUS_AREAS.map(area => (
                  <button
                    key={area.value}
                    onClick={() => toggleFocusArea(area.value)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 20,
                      border: '2px solid',
                      borderColor: config.focus_areas.includes(area.value) ? '#10b981' : 'var(--border)',
                      background: config.focus_areas.includes(area.value) ? '#10b98120' : 'transparent',
                      color: config.focus_areas.includes(area.value) ? '#10b981' : 'var(--text)',
                      cursor: 'pointer',
                      fontWeight: 500,
                      fontSize: 14,
                    }}
                  >
                    {area.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Include Options */}
            <div style={{ marginTop: 24 }}>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: 12 }}>Include in Plan</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                {[
                  { key: 'include_excursions', label: 'Field Trips & Excursions', icon: '🚌' },
                  { key: 'include_parent_meetings', label: 'Parent Meetings', icon: '👨‍👩‍👧' },
                  { key: 'include_staff_training', label: 'Staff Training Days', icon: '📚' },
                  { key: 'include_special_events', label: 'Special Events', icon: '🎉' },
                ].map(option => (
                  <label key={option.key} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 12, 
                    padding: 12,
                    background: 'var(--background)',
                    borderRadius: 8,
                    cursor: 'pointer'
                  }}>
                    <input
                      type="checkbox"
                      checked={config[option.key as keyof YearPlanConfig] as boolean}
                      onChange={(e) => setConfig(prev => ({ ...prev, [option.key]: e.target.checked }))}
                      style={{ width: 18, height: 18 }}
                    />
                    <span style={{ fontSize: 20 }}>{option.icon}</span>
                    <span style={{ fontWeight: 500 }}>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* School Context */}
            <div style={{ marginTop: 24 }}>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: 8 }}>
                Additional Context (Optional)
              </label>
              <textarea
                value={config.school_context}
                onChange={(e) => setConfig(prev => ({ ...prev, school_context: e.target.value }))}
                placeholder="Tell us about your school's unique needs, community, special programs, or any other context that should influence the year plan..."
                className="input"
                style={{ width: '100%', minHeight: 100, resize: 'vertical' }}
              />
            </div>

            {/* Generate Button */}
            <div style={{ marginTop: 32, display: 'flex', justifyContent: 'center' }}>
              <button
                onClick={generateYearPlan}
                disabled={generating || config.age_groups.length === 0 || config.focus_areas.length === 0}
                className="btn btnPrimary"
                style={{ 
                  padding: '16px 48px', 
                  fontSize: 18, 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 12,
                  background: 'linear-gradient(135deg, #8b5cf6, #6366f1)'
                }}
              >
                {generating ? (
                  <>
                    <Loader2 size={24} className="animate-spin" />
                    Generating Your Year Plan...
                  </>
                ) : (
                  <>
                    <Sparkles size={24} />
                    Generate Year Plan with AI
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Generated Plan Display */}
        {generatedPlan && (
          <div>
            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
              <button
                onClick={() => saveYearPlan(false)}
                disabled={saving}
                className="btn btnPrimary"
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                Save Draft
              </button>
              <button
                onClick={() => saveYearPlan(true)}
                disabled={saving}
                className="btn btnSecondary"
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
                Publish to Calendar
              </button>
              <button
                onClick={() => setGeneratedPlan(null)}
                className="btn btnSecondary"
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <RefreshCw size={18} />
                Start Over
              </button>
            </div>

            {/* Overview Card */}
            <div className="card" style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>
                {generatedPlan.school_name} - {generatedPlan.academic_year} Year Plan
              </h2>
              <p style={{ color: 'var(--muted)', lineHeight: 1.6 }}>{generatedPlan.overview}</p>

              {/* Annual Goals */}
              <div style={{ marginTop: 20 }}>
                <h3 style={{ fontWeight: 600, marginBottom: 12 }}>Annual Goals</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {generatedPlan.annual_goals.map((goal, i) => (
                    <span key={i} style={{
                      padding: '6px 12px',
                      background: '#10b98120',
                      color: '#10b981',
                      borderRadius: 16,
                      fontSize: 13,
                      fontWeight: 500
                    }}>
                      ✓ {goal}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Terms */}
            {generatedPlan.terms.map((term) => (
              <div key={term.term_number} className="card" style={{ marginBottom: 16 }}>
                <button
                  onClick={() => toggleTerm(term.term_number)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: 700,
                      fontSize: 18
                    }}>
                      T{term.term_number}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 18 }}>{term.name}</div>
                      <div style={{ fontSize: 14, color: 'var(--muted)' }}>
                        {term.start_date} to {term.end_date} • Theme: {term.theme}
                      </div>
                    </div>
                  </div>
                  {expandedTerms.includes(term.term_number) ? (
                    <ChevronUp size={24} color="var(--muted)" />
                  ) : (
                    <ChevronDown size={24} color="var(--muted)" />
                  )}
                </button>

                {expandedTerms.includes(term.term_number) && (
                  <div style={{ marginTop: 20 }}>
                    <p style={{ color: 'var(--muted)', marginBottom: 20 }}>{term.description}</p>

                    {/* Weekly Themes */}
                    <div style={{ marginBottom: 24 }}>
                      <h4 style={{ fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <BookOpen size={18} />
                        Weekly Themes
                      </h4>
                      <div style={{ display: 'grid', gap: 12 }}>
                        {term.weekly_themes.map((week) => (
                          <div key={week.week} style={{ 
                            padding: 16, 
                            background: 'var(--background)', 
                            borderRadius: 12,
                            borderLeft: '4px solid #6366f1'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                              <div style={{ fontWeight: 600 }}>Week {week.week}: {week.theme}</div>
                              <span style={{ fontSize: 12, color: '#6366f1', fontWeight: 500 }}>
                                {week.focus_area}
                              </span>
                            </div>
                            <div style={{ fontSize: 14, color: 'var(--muted)' }}>
                              <strong>Activities:</strong> {week.key_activities.join(', ')}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Excursions */}
                    {term.excursions.length > 0 && (
                      <div style={{ marginBottom: 24 }}>
                        <h4 style={{ fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <MapPin size={18} />
                          Planned Excursions
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                          {term.excursions.map((excursion, i) => (
                            <div key={i} style={{ 
                              padding: 16, 
                              background: '#fef3c720', 
                              borderRadius: 12,
                              border: '1px solid #fde68a'
                            }}>
                              <div style={{ fontWeight: 600, marginBottom: 4 }}>{excursion.title}</div>
                              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>
                                📍 {excursion.destination} • Week {excursion.week}
                              </div>
                              <div style={{ fontSize: 12, color: '#f59e0b' }}>
                                Est. R{excursion.estimated_cost} per child
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Meetings */}
                    {term.meetings.length > 0 && (
                      <div style={{ marginBottom: 24 }}>
                        <h4 style={{ fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Users size={18} />
                          Scheduled Meetings
                        </h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {term.meetings.map((meeting, i) => (
                            <span key={i} style={{
                              padding: '8px 16px',
                              background: '#dbeafe',
                              color: '#2563eb',
                              borderRadius: 20,
                              fontSize: 13,
                              fontWeight: 500
                            }}>
                              Week {meeting.week}: {meeting.title}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Special Events */}
                    {term.special_events.length > 0 && (
                      <div>
                        <h4 style={{ fontWeight: 600, marginBottom: 12 }}>🎉 Special Events</h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {term.special_events.map((event, i) => (
                            <span key={i} style={{
                              padding: '8px 16px',
                              background: '#fce7f3',
                              color: '#db2777',
                              borderRadius: 20,
                              fontSize: 13,
                              fontWeight: 500
                            }}>
                              {event.title} ({event.date})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Budget Summary */}
            {generatedPlan.monthly_entries && generatedPlan.monthly_entries.length > 0 && (
              <div className="card" style={{ marginBottom: 16 }}>
                <h3 style={{ fontWeight: 600, marginBottom: 16 }}>📅 Monthly Matrix Preview</h3>
                <div style={{ display: 'grid', gap: 12 }}>
                  {Array.from(groupMonthlyEntries(generatedPlan.monthly_entries).entries())
                    .sort(([a], [b]) => a - b)
                    .map(([month, entries]) => (
                      <div key={month} style={{ background: 'var(--background)', borderRadius: 12, padding: 14 }}>
                        <div style={{ fontWeight: 600, marginBottom: 8 }}>{MONTH_LABELS[month - 1] || `Month ${month}`}</div>
                        <div style={{ display: 'grid', gap: 6 }}>
                          {entries.map((entry, index) => (
                            <div key={`${entry.bucket}-${entry.title}-${index}`} style={{ fontSize: 13, color: 'var(--muted)' }}>
                              <strong style={{ color: 'var(--text)' }}>{monthlyBucketLabel(entry.bucket)}:</strong> {entry.title}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Budget Summary */}
            {generatedPlan.budget_summary && generatedPlan.budget_summary.length > 0 && (
              <div className="card">
                <h3 style={{ fontWeight: 600, marginBottom: 16 }}>💰 Estimated Budget Summary</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
                  {generatedPlan.budget_summary.map((item, i) => (
                    <div key={i} style={{ padding: 16, background: 'var(--background)', borderRadius: 12, textAlign: 'center' }}>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>{item.category}</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#10b981' }}>
                        R{item.estimated_cost.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </PrincipalShell>
  );
}

// Helper function to build AI prompt
function buildAIPrompt(config: YearPlanConfig, schoolName: string): string {
  const ageGroupLabels = AGE_GROUPS
    .filter(g => config.age_groups.includes(g.value))
    .map(g => g.label)
    .join(', ');

  const focusLabels = FOCUS_AREAS
    .filter(f => config.focus_areas.includes(f.value))
    .map(f => f.label)
    .join(', ');

  return `Generate a comprehensive ${config.academic_year} academic year plan for "${schoolName}", a South African preschool.

CONFIGURATION:
- Academic Year: ${config.academic_year}
- Number of Terms: ${config.terms_per_year}
- Age Groups: ${ageGroupLabels}
- Focus Areas: ${focusLabels}
- Budget Level: ${config.budget_considerations}
- Include Excursions: ${config.include_excursions}
- Include Parent Meetings: ${config.include_parent_meetings}
- Include Staff Training: ${config.include_staff_training}
- Include Special Events: ${config.include_special_events}
${config.school_context ? `- Additional Context: ${config.school_context}` : ''}

Please generate a JSON response with this exact structure:
{
  "academic_year": ${config.academic_year},
  "school_name": "${schoolName}",
  "overview": "Brief overview of the year plan",
  "annual_goals": ["goal1", "goal2", "goal3"],
  "terms": [
    {
      "term_number": 1,
      "name": "Term 1",
      "start_date": "2025-01-15",
      "end_date": "2025-03-21",
      "theme": "Main theme for the term",
      "description": "Term description",
      "weekly_themes": [
        {
          "week": 1,
          "theme": "Theme name",
          "focus_area": "Developmental area",
          "key_activities": ["activity1", "activity2"],
          "developmental_goals": ["goal1", "goal2"]
        }
      ],
      "excursions": [
        {
          "title": "Excursion name",
          "destination": "Location",
          "week": 4,
          "learning_objectives": ["objective1"],
          "estimated_cost": 50
        }
      ],
      "meetings": [
        {
          "title": "Meeting name",
          "type": "parent",
          "week": 2,
          "purpose": "Purpose"
        }
      ],
      "special_events": [
        {
          "title": "Event name",
          "date": "2025-02-14",
          "description": "Event description"
        }
      ]
    }
  ],
  "monthly_entries": [
    {
      "month_index": 1,
      "bucket": "holidays_closures",
      "subtype": "holiday",
      "title": "Term 1 Starts",
      "details": "School opening week",
      "start_date": "${config.academic_year}-01-15",
      "end_date": "${config.academic_year}-01-15"
    },
    {
      "month_index": 2,
      "bucket": "meetings_admin",
      "subtype": "parent_meeting",
      "title": "Parent Orientation",
      "details": "Families orientation and policy walkthrough",
      "start_date": "${config.academic_year}-02-10",
      "end_date": "${config.academic_year}-02-10"
    },
    {
      "month_index": 3,
      "bucket": "excursions_extras",
      "subtype": "excursion",
      "title": "Local Community Excursion",
      "details": "Age-appropriate local visit",
      "start_date": "${config.academic_year}-03-12",
      "end_date": "${config.academic_year}-03-12"
    },
    {
      "month_index": 4,
      "bucket": "donations_fundraisers",
      "subtype": "fundraiser",
      "title": "Family Fundraiser",
      "details": "Term fundraiser event",
      "start_date": "${config.academic_year}-04-20",
      "end_date": "${config.academic_year}-04-20"
    }
  ],
  "operational_highlights": [
    { "title": "Fundraising Strategy", "description": "Describe quick wins and signature events." },
    { "title": "Family Engagement", "description": "Describe meetings and communication rhythm." },
    { "title": "Learning Through Excursions", "description": "Describe excursion progression and outcomes." }
  ],
  "key_dates": [{"date": "2025-01-15", "event": "School opens"}],
  "budget_summary": [
    {"category": "Excursions", "estimated_cost": 5000},
    {"category": "Materials", "estimated_cost": 3000}
  ]
}

Use the South African school calendar for ${config.academic_year} with appropriate term dates.
Include South African public holidays and consider local context.
Make themes age-appropriate and aligned with CAPS curriculum.
${config.budget_considerations === 'low' ? 'Keep costs minimal - suggest free or low-cost activities.' : ''}
${config.budget_considerations === 'high' ? 'Include enrichment activities and quality resources.' : ''}`;
}

// Helper function to generate mock plan for demo/fallback
function generateMockPlan(config: YearPlanConfig, schoolName: string): GeneratedYearPlan {
  const termDates = [
    { start: `${config.academic_year}-01-15`, end: `${config.academic_year}-03-21` },
    { start: `${config.academic_year}-04-02`, end: `${config.academic_year}-06-14` },
    { start: `${config.academic_year}-07-09`, end: `${config.academic_year}-09-20` },
    { start: `${config.academic_year}-10-01`, end: `${config.academic_year}-12-06` },
  ];

  const themes = [
    { name: 'New Beginnings & Me', description: 'Self-discovery and settling in' },
    { name: 'Our Community', description: 'Exploring our local environment' },
    { name: 'Nature & Seasons', description: 'Understanding the natural world' },
    { name: 'Celebrations & Growth', description: 'Celebrating achievements' },
  ];

  return {
    academic_year: config.academic_year,
    school_name: schoolName,
    overview: `This comprehensive year plan for ${schoolName} focuses on holistic child development through play-based learning, aligned with CAPS curriculum guidelines. Each term builds progressively on previous learning while introducing engaging new themes.`,
    annual_goals: [
      'Develop strong social-emotional foundations',
      'Build pre-literacy and pre-numeracy skills',
      'Foster creativity and critical thinking',
      'Strengthen gross and fine motor skills',
      'Encourage independence and self-confidence',
    ],
    terms: termDates.slice(0, config.terms_per_year).map((dates, i) => ({
      term_number: i + 1,
      name: `Term ${i + 1}`,
      start_date: dates.start,
      end_date: dates.end,
      theme: themes[i].name,
      description: themes[i].description,
      weekly_themes: Array.from({ length: 10 }, (_, w) => ({
        week: w + 1,
        theme: `Week ${w + 1} Theme`,
        focus_area: config.focus_areas[w % config.focus_areas.length],
        key_activities: ['Circle time', 'Art activity', 'Outdoor play'],
        developmental_goals: ['Social skills', 'Motor development'],
      })),
      excursions: config.include_excursions ? [
        {
          title: `Term ${i + 1} Field Trip`,
          destination: ['Local Park', 'Fire Station', 'Farm Visit', 'Nature Reserve'][i],
          week: 5,
          learning_objectives: ['Community awareness', 'Real-world connections'],
          estimated_cost: config.budget_considerations === 'low' ? 20 : config.budget_considerations === 'high' ? 100 : 50,
        }
      ] : [],
      meetings: config.include_parent_meetings ? [
        { title: 'Parent Information Evening', type: 'parent', week: 2, purpose: 'Share term plans and expectations' },
        { title: 'Parent-Teacher Consultations', type: 'one_on_one', week: 8, purpose: 'Individual progress discussions' },
      ] : [],
      special_events: config.include_special_events ? [
        { title: ['Welcome Day', 'Sports Day', 'Concert', 'Graduation'][i], date: dates.end, description: 'End of term celebration' }
      ] : [],
    })),
    key_dates: [
      { date: `${config.academic_year}-01-15`, event: 'School Opens' },
      { date: `${config.academic_year}-03-21`, event: 'Human Rights Day' },
      { date: `${config.academic_year}-12-06`, event: 'Last Day of School' },
    ],
    budget_summary: [
      { category: 'Learning Materials', estimated_cost: config.budget_considerations === 'low' ? 2000 : config.budget_considerations === 'high' ? 8000 : 4000 },
      { category: 'Excursions', estimated_cost: config.budget_considerations === 'low' ? 1000 : config.budget_considerations === 'high' ? 5000 : 2500 },
      { category: 'Special Events', estimated_cost: config.budget_considerations === 'low' ? 500 : config.budget_considerations === 'high' ? 3000 : 1500 },
      { category: 'Staff Training', estimated_cost: config.budget_considerations === 'low' ? 1000 : config.budget_considerations === 'high' ? 4000 : 2000 },
    ],
  };
}

// Helper function to calculate date from term start + weeks
function calculateWeekDate(termStart: string, weekNumber: number): string {
  const date = new Date(termStart);
  date.setDate(date.getDate() + (weekNumber - 1) * 7);
  return date.toISOString().split('T')[0];
}
