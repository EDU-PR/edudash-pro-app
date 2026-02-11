'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, ClipboardList, Loader2, Save } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { TeacherShell } from '@/components/dashboard/teacher/TeacherShell';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';

interface ClassOption {
  id: string;
  name: string;
  grade_level?: string | null;
  grade?: string | null;
}

const ASSIGN_HOMEWORK_ROLES = ['teacher', 'principal', 'principal_admin', 'admin', 'super_admin', 'superadmin'];
const MANAGE_ALL_CLASSES_ROLES = ['principal', 'principal_admin', 'admin', 'super_admin', 'superadmin'];

const normalizeInt = (value: string, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.round(parsed);
  return rounded > 0 ? rounded : fallback;
};

export default function TeacherHomeworkCreatePage() {
  const router = useRouter();
  const supabase = createClient();
  const [userId, setUserId] = useState<string>();
  const [authLoading, setAuthLoading] = useState(true);

  const [loadingClasses, setLoadingClasses] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');

  const [title, setTitle] = useState('Homework');
  const [description, setDescription] = useState('Complete this lesson at home.');
  const [instructions, setInstructions] = useState('');
  const [materialsNeeded, setMaterialsNeeded] = useState('');
  const [dueDays, setDueDays] = useState('3');
  const [estimatedMinutes, setEstimatedMinutes] = useState('30');

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
  const canAssignHomework = ASSIGN_HOMEWORK_ROLES.includes(role);
  const canSeeAllClasses = MANAGE_ALL_CLASSES_ROLES.includes(role);
  const schoolId = profile?.organizationId || profile?.preschoolId;

  const loadClasses = useCallback(async () => {
    if (!schoolId || !userId) {
      setClasses([]);
      setLoadingClasses(false);
      return;
    }

    setLoadingClasses(true);
    setErrorMessage(null);
    try {
      let query = supabase
        .from('classes')
        .select('id, name, grade_level, grade')
        .eq('preschool_id', schoolId)
        .eq('active', true)
        .order('name', { ascending: true });

      if (!canSeeAllClasses) {
        query = query.eq('teacher_id', userId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data || []) as ClassOption[];
      setClasses(rows);
      if (!selectedClassId && rows.length > 0) {
        setSelectedClassId(rows[0].id);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load classes.';
      setErrorMessage(message);
      setClasses([]);
    } finally {
      setLoadingClasses(false);
    }
  }, [canSeeAllClasses, schoolId, selectedClassId, supabase, userId]);

  useEffect(() => {
    void loadClasses();
  }, [loadClasses]);

  const handleCreateHomework = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canAssignHomework) {
      setErrorMessage('You do not have permission to assign homework.');
      return;
    }
    if (!schoolId) {
      setErrorMessage('School context is missing for your account.');
      return;
    }
    if (!userId) {
      setErrorMessage('You must be signed in to assign homework.');
      return;
    }
    if (!selectedClassId) {
      setErrorMessage('Please select a class.');
      return;
    }
    if (!title.trim()) {
      setErrorMessage('Please enter a homework title.');
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    try {
      const dueOffsetDays = normalizeInt(dueDays, 3);
      const estimatedTimeMinutes = normalizeInt(estimatedMinutes, 30);
      const selectedClass = classes.find((item) => item.id === selectedClassId);
      const gradeBand = (selectedClass?.grade_level || selectedClass?.grade || 'unspecified').toString();

      const payload = {
        preschool_id: schoolId,
        class_id: selectedClassId,
        teacher_id: userId,
        title: title.trim(),
        description: description.trim() || null,
        instructions: instructions.trim() || null,
        materials_needed: materialsNeeded.trim() || null,
        due_date_offset_days: dueOffsetDays,
        estimated_time_minutes: estimatedTimeMinutes,
        is_published: false,
        is_active: true,
        is_required: true,
        status: 'draft',
        subject: 'general',
        grade_band: gradeBand || 'unspecified',
        assigned_at: null,
      };

      const { error } = await supabase
        .from('homework_assignments')
        .insert(payload);
      if (error) throw error;

      router.push('/dashboard/teacher/homework');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save homework assignment.';
      setErrorMessage(message);
    } finally {
      setSaving(false);
    }
  }, [
    canAssignHomework,
    classes,
    description,
    dueDays,
    estimatedMinutes,
    instructions,
    materialsNeeded,
    schoolId,
    selectedClassId,
    supabase,
    title,
    userId,
    router,
  ]);

  const subtitle = useMemo(() => {
    if (!canAssignHomework) {
      return 'Your role cannot assign homework in this school.';
    }
    return 'Assignments are queued as draft and require principal approval before parents can view them.';
  }, [canAssignHomework]);

  if (authLoading || profileLoading) {
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
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl" style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}>
                <ClipboardList className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="h1">Assign Homework</h1>
                <p className="muted">{subtitle}</p>
              </div>
            </div>

            <button
              onClick={() => router.push('/dashboard/teacher/homework')}
              className="px-4 py-2 rounded-lg text-sm font-semibold border border-slate-600 text-slate-200 hover:bg-slate-800/60 inline-flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Homework
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
          <div className="card p-md max-w-3xl">
            {!canAssignHomework ? (
              <div className="rounded-lg border border-amber-500/40 bg-amber-950/20 p-4 text-amber-100 text-sm">
                Your account does not currently have permission to assign homework.
              </div>
            ) : loadingClasses ? (
              <div className="text-sm text-gray-400 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading classes...
              </div>
            ) : classes.length === 0 ? (
              <div className="rounded-lg border border-slate-700 bg-slate-900/30 p-4 text-sm text-slate-300">
                No active classes found for assignment.
              </div>
            ) : (
              <form onSubmit={(event) => void handleCreateHomework(event)} className="space-y-4">
                <div>
                  <label className="text-xs text-slate-300 font-semibold block mb-1">Class</label>
                  <select
                    value={selectedClassId}
                    onChange={(event) => setSelectedClassId(event.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-purple-500/50"
                  >
                    {classes.map((classItem) => (
                      <option key={classItem.id} value={classItem.id}>
                        {classItem.name}{classItem.grade_level || classItem.grade ? ` (${classItem.grade_level || classItem.grade})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-semibold block mb-1">Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-purple-500/50"
                    maxLength={140}
                    required
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-semibold block mb-1">Description</label>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-purple-500/50"
                    rows={3}
                    maxLength={1000}
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-semibold block mb-1">Instructions</label>
                  <textarea
                    value={instructions}
                    onChange={(event) => setInstructions(event.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-purple-500/50"
                    rows={3}
                    maxLength={1200}
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-semibold block mb-1">Materials needed (optional)</label>
                  <textarea
                    value={materialsNeeded}
                    onChange={(event) => setMaterialsNeeded(event.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-purple-500/50"
                    rows={2}
                    maxLength={600}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs text-slate-300 font-semibold block mb-1">Due in (days)</label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={dueDays}
                      onChange={(event) => setDueDays(event.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-300 font-semibold block mb-1">Estimated time (minutes)</label>
                    <input
                      type="number"
                      min={5}
                      max={240}
                      value={estimatedMinutes}
                      onChange={(event) => setEstimatedMinutes(event.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60 inline-flex items-center gap-2"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save as Draft'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </TeacherShell>
  );
}
