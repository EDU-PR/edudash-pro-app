'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Clock3,
  Edit3,
  Eye,
  Loader2,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { TeacherShell } from '@/components/dashboard/teacher/TeacherShell';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { getInitials, getLessonSummary } from '@/lib/utils/lessonContent';

interface TeacherMini {
  first_name: string | null;
  last_name: string | null;
}

interface LessonRow {
  id: string;
  title: string;
  description: string | null;
  subject: string;
  age_group: string;
  duration_minutes: number | null;
  status: string;
  is_ai_generated: boolean | null;
  teacher_id: string | null;
  preschool_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  objectives: string[] | null;
  materials_needed: string | null;
  content: string | null;
  teacher?: TeacherMini | TeacherMini[] | null;
}

type LessonFilter = 'all' | 'active' | 'draft' | 'mine';

const PRINCIPAL_ROLES = ['principal', 'principal_admin', 'admin', 'super_admin', 'superadmin'];

const normalizeTeacher = (value?: TeacherMini | TeacherMini[] | null): TeacherMini | null => {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] || null) : value;
};

const statusStyles: Record<string, { label: string; border: string; bg: string; text: string }> = {
  draft: { label: 'Draft', border: 'border-amber-500/40', bg: 'bg-amber-900/20', text: 'text-amber-300' },
  active: { label: 'Active', border: 'border-emerald-500/40', bg: 'bg-emerald-900/20', text: 'text-emerald-300' },
  published: { label: 'Published', border: 'border-blue-500/40', bg: 'bg-blue-900/20', text: 'text-blue-300' },
  archived: { label: 'Archived', border: 'border-slate-500/40', bg: 'bg-slate-900/20', text: 'text-slate-300' },
};

const getStatusStyle = (status: string) => {
  const key = String(status || '').toLowerCase();
  return statusStyles[key] || {
    label: key ? key.replace(/_/g, ' ') : 'Unknown',
    border: 'border-slate-500/40',
    bg: 'bg-slate-900/20',
    text: 'text-slate-300',
  };
};

const isMissingRelation = (error: { code?: string; message?: string } | null) => {
  if (!error) return false;
  return error.code === '42P01' || String(error.message || '').toLowerCase().includes('does not exist');
};

export default function TeacherLessonsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [userId, setUserId] = useState<string>();
  const [authLoading, setAuthLoading] = useState(true);
  const [loadingLessons, setLoadingLessons] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingLessonId, setDeletingLessonId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<LessonFilter>('all');

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

  useEffect(() => {
    const query = (searchParams.get('q') || '').trim();
    if (query) {
      setSearch(query);
    }
  }, [searchParams]);

  const schoolId = profile?.organizationId || profile?.preschoolId || null;
  const role = String(profile?.role || '').toLowerCase();
  const isPrincipalRole = PRINCIPAL_ROLES.includes(role);

  const fetchLessons = useCallback(async (isRefresh = false) => {
    if (!userId) {
      setLessons([]);
      setLoadingLessons(false);
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoadingLessons(true);
    }

    setErrorMessage(null);

    try {
      const baseSelect = [
        'id',
        'title',
        'description',
        'subject',
        'age_group',
        'duration_minutes',
        'status',
        'is_ai_generated',
        'teacher_id',
        'preschool_id',
        'created_at',
        'updated_at',
        'objectives',
        'materials_needed',
        'content',
      ].join(', ');

      const withTeacherSelect = `${baseSelect}, teacher:profiles!lessons_teacher_id_fkey(first_name, last_name)`;

      const buildQuery = (selectClause: string) => {
        let query = supabase
          .from('lessons')
          .select(selectClause)
          .order('created_at', { ascending: false })
          .limit(300);

        if (schoolId) {
          query = query.or(`teacher_id.eq.${userId},preschool_id.eq.${schoolId}`);
        } else {
          query = query.eq('teacher_id', userId);
        }

        return query;
      };

      const initialResult = await buildQuery(withTeacherSelect);
      let data = initialResult.data;

      if (initialResult.error && !isMissingRelation(initialResult.error)) {
        throw initialResult.error;
      }

      if (initialResult.error && isMissingRelation(initialResult.error)) {
        const fallback = await buildQuery(baseSelect);
        if (fallback.error) throw fallback.error;
        data = fallback.data;
      }

      setLessons((data || []) as LessonRow[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load lessons';
      setErrorMessage(message);
      setLessons([]);
    } finally {
      setLoadingLessons(false);
      setRefreshing(false);
    }
  }, [schoolId, supabase, userId]);

  useEffect(() => {
    void fetchLessons(false);
  }, [fetchLessons]);

  const filteredLessons = useMemo(() => {
    const query = search.trim().toLowerCase();

    return lessons.filter((lesson) => {
      const status = String(lesson.status || '').toLowerCase();
      const isMine = lesson.teacher_id === userId;

      if (filter === 'active' && !['active', 'published'].includes(status)) {
        return false;
      }
      if (filter === 'draft' && status !== 'draft') {
        return false;
      }
      if (filter === 'mine' && !isMine) {
        return false;
      }

      if (!query) return true;

      const haystack = [
        lesson.title,
        lesson.subject,
        lesson.age_group,
        lesson.status,
        lesson.description,
      ]
        .map((item) => String(item || '').toLowerCase())
        .join(' ');

      return haystack.includes(query);
    });
  }, [filter, lessons, search, userId]);

  const stats = useMemo(() => {
    const all = lessons.length;
    const mine = lessons.filter((lesson) => lesson.teacher_id === userId).length;
    const active = lessons.filter((lesson) => ['active', 'published'].includes(String(lesson.status || '').toLowerCase())).length;
    const draft = lessons.filter((lesson) => String(lesson.status || '').toLowerCase() === 'draft').length;
    return { all, mine, active, draft };
  }, [lessons, userId]);

  const canEditLesson = useCallback((lesson: LessonRow) => {
    return isPrincipalRole || lesson.teacher_id === userId;
  }, [isPrincipalRole, userId]);

  const handleDeleteLesson = useCallback(async (lesson: LessonRow) => {
    if (!canEditLesson(lesson)) {
      setErrorMessage('You can only delete lessons you created.');
      return;
    }

    const confirmed = confirm(`Delete "${lesson.title}"? This cannot be undone.`);
    if (!confirmed) return;

    setDeletingLessonId(lesson.id);
    setErrorMessage(null);

    try {
      const { error: approvalsError } = await supabase
        .from('lesson_approvals')
        .delete()
        .eq('lesson_id', lesson.id);
      if (approvalsError && !isMissingRelation(approvalsError)) {
        throw approvalsError;
      }

      const { error: activitiesError } = await supabase
        .from('lesson_activities')
        .delete()
        .eq('lesson_id', lesson.id);
      if (activitiesError && !isMissingRelation(activitiesError)) {
        throw activitiesError;
      }

      const { error: lessonError } = await supabase
        .from('lessons')
        .delete()
        .eq('id', lesson.id);
      if (lessonError) throw lessonError;

      setLessons((prev) => prev.filter((item) => item.id !== lesson.id));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete lesson';
      setErrorMessage(message);
    } finally {
      setDeletingLessonId(null);
    }
  }, [canEditLesson, supabase]);

  const loading = authLoading || profileLoading;

  if (loading) {
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
            <div>
              <h1 className="h1">Lessons Hub</h1>
              <p className="muted">Browse, search, edit, and assign lesson plans across your school.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => void fetchLessons(true)}
                className="px-3 py-2 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800/60 text-sm font-medium"
              >
                Refresh
              </button>
              <button
                onClick={() => router.push('/dashboard/teacher/lessons/create')}
                className="px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2 shadow-lg"
              >
                <Plus className="w-4 h-4" />
                <span>Create Lesson</span>
              </button>
            </div>
          </div>
        </div>

        <div className="section">
          <div className="card p-md">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <div className="rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2">
                <div className="text-xs text-slate-400">All lessons</div>
                <div className="text-xl font-semibold text-white">{stats.all}</div>
              </div>
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-3 py-2">
                <div className="text-xs text-emerald-300">Active / Published</div>
                <div className="text-xl font-semibold text-emerald-200">{stats.active}</div>
              </div>
              <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2">
                <div className="text-xs text-amber-300">Drafts</div>
                <div className="text-xl font-semibold text-amber-200">{stats.draft}</div>
              </div>
              <div className="rounded-lg border border-blue-500/30 bg-blue-950/20 px-3 py-2">
                <div className="text-xs text-blue-300">My lessons</div>
                <div className="text-xl font-semibold text-blue-200">{stats.mine}</div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
              <div className="relative w-full md:max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by title, subject, age group, status..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {([
                  ['all', `All (${stats.all})`],
                  ['active', `Active (${stats.active})`],
                  ['draft', `Drafts (${stats.draft})`],
                  ['mine', `Mine (${stats.mine})`],
                ] as Array<[LessonFilter, string]>).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      filter === key
                        ? 'border-blue-500 bg-blue-900/20 text-blue-300'
                        : 'border-slate-700 text-slate-300 hover:bg-slate-800/70'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
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
          {loadingLessons ? (
            <div className="card p-md text-sm text-slate-300 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading lessons...
            </div>
          ) : filteredLessons.length === 0 ? (
            <div className="card p-md text-center py-16">
              <BookOpen className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                {search.trim() ? 'No lessons match your search' : 'No lessons yet'}
              </h3>
              <p className="text-slate-400 mb-6">
                {search.trim()
                  ? 'Try a different keyword or filter.'
                  : 'Generate your first lesson with Dash AI and publish it to your classes.'}
              </p>
              <button
                onClick={() => router.push('/dashboard/teacher/lessons/create')}
                className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold inline-flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Create a lesson
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {filteredLessons.map((lesson) => {
                const statusStyle = getStatusStyle(lesson.status);
                const teacher = normalizeTeacher(lesson.teacher);
                const lessonOwner = lesson.teacher_id === userId ? 'You' : (teacher ? `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim() || 'School teacher' : 'School teacher');
                const isMine = lesson.teacher_id === userId;
                const canEdit = canEditLesson(lesson);

                return (
                  <div
                    key={lesson.id}
                    className="card p-md border border-slate-700/70 hover:border-blue-500/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <h3 className="text-lg font-semibold text-white truncate">{lesson.title || 'Untitled lesson'}</h3>
                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                          <span className="inline-flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" />
                            {lesson.age_group || 'All ages'}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Clock3 className="w-3.5 h-3.5" />
                            {lesson.duration_minutes || 30} min
                          </span>
                        </p>
                      </div>

                      <div className={`text-xs px-2.5 py-1 rounded-full border ${statusStyle.border} ${statusStyle.bg} ${statusStyle.text}`}>
                        {statusStyle.label}
                      </div>
                    </div>

                    <p className="text-sm text-slate-300 line-clamp-3 mb-3">
                      {getLessonSummary(lesson.description, lesson.content)}
                    </p>

                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span className="h-7 w-7 rounded-full bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center">
                          {getInitials(teacher?.first_name, teacher?.last_name)}
                        </span>
                        <div>
                          <p className="text-xs text-slate-200">{lessonOwner}</p>
                          <p className="text-[11px] text-slate-500">{isMine ? 'Created by you' : 'Organization lesson'}</p>
                        </div>
                      </div>

                      <div className="text-right">
                        {lesson.is_ai_generated && (
                          <p className="text-[11px] text-cyan-300 font-semibold mb-0.5">AI generated</p>
                        )}
                        <p className="text-[11px] text-slate-500">
                          {lesson.created_at ? new Date(lesson.created_at).toLocaleDateString() : 'Unknown date'}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <button
                        onClick={() => router.push(`/dashboard/teacher/lessons/${lesson.id}`)}
                        className="px-3 py-2 rounded-lg border border-slate-700 hover:bg-slate-800/80 text-xs font-medium text-slate-200 inline-flex items-center justify-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View
                      </button>

                      <button
                        onClick={() => router.push(`/dashboard/teacher/lessons/${lesson.id}/assign`)}
                        className="px-3 py-2 rounded-lg border border-blue-500/40 bg-blue-900/20 hover:bg-blue-900/30 text-xs font-medium text-blue-200 inline-flex items-center justify-center gap-1"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Assign
                      </button>

                      <button
                        onClick={() => canEdit && router.push(`/dashboard/teacher/lessons/${lesson.id}/edit`)}
                        disabled={!canEdit}
                        className="px-3 py-2 rounded-lg border border-amber-500/40 bg-amber-900/20 hover:bg-amber-900/30 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium text-amber-200 inline-flex items-center justify-center gap-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Edit
                      </button>

                      <button
                        onClick={() => void handleDeleteLesson(lesson)}
                        disabled={!canEdit || deletingLessonId === lesson.id}
                        className="px-3 py-2 rounded-lg border border-red-500/40 bg-red-900/20 hover:bg-red-900/30 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium text-red-200 inline-flex items-center justify-center gap-1"
                      >
                        {deletingLessonId === lesson.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        Delete
                      </button>
                    </div>

                    {lesson.status.toLowerCase() === 'published' && (
                      <div className="mt-3 text-[11px] text-emerald-300 inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Visible to assigned learners
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {refreshing && (
            <p className="text-xs text-slate-500 mt-3 flex items-center gap-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Refreshing lessons...
            </p>
          )}
        </div>
      </div>
    </TeacherShell>
  );
}
