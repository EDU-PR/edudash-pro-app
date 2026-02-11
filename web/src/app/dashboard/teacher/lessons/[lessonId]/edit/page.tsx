'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, Loader2, Save } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { TeacherShell } from '@/components/dashboard/teacher/TeacherShell';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { splitTextareaLines, toTextareaValue } from '@/lib/utils/lessonContent';

interface LessonRow {
  id: string;
  title: string;
  description: string | null;
  subject: string;
  age_group: string;
  duration_minutes: number | null;
  status: string;
  teacher_id: string | null;
  preschool_id: string | null;
  objectives: string[] | null;
  materials_needed: string | null;
  content: string | null;
}

const PRINCIPAL_ROLES = ['principal', 'principal_admin', 'admin', 'super_admin', 'superadmin'];
const STATUS_OPTIONS = ['draft', 'active', 'published', 'archived'];
const SUBJECT_OPTIONS = [
  'General',
  'Mathematics',
  'Literacy',
  'Science',
  'Art',
  'Music',
  'Physical Education',
  'Life Skills',
  'STEM',
];

export default function TeacherLessonEditPage() {
  const params = useParams<{ lessonId: string }>();
  const lessonId = params?.lessonId;
  const router = useRouter();
  const supabase = createClient();

  const [userId, setUserId] = useState<string>();
  const [authLoading, setAuthLoading] = useState(true);

  const [loadingLesson, setLoadingLesson] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [lesson, setLesson] = useState<LessonRow | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState('General');
  const [ageGroup, setAgeGroup] = useState('3-6 years');
  const [durationMinutes, setDurationMinutes] = useState('30');
  const [status, setStatus] = useState('draft');
  const [objectivesText, setObjectivesText] = useState('');
  const [materialsText, setMaterialsText] = useState('');
  const [content, setContent] = useState('');

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
          teacher_id,
          preschool_id,
          objectives,
          materials_needed,
          content
        `)
        .eq('id', lessonId)
        .single();

      if (error) throw error;

      const loaded = data as LessonRow;
      setLesson(loaded);
      setTitle(loaded.title || '');
      setDescription(loaded.description || '');
      setSubject(loaded.subject || 'General');
      setAgeGroup(loaded.age_group || '3-6 years');
      setDurationMinutes(String(loaded.duration_minutes || 30));
      setStatus(loaded.status || 'draft');
      setObjectivesText(toTextareaValue(loaded.objectives));
      setMaterialsText(toTextareaValue(loaded.materials_needed));
      setContent(loaded.content || '');
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
  const canEdit = useMemo(() => {
    if (!lesson || !userId) return false;
    return isPrincipalRole || lesson.teacher_id === userId;
  }, [isPrincipalRole, lesson, userId]);

  const handleSave = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!lesson) return;
    if (!canEdit) {
      setErrorMessage('You do not have permission to edit this lesson.');
      return;
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setErrorMessage('Lesson title is required.');
      return;
    }

    const parsedDuration = Number(durationMinutes);
    const safeDuration = Number.isFinite(parsedDuration) && parsedDuration > 0 ? Math.round(parsedDuration) : 30;

    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const objectives = splitTextareaLines(objectivesText);
      const materials = splitTextareaLines(materialsText);

      const { error } = await supabase
        .from('lessons')
        .update({
          title: trimmedTitle,
          description: description.trim() || null,
          subject: subject.trim() || 'General',
          age_group: ageGroup.trim() || 'All ages',
          duration_minutes: safeDuration,
          status: STATUS_OPTIONS.includes(status) ? status : 'draft',
          objectives: objectives.length > 0 ? objectives : null,
          materials_needed: materials.length > 0 ? materials.join(', ') : null,
          content: content.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', lesson.id);

      if (error) throw error;

      setSuccessMessage('Lesson updated successfully.');
      setTimeout(() => {
        router.push(`/dashboard/teacher/lessons/${lesson.id}`);
      }, 600);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update lesson';
      setErrorMessage(message);
    } finally {
      setSaving(false);
    }
  }, [
    ageGroup,
    canEdit,
    content,
    description,
    durationMinutes,
    lesson,
    materialsText,
    objectivesText,
    router,
    status,
    subject,
    supabase,
    title,
  ]);

  const loading = authLoading || profileLoading || loadingLesson;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  if (!lesson || !canEdit) {
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
              <h2 className="text-lg font-semibold mb-2">Unable to edit this lesson</h2>
              <p className="text-sm">{errorMessage || 'Either the lesson does not exist or your role cannot edit it.'}</p>
              <button
                onClick={() => router.push('/dashboard/teacher/lessons')}
                className="mt-4 px-4 py-2 rounded-lg border border-red-400/40 hover:bg-red-900/20 text-sm font-semibold inline-flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Lessons
              </button>
            </div>
          </div>
        </div>
      </TeacherShell>
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
              <h1 className="h1">Edit Lesson</h1>
              <p className="muted">Update metadata, objectives, materials, and content before assigning.</p>
            </div>

            <button
              onClick={() => router.push(`/dashboard/teacher/lessons/${lesson.id}`)}
              className="px-4 py-2 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800/60 text-sm font-semibold inline-flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Lesson
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

        {successMessage && (
          <div className="section">
            <div className="card p-md border border-emerald-500/40 bg-emerald-950/20 text-emerald-200">
              {successMessage}
            </div>
          </div>
        )}

        <div className="section">
          <div className="card p-md max-w-4xl">
            <form onSubmit={(event) => void handleSave(event)} className="space-y-4">
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500/50"
                  maxLength={160}
                  required
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500/50"
                  rows={3}
                  maxLength={1200}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs text-slate-300 font-semibold block mb-1">Subject</label>
                  <select
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500/50"
                  >
                    {SUBJECT_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-semibold block mb-1">Age Group</label>
                  <input
                    type="text"
                    value={ageGroup}
                    onChange={(event) => setAgeGroup(event.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500/50"
                    maxLength={80}
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-semibold block mb-1">Duration (mins)</label>
                  <input
                    type="number"
                    value={durationMinutes}
                    min={5}
                    max={240}
                    onChange={(event) => setDurationMinutes(event.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-semibold block mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500/50"
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">Objectives (one per line)</label>
                <textarea
                  value={objectivesText}
                  onChange={(event) => setObjectivesText(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500/50"
                  rows={4}
                  placeholder={'Recognize colors\nCount objects to 10'}
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">Materials (one per line)</label>
                <textarea
                  value={materialsText}
                  onChange={(event) => setMaterialsText(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500/50"
                  rows={3}
                  placeholder={'Flash cards\nColor pencils\nStory book'}
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">Lesson Content</label>
                <textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500/50"
                  rows={10}
                  placeholder="Paste structured lesson plan content or markdown text here..."
                />
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white text-sm font-semibold inline-flex items-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>

                <button
                  type="button"
                  onClick={() => router.push(`/dashboard/teacher/lessons/${lesson.id}`)}
                  className="px-5 py-2.5 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800/60 text-sm font-semibold"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </TeacherShell>
  );
}
