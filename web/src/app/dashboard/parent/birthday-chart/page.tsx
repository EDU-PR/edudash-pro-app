'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { createClient } from '@/lib/supabase/client';
import { ParentShell } from '@/components/dashboard/parent/ParentShell';
import { BirthdayChartWeb, type WebStudentBirthday } from '@/components/dashboard/parent/BirthdayChartWeb';
import { calculateAgeOnDate, getNextBirthdayDate, parseDateOnly } from '@/lib/utils/dateUtils';

interface StudentRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  class_id: string | null;
  avatar_url: string | null;
  classes?: { name?: string | null } | Array<{ name?: string | null }> | null;
}

export default function ParentBirthdayChartPage() {
  const router = useRouter();
  const { t } = useTranslation('common');
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [birthdays, setBirthdays] = useState<WebStudentBirthday[]>([]);
  const [tenantSlug, setTenantSlug] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [userName, setUserName] = useState<string>('');

  useEffect(() => {
    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        router.push('/sign-in');
        return;
      }

      const userId = session.user.id;
      setUserEmail(session.user.email || '');

      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name, preschool_id, organization_id, preschool_name')
        .eq('id', userId)
        .maybeSingle();

      if (profile?.first_name || profile?.last_name) {
        setUserName(`${profile?.first_name || ''} ${profile?.last_name || ''}`.trim());
      }

      const organizationId = profile?.organization_id || profile?.preschool_id;
      if (!organizationId) {
        setBirthdays([]);
        setLoading(false);
        return;
      }

      setTenantSlug(profile?.preschool_name || '');

      const { data, error } = await supabase
        .from('students')
        .select('id, first_name, last_name, date_of_birth, class_id, avatar_url, classes!students_class_id_fkey(name)')
        .or(`organization_id.eq.${organizationId},preschool_id.eq.${organizationId}`)
        .eq('is_active', true)
        .not('date_of_birth', 'is', null);

      if (error) {
        setBirthdays([]);
        setLoading(false);
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const mapped: WebStudentBirthday[] = (data || []).map((row: StudentRow): WebStudentBirthday => {
        const dob = row.date_of_birth || '';
        const nextBirthday = dob ? getNextBirthdayDate(dob, today) : null;
        const ageTurning = dob && nextBirthday ? calculateAgeOnDate(dob, nextBirthday) : 0;
        const classData = Array.isArray(row.classes) ? row.classes[0] : row.classes;
        return {
          id: `birthday-${row.id}`,
          studentId: row.id,
          firstName: row.first_name || t('birthdayChart.studentFallback'),
          lastName: row.last_name || '',
          dateOfBirth: dob,
          ageTurning,
          className: classData?.name || null,
        };
      });

      mapped.sort((a: WebStudentBirthday, b: WebStudentBirthday) => {
        const aDate = parseDateOnly(a.dateOfBirth);
        const bDate = parseDateOnly(b.dateOfBirth);
        if (!aDate || !bDate) return 0;
        const monthDiff = aDate.getMonth() - bDate.getMonth();
        if (monthDiff !== 0) return monthDiff;
        return aDate.getDate() - bDate.getDate();
      });

      setBirthdays(mapped);
      setLoading(false);
    };

    void load();
  }, [router, supabase, t]);

  return (
    <ParentShell tenantSlug={tenantSlug} userEmail={userEmail} userName={userName}>
      <div className="app" style={{ padding: 20 }}>
        {loading ? (
          <div className="card">
            <div className="sectionTitle">{t('birthdayChart.title')}</div>
            <div className="muted">{t('birthdayChart.loading')}</div>
          </div>
        ) : (
          <BirthdayChartWeb birthdays={birthdays} />
        )}
      </div>
    </ParentShell>
  );
}
