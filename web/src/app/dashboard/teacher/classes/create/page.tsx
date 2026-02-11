'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, Loader2, Plus, Save } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { TeacherShell } from '@/components/dashboard/teacher/TeacherShell';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';

interface TeacherOption {
  id: string;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
}

const MANAGE_CLASS_ROLES = ['principal', 'principal_admin', 'admin', 'super_admin', 'superadmin'];

const toDisplayName = (teacher: TeacherOption): string => {
  const full = `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim();
  return full || teacher.id;
};

export default function TeacherClassesCreatePage() {
  const router = useRouter();
  const supabase = createClient();
  const [userId, setUserId] = useState<string>();
  const [authLoading, setAuthLoading] = useState(true);

  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [teachers, setTeachers] = useState<TeacherOption[]>([]);

  const [name, setName] = useState('');
  const [grade, setGrade] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [schedule, setSchedule] = useState('');
  const [maxCapacity, setMaxCapacity] = useState('20');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');

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
  const canManageClasses = MANAGE_CLASS_ROLES.includes(role);
  const organizationId = profile?.organizationId || profile?.preschoolId;

  const loadTeachers = useCallback(async () => {
    if (!organizationId || !canManageClasses) return;
    setLoadingTeachers(true);
    setErrorMessage(null);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, role')
        .or(`preschool_id.eq.${organizationId},organization_id.eq.${organizationId}`)
        .in('role', ['teacher', 'principal', 'principal_admin', 'admin']);
      if (error) throw error;

      const rows = (data || []) as TeacherOption[];
      setTeachers(rows);

      if (!selectedTeacherId) {
        const currentUserOption = rows.find((row) => row.id === userId);
        if (currentUserOption) {
          setSelectedTeacherId(currentUserOption.id);
        } else if (rows.length > 0) {
          setSelectedTeacherId(rows[0].id);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load teachers.';
      setErrorMessage(message);
      setTeachers([]);
    } finally {
      setLoadingTeachers(false);
    }
  }, [canManageClasses, organizationId, selectedTeacherId, supabase, userId]);

  useEffect(() => {
    void loadTeachers();
  }, [loadTeachers]);

  const handleCreateClass = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canManageClasses) {
      setErrorMessage('You do not have permission to create classes.');
      return;
    }

    if (!organizationId) {
      setErrorMessage('School context is missing for your account.');
      return;
    }

    if (!name.trim()) {
      setErrorMessage('Please enter a class name.');
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    try {
      const parsedCapacity = Number(maxCapacity);
      const safeCapacity = Number.isFinite(parsedCapacity) && parsedCapacity > 0
        ? Math.round(parsedCapacity)
        : 20;

      const normalizedGrade = grade.trim() || null;
      const normalizedRoom = roomNumber.trim() || null;
      const normalizedSchedule = schedule.trim() || null;
      const teacherId = selectedTeacherId || null;
      const currentYear = String(new Date().getFullYear());

      const payload = {
        name: name.trim(),
        grade: normalizedGrade,
        grade_level: normalizedGrade,
        preschool_id: organizationId,
        organization_id: organizationId,
        teacher_id: teacherId,
        active: true,
        max_capacity: safeCapacity,
        max_students: safeCapacity,
        room_number: normalizedRoom,
        room: normalizedRoom,
        schedule: normalizedSchedule,
        academic_year: currentYear,
      };

      const { data, error } = await supabase
        .from('classes')
        .insert(payload)
        .select('id')
        .single();
      if (error) throw error;

      router.push(`/dashboard/teacher/classes/${data.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create class.';
      setErrorMessage(message);
    } finally {
      setSaving(false);
    }
  }, [canManageClasses, grade, maxCapacity, name, organizationId, roomNumber, router, schedule, selectedTeacherId, supabase]);

  const subtitle = useMemo(() => {
    if (!canManageClasses) {
      return 'Your role can view classes, but cannot create or manage class records.';
    }
    return 'Create a new class and assign a teacher for attendance, lessons, and reporting.';
  }, [canManageClasses]);

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
              <div className="p-3 rounded-xl" style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
                <Plus className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="h1">Create Class</h1>
                <p className="muted">{subtitle}</p>
              </div>
            </div>

            <button
              onClick={() => router.push('/dashboard/teacher/classes')}
              className="px-4 py-2 rounded-lg text-sm font-semibold border border-slate-600 text-slate-200 hover:bg-slate-800/60 inline-flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Classes
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
            {!canManageClasses ? (
              <div className="rounded-lg border border-amber-500/40 bg-amber-950/20 p-4 text-amber-100 text-sm">
                Only principal/admin roles can create classes in this school.
              </div>
            ) : (
              <form onSubmit={(event) => void handleCreateClass(event)} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs text-slate-300 font-semibold block mb-1">Class name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="e.g. Little Explorers"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500/50"
                      maxLength={120}
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 font-semibold block mb-1">Grade / level</label>
                    <input
                      type="text"
                      value={grade}
                      onChange={(event) => setGrade(event.target.value)}
                      placeholder="e.g. Grade R"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500/50"
                      maxLength={100}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="text-xs text-slate-300 font-semibold block mb-1">Room number</label>
                    <input
                      type="text"
                      value={roomNumber}
                      onChange={(event) => setRoomNumber(event.target.value)}
                      placeholder="e.g. Room 3"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500/50"
                      maxLength={80}
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 font-semibold block mb-1">Max capacity</label>
                    <input
                      type="number"
                      value={maxCapacity}
                      onChange={(event) => setMaxCapacity(event.target.value)}
                      min={1}
                      max={500}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 font-semibold block mb-1">Assigned teacher</label>
                    <select
                      value={selectedTeacherId}
                      onChange={(event) => setSelectedTeacherId(event.target.value)}
                      disabled={loadingTeachers}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500/50"
                    >
                      <option value="">Unassigned</option>
                      {teachers.map((teacher) => (
                        <option key={teacher.id} value={teacher.id}>
                          {toDisplayName(teacher)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-semibold block mb-1">Schedule (optional)</label>
                  <textarea
                    value={schedule}
                    onChange={(event) => setSchedule(event.target.value)}
                    placeholder="e.g. Mon-Fri, 08:00-13:00"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500/50"
                    rows={3}
                    maxLength={300}
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60 inline-flex items-center gap-2"
                    style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'Creating...' : 'Create Class'}
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
