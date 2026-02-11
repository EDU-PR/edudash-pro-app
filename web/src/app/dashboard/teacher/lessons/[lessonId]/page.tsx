'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, CheckCircle2, Edit3, Layers, Loader2, Save, Send, Target } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { TeacherShell } from '@/components/dashboard/teacher/TeacherShell';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { normalizeMaterialsList, normalizeStringList, parseLessonContent } from '@/lib/utils/lessonContent';
import { LessonContentSection } from '@/components/dashboard/teacher/lesson-detail/LessonContentSection';
import { LessonMetaCard } from '@/components/dashboard/teacher/lesson-detail/LessonMetaCard';
import type { LessonRow } from '@/components/dashboard/teacher/lesson-detail/types';
import { nextStatusForAction, normalizeTeacher, PRINCIPAL_ROLES } from '@/components/dashboard/teacher/lesson-detail/types';

export default function TeacherLessonDetailPage() {
  const router = useRouter();
  const params = useParams<{ lessonId: string }>();
  const lessonId = params?.lessonId;
  const supabase = createClient();

  const [userId, setUserId] = useState<string>();
  const [authLoading, setAuthLoading] = useState(true);

  const [loadingLesson, setLoadingLesson] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [lesson, setLesson] = useState<LessonRow | null>(null);

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

  const loadLesson = useCallback(async () => {
    if (!lessonId || !userId) {
      setLoadingLesson(false);
      return;
    }

    setLoadingLesson(true);
    setErrorMessage(null);

    try {
      const { data, error } = await supabase
        .from('lessons')
        .select(`
          id,
          title,
          description,
          subject,
          age_group,
          duration_minutes,
          status,
          is_ai_generated,
          teacher_id,
          preschool_id,
          created_at,
          updated_at,
          objectives,
          materials_needed,
          content,
          teacher:profiles!lessons_teacher_id_fkey(first_name, last_name)
        `)
        .eq('id', lessonId)
        .single();

      if (error) throw error;
      setLesson(data as LessonRow);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load lesson';
      setErrorMessage(message);
      setLesson(null);
    } finally {
      setLoadingLesson(false);
    }
  }, [lessonId, supabase, userId]);

  useEffect(() => {
    void loadLesson();
  }, [loadLesson]);

  const role = String(profile?.role || '').toLowerCase();
  const isPrincipalRole = PRINCIPAL_ROLES.includes(role);
  const schoolId = profile?.organizationId || profile?.preschoolId || null;

  const canEdit = useMemo(() => {
    if (!lesson || !userId) return false;
    return isPrincipalRole || lesson.teacher_id === userId;
  }, [isPrincipalRole, lesson, userId]);

  const hasSchoolAccess = useMemo(() => {
    if (!lesson) return true;
    if (lesson.teacher_id === userId) return true;
    if (!schoolId) return true;
    return lesson.preschool_id === schoolId;
  }, [lesson, schoolId, userId]);

  const parsedContent = useMemo(() => parseLessonContent(lesson?.content), [lesson?.content]);
  const objectives = useMemo(() => normalizeStringList(lesson?.objectives), [lesson?.objectives]);
  const materials = useMemo(() => normalizeMaterialsList(lesson?.materials_needed), [lesson?.materials_needed]);

  const handleStatusChange = useCallback(async () => {
    if (!lesson || !canEdit) return;

    const { nextStatus, ctaLabel } = nextStatusForAction(lesson.status);
    const confirmed = confirm(`${ctaLabel} for "${lesson.title}"?`);
    if (!confirmed) return;

    setUpdatingStatus(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const { error } = await supabase
        .from('lessons')
        .update({
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', lesson.id);

      if (error) throw error;

      setLesson((prev) => (prev ? { ...prev, status: nextStatus, updated_at: new Date().toISOString() } : prev));
      setSuccessMessage(`Lesson status updated to ${nextStatus}.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update status';
      setErrorMessage(message);
    } finally {
      setUpdatingStatus(false);
    }
  }, [canEdit, lesson, supabase]);

  const loading = authLoading || profileLoading || loadingLesson;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  if (!lesson || !hasSchoolAccess) {
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
            <div className="card p-md border border-red-500/40 bg-red-950/20 text-red-200">
              <h2 className="text-lg font-semibold mb-1">Lesson not available</h2>
              <p className="text-sm">{errorMessage || 'This lesson could not be loaded or you do not have access.'}</p>
              <button
                onClick={() => router.push('/dashboard/teacher/lessons')}
                className="mt-4 px-4 py-2 rounded-lg border border-red-400/40 hover:bg-red-900/20 text-sm font-semibold"
              >
                Back to Lessons
              </button>
            </div>
          </div>
        </div>
      </TeacherShell>
    );
  }

  const teacher = normalizeTeacher(lesson.teacher);
  const ownerLabel = lesson.teacher_id === userId
    ? 'You'
    : `${teacher?.first_name || ''} ${teacher?.last_name || ''}`.trim() || 'School teacher';
  const statusAction = nextStatusForAction(lesson.status);

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
            <button
              onClick={() => router.push('/dashboard/teacher/lessons')}
              className="px-3 py-2 rounded-lg border border-slate-700 hover:bg-slate-800/80 text-slate-200 text-sm font-medium inline-flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Lessons
            </button>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => router.push(`/dashboard/teacher/lessons/${lesson.id}/assign`)}
                className="px-3 py-2 rounded-lg border border-blue-500/40 bg-blue-900/20 hover:bg-blue-900/30 text-blue-200 text-sm font-semibold inline-flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                Assign
              </button>

              <button
                onClick={() => canEdit && router.push(`/dashboard/teacher/lessons/${lesson.id}/edit`)}
                disabled={!canEdit}
                className="px-3 py-2 rounded-lg border border-amber-500/40 bg-amber-900/20 hover:bg-amber-900/30 disabled:opacity-40 disabled:cursor-not-allowed text-amber-200 text-sm font-semibold inline-flex items-center gap-2"
              >
                <Edit3 className="w-4 h-4" />
                Edit
              </button>

              <button
                onClick={() => void handleStatusChange()}
                disabled={!canEdit || updatingStatus}
                className="px-3 py-2 rounded-lg border border-emerald-500/40 bg-emerald-900/20 hover:bg-emerald-900/30 disabled:opacity-40 disabled:cursor-not-allowed text-emerald-200 text-sm font-semibold inline-flex items-center gap-2"
              >
                {updatingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {statusAction.ctaLabel}
              </button>
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

        <LessonMetaCard lesson={lesson} ownerLabel={ownerLabel} />

        <div className="section grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="card p-md">
            <h2 className="text-lg font-semibold text-white mb-3 inline-flex items-center gap-2">
              <Target className="w-5 h-5 text-emerald-300" />
              Learning Objectives
            </h2>
            {objectives.length === 0 ? (
              <p className="text-sm text-slate-400">No objectives listed.</p>
            ) : (
              <ul className="space-y-2 text-sm text-slate-200">
                {objectives.map((objective, index) => (
                  <li key={`${objective}-${index}`} className="flex gap-2">
                    <span className="text-emerald-300 mt-0.5">•</span>
                    <span>{objective}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card p-md">
            <h2 className="text-lg font-semibold text-white mb-3 inline-flex items-center gap-2">
              <Layers className="w-5 h-5 text-purple-300" />
              Materials
            </h2>
            {materials.length === 0 ? (
              <p className="text-sm text-slate-400">No materials listed.</p>
            ) : (
              <ul className="space-y-2 text-sm text-slate-200">
                {materials.map((material, index) => (
                  <li key={`${material}-${index}`} className="flex gap-2">
                    <span className="text-purple-300 mt-0.5">•</span>
                    <span>{material}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <LessonContentSection parsedContent={parsedContent} rawContent={lesson.content} />
      </div>
    </TeacherShell>
  );
}
