'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Filter, Loader2, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { TeacherShell } from '@/components/dashboard/teacher/TeacherShell';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { FamilyUploadCard } from '@/components/dashboard/teacher/family-review/FamilyUploadCard';
import { RecentGradingList } from '@/components/dashboard/teacher/family-review/RecentGradingList';
import type { ClassSummary, ProgressUpload, ReviewFilter, StudentSummary, TutorAttempt } from '@/components/dashboard/teacher/family-review/types';
import { parseMetadata, parseScore, PRINCIPAL_ROLES, PROGRESS_STORAGE_BUCKET, STAFF_ROLES, toName } from '@/components/dashboard/teacher/family-review/types';

export default function TeacherFamilyReviewPage() {
  const router = useRouter();
  const supabase = createClient();
  const [userId, setUserId] = useState<string>();
  const [authLoading, setAuthLoading] = useState(true);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploads, setUploads] = useState<ProgressUpload[]>([]);
  const [attempts, setAttempts] = useState<TutorAttempt[]>([]);
  const [filter, setFilter] = useState<ReviewFilter>('all');
  const [openingUploadId, setOpeningUploadId] = useState<string | null>(null);

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
  const isPrincipalView = PRINCIPAL_ROLES.includes(role);
  const organizationId = profile?.organizationId || profile?.preschoolId;

  const fetchScopedStudents = useCallback(async (): Promise<StudentSummary[]> => {
    if (!organizationId) return [];

    if (isPrincipalView) {
      const { data, error } = await supabase
        .from('students')
        .select('id, first_name, last_name, class_id')
        .or(`preschool_id.eq.${organizationId},organization_id.eq.${organizationId}`)
        .order('first_name', { ascending: true });
      if (error) throw error;
      return (data || []) as StudentSummary[];
    }

    if (!userId) return [];

    const { data: classesData, error: classesError } = await supabase
      .from('classes')
      .select('id')
      .eq('teacher_id', userId)
      .or(`preschool_id.eq.${organizationId},organization_id.eq.${organizationId}`);
    if (classesError) throw classesError;

    const classIds = ((classesData || []) as ClassSummary[]).map((cls) => cls.id).filter(Boolean) as string[];
    if (classIds.length === 0) return [];

    const { data: studentsData, error: studentsError } = await supabase
      .from('students')
      .select('id, first_name, last_name, class_id')
      .in('class_id', classIds)
      .order('first_name', { ascending: true });
    if (studentsError) throw studentsError;
    return (studentsData || []) as StudentSummary[];
  }, [isPrincipalView, organizationId, supabase, userId]);

  const loadData = useCallback(async () => {
    if (!userId) return;

    if (!organizationId) {
      setUploads([]);
      setAttempts([]);
      setLoading(false);
      setErrorMessage('School context is missing for your account.');
      return;
    }

    if (!isStaff) {
      setUploads([]);
      setAttempts([]);
      setLoading(false);
      setErrorMessage('This page is available to teachers and school admins only.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const scopedStudents = await fetchScopedStudents();
      const scopedStudentIds = scopedStudents.map((student) => student.id).filter(Boolean);

      if (!isPrincipalView && scopedStudentIds.length === 0) {
        setUploads([]);
        setAttempts([]);
        return;
      }

      let uploadQuery = supabase
        .from('pop_uploads')
        .select(`
          id,
          student_id,
          title,
          description,
          subject,
          learning_area,
          achievement_level,
          status,
          file_path,
          file_name,
          created_at,
          student:students (
            id,
            first_name,
            last_name,
            class_id
          )
        `)
        .eq('upload_type', 'picture_of_progress')
        .eq('preschool_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(250);

      if (scopedStudentIds.length > 0) {
        uploadQuery = uploadQuery.in('student_id', scopedStudentIds);
      }

      const { data: uploadData, error: uploadError } = await uploadQuery;
      if (uploadError) throw uploadError;

      const uploadsResult = (uploadData || []) as ProgressUpload[];
      const uploadIds = new Set(uploadsResult.map((upload) => upload.id));

      let attemptsResult: TutorAttempt[] = [];
      if (scopedStudentIds.length > 0) {
        const { data: attemptData, error: attemptError } = await supabase
          .from('dash_ai_tutor_attempts')
          .select('id, student_id, score, feedback, topic, subject, metadata, created_at')
          .in('student_id', scopedStudentIds)
          .order('created_at', { ascending: false })
          .limit(500);
        if (attemptError) throw attemptError;

        attemptsResult = ((attemptData || []) as TutorAttempt[]).filter((attempt) => {
          const metadata = parseMetadata(attempt.metadata);
          const contextTag = String(metadata.context_tag || '').toLowerCase();
          const source = String(metadata.source || metadata.source_flow || '').toLowerCase();
          const progressUploadId = String(metadata.progress_upload_id || '');

          if (contextTag === 'family_activity') return true;
          if (source === 'dash_playground_activity') return true;
          if (source === 'family_activity_review') return true;
          if (progressUploadId && uploadIds.has(progressUploadId)) return true;
          if (String(attempt.subject || '').toLowerCase() === 'family_activity') return true;
          return false;
        });
      }

      setUploads(uploadsResult);
      setAttempts(attemptsResult);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load family activity review.';
      setErrorMessage(message);
      setUploads([]);
      setAttempts([]);
    } finally {
      setLoading(false);
    }
  }, [fetchScopedStudents, isPrincipalView, isStaff, organizationId, supabase, userId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const attemptsByUploadId = useMemo(() => {
    const mapping = new Map<string, TutorAttempt>();
    attempts.forEach((attempt) => {
      const metadata = parseMetadata(attempt.metadata);
      const uploadId = String(metadata.progress_upload_id || '');
      if (!uploadId || mapping.has(uploadId)) return;
      mapping.set(uploadId, attempt);
    });
    return mapping;
  }, [attempts]);

  const filteredUploads = useMemo(() => uploads.filter((upload) => {
    const hasGrade = attemptsByUploadId.has(upload.id);
    if (filter === 'needs_grading') return !hasGrade;
    if (filter === 'graded') return hasGrade;
    return true;
  }), [attemptsByUploadId, filter, uploads]);

  const stats = useMemo(() => {
    const gradedCount = uploads.filter((upload) => attemptsByUploadId.has(upload.id)).length;
    const scores = attempts
      .map((attempt) => parseScore(attempt.score))
      .filter((score): score is number => score !== null);
    const averageScore = scores.length
      ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
      : null;

    return {
      totalUploads: uploads.length,
      gradedCount,
      needsGrading: Math.max(uploads.length - gradedCount, 0),
      averageScore,
    };
  }, [attempts, attemptsByUploadId, uploads]);

  const handleOpenEvidence = useCallback(async (upload: ProgressUpload) => {
    setOpeningUploadId(upload.id);
    setErrorMessage(null);
    try {
      const { data, error } = await supabase.storage
        .from(PROGRESS_STORAGE_BUCKET)
        .createSignedUrl(upload.file_path, 3600);

      if (error || !data?.signedUrl) {
        throw new Error(error?.message || 'Could not create secure file URL.');
      }

      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to open uploaded evidence.';
      setErrorMessage(message);
    } finally {
      setOpeningUploadId(null);
    }
  }, [supabase]);

  const handleGradeWithDash = useCallback((upload: ProgressUpload) => {
    const studentName = toName(upload.student);
    const submissionText = `${studentName} completed "${upload.title}". ${upload.description || ''}`.trim();

    const params = new URLSearchParams({
      assignmentTitle: `${upload.title} Review`,
      gradeLevel: 'Age 3-6',
      submissionText,
      studentId: upload.student_id,
      contextTag: 'family_activity',
      sourceFlow: 'family_activity_review',
      progressUploadId: upload.id,
    });

    router.push(`/dashboard/teacher/ai-grader?${params.toString()}`);
  }, [router]);

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  const filterButtons: { key: ReviewFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'needs_grading', label: 'Needs grading' },
    { key: 'graded', label: 'Graded' },
  ];

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
              <div className="p-3 rounded-xl" style={{ background: 'linear-gradient(135deg, #2563eb, #10b981)' }}>
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="h1">Family Activity Review</h1>
                <p className="muted">
                  {isPrincipalView ? 'School-wide uploads and grading.' : 'Uploads and grading for your classes.'}
                </p>
              </div>
            </div>

            <button
              onClick={() => void loadData()}
              disabled={loading}
              className="px-4 py-2 rounded-lg text-sm font-semibold border border-slate-600 text-slate-200 hover:bg-slate-800/60 disabled:opacity-50"
            >
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

        <div className="section">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="card p-md">
              <div className="text-2xl font-extrabold text-white">{stats.totalUploads}</div>
              <div className="text-xs uppercase tracking-wide text-slate-400">Uploads</div>
            </div>
            <div className="card p-md">
              <div className="text-2xl font-extrabold text-amber-300">{stats.needsGrading}</div>
              <div className="text-xs uppercase tracking-wide text-slate-400">Needs grading</div>
            </div>
            <div className="card p-md">
              <div className="text-2xl font-extrabold text-emerald-300">{stats.averageScore ?? '--'}</div>
              <div className="text-xs uppercase tracking-wide text-slate-400">Average score</div>
            </div>
          </div>
        </div>

        <div className="section">
          <div className="card p-md">
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <Filter className="w-4 h-4 text-slate-400" />
              {filterButtons.map((button) => (
                <button
                  key={button.key}
                  onClick={() => setFilter(button.key)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                  style={{
                    background: filter === button.key ? 'var(--primary)' : 'rgba(148, 163, 184, 0.14)',
                    color: filter === button.key ? '#fff' : '#cbd5e1',
                  }}
                >
                  {button.label}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="text-sm text-gray-400 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading uploads...
              </div>
            ) : filteredUploads.length === 0 ? (
              <div className="rounded-lg border border-slate-700 bg-slate-900/30 p-8 text-center">
                <div className="text-sm text-slate-300">No uploads match this filter yet.</div>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredUploads.map((upload) => (
                  <FamilyUploadCard
                    key={upload.id}
                    upload={upload}
                    linkedAttempt={attemptsByUploadId.get(upload.id)}
                    openingUploadId={openingUploadId}
                    onOpenEvidence={(u) => void handleOpenEvidence(u)}
                    onGradeWithDash={handleGradeWithDash}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <RecentGradingList attempts={attempts} uploads={uploads} />
      </div>
    </TeacherShell>
  );
}
