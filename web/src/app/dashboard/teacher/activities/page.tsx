'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Megaphone,
  Send,
  Users,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { TeacherShell } from '@/components/dashboard/teacher/TeacherShell';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';

type ActivityType =
  | 'learning'
  | 'play'
  | 'meal'
  | 'rest'
  | 'art'
  | 'music'
  | 'story'
  | 'outdoor'
  | 'special'
  | 'milestone'
  | 'social';

interface ClassRow {
  id: string;
  name: string;
  grade: string | null;
  teacher_id: string | null;
}

interface StudentRow {
  id: string;
  class_id: string | null;
  first_name: string | null;
  last_name: string | null;
  is_active: boolean | null;
}

const PRINCIPAL_ROLES = ['principal', 'principal_admin', 'admin', 'super_admin', 'superadmin'];

const ACTIVITY_TYPES: { value: ActivityType; label: string }[] = [
  { value: 'learning', label: 'Learning' },
  { value: 'play', label: 'Play' },
  { value: 'meal', label: 'Meal' },
  { value: 'rest', label: 'Rest' },
  { value: 'art', label: 'Art' },
  { value: 'music', label: 'Music' },
  { value: 'story', label: 'Story' },
  { value: 'outdoor', label: 'Outdoor' },
  { value: 'special', label: 'Special' },
  { value: 'milestone', label: 'Milestone' },
  { value: 'social', label: 'Social' },
];

const VISIBILITY_OPTIONS = [
  { value: 'class_parents', label: 'Class parents only' },
  { value: 'all_parents', label: 'All parents in school' },
  { value: 'private', label: 'Private to selected families' },
];

const formatStudentName = (student: StudentRow): string => {
  const first = String(student.first_name || '').trim();
  const last = String(student.last_name || '').trim();
  return `${first} ${last}`.trim() || 'Unnamed student';
};

export default function TeacherActivitiesPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [userId, setUserId] = useState<string>();
  const [authLoading, setAuthLoading] = useState(true);

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [postToWholeClass, setPostToWholeClass] = useState(true);

  const [activityType, setActivityType] = useState<ActivityType>('learning');
  const [visibility, setVisibility] = useState('class_parents');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');

  const [loadingData, setLoadingData] = useState(true);
  const [posting, setPosting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
  const canPost = role === 'teacher' || PRINCIPAL_ROLES.includes(role);
  const isPrincipalRole = PRINCIPAL_ROLES.includes(role);
  const organizationId = profile?.organizationId || profile?.preschoolId || null;

  const loadClasses = useCallback(async () => {
    if (!organizationId || !userId) {
      setLoadingData(false);
      return;
    }

    setLoadingData(true);
    setErrorMessage(null);

    try {
      let query = supabase
        .from('classes')
        .select('id, name, grade, teacher_id')
        .eq('preschool_id', organizationId)
        .order('name', { ascending: true });

      if (!isPrincipalRole) {
        query = query.eq('teacher_id', userId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const classRows = (data || []) as ClassRow[];
      setClasses(classRows);

      if (classRows.length === 0) {
        setSelectedClassId('');
        setStudents([]);
        setSelectedStudents([]);
        return;
      }

      setSelectedClassId((previous) => {
        if (previous && classRows.some((cls) => cls.id === previous)) return previous;
        return classRows[0].id;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load classes.';
      setErrorMessage(message);
      setClasses([]);
      setStudents([]);
      setSelectedStudents([]);
    } finally {
      setLoadingData(false);
    }
  }, [isPrincipalRole, organizationId, supabase, userId]);

  useEffect(() => {
    void loadClasses();
  }, [loadClasses]);

  useEffect(() => {
    const loadStudents = async () => {
      if (!organizationId || !selectedClassId) {
        setStudents([]);
        setSelectedStudents([]);
        return;
      }

      setErrorMessage(null);
      try {
        const { data, error } = await supabase
          .from('students')
          .select('id, class_id, first_name, last_name, is_active')
          .eq('preschool_id', organizationId)
          .eq('class_id', selectedClassId)
          .order('first_name', { ascending: true });

        if (error) throw error;

        const activeStudents = ((data || []) as StudentRow[]).filter((student) => student.is_active !== false);
        const idSet = new Set(activeStudents.map((student) => student.id));
        setStudents(activeStudents);
        setSelectedStudents((previous) => previous.filter((studentId) => idSet.has(studentId)));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load students.';
        setErrorMessage(message);
        setStudents([]);
        setSelectedStudents([]);
      }
    };

    void loadStudents();
  }, [organizationId, selectedClassId, supabase]);

  const recipientCount = postToWholeClass ? students.length : selectedStudents.length;

  const handleStudentToggle = (studentId: string) => {
    setSelectedStudents((previous) => {
      if (previous.includes(studentId)) {
        return previous.filter((id) => id !== studentId);
      }
      return [...previous, studentId];
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!canPost) {
      setErrorMessage('Your role cannot publish activities.');
      return;
    }

    if (!organizationId || !userId) {
      setErrorMessage('Your account is missing school context. Please sign in again.');
      return;
    }

    if (!selectedClassId) {
      setErrorMessage('Please select a class.');
      return;
    }

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setErrorMessage('Please enter an activity title.');
      return;
    }

    const targetStudents = postToWholeClass ? students.map((student) => student.id) : selectedStudents;
    if (targetStudents.length === 0) {
      setErrorMessage('Select at least one student or publish to whole class.');
      return;
    }

    const parsedDuration = Number.parseInt(durationMinutes, 10);
    const duration = Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : null;

    setPosting(true);
    try {
      const payload = targetStudents.map((studentId) => ({
        preschool_id: organizationId,
        class_id: selectedClassId,
        student_id: studentId,
        teacher_id: userId,
        activity_type: activityType,
        title: cleanTitle,
        description: description.trim() || null,
        visibility,
        duration_minutes: duration,
        activity_at: new Date().toISOString(),
        is_published: true,
      }));

      const { error } = await supabase.from('student_activity_feed').insert(payload);
      if (error) throw error;

      setSuccessMessage(`Published activity for ${targetStudents.length} student${targetStudents.length === 1 ? '' : 's'}.`);
      setTitle('');
      setDescription('');
      setDurationMinutes('');
      if (!postToWholeClass) {
        setSelectedStudents([]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to publish activity.';
      setErrorMessage(message);
    } finally {
      setPosting(false);
    }
  };

  const loading = authLoading || profileLoading || loadingData;
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  if (!canPost) {
    return (
      <TeacherShell
        tenantSlug={tenantSlug}
        userEmail={profile?.email}
        userName={profile?.firstName}
        preschoolName={profile?.preschoolName}
        hideHeader={true}
      >
        <div className="container">
          <div className="section">
            <div className="card p-md border border-amber-500/40 bg-amber-950/20 text-amber-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 mt-0.5" />
                <div>
                  <h1 className="text-lg font-semibold">Activity Posting Restricted</h1>
                  <p className="text-sm mt-1">
                    Only teachers and school admins can publish activity updates to parents.
                  </p>
                </div>
              </div>
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
      hideHeader={true}
    >
      <div className="container">
        <div className="section">
          <div className="card p-md border border-blue-500/40 bg-gradient-to-r from-blue-900/25 to-cyan-900/20">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-white">Post Activity to Parents</h1>
                <p className="text-sm text-gray-300 mt-1">
                  Share classroom moments directly into the parent activity feed.
                </p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center">
                <Megaphone className="w-5 h-5 text-blue-200" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
              <div className="rounded-lg border border-gray-700 bg-gray-900/70 px-3 py-2">
                <div className="text-xs text-gray-400">Classes</div>
                <div className="text-lg font-semibold text-white">{classes.length}</div>
              </div>
              <div className="rounded-lg border border-gray-700 bg-gray-900/70 px-3 py-2">
                <div className="text-xs text-gray-400">Students in Selected Class</div>
                <div className="text-lg font-semibold text-white">{students.length}</div>
              </div>
              <div className="rounded-lg border border-gray-700 bg-gray-900/70 px-3 py-2">
                <div className="text-xs text-gray-400">Recipients This Post</div>
                <div className="text-lg font-semibold text-white">{recipientCount}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="section">
          {errorMessage ? (
            <div className="card p-md border border-red-500/40 bg-red-950/20 text-red-200 mb-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          ) : null}

          {successMessage ? (
            <div className="card p-md border border-emerald-500/40 bg-emerald-950/20 text-emerald-200 mb-3 flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="card p-md space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="text-sm text-gray-200">
                <span className="block text-xs text-gray-400 mb-1">Class</span>
                <select
                  value={selectedClassId}
                  onChange={(event) => setSelectedClassId(event.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {classes.length === 0 ? <option value="">No classes found</option> : null}
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} {cls.grade ? `(${cls.grade})` : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm text-gray-200">
                <span className="block text-xs text-gray-400 mb-1">Activity Type</span>
                <select
                  value={activityType}
                  onChange={(event) => setActivityType(event.target.value as ActivityType)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {ACTIVITY_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm text-gray-200">
                <span className="block text-xs text-gray-400 mb-1">Visibility</span>
                <select
                  value={visibility}
                  onChange={(event) => setVisibility(event.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {VISIBILITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="text-sm text-gray-200 block">
              <span className="block text-xs text-gray-400 mb-1">Activity title</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Example: Healthy snack time and story circle"
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </label>

            <label className="text-sm text-gray-200 block">
              <span className="block text-xs text-gray-400 mb-1">Description (optional)</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                placeholder="Share details with parents..."
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <label className="text-sm text-gray-200 block">
              <span className="block text-xs text-gray-400 mb-1">Duration in minutes (optional)</span>
              <input
                type="number"
                min={1}
                step={1}
                value={durationMinutes}
                onChange={(event) => setDurationMinutes(event.target.value)}
                placeholder="30"
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 md:max-w-xs"
              />
            </label>

            <div className="rounded-lg border border-gray-700 bg-gray-900/70 px-3 py-3">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div>
                  <h3 className="text-sm font-semibold text-white">Recipients</h3>
                  <p className="text-xs text-gray-400">Choose full class or specific students.</p>
                </div>
                <label className="inline-flex items-center gap-2 text-xs text-gray-300">
                  <input
                    type="checkbox"
                    checked={postToWholeClass}
                    onChange={(event) => setPostToWholeClass(event.target.checked)}
                    className="rounded border-gray-600 bg-gray-800"
                  />
                  Post to whole class
                </label>
              </div>

              {!postToWholeClass ? (
                students.length === 0 ? (
                  <p className="text-xs text-gray-500">No active students found for this class.</p>
                ) : (
                  <div>
                    <div className="flex flex-wrap gap-2 mb-2">
                      <button
                        type="button"
                        onClick={() => setSelectedStudents(students.map((student) => student.id))}
                        className="px-3 py-1 text-xs rounded-md border border-gray-600 text-gray-200 hover:bg-gray-800"
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedStudents([])}
                        className="px-3 py-1 text-xs rounded-md border border-gray-600 text-gray-200 hover:bg-gray-800"
                      >
                        Clear
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {students.map((student) => (
                        <label
                          key={student.id}
                          className="flex items-center gap-2 rounded-md border border-gray-700 px-2 py-2 text-sm text-gray-200"
                        >
                          <input
                            type="checkbox"
                            checked={selectedStudents.includes(student.id)}
                            onChange={() => handleStudentToggle(student.id)}
                            className="rounded border-gray-600 bg-gray-800"
                          />
                          <span>{formatStudentName(student)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )
              ) : (
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <Users className="w-4 h-4" />
                  <span>This post will go to all active students in the selected class.</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={posting || classes.length === 0}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-400 rounded-lg text-sm font-semibold text-white inline-flex items-center gap-2"
              >
                {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Publish Activity
              </button>
              <button
                type="button"
                onClick={() => router.push('/dashboard/teacher')}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-semibold text-gray-100 border border-gray-700"
              >
                Back to Dashboard
              </button>
            </div>
          </form>
        </div>
      </div>
    </TeacherShell>
  );
}
