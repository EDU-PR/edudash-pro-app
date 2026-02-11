'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Calendar, CheckCircle2, Loader2, UserCheck, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { TeacherShell } from '@/components/dashboard/teacher/TeacherShell';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';

type AttendanceStatus = 'present' | 'late' | 'absent';

interface ClassRow {
  id: string;
  name: string;
  grade: string | null;
}

interface StudentRow {
  id: string;
  class_id: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
}

interface AttendanceRow {
  student_id: string | null;
  status: string | null;
}

const STATUS_ORDER: AttendanceStatus[] = ['present', 'late', 'absent'];

const nextStatus = (current: AttendanceStatus): AttendanceStatus => {
  const index = STATUS_ORDER.indexOf(current);
  return STATUS_ORDER[(index + 1) % STATUS_ORDER.length];
};

const statusBadgeStyle = (status: AttendanceStatus) => {
  if (status === 'present') {
    return { background: '#14532d', borderColor: '#16a34a', color: '#86efac' };
  }
  if (status === 'late') {
    return { background: '#78350f', borderColor: '#f59e0b', color: '#fcd34d' };
  }
  return { background: '#7f1d1d', borderColor: '#ef4444', color: '#fecaca' };
};

const todayKey = (): string => new Date().toISOString().slice(0, 10);

export default function TeacherAttendancePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [userId, setUserId] = useState<string>();
  const [authLoading, setAuthLoading] = useState(true);

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [attendanceDate, setAttendanceDate] = useState<string>(todayKey());
  const [statusMap, setStatusMap] = useState<Record<string, AttendanceStatus>>({});

  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { profile, loading: profileLoading } = useUserProfile(userId);
  const { slug: tenantSlug } = useTenantSlug(userId);

  useEffect(() => {
    const initAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push('/sign-in');
        return;
      }

      setUserId(session.user.id);
      setAuthLoading(false);
    };

    initAuth();
  }, [router, supabase]);

  useEffect(() => {
    const loadClasses = async () => {
      if (!userId || !profile?.preschoolId) {
        setLoadingClasses(false);
        return;
      }

      setLoadingClasses(true);
      setErrorMessage(null);
      try {
        const { data, error } = await supabase
          .from('classes')
          .select('id, name, grade')
          .eq('teacher_id', userId)
          .eq('preschool_id', profile.preschoolId)
          .order('name', { ascending: true });

        if (error) throw error;
        const classRows = (data || []) as ClassRow[];
        setClasses(classRows);

        const routeClassId = searchParams.get('classId');
        if (routeClassId && classRows.some((cls) => cls.id === routeClassId)) {
          setSelectedClassId(routeClassId);
        } else if (!selectedClassId && classRows.length > 0) {
          setSelectedClassId(classRows[0].id);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load classes';
        setErrorMessage(message);
      } finally {
        setLoadingClasses(false);
      }
    };

    loadClasses();
  }, [userId, profile?.preschoolId, searchParams, selectedClassId, supabase]);

  useEffect(() => {
    const loadStudentsAndAttendance = async () => {
      if (!selectedClassId || !profile?.preschoolId || !attendanceDate) {
        setStudents([]);
        setStatusMap({});
        return;
      }

      setLoadingStudents(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      try {
        const { data: studentData, error: studentError } = await supabase
          .from('students')
          .select('id, class_id, full_name, first_name, last_name')
          .eq('preschool_id', profile.preschoolId)
          .eq('class_id', selectedClassId)
          .eq('is_active', true)
          .order('first_name', { ascending: true });

        if (studentError) throw studentError;

        const studentRows = (studentData || []) as StudentRow[];
        setStudents(studentRows);

        const nextMap: Record<string, AttendanceStatus> = {};
        studentRows.forEach((student) => {
          nextMap[student.id] = 'present';
        });

        if (studentRows.length > 0) {
          const studentIds = studentRows.map((student) => student.id);
          const { data: attendanceRows, error: attendanceError } = await supabase
            .from('attendance')
            .select('student_id, status')
            .eq('attendance_date', attendanceDate)
            .in('student_id', studentIds)
            .or(`organization_id.eq.${profile.preschoolId},organization_id.is.null`);

          if (!attendanceError && attendanceRows) {
            attendanceRows.forEach((row: AttendanceRow) => {
              const status = String(row.status || '').toLowerCase();
              if (
                row.student_id &&
                (status === 'present' || status === 'late' || status === 'absent')
              ) {
                nextMap[row.student_id] = status as AttendanceStatus;
              }
            });
          }
        }

        setStatusMap(nextMap);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load students';
        setErrorMessage(message);
      } finally {
        setLoadingStudents(false);
      }
    };

    loadStudentsAndAttendance();
  }, [attendanceDate, profile?.preschoolId, selectedClassId, supabase]);

  const stats = useMemo(() => {
    const values = Object.values(statusMap);
    return {
      total: values.length,
      present: values.filter((status) => status === 'present').length,
      late: values.filter((status) => status === 'late').length,
      absent: values.filter((status) => status === 'absent').length,
    };
  }, [statusMap]);

  const setAllStatus = (status: AttendanceStatus) => {
    setStatusMap((prev) => {
      const next: Record<string, AttendanceStatus> = {};
      Object.keys(prev).forEach((studentId) => {
        next[studentId] = status;
      });
      return next;
    });
  };

  const cycleStudentStatus = (studentId: string) => {
    setStatusMap((prev) => {
      const current = prev[studentId] || 'present';
      return { ...prev, [studentId]: nextStatus(current) };
    });
  };

  const submitAttendance = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!selectedClassId) {
      setErrorMessage('Please select a class.');
      return;
    }

    if (!profile?.preschoolId || !userId) {
      setErrorMessage('Your profile is missing school information. Please sign in again.');
      return;
    }

    if (!attendanceDate || attendanceDate > todayKey()) {
      setErrorMessage('Please choose a valid attendance date (today or earlier).');
      return;
    }

    const studentIds = students.map((student) => student.id);
    if (studentIds.length === 0) {
      setErrorMessage('No active students found in this class.');
      return;
    }

    setSubmitting(true);
    try {
      // Remove prior records for this class/date to support updates.
      const baseDelete = supabase
        .from('attendance')
        .delete()
        .in('student_id', studentIds)
        .eq('attendance_date', attendanceDate);

      const { error: deleteSchoolScopedError } = await baseDelete.eq('organization_id', profile.preschoolId);
      if (deleteSchoolScopedError) throw deleteSchoolScopedError;

      const { error: deleteLegacyNullError } = await supabase
        .from('attendance')
        .delete()
        .in('student_id', studentIds)
        .eq('attendance_date', attendanceDate)
        .is('organization_id', null);
      if (deleteLegacyNullError) throw deleteLegacyNullError;

      const rows = studentIds.map((studentId) => ({
        student_id: studentId,
        status: statusMap[studentId] || 'present',
        attendance_date: attendanceDate,
        recorded_by: userId,
        organization_id: profile.preschoolId,
      }));

      const { error: insertError } = await supabase.from('attendance').insert(rows);
      if (insertError) throw insertError;

      setSuccessMessage(
        `Attendance saved for ${attendanceDate}: ${stats.present} present, ${stats.late} late, ${stats.absent} absent.`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit attendance';
      setErrorMessage(message);
    } finally {
      setSubmitting(false);
    }
  };

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
            <div>
              <h1 className="h1">Attendance</h1>
              <p className="muted">Mark daily attendance by class and update records when needed.</p>
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
          <div className="card p-md">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Class</label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  disabled={loadingClasses || classes.length === 0}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white disabled:opacity-50"
                >
                  {classes.length === 0 && <option value="">No classes assigned</option>}
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.grade ? `${cls.name} (${cls.grade})` : cls.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Date</label>
                <input
                  type="date"
                  value={attendanceDate}
                  max={todayKey()}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white"
                />
              </div>
            </div>

            <div className="flex gap-2 flex-wrap mb-4">
              <button
                type="button"
                onClick={() => setAllStatus('present')}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-green-500/40 text-green-300 hover:bg-green-900/20"
              >
                Mark all present
              </button>
              <button
                type="button"
                onClick={() => setAllStatus('late')}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-yellow-500/40 text-yellow-300 hover:bg-yellow-900/20"
              >
                Mark all late
              </button>
              <button
                type="button"
                onClick={() => setAllStatus('absent')}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-500/40 text-red-300 hover:bg-red-900/20"
              >
                Mark all absent
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="rounded-lg border border-gray-700 bg-gray-900/50 px-3 py-2">
                <div className="text-xs text-gray-400">Total</div>
                <div className="text-lg font-semibold text-white">{stats.total}</div>
              </div>
              <div className="rounded-lg border border-green-500/30 bg-green-950/20 px-3 py-2">
                <div className="text-xs text-green-300">Present</div>
                <div className="text-lg font-semibold text-green-200">{stats.present}</div>
              </div>
              <div className="rounded-lg border border-yellow-500/30 bg-yellow-950/20 px-3 py-2">
                <div className="text-xs text-yellow-300">Late</div>
                <div className="text-lg font-semibold text-yellow-200">{stats.late}</div>
              </div>
              <div className="rounded-lg border border-red-500/30 bg-red-950/20 px-3 py-2">
                <div className="text-xs text-red-300">Absent</div>
                <div className="text-lg font-semibold text-red-200">{stats.absent}</div>
              </div>
            </div>

            {loadingStudents ? (
              <div className="text-sm text-gray-400 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading students...
              </div>
            ) : students.length === 0 ? (
              <div className="text-sm text-gray-400">
                Select a class with active students to take attendance.
              </div>
            ) : (
              <div className="space-y-2">
                {students.map((student) => {
                  const status = statusMap[student.id] || 'present';
                  const badge = statusBadgeStyle(status);
                  const fullName =
                    student.full_name || [student.first_name, student.last_name].filter(Boolean).join(' ') || 'Unnamed student';

                  return (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() => cycleStudentStatus(student.id)}
                      className="w-full rounded-lg border border-gray-700 bg-gray-900/40 px-3 py-3 flex items-center justify-between hover:border-gray-500 transition-colors text-left"
                    >
                      <span className="text-sm text-gray-100 flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-gray-400" />
                        {fullName}
                      </span>
                      <span
                        className="text-xs font-semibold px-2.5 py-1 rounded-full border"
                        style={badge}
                      >
                        {status.toUpperCase()}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={submitAttendance}
                disabled={submitting || !selectedClassId || students.length === 0}
                className="px-5 py-2.5 rounded-lg font-semibold text-sm text-white flex items-center gap-2 disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #2563eb, #3b82f6)' }}
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
                {submitting ? 'Saving attendance...' : 'Save attendance'}
              </button>
              <button
                type="button"
                onClick={() => router.push('/dashboard/teacher/classes')}
                className="px-5 py-2.5 rounded-lg border border-gray-600 text-gray-200 hover:bg-gray-800 text-sm font-semibold"
              >
                Back to classes
              </button>
            </div>
          </div>
        </div>
      </div>
    </TeacherShell>
  );
}
