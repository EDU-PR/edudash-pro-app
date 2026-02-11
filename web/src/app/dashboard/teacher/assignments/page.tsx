'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  Sparkles,
  User,
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

interface AssignmentOption {
  id: string;
  title: string;
  class_id: string | null;
  subject: string;
  due_date: string | null;
  status: string;
  is_published: boolean | null;
  teacher_id: string | null;
  class?: ClassJoin | ClassJoin[] | null;
}

interface StudentMini {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  class_id: string | null;
}

interface SubmissionRow {
  id: string;
  assignment_id: string | null;
  student_id: string | null;
  status: string | null;
  submitted_at: string | null;
  created_at: string | null;
  submission_text: string | null;
  grade: number | null;
  feedback: string | null;
  graded_at: string | null;
  student?: StudentMini | StudentMini[] | null;
}

interface SubmissionCard extends SubmissionRow {
  assignment: AssignmentOption | null;
}

type GradingFilter = 'all' | 'pending' | 'graded';

const PRINCIPAL_ROLES = ['principal', 'principal_admin', 'admin', 'super_admin', 'superadmin'];

const normalizeClass = (value?: ClassJoin | ClassJoin[] | null): ClassJoin | null => {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] || null) : value;
};

const normalizeStudent = (value?: StudentMini | StudentMini[] | null): StudentMini | null => {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] || null) : value;
};

const isGraded = (submission: SubmissionCard): boolean => {
  const status = String(submission.status || '').toLowerCase();
  return status === 'graded' || status === 'reviewed' || typeof submission.grade === 'number';
};

export default function AssignmentsGradingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [userId, setUserId] = useState<string>();
  const [authLoading, setAuthLoading] = useState(true);

  const [loadingData, setLoadingData] = useState(true);
  const [savingSubmissionId, setSavingSubmissionId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [assignments, setAssignments] = useState<AssignmentOption[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionCard[]>([]);

  const [filter, setFilter] = useState<GradingFilter>('pending');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('all');
  const [gradeDrafts, setGradeDrafts] = useState<Record<string, string>>({});
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, string>>({});

  const { profile, loading: profileLoading } = useUserProfile(userId);
  const { slug: tenantSlug } = useTenantSlug(userId);

  useEffect(() => {
    const initAuth = async () => {
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
    void initAuth();
  }, [router, supabase]);

  const role = String(profile?.role || '').toLowerCase();
  const isPrincipalRole = PRINCIPAL_ROLES.includes(role);
  const schoolId = profile?.organizationId || profile?.preschoolId || null;
  const routeAssignmentId = (searchParams.get('assignmentId') || '').trim();

  const loadData = useCallback(async () => {
    if (!userId) {
      setAssignments([]);
      setSubmissions([]);
      setLoadingData(false);
      return;
    }

    setLoadingData(true);
    setErrorMessage(null);

    try {
      let assignmentsQuery = supabase
        .from('homework_assignments')
        .select(`
          id,
          title,
          class_id,
          subject,
          due_date,
          status,
          is_published,
          teacher_id,
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

      const { data: assignmentData, error: assignmentError } = await assignmentsQuery;
      if (assignmentError) throw assignmentError;

      const assignmentRows = (assignmentData || []) as AssignmentOption[];
      setAssignments(assignmentRows);

      const assignmentMap = new Map<string, AssignmentOption>();
      assignmentRows.forEach((assignment) => assignmentMap.set(assignment.id, assignment));
      const assignmentIds = assignmentRows.map((assignment) => assignment.id);

      if (routeAssignmentId && assignmentIds.includes(routeAssignmentId)) {
        setSelectedAssignmentId(routeAssignmentId);
      }

      if (assignmentIds.length === 0) {
        setSubmissions([]);
        setGradeDrafts({});
        setFeedbackDrafts({});
        return;
      }

      let submissionQuery = supabase
        .from('homework_submissions')
        .select(`
          id,
          assignment_id,
          student_id,
          status,
          submitted_at,
          created_at,
          submission_text,
          grade,
          feedback,
          graded_at,
          student:students!homework_submissions_student_id_fkey(id, full_name, first_name, last_name, class_id)
        `)
        .in('assignment_id', assignmentIds)
        .order('created_at', { ascending: false })
        .limit(800);

      if (schoolId) {
        submissionQuery = submissionQuery.eq('preschool_id', schoolId);
      }

      const { data: submissionData, error: submissionError } = await submissionQuery;
      if (submissionError) throw submissionError;

      const submissionRows = (submissionData || []) as SubmissionRow[];
      const cards: SubmissionCard[] = submissionRows.map((submission) => ({
        ...submission,
        assignment: submission.assignment_id ? (assignmentMap.get(submission.assignment_id) || null) : null,
      }));

      setSubmissions(cards);

      const nextGradeDrafts: Record<string, string> = {};
      const nextFeedbackDrafts: Record<string, string> = {};
      cards.forEach((submission) => {
        nextGradeDrafts[submission.id] = typeof submission.grade === 'number' ? String(submission.grade) : '';
        nextFeedbackDrafts[submission.id] = submission.feedback || '';
      });
      setGradeDrafts(nextGradeDrafts);
      setFeedbackDrafts(nextFeedbackDrafts);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load submissions';
      setErrorMessage(message);
      setAssignments([]);
      setSubmissions([]);
    } finally {
      setLoadingData(false);
    }
  }, [isPrincipalRole, routeAssignmentId, schoolId, supabase, userId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredSubmissions = useMemo(() => {
    return submissions.filter((submission) => {
      if (selectedAssignmentId !== 'all' && submission.assignment_id !== selectedAssignmentId) {
        return false;
      }

      if (filter === 'pending') {
        return !isGraded(submission);
      }
      if (filter === 'graded') {
        return isGraded(submission);
      }

      return true;
    });
  }, [filter, selectedAssignmentId, submissions]);

  const stats = useMemo(() => {
    const total = submissions.length;
    const graded = submissions.filter(isGraded).length;
    const pending = Math.max(total - graded, 0);
    return { total, graded, pending };
  }, [submissions]);

  const updateGradeDraft = (submissionId: string, value: string) => {
    setGradeDrafts((prev) => ({ ...prev, [submissionId]: value }));
  };

  const updateFeedbackDraft = (submissionId: string, value: string) => {
    setFeedbackDrafts((prev) => ({ ...prev, [submissionId]: value }));
  };

  const handleSaveReview = useCallback(async (submission: SubmissionCard) => {
    if (!userId) return;

    const gradeRaw = String(gradeDrafts[submission.id] || '').trim();
    const feedbackRaw = String(feedbackDrafts[submission.id] || '').trim();

    let gradeValue: number | null = null;
    if (gradeRaw) {
      const parsed = Number(gradeRaw);
      if (!Number.isFinite(parsed)) {
        setErrorMessage('Grade must be a valid number.');
        return;
      }
      gradeValue = Math.max(0, Math.min(100, Math.round(parsed)));
    }

    setSavingSubmissionId(submission.id);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload: Record<string, unknown> = {
        graded_by: userId,
        graded_at: new Date().toISOString(),
        status: gradeValue !== null ? 'graded' : 'reviewed',
      };

      payload.grade = gradeValue;
      payload.feedback = feedbackRaw || null;

      const { error } = await supabase
        .from('homework_submissions')
        .update(payload)
        .eq('id', submission.id);

      if (error) throw error;

      setSubmissions((prev) => prev.map((item) => {
        if (item.id !== submission.id) return item;
        return {
          ...item,
          grade: gradeValue,
          feedback: feedbackRaw || null,
          status: gradeValue !== null ? 'graded' : 'reviewed',
          graded_at: new Date().toISOString(),
        };
      }));

      setSuccessMessage('Submission review saved.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save submission review';
      setErrorMessage(message);
    } finally {
      setSavingSubmissionId(null);
    }
  }, [feedbackDrafts, gradeDrafts, supabase, userId]);

  const handleAIAssist = (submission: SubmissionCard) => {
    const assignment = submission.assignment;
    const classJoin = normalizeClass(assignment?.class);
    const student = normalizeStudent(submission.student);

    const params = new URLSearchParams({
      assignmentTitle: assignment?.title || 'Homework Submission',
      gradeLevel: classJoin?.grade_level || classJoin?.grade || 'General',
      submissionText: submission.submission_text || '',
      studentId: student?.id || '',
      contextTag: 'homework_submission',
      sourceFlow: 'assignments_queue',
    });

    router.push(`/dashboard/teacher/ai-grader?${params.toString()}`);
  };

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
              <h1 className="h1">Grade Assignments</h1>
              <p className="muted">Review student homework submissions and publish grades.</p>
            </div>

            <button
              onClick={() => router.push('/dashboard/teacher/homework')}
              className="px-4 py-2 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800/60 text-sm font-semibold"
            >
              Back to Homework
            </button>
          </div>
        </div>

        <div className="section">
          <div className="card p-md">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
              <div className="rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2">
                <div className="text-xs text-slate-400">Total submissions</div>
                <div className="text-xl font-semibold text-white">{stats.total}</div>
              </div>
              <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2">
                <div className="text-xs text-amber-300">Pending</div>
                <div className="text-xl font-semibold text-amber-200">{stats.pending}</div>
              </div>
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-3 py-2">
                <div className="text-xs text-emerald-300">Graded</div>
                <div className="text-xl font-semibold text-emerald-200">{stats.graded}</div>
              </div>
              <div className="rounded-lg border border-blue-500/30 bg-blue-950/20 px-3 py-2">
                <div className="text-xs text-blue-300">Assignments</div>
                <div className="text-xl font-semibold text-blue-200">{assignments.length}</div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-3">
              <select
                value={selectedAssignmentId}
                onChange={(event) => setSelectedAssignmentId(event.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                <option value="all">All assignments</option>
                {assignments.map((assignment) => (
                  <option key={assignment.id} value={assignment.id}>
                    {assignment.title}
                  </option>
                ))}
              </select>

              <div className="flex gap-2">
                {([
                  ['pending', `Pending (${stats.pending})`],
                  ['graded', `Graded (${stats.graded})`],
                  ['all', `All (${stats.total})`],
                ] as Array<[GradingFilter, string]>).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                      filter === key
                        ? 'border-blue-500 bg-blue-900/20 text-blue-300'
                        : 'border-slate-700 text-slate-300 hover:bg-slate-800/80'
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

        {successMessage && (
          <div className="section">
            <div className="card p-md border border-emerald-500/40 bg-emerald-950/20 text-emerald-200 flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          </div>
        )}

        <div className="section">
          {loadingData ? (
            <div className="card p-md text-sm text-slate-300 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading submissions...
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="card p-md text-center py-16">
              <ClipboardCheck className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No submissions found</h3>
              <p className="text-slate-400 mb-6">No student submissions match your current filters.</p>
              <button
                onClick={() => router.push('/dashboard/teacher/homework')}
                className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
              >
                View Homework Board
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSubmissions.map((submission) => {
                const assignment = submission.assignment;
                const classJoin = normalizeClass(assignment?.class);
                const student = normalizeStudent(submission.student);
                const studentName = student?.full_name || `${student?.first_name || ''} ${student?.last_name || ''}`.trim() || 'Student';
                const submissionText = submission.submission_text || '';

                return (
                  <div key={submission.id} className="card p-md border border-slate-700/70 hover:border-blue-500/30 transition-colors">
                    <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                      <div>
                        <h3 className="text-lg font-semibold text-white">{assignment?.title || 'Assignment'}</h3>
                        <p className="text-xs text-slate-400 mt-1 inline-flex items-center gap-1">
                          <User className="w-3.5 h-3.5" />
                          {studentName}
                          {classJoin?.name ? ` • ${classJoin.name}` : ''}
                        </p>
                      </div>

                      <div className={`text-[11px] px-2.5 py-1 rounded-full border ${isGraded(submission)
                        ? 'border-emerald-500/40 bg-emerald-900/20 text-emerald-300'
                        : 'border-amber-500/40 bg-amber-900/20 text-amber-300'
                      }`}>
                        {isGraded(submission) ? 'Graded' : 'Pending'}
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 mb-2">
                      Submitted: {submission.submitted_at ? new Date(submission.submitted_at).toLocaleString() : 'Not submitted yet'}
                    </p>

                    <div className="rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 mb-3">
                      <p className="text-xs text-slate-400 mb-1">Submission text</p>
                      {submissionText ? (
                        <p className="text-sm text-slate-200 whitespace-pre-wrap line-clamp-6">{submissionText}</p>
                      ) : (
                        <p className="text-sm text-slate-500">No text submission provided.</p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="text-xs text-slate-300 font-semibold block mb-1">Grade (0-100)</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={gradeDrafts[submission.id] || ''}
                          onChange={(event) => updateGradeDraft(submission.id, event.target.value)}
                          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500/50"
                          placeholder="Optional"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-slate-300 font-semibold block mb-1">Feedback</label>
                        <textarea
                          value={feedbackDrafts[submission.id] || ''}
                          onChange={(event) => updateFeedbackDraft(submission.id, event.target.value)}
                          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500/50"
                          rows={3}
                          placeholder="Write feedback for parent/student..."
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => void handleSaveReview(submission)}
                        disabled={savingSubmissionId === submission.id}
                        className="px-3 py-2 rounded-lg border border-emerald-500/40 bg-emerald-900/20 hover:bg-emerald-900/30 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-emerald-200"
                      >
                        {savingSubmissionId === submission.id ? 'Saving...' : 'Save Review'}
                      </button>

                      <button
                        onClick={() => handleAIAssist(submission)}
                        className="px-3 py-2 rounded-lg border border-cyan-500/40 bg-cyan-900/20 hover:bg-cyan-900/30 text-xs font-semibold text-cyan-200 inline-flex items-center gap-1"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Grade with AI
                      </button>
                    </div>
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
