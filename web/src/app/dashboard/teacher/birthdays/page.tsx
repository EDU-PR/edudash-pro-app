'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Cake, Calendar, Loader2, RefreshCcw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { TeacherShell } from '@/components/dashboard/teacher/TeacherShell';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';

interface ClassSummary {
  id: string;
  name: string;
  grade?: string | null;
}

interface StudentBirthday {
  id: string;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string;
  class_id: string | null;
}

const STAFF_ROLES = ['teacher', 'principal', 'principal_admin', 'admin', 'super_admin', 'superadmin'];
const PRINCIPAL_ROLES = ['principal', 'principal_admin', 'admin', 'super_admin', 'superadmin'];

const studentName = (student: StudentBirthday): string => {
  const full = `${student.first_name || ''} ${student.last_name || ''}`.trim();
  return full || 'Student';
};

const computeAge = (dateOfBirth: string, onDate = new Date()): number => {
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return 0;
  let age = onDate.getFullYear() - dob.getFullYear();
  const monthDiff = onDate.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && onDate.getDate() < dob.getDate())) age -= 1;
  return Math.max(age, 0);
};

const getNextBirthdayDate = (dateOfBirth: string): Date | null => {
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;

  const today = new Date();
  const thisYear = today.getFullYear();
  const candidate = new Date(thisYear, dob.getMonth(), dob.getDate());
  candidate.setHours(0, 0, 0, 0);

  const normalizedToday = new Date(today);
  normalizedToday.setHours(0, 0, 0, 0);

  if (candidate < normalizedToday) {
    candidate.setFullYear(thisYear + 1);
  }
  return candidate;
};

const daysUntil = (date: Date): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

export default function TeacherBirthdaysPage() {
  const router = useRouter();
  const supabase = createClient();
  const [userId, setUserId] = useState<string>();
  const [authLoading, setAuthLoading] = useState(true);

  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [birthdays, setBirthdays] = useState<StudentBirthday[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [loadingData, setLoadingData] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const loadBirthdays = useCallback(async () => {
    if (!userId) return;
    if (!organizationId) {
      setBirthdays([]);
      setClasses([]);
      setErrorMessage('School context is missing for your account.');
      setLoadingData(false);
      return;
    }
    if (!isStaff) {
      setBirthdays([]);
      setClasses([]);
      setErrorMessage('This page is available to teachers and school admins only.');
      setLoadingData(false);
      return;
    }

    setLoadingData(true);
    setErrorMessage(null);

    try {
      let classRows: ClassSummary[] = [];

      if (isPrincipalView) {
        const { data, error } = await supabase
          .from('classes')
          .select('id, name, grade')
          .or(`preschool_id.eq.${organizationId},organization_id.eq.${organizationId}`)
          .order('name', { ascending: true });
        if (error) throw error;
        classRows = (data || []) as ClassSummary[];
      } else {
        const { data, error } = await supabase
          .from('classes')
          .select('id, name, grade')
          .eq('teacher_id', userId)
          .or(`preschool_id.eq.${organizationId},organization_id.eq.${organizationId}`)
          .order('name', { ascending: true });
        if (error) throw error;
        classRows = (data || []) as ClassSummary[];
      }

      setClasses(classRows);
      const classIds = classRows.map((row) => row.id);

      if (!isPrincipalView && classIds.length === 0) {
        setBirthdays([]);
        return;
      }

      let studentsQuery = supabase
        .from('students')
        .select('id, first_name, last_name, date_of_birth, class_id')
        .eq('is_active', true)
        .not('date_of_birth', 'is', null)
        .order('first_name', { ascending: true });

      if (isPrincipalView) {
        studentsQuery = studentsQuery.or(`preschool_id.eq.${organizationId},organization_id.eq.${organizationId}`);
      } else {
        studentsQuery = studentsQuery.in('class_id', classIds);
      }

      const { data: studentRows, error: studentsError } = await studentsQuery;
      if (studentsError) throw studentsError;

      const normalized = ((studentRows || []) as StudentBirthday[]).filter((row) => {
        const parsed = new Date(row.date_of_birth);
        return !Number.isNaN(parsed.getTime());
      });
      setBirthdays(normalized);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load birthdays.';
      setErrorMessage(message);
      setBirthdays([]);
      setClasses([]);
    } finally {
      setLoadingData(false);
    }
  }, [isPrincipalView, isStaff, organizationId, supabase, userId]);

  useEffect(() => {
    void loadBirthdays();
  }, [loadBirthdays]);

  const classMap = useMemo(() => (
    new Map(classes.map((row) => [row.id, row.grade ? `${row.name} (${row.grade})` : row.name]))
  ), [classes]);

  const filteredBirthdays = useMemo(() => {
    const base = selectedClassId === 'all'
      ? birthdays
      : birthdays.filter((student) => student.class_id === selectedClassId);

    return [...base].sort((a, b) => {
      const nextA = getNextBirthdayDate(a.date_of_birth);
      const nextB = getNextBirthdayDate(b.date_of_birth);
      if (!nextA && !nextB) return 0;
      if (!nextA) return 1;
      if (!nextB) return -1;
      return nextA.getTime() - nextB.getTime();
    });
  }, [birthdays, selectedClassId]);

  const stats = useMemo(() => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentDay = today.getDate();

    const source = selectedClassId === 'all'
      ? birthdays
      : birthdays.filter((student) => student.class_id === selectedClassId);

    const todayCount = source.filter((student) => {
      const dob = new Date(student.date_of_birth);
      return dob.getMonth() === currentMonth && dob.getDate() === currentDay;
    }).length;

    const thisMonthCount = source.filter((student) => {
      const dob = new Date(student.date_of_birth);
      return dob.getMonth() === currentMonth;
    }).length;

    return {
      total: source.length,
      today: todayCount,
      thisMonth: thisMonthCount,
    };
  }, [birthdays, selectedClassId]);

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
              <div className="p-3 rounded-xl" style={{ background: 'linear-gradient(135deg, #f97316, #ec4899)' }}>
                <Cake className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="h1">Birthday Chart</h1>
                <p className="muted">Track upcoming birthdays for your learners.</p>
              </div>
            </div>

            <button
              onClick={() => void loadBirthdays()}
              disabled={loadingData}
              className="px-4 py-2 rounded-lg text-sm font-semibold border border-slate-600 text-slate-200 hover:bg-slate-800/60 disabled:opacity-50 inline-flex items-center gap-2"
            >
              <RefreshCcw className="w-4 h-4" />
              {loadingData ? 'Refreshing...' : 'Refresh'}
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
              <div className="text-2xl font-extrabold text-white">{stats.total}</div>
              <div className="text-xs uppercase tracking-wide text-slate-400">Students tracked</div>
            </div>
            <div className="card p-md">
              <div className="text-2xl font-extrabold text-amber-300">{stats.today}</div>
              <div className="text-xs uppercase tracking-wide text-slate-400">Birthdays today</div>
            </div>
            <div className="card p-md">
              <div className="text-2xl font-extrabold text-violet-300">{stats.thisMonth}</div>
              <div className="text-xs uppercase tracking-wide text-slate-400">This month</div>
            </div>
          </div>
        </div>

        {classes.length > 0 && (
          <div className="section">
            <div className="card p-md">
              <div className="text-sm text-slate-300 mb-3">Filter by class</div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setSelectedClassId('all')}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{
                    background: selectedClassId === 'all' ? 'var(--primary)' : 'rgba(148, 163, 184, 0.14)',
                    color: selectedClassId === 'all' ? '#fff' : '#cbd5e1',
                  }}
                >
                  All classes
                </button>
                {classes.map((row) => (
                  <button
                    key={row.id}
                    onClick={() => setSelectedClassId(row.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={{
                      background: selectedClassId === row.id ? 'var(--primary)' : 'rgba(148, 163, 184, 0.14)',
                      color: selectedClassId === row.id ? '#fff' : '#cbd5e1',
                    }}
                  >
                    {row.grade ? `${row.name} (${row.grade})` : row.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="section">
          <div className="card p-md">
            <h2 className="text-lg font-semibold text-white mb-3">Upcoming Birthdays</h2>
            {loadingData ? (
              <div className="text-sm text-gray-400 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading birthday chart...
              </div>
            ) : filteredBirthdays.length === 0 ? (
              <div className="rounded-lg border border-slate-700 bg-slate-900/30 p-8 text-center">
                <Calendar className="w-10 h-10 text-slate-500 mx-auto mb-2" />
                <div className="text-sm text-slate-300">No birthdays found for this filter.</div>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredBirthdays.map((student) => {
                  const nextDate = getNextBirthdayDate(student.date_of_birth);
                  const turns = computeAge(student.date_of_birth, nextDate || new Date());
                  const until = nextDate ? daysUntil(nextDate) : null;

                  return (
                    <div key={student.id} className="rounded-lg border border-slate-700 bg-slate-900/35 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-white font-semibold">{studentName(student)}</div>
                          <div className="text-xs text-slate-400 mt-1">
                            {student.class_id ? (classMap.get(student.class_id) || 'Class') : 'Class not assigned'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-amber-300">
                            {nextDate ? nextDate.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long' }) : 'Unknown'}
                          </div>
                          <div className="text-xs text-slate-400">
                            Turning {Math.max(turns, 1)}
                            {until !== null ? ` · in ${until} day${until === 1 ? '' : 's'}` : ''}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </TeacherShell>
  );
}
