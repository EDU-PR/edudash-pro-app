'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  BookOpen,
  ClipboardList,
  Loader2,
  Search,
  Users,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { TeacherShell } from '@/components/dashboard/teacher/TeacherShell';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';

interface ClassResult {
  id: string;
  name: string;
  grade_level: string | null;
  grade: string | null;
  teacher_id: string | null;
}

interface LessonResult {
  id: string;
  title: string;
  description: string | null;
  subject: string;
  status: string;
  age_group: string;
  created_at: string | null;
}

interface HomeworkClass {
  name: string | null;
  grade_level?: string | null;
  grade?: string | null;
}

interface HomeworkResult {
  id: string;
  title: string;
  description: string | null;
  subject: string;
  due_date: string | null;
  status: string;
  is_published: boolean | null;
  class_id: string | null;
  class?: HomeworkClass | HomeworkClass[] | null;
}

const PRINCIPAL_ROLES = ['principal', 'principal_admin', 'admin', 'super_admin', 'superadmin'];

const normalizeClassJoin = (value?: HomeworkClass | HomeworkClass[] | null): HomeworkClass | null => {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] || null) : value;
};

export default function TeacherSearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [userId, setUserId] = useState<string>();
  const [authLoading, setAuthLoading] = useState(true);

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [classResults, setClassResults] = useState<ClassResult[]>([]);
  const [lessonResults, setLessonResults] = useState<LessonResult[]>([]);
  const [homeworkResults, setHomeworkResults] = useState<HomeworkResult[]>([]);

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
    const param = (searchParams.get('q') || '').trim();
    if (param) setQuery(param);
  }, [searchParams]);

  const role = String(profile?.role || '').toLowerCase();
  const isPrincipalRole = PRINCIPAL_ROLES.includes(role);
  const schoolId = profile?.organizationId || profile?.preschoolId || null;

  useEffect(() => {
    const trimmed = query.trim();

    if (!userId) return;

    if (trimmed.length < 2) {
      setClassResults([]);
      setLessonResults([]);
      setHomeworkResults([]);
      setErrorMessage(null);
      setSearching(false);
      return;
    }

    const timer = setTimeout(() => {
      const runSearch = async () => {
        setSearching(true);
        setErrorMessage(null);

        try {
          let classesQuery = supabase
            .from('classes')
            .select('id, name, grade_level, grade, teacher_id')
            .order('name', { ascending: true })
            .limit(250);

          if (schoolId) {
            classesQuery = classesQuery.eq('preschool_id', schoolId);
          }

          if (!isPrincipalRole) {
            classesQuery = classesQuery.eq('teacher_id', userId);
          }

          const { data: classesData, error: classesError } = await classesQuery;
          if (classesError) throw classesError;

          const allClasses = (classesData || []) as ClassResult[];
          const filteredClasses = allClasses.filter((item) => {
            const haystack = [item.name, item.grade_level, item.grade]
              .map((part) => String(part || '').toLowerCase())
              .join(' ');
            return haystack.includes(trimmed.toLowerCase());
          });
          setClassResults(filteredClasses);

          let lessonsQuery = supabase
            .from('lessons')
            .select('id, title, description, subject, status, age_group, created_at')
            .order('created_at', { ascending: false })
            .limit(250);

          if (schoolId) {
            lessonsQuery = lessonsQuery.or(`teacher_id.eq.${userId},preschool_id.eq.${schoolId}`);
          } else {
            lessonsQuery = lessonsQuery.eq('teacher_id', userId);
          }

          const { data: lessonsData, error: lessonsError } = await lessonsQuery;
          if (lessonsError) throw lessonsError;

          const allLessons = (lessonsData || []) as LessonResult[];
          const filteredLessons = allLessons.filter((item) => {
            const haystack = [item.title, item.description, item.subject, item.status, item.age_group]
              .map((part) => String(part || '').toLowerCase())
              .join(' ');
            return haystack.includes(trimmed.toLowerCase());
          });
          setLessonResults(filteredLessons);

          const classIds = allClasses.map((item) => item.id);

          let homeworkQuery = supabase
            .from('homework_assignments')
            .select(`
              id,
              title,
              description,
              subject,
              due_date,
              status,
              is_published,
              class_id,
              class:classes!homework_assignments_class_id_fkey(name, grade_level, grade)
            `)
            .order('created_at', { ascending: false })
            .limit(250);

          if (schoolId) {
            homeworkQuery = homeworkQuery.eq('preschool_id', schoolId);
          } else {
            homeworkQuery = homeworkQuery.eq('teacher_id', userId);
          }

          if (!isPrincipalRole) {
            if (classIds.length === 0) {
              setHomeworkResults([]);
            } else {
              homeworkQuery = homeworkQuery.in('class_id', classIds);
            }
          }

          if (isPrincipalRole || classIds.length > 0 || !schoolId) {
            const { data: homeworkData, error: homeworkError } = await homeworkQuery;
            if (homeworkError) throw homeworkError;

            const allHomework = (homeworkData || []) as HomeworkResult[];
            const filteredHomework = allHomework.filter((item) => {
              const classJoin = normalizeClassJoin(item.class);
              const haystack = [
                item.title,
                item.description,
                item.subject,
                classJoin?.name,
                classJoin?.grade_level,
                classJoin?.grade,
                item.status,
              ]
                .map((part) => String(part || '').toLowerCase())
                .join(' ');
              return haystack.includes(trimmed.toLowerCase());
            });

            setHomeworkResults(filteredHomework);
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Search failed';
          setErrorMessage(message);
          setClassResults([]);
          setLessonResults([]);
          setHomeworkResults([]);
        } finally {
          setSearching(false);
        }
      };

      void runSearch();
    }, 250);

    return () => clearTimeout(timer);
  }, [isPrincipalRole, query, schoolId, supabase, userId]);

  const loading = authLoading || profileLoading;
  const trimmed = query.trim();

  const totalResults = useMemo(() => {
    return classResults.length + lessonResults.length + homeworkResults.length;
  }, [classResults.length, homeworkResults.length, lessonResults.length]);

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
          <h1 className="h1">Search</h1>
          <p className="muted">Find classes, lessons, and homework assignments from one place.</p>
        </div>

        <div className="section">
          <div className="card p-md">
            <div className="relative max-w-2xl">
              <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search classes, lessons, homework..."
                className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-700 bg-slate-950 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>

            <div className="mt-3 text-xs text-slate-400 flex items-center gap-3 flex-wrap">
              <span>Type at least 2 characters.</span>
              {trimmed.length >= 2 && !searching && <span>{totalResults} result(s)</span>}
              {searching && <span className="inline-flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching...</span>}
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

        {trimmed.length < 2 ? (
          <div className="section">
            <div className="card p-md text-sm text-slate-400">
              Start typing to search across your teacher workspace.
            </div>
          </div>
        ) : (
          <>
            <div className="section">
              <div className="card p-md">
                <h2 className="text-lg font-semibold text-white mb-3 inline-flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-300" />
                  Classes ({classResults.length})
                </h2>

                {classResults.length === 0 ? (
                  <p className="text-sm text-slate-400">No matching classes.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {classResults.map((classItem) => (
                      <button
                        key={classItem.id}
                        onClick={() => router.push(`/dashboard/teacher/classes/${classItem.id}`)}
                        className="text-left rounded-lg border border-slate-700 bg-slate-900/40 hover:border-blue-500/40 px-3 py-3"
                      >
                        <p className="text-sm font-semibold text-slate-100">{classItem.name}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          {classItem.grade_level || classItem.grade || 'Unspecified grade'}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="section">
              <div className="card p-md">
                <h2 className="text-lg font-semibold text-white mb-3 inline-flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-emerald-300" />
                  Lessons ({lessonResults.length})
                </h2>

                {lessonResults.length === 0 ? (
                  <p className="text-sm text-slate-400">No matching lessons.</p>
                ) : (
                  <div className="space-y-3">
                    {lessonResults.map((lessonItem) => (
                      <button
                        key={lessonItem.id}
                        onClick={() => router.push(`/dashboard/teacher/lessons/${lessonItem.id}`)}
                        className="w-full text-left rounded-lg border border-slate-700 bg-slate-900/40 hover:border-emerald-500/40 px-3 py-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-100">{lessonItem.title}</p>
                          <span className="text-[11px] text-slate-500">{lessonItem.status}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          {[lessonItem.subject, lessonItem.age_group].filter(Boolean).join(' • ')}
                        </p>
                        {lessonItem.description && (
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">{lessonItem.description}</p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="section">
              <div className="card p-md">
                <h2 className="text-lg font-semibold text-white mb-3 inline-flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-purple-300" />
                  Homework ({homeworkResults.length})
                </h2>

                {homeworkResults.length === 0 ? (
                  <p className="text-sm text-slate-400">No matching homework assignments.</p>
                ) : (
                  <div className="space-y-3">
                    {homeworkResults.map((homeworkItem) => {
                      const classJoin = normalizeClassJoin(homeworkItem.class);
                      return (
                        <button
                          key={homeworkItem.id}
                          onClick={() => router.push('/dashboard/teacher/homework')}
                          className="w-full text-left rounded-lg border border-slate-700 bg-slate-900/40 hover:border-purple-500/40 px-3 py-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-100">{homeworkItem.title}</p>
                            <span className="text-[11px] text-slate-500">{homeworkItem.status || 'draft'}</span>
                          </div>
                          <p className="text-xs text-slate-400 mt-1">
                            {[homeworkItem.subject, classJoin?.name].filter(Boolean).join(' • ')}
                          </p>
                          {homeworkItem.due_date && (
                            <p className="text-xs text-slate-500 mt-1">Due: {new Date(homeworkItem.due_date).toLocaleDateString()}</p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </TeacherShell>
  );
}
