'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  Calendar,
  Check,
  ClipboardList,
  Loader2,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { TeacherShell } from '@/components/dashboard/teacher/TeacherShell';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';

interface ClassJoin {
  name: string | null;
  grade_level?: string | null;
  grade?: string | null;
}

interface AssignmentRow {
  id: string;
  title: string;
  description: string | null;
  subject: string;
  due_date: string | null;
  status: string;
  is_published: boolean | null;
  class_id: string | null;
  teacher_id: string | null;
  estimated_time_minutes: number | null;
  created_at: string | null;
  class?: ClassJoin | ClassJoin[] | null;
}

interface SubmissionRow {
  assignment_id: string | null;
  status: string | null;
  grade: number | null;
}

interface AssignmentCard extends AssignmentRow {
  totalSubmissions: number;
  gradedSubmissions: number;
  pendingSubmissions: number;
}

type HomeworkFilter = 'all' | 'draft' | 'published' | 'overdue';

const PRINCIPAL_ROLES = ['principal', 'principal_admin', 'admin', 'super_admin', 'superadmin'];

const normalizeClass = (value?: ClassJoin | ClassJoin[] | null): ClassJoin | null => {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] || null) : value;
};

const isSubmissionGraded = (submission: SubmissionRow): boolean => {
  const status = String(submission.status || '').toLowerCase();
  return status === 'graded' || status === 'reviewed' || typeof submission.grade === 'number';
};

export default function TeacherHomeworkPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [userId, setUserId] = useState<string>();
  const [authLoading, setAuthLoading] = useState(true);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [togglingAssignmentId, setTogglingAssignmentId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [assignments, setAssignments] = useState<AssignmentCard[]>([]);
  const [filter, setFilter] = useState<HomeworkFilter>('all');

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
  const isPrincipalRole = PRINCIPAL_ROLES.includes(role);
  const schoolId = profile?.organizationId || profile?.preschoolId || null;
  const routeClassId = (searchParams.get('classId') || '').trim();

  const loadAssignments = useCallback(async () => {
    if (!userId) {
      setAssignments([]);
      setLoadingAssignments(false);
      return;
    }

    setLoadingAssignments(true);
    setErrorMessage(null);

    try {
      let assignmentsQuery = supabase
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
          teacher_id,
          estimated_time_minutes,
          created_at,
          class:classes!homework_assignments_class_id_fkey(name, grade_level, grade)
        `)
        .order('created_at', { ascending: false })
        .limit(300);

      if (schoolId) {
        assignmentsQuery = assignmentsQuery.eq('preschool_id', schoolId);
      }

      if (!isPrincipalRole) {
        assignmentsQuery = assignmentsQuery.eq('teacher_id', userId);
      }

      if (routeClassId) {
        assignmentsQuery = assignmentsQuery.eq('class_id', routeClassId);
      }

      const { data: assignmentData, error: assignmentError } = await assignmentsQuery;
      if (assignmentError) throw assignmentError;

      const rows = (assignmentData || []) as AssignmentRow[];
      const assignmentIds = rows.map((row) => row.id);

      let submissionRows: SubmissionRow[] = [];
      if (assignmentIds.length > 0) {
        let submissionQuery = supabase
          .from('homework_submissions')
          .select('assignment_id, status, grade')
          .in('assignment_id', assignmentIds);

        if (schoolId) {
          submissionQuery = submissionQuery.eq('preschool_id', schoolId);
        }

        const { data: submissionData, error: submissionError } = await submissionQuery;
        if (submissionError) throw submissionError;
        submissionRows = (submissionData || []) as SubmissionRow[];
      }

      const cards = rows.map((row) => {
        const linkedSubmissions = submissionRows.filter((submission) => submission.assignment_id === row.id);
        const gradedSubmissions = linkedSubmissions.filter(isSubmissionGraded).length;
        const totalSubmissions = linkedSubmissions.length;

        return {
          ...row,
          totalSubmissions,
          gradedSubmissions,
          pendingSubmissions: Math.max(totalSubmissions - gradedSubmissions, 0),
        };
      });

      setAssignments(cards);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load assignments';
      setErrorMessage(message);
      setAssignments([]);
    } finally {
      setLoadingAssignments(false);
    }
  }, [isPrincipalRole, routeClassId, schoolId, supabase, userId]);

  useEffect(() => {
    void loadAssignments();
  }, [loadAssignments]);

  const filteredAssignments = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);

    return assignments.filter((assignment) => {
      const status = String(assignment.status || '').toLowerCase();
      const isPublished = Boolean(assignment.is_published) || status === 'published';

      if (filter === 'draft') return !isPublished;
      if (filter === 'published') return isPublished;
      if (filter === 'overdue') return Boolean(assignment.due_date && assignment.due_date < today);
      return true;
    });
  }, [assignments, filter]);

  const stats = useMemo(() => {
    const totalAssignments = assignments.length;
    const publishedAssignments = assignments.filter((item) => item.is_published).length;
    const totalPendingSubmissions = assignments.reduce((acc, item) => acc + item.pendingSubmissions, 0);
    const totalGradedSubmissions = assignments.reduce((acc, item) => acc + item.gradedSubmissions, 0);

    return {
      totalAssignments,
      publishedAssignments,
      totalPendingSubmissions,
      totalGradedSubmissions,
    };
  }, [assignments]);

  const canManageAssignment = useCallback((assignment: AssignmentCard): boolean => {
    return isPrincipalRole || assignment.teacher_id === userId;
  }, [isPrincipalRole, userId]);

  const handleTogglePublish = useCallback(async (assignment: AssignmentCard) => {
    if (!canManageAssignment(assignment)) {
      setErrorMessage('You do not have permission to publish this assignment.');
      return;
    }

    const nextPublished = !assignment.is_published;
    setTogglingAssignmentId(assignment.id);
    setErrorMessage(null);

    try {
      const { error } = await supabase
        .from('homework_assignments')
        .update({
          is_published: nextPublished,
          status: nextPublished ? 'published' : 'draft',
          assigned_at: nextPublished ? new Date().toISOString() : null,
        })
        .eq('id', assignment.id);

      if (error) throw error;

      setAssignments((prev) => prev.map((item) => {
        if (item.id !== assignment.id) return item;
        return {
          ...item,
          is_published: nextPublished,
          status: nextPublished ? 'published' : 'draft',
        };
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update publish state';
      setErrorMessage(message);
    } finally {
      setTogglingAssignmentId(null);
    }
  }, [canManageAssignment, supabase]);

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
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h1 className="h1">Homework & Assignments</h1>
              <p className="muted">Manage homework drafts, publishing, and grading workflow.</p>
            </div>

            <button
              onClick={() => router.push('/dashboard/teacher/homework/create')}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2 shadow-lg"
            >
              <Plus className="w-4 h-4" />
              Assign Homework
            </button>
          </div>
        </div>

        <div className="section">
          <div className="card p-md">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2">
                <div className="text-xs text-slate-400">Assignments</div>
                <div className="text-xl font-semibold text-white">{stats.totalAssignments}</div>
              </div>
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-3 py-2">
                <div className="text-xs text-emerald-300">Published</div>
                <div className="text-xl font-semibold text-emerald-200">{stats.publishedAssignments}</div>
              </div>
              <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2">
                <div className="text-xs text-amber-300">Pending grading</div>
                <div className="text-xl font-semibold text-amber-200">{stats.totalPendingSubmissions}</div>
              </div>
              <div className="rounded-lg border border-blue-500/30 bg-blue-950/20 px-3 py-2">
                <div className="text-xs text-blue-300">Graded</div>
                <div className="text-xl font-semibold text-blue-200">{stats.totalGradedSubmissions}</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {([
                ['all', 'All'],
                ['draft', 'Draft'],
                ['published', 'Published'],
                ['overdue', 'Overdue'],
              ] as Array<[HomeworkFilter, string]>).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    filter === key
                      ? 'border-purple-500 bg-purple-900/20 text-purple-300'
                      : 'border-slate-700 text-slate-300 hover:bg-slate-800/80'
                  }`}
                >
                  {label}
                </button>
              ))}
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
          {loadingAssignments ? (
            <div className="card p-md text-sm text-slate-300 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading assignments...
            </div>
          ) : filteredAssignments.length === 0 ? (
            <div className="card p-md text-center py-16">
              <ClipboardList className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No assignments found</h3>
              <p className="text-slate-400 mb-6">
                {routeClassId ? 'No assignments exist for this class filter.' : 'Create a homework assignment to start grading workflow.'}
              </p>
              <button
                onClick={() => router.push('/dashboard/teacher/homework/create')}
                className="px-5 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create Assignment
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {filteredAssignments.map((assignment) => {
                const classJoin = normalizeClass(assignment.class);
                const dueDate = assignment.due_date ? new Date(assignment.due_date) : null;
                const isOverdue = Boolean(assignment.due_date && assignment.due_date < new Date().toISOString().slice(0, 10));
                const canManage = canManageAssignment(assignment);

                return (
                  <div key={assignment.id} className="card p-md border border-slate-700/70 hover:border-purple-500/40 transition-colors">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <h3 className="text-lg font-semibold text-white truncate">{assignment.title}</h3>
                        <p className="text-xs text-slate-400 mt-1">
                          {[assignment.subject, classJoin?.name].filter(Boolean).join(' • ') || 'General homework'}
                        </p>
                      </div>

                      <span
                        className={`text-[11px] px-2.5 py-1 rounded-full border ${assignment.is_published
                          ? 'border-emerald-500/40 bg-emerald-900/20 text-emerald-300'
                          : 'border-amber-500/40 bg-amber-900/20 text-amber-300'
                        }`}
                      >
                        {assignment.is_published ? 'Published' : 'Draft'}
                      </span>
                    </div>

                    {assignment.description && (
                      <p className="text-sm text-slate-300 line-clamp-3 mb-3">{assignment.description}</p>
                    )}

                    <div className="grid grid-cols-3 gap-2 mb-4">
                      <div className="rounded-lg border border-slate-700 bg-slate-900/30 px-2.5 py-2">
                        <div className="text-[11px] text-slate-400">Total</div>
                        <div className="text-sm font-semibold text-slate-100">{assignment.totalSubmissions}</div>
                      </div>
                      <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-2.5 py-2">
                        <div className="text-[11px] text-amber-300">Pending</div>
                        <div className="text-sm font-semibold text-amber-200">{assignment.pendingSubmissions}</div>
                      </div>
                      <div className="rounded-lg border border-blue-500/30 bg-blue-950/20 px-2.5 py-2">
                        <div className="text-[11px] text-blue-300">Graded</div>
                        <div className="text-sm font-semibold text-blue-200">{assignment.gradedSubmissions}</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-3 text-xs text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {dueDate ? dueDate.toLocaleDateString() : 'No due date'}
                      </span>
                      {isOverdue && <span className="text-red-300">Overdue</span>}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <button
                        onClick={() => router.push(`/dashboard/teacher/assignments?assignmentId=${assignment.id}`)}
                        className="px-3 py-2 rounded-lg border border-blue-500/40 bg-blue-900/20 hover:bg-blue-900/30 text-xs font-medium text-blue-200"
                      >
                        Grade Queue
                      </button>

                      <button
                        onClick={() => router.push(`/dashboard/teacher/ai-grader?assignmentTitle=${encodeURIComponent(assignment.title)}&gradeLevel=${encodeURIComponent(classJoin?.grade_level || classJoin?.grade || 'General')}`)}
                        className="px-3 py-2 rounded-lg border border-cyan-500/40 bg-cyan-900/20 hover:bg-cyan-900/30 text-xs font-medium text-cyan-200 inline-flex items-center justify-center gap-1"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        AI Grader
                      </button>

                      <button
                        onClick={() => void handleTogglePublish(assignment)}
                        disabled={!canManage || togglingAssignmentId === assignment.id}
                        className="px-3 py-2 rounded-lg border border-emerald-500/40 bg-emerald-900/20 hover:bg-emerald-900/30 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium text-emerald-200"
                      >
                        {togglingAssignmentId === assignment.id ? 'Updating...' : assignment.is_published ? 'Unpublish' : 'Publish'}
                      </button>

                      <button
                        onClick={() => router.push('/dashboard/teacher/homework/create')}
                        className="px-3 py-2 rounded-lg border border-slate-600 hover:bg-slate-800/80 text-xs font-medium text-slate-200"
                      >
                        Duplicate
                      </button>
                    </div>

                    {assignment.totalSubmissions > 0 && assignment.pendingSubmissions === 0 && (
                      <div className="mt-3 text-xs text-emerald-300 inline-flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        All submissions graded
                      </div>
                    )}

                    {assignment.totalSubmissions === 0 && (
                      <div className="mt-3 text-xs text-slate-500 inline-flex items-center gap-1">
                        <X className="w-3.5 h-3.5" />
                        No submissions yet
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </TeacherShell>
  );
}
