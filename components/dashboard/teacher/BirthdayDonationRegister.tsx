import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme, type ThemeColors } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTeacherStudents, type TeacherStudentSummary } from '@/hooks/useTeacherStudents';
import { BirthdayDonationsService } from '@/features/birthday-donations/services/BirthdayDonationsService';
import type {
  BirthdayDonationEntry,
} from '@/features/birthday-donations/types/birthdayDonations.types';
import { notifyBirthdayDonationPaid } from '@/lib/notify';
import { assertSupabase } from '@/lib/supabase';
import { getOrganizationType } from '@/lib/tenant/compat';

interface BirthdayDonationRegisterProps {
  organizationId?: string | null;
}

const DEFAULT_AMOUNT = 25;
const PAYMENT_METHODS = ['cash', 'eft', 'card', 'other'] as const;
const MAX_UPCOMING_BIRTHDAYS = 6;
const UPCOMING_WINDOW_DAYS = 30;
const PAST_WINDOW_DAYS = 30;
type PaymentMethod = typeof PAYMENT_METHODS[number];
type BirthdayWindowMode = 'upcoming' | 'recent' | 'all';

interface UpcomingBirthday {
  student: TeacherStudentSummary;
  date: Date;
  daysUntil: number;
  isPast: boolean;
  key: string;
}

interface StudentRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  date_of_birth: string | null;
  class_id: string | null;
  parent_id: string | null;
  guardian_id: string | null;
  classes?: {
    name?: string | null;
  } | null;
}

const padDatePart = (value: number) => String(value).padStart(2, '0');
const formatDateKey = (date: Date) => `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
const startOfWeekMonday = (date: Date) => {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = result.getDay();
  const mondayOffset = (day + 6) % 7;
  result.setDate(result.getDate() - mondayOffset);
  return result;
};
const getCelebrationFriday = (date: Date) => {
  const weekStart = startOfWeekMonday(date);
  const friday = new Date(weekStart);
  friday.setDate(weekStart.getDate() + 4);
  return friday;
};

const parseDateParts = (value?: string | null): { month: number; day: number } | null => {
  if (!value) return null;
  const datePart = value.split('T')[0] || value;
  const [year, month, day] = datePart.split('-').map((part) => Number(part));
  if (!year || !month || !day) return null;
  return { month, day };
};

const getBirthdayWindow = (
  students: TeacherStudentSummary[],
  mode: BirthdayWindowMode
): UpcomingBirthday[] => {
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (mode === 'all') {
    students.forEach((student) => {
      const parts = parseDateParts(student.dateOfBirth);
      if (!parts) return;

      const thisYearBirthday = new Date(startOfToday.getFullYear(), parts.month - 1, parts.day);
      const daysUntil = Math.round((thisYearBirthday.getTime() - startOfToday.getTime()) / dayMs);
      const key = `${student.id}|${formatDateKey(thisYearBirthday)}`;
      if (!seen.has(key)) {
        seen.add(key);
        entries.push({
          student,
          date: thisYearBirthday,
          daysUntil,
          isPast: thisYearBirthday < startOfToday,
          key,
        });
      }
    });

    return entries;
  }

  const includeUpcoming = mode === 'upcoming';
  const includePast = mode === 'recent';

  const entries: UpcomingBirthday[] = [];
  const dayMs = 1000 * 60 * 60 * 24;
  const seen = new Set<string>();

  students.forEach((student) => {
    const parts = parseDateParts(student.dateOfBirth);
    if (!parts) return;

    const thisYearBirthday = new Date(startOfToday.getFullYear(), parts.month - 1, parts.day);
    const nextDate = thisYearBirthday < startOfToday
      ? new Date(startOfToday.getFullYear() + 1, parts.month - 1, parts.day)
      : thisYearBirthday;
    const prevDate = thisYearBirthday < startOfToday
      ? thisYearBirthday
      : new Date(startOfToday.getFullYear() - 1, parts.month - 1, parts.day);

    if (includeUpcoming) {
      const daysUntil = Math.round((nextDate.getTime() - startOfToday.getTime()) / dayMs);
      if (daysUntil >= 0 && daysUntil <= UPCOMING_WINDOW_DAYS) {
        const key = `${student.id}|${formatDateKey(nextDate)}`;
        if (!seen.has(key)) {
          seen.add(key);
          entries.push({ student, date: nextDate, daysUntil, isPast: false, key });
        }
      }
    }

    if (includePast) {
      const daysSince = Math.round((startOfToday.getTime() - prevDate.getTime()) / dayMs);
      if (daysSince >= 0 && daysSince <= PAST_WINDOW_DAYS) {
        const key = `${student.id}|${formatDateKey(prevDate)}`;
        if (!seen.has(key)) {
          seen.add(key);
          entries.push({ student, date: prevDate, daysUntil: -daysSince, isPast: true, key });
        }
      }
    }
  });

  entries.sort((a, b) => {
    if (a.daysUntil !== b.daysUntil) return a.daysUntil - b.daysUntil;
    return `${a.student.firstName} ${a.student.lastName}`.localeCompare(`${b.student.firstName} ${b.student.lastName}`);
  });

  if (mode === 'upcoming') {
    return entries.slice(0, MAX_UPCOMING_BIRTHDAYS);
  }

  return entries.slice(0, MAX_UPCOMING_BIRTHDAYS);
};

export const BirthdayDonationRegister: React.FC<BirthdayDonationRegisterProps> = ({ organizationId }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { user, profile } = useAuth();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const orgType = useMemo(() => getOrganizationType(profile), [profile]);
  const isPreschool = orgType === 'preschool';

  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedBirthdayKey, setSelectedBirthdayKey] = useState<string | null>(null);
  const [birthdayWindowMode, setBirthdayWindowMode] = useState<BirthdayWindowMode>('upcoming');
  const [useFridayCelebration, setUseFridayCelebration] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [donations, setDonations] = useState<BirthdayDonationEntry[]>([]);
  const [loadingDonations, setLoadingDonations] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [schoolStudents, setSchoolStudents] = useState<TeacherStudentSummary[]>([]);
  const [loadingSchoolStudents, setLoadingSchoolStudents] = useState(false);

  const {
    students: teacherStudents,
    loading: teacherStudentsLoading,
  } = useTeacherStudents({ teacherId: user?.id || null, organizationId, limit: 0 });

  const loadSchoolStudents = useCallback(async () => {
    if (!organizationId) return;
    setLoadingSchoolStudents(true);
    setError(null);
    try {
      const { data, error: queryError } = await assertSupabase()
        .from('students')
        .select('id, first_name, last_name, avatar_url, date_of_birth, class_id, parent_id, guardian_id, classes(name)')
        .or(`preschool_id.eq.${organizationId},organization_id.eq.${organizationId}`)
        .eq('is_active', true)
        .order('first_name');

      if (queryError) throw new Error(queryError.message);

      const mapped = (data as StudentRow[] | null || []).map((student) => ({
        id: student.id,
        firstName: student.first_name || 'Child',
        lastName: student.last_name || '',
        avatarUrl: student.avatar_url ?? null,
        dateOfBirth: student.date_of_birth ?? null,
        className: student.classes?.name ?? null,
        classId: student.class_id ?? null,
        parentId: student.parent_id ?? null,
        guardianId: student.guardian_id ?? null,
      }));

      setSchoolStudents(mapped);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load students';
      setError(message);
    } finally {
      setLoadingSchoolStudents(false);
    }
  }, [organizationId]);

  useEffect(() => {
    if (isPreschool) {
      void loadSchoolStudents();
    }
  }, [isPreschool, loadSchoolStudents]);

  const activeStudents = isPreschool ? schoolStudents : teacherStudents;
  const activeStudentsLoading = isPreschool ? loadingSchoolStudents : teacherStudentsLoading;
  const teacherStudentIds = useMemo(() => new Set(teacherStudents.map((student) => student.id)), [teacherStudents]);

  const classGroups = useMemo(() => {
    const groups = new Map<string, { id: string; name: string; students: TeacherStudentSummary[] }>();

    if (isPreschool) {
      return Array.from(groups.values());
    }

    activeStudents.forEach((student) => {
      const classId = student.classId || 'unassigned';
      const className = student.className || t('dashboard.class_unassigned', { defaultValue: 'Unassigned' });
      const group = groups.get(classId) || { id: classId, name: className, students: [] };
      group.students.push(student);
      groups.set(classId, group);
    });

    return Array.from(groups.values());
  }, [activeStudents, isPreschool, t]);

  useEffect(() => {
    if (!isPreschool && !selectedClassId && classGroups.length > 0) {
      setSelectedClassId(classGroups[0].id);
    }
  }, [classGroups, isPreschool, selectedClassId]);

  const selectedClass = useMemo(
    () => classGroups.find((group) => group.id === selectedClassId) || null,
    [classGroups, selectedClassId]
  );

  const classStudents = isPreschool ? teacherStudents : (selectedClass?.students ?? []);
  const birthdaySourceStudents = isPreschool ? schoolStudents : classStudents;
  const upcomingBirthdays = useMemo(
    () => getBirthdayWindow(birthdaySourceStudents, birthdayWindowMode),
    [birthdaySourceStudents, birthdayWindowMode]
  );

  useEffect(() => {
    if (upcomingBirthdays.length === 0) {
    if (selectedBirthdayKey !== null) {
        setSelectedBirthdayKey(null);
      }
      return;
    }

    const exists = selectedBirthdayKey && upcomingBirthdays.some((entry) => entry.key === selectedBirthdayKey);
    if (!exists) {
      setSelectedBirthdayKey(upcomingBirthdays[0].key);
    }
  }, [selectedBirthdayKey, upcomingBirthdays]);

  const selectedBirthday = useMemo(() => (
    upcomingBirthdays.find((entry) => entry.key === selectedBirthdayKey) || upcomingBirthdays[0] || null
  ), [selectedBirthdayKey, upcomingBirthdays]);

  const celebrationDate = useMemo(() => (
    selectedBirthday && isPreschool && useFridayCelebration
      ? getCelebrationFriday(selectedBirthday.date)
      : null
  ), [selectedBirthday, isPreschool, useFridayCelebration]);

  const donationDate = selectedBirthday
    ? formatDateKey(celebrationDate ?? selectedBirthday.date)
    : null;
  const classIdForRecord = !isPreschool && selectedClassId && selectedClassId !== 'unassigned' ? selectedClassId : undefined;
  const emptyMessage = useMemo(() => {
    if (birthdayWindowMode === 'recent') {
      return isPreschool
        ? t('dashboard.birthday_donations.no_birthdays_recent_school', { defaultValue: 'No recent birthdays for the school.' })
        : t('dashboard.birthday_donations.no_birthdays_recent', { defaultValue: 'No recent birthdays for this class.' });
    }
    if (birthdayWindowMode === 'all') {
      return isPreschool
        ? t('dashboard.birthday_donations.no_birthdays_all_school', { defaultValue: 'No birthdays found for the selected range.' })
        : t('dashboard.birthday_donations.no_birthdays_all', { defaultValue: 'No birthdays found for the selected range.' });
    }
    return isPreschool
      ? t('dashboard.birthday_donations.no_birthdays_school', { defaultValue: 'No upcoming birthdays for the school.' })
      : t('dashboard.birthday_donations.no_birthdays', { defaultValue: 'No upcoming birthdays for this class.' });
  }, [birthdayWindowMode, isPreschool, t]);

  const loadDonations = useCallback(async () => {
    if (!organizationId || !donationDate || !selectedBirthday) return;
    setLoadingDonations(true);
    setError(null);
    try {
      const data = await BirthdayDonationsService.getDonationsForBirthday(
        organizationId,
        donationDate,
        selectedBirthday.student.id,
        classIdForRecord
      );
      setDonations(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load donations';
      setError(message);
    } finally {
      setLoadingDonations(false);
    }
  }, [organizationId, donationDate, selectedBirthday, classIdForRecord]);

  useEffect(() => {
    void loadDonations();
  }, [loadDonations]);

  const visibleDonations = useMemo(() => (
    isPreschool
      ? donations.filter((entry) => !entry.payerStudentId || teacherStudentIds.has(entry.payerStudentId))
      : donations
  ), [donations, isPreschool, teacherStudentIds]);

  const paidStudentIds = useMemo(() => new Set(
    visibleDonations
      .map((entry) => entry.payerStudentId)
      .filter((id): id is string => Boolean(id))
  ), [visibleDonations]);

  const paidEntriesByStudentId = useMemo(() => {
    const map = new Map<string, BirthdayDonationEntry>();
    visibleDonations.forEach((entry) => {
      if (entry.payerStudentId) {
        map.set(entry.payerStudentId, entry);
      }
    });
    return map;
  }, [visibleDonations]);

  const payerStudents = useMemo(
    () => classStudents.filter((student) => student.id !== selectedBirthday?.student.id),
    [classStudents, selectedBirthday]
  );

  const paidStudents = payerStudents.filter((student) => paidStudentIds.has(student.id));
  const unpaidStudents = payerStudents.filter((student) => !paidStudentIds.has(student.id));

  const schoolPayerCount = useMemo(() => (
    birthdaySourceStudents.filter((student) => student.id !== selectedBirthday?.student.id).length
  ), [birthdaySourceStudents, selectedBirthday]);
  const classExpectedAmount = payerStudents.length * DEFAULT_AMOUNT;
  const expectedAmount = isPreschool ? schoolPayerCount * DEFAULT_AMOUNT : classExpectedAmount;
  const totalReceived = (isPreschool ? donations : visibleDonations).reduce((sum, entry) => sum + entry.amount, 0);
  const classReceived = visibleDonations.reduce((sum, entry) => sum + entry.amount, 0);
  const remainingAmount = Math.max(expectedAmount - totalReceived, 0);

  const handleMarkPaid = useCallback(async (student: TeacherStudentSummary) => {
    if (!organizationId || !donationDate || !selectedBirthday) return;
    setSavingId(student.id);
    setError(null);
    try {
      await BirthdayDonationsService.recordDonation(organizationId, {
        donationDate,
        amount: DEFAULT_AMOUNT,
        paymentMethod,
        payerStudentId: student.id,
        birthdayStudentId: selectedBirthday.student.id,
        classId: classIdForRecord,
        celebrationMode: isPreschool && useFridayCelebration,
      });

      const parentId = student.parentId || student.guardianId || null;
      if (parentId) {
        await notifyBirthdayDonationPaid(parentId, {
          payer_child_name: `${student.firstName} ${student.lastName}`.trim(),
          birthday_child_name: `${selectedBirthday.student.firstName} ${selectedBirthday.student.lastName}`.trim(),
          donation_amount: DEFAULT_AMOUNT,
          donation_date: donationDate,
        });
      }

      await loadDonations();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to record donation.';
      setError(message);
    } finally {
      setSavingId(null);
    }
  }, [organizationId, donationDate, selectedBirthday, paymentMethod, classIdForRecord, loadDonations]);

  const handleMarkUnpaid = useCallback(async (student: TeacherStudentSummary, donationEntry: BirthdayDonationEntry) => {
    if (!organizationId || !donationEntry) return;
    setSavingId(student.id);
    setError(null);
    try {
      await BirthdayDonationsService.unrecordDonation(organizationId, donationEntry.id);
      await loadDonations();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove donation.';
      setError(message);
    } finally {
      setSavingId(null);
    }
  }, [organizationId, loadDonations]);

  if (!organizationId) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>{t('dashboard.birthday_donations.title', { defaultValue: 'Birthday Donations' })}</Text>
        <Text style={styles.muted}>{t('dashboard.birthday_donations.no_org', { defaultValue: 'Connect your school profile to track donations.' })}</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('dashboard.birthday_donations.title', { defaultValue: 'Birthday Donations' })}</Text>
      <Text style={styles.subtitle}>
        {isPreschool
          ? t('dashboard.birthday_donations.subtitle_school', { defaultValue: 'Mark R25 birthday contributions for the whole school.' })
          : t('dashboard.birthday_donations.subtitle', { defaultValue: 'Mark R25 birthday contributions for your class.' })}
      </Text>

      {activeStudentsLoading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={theme.primary} />
          <Text style={styles.muted}>{t('common.loading', { defaultValue: 'Loading...' })}</Text>
        </View>
      ) : (
        <>
          {!isPreschool && classGroups.length > 1 && (
            <View style={styles.classRow}>
              {classGroups.map((group) => {
                const selected = group.id === selectedClassId;
                return (
                  <TouchableOpacity
                    key={group.id}
                    style={[styles.classChip, selected && { backgroundColor: theme.primary }]}
                    onPress={() => setSelectedClassId(group.id)}
                  >
                    <Text style={[styles.classChipText, selected && { color: '#fff' }]}>{group.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {!isPreschool && !selectedClass && (
            <Text style={styles.muted}>{t('dashboard.birthday_donations.no_class', { defaultValue: 'No class assigned yet.' })}</Text>
          )}

          {upcomingBirthdays.length === 0 && (
            <Text style={styles.muted}>
              {emptyMessage}
            </Text>
          )}

          {upcomingBirthdays.length > 0 && (
            <View style={styles.birthdayPicker}>
              <Text style={styles.label}>{t('dashboard.birthday_donations.select_birthday', { defaultValue: 'Select birthday' })}</Text>
              <View style={styles.windowRow}>
                {(['upcoming', 'recent', 'all'] as const).map((mode) => {
                  const selected = mode === birthdayWindowMode;
                  const label = mode === 'upcoming'
                    ? t('dashboard.birthday_donations.window_upcoming', { defaultValue: 'Upcoming' })
                    : mode === 'recent'
                      ? t('dashboard.birthday_donations.window_recent', { defaultValue: 'Recent' })
                      : t('dashboard.birthday_donations.window_all', { defaultValue: 'All' });
                  return (
                    <TouchableOpacity
                      key={mode}
                      style={[styles.windowChip, selected && { backgroundColor: theme.primary }]}
                      onPress={() => setBirthdayWindowMode(mode)}
                    >
                      <Text style={[styles.windowChipText, selected && { color: '#fff' }]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
                {isPreschool && (
                  <TouchableOpacity
                    style={[styles.windowChip, useFridayCelebration && { backgroundColor: theme.primary }]}
                    onPress={() => setUseFridayCelebration((prev) => !prev)}
                  >
                    <Text style={[styles.windowChipText, useFridayCelebration && { color: '#fff' }]}>
                      {t('dashboard.birthday_donations.friday_mode', { defaultValue: 'Friday celebration' })}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.birthdayPickerList}>
                {upcomingBirthdays.map((entry) => {
                  const selected = entry.key === selectedBirthday?.key;
                  const daysLabel = entry.daysUntil === 0
                    ? t('dashboard.birthday_donations.today', { defaultValue: 'Today' })
                    : entry.isPast
                      ? t('dashboard.birthday_donations.days_ago', { defaultValue: '{{count}} days ago', count: Math.abs(entry.daysUntil) })
                      : t('dashboard.birthday_donations.days_until', { defaultValue: '{{count}} days away', count: entry.daysUntil });

                  return (
                    <TouchableOpacity
                      key={entry.key}
                      style={[styles.birthdayChip, selected && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                      onPress={() => setSelectedBirthdayKey(entry.key)}
                    >
                      <Text style={[styles.birthdayChipName, selected && { color: '#fff' }]}>
                        {entry.student.firstName} {entry.student.lastName}
                      </Text>
                      <Text style={[styles.birthdayChipMeta, selected && { color: '#fff' }]}>
                        {entry.date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })} • {daysLabel}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {selectedBirthday && (
            <View style={styles.birthdayCard}>
              <Text style={styles.label}>{t('dashboard.birthday_donations.selected_label', { defaultValue: 'Selected birthday' })}</Text>
              <Text style={styles.birthdayName}>
                {selectedBirthday.student.firstName} {selectedBirthday.student.lastName}
              </Text>
              <Text style={styles.muted}>
                {selectedBirthday.date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}
                {` • ${selectedBirthday.daysUntil === 0
                  ? t('dashboard.birthday_donations.today', { defaultValue: 'Today' })
                  : selectedBirthday.isPast
                    ? t('dashboard.birthday_donations.days_ago', { defaultValue: '{{count}} days ago', count: Math.abs(selectedBirthday.daysUntil) })
                    : t('dashboard.birthday_donations.days_until', { defaultValue: '{{count}} days away', count: selectedBirthday.daysUntil })}`}
              </Text>
              {celebrationDate && (
                <Text style={styles.muted}>
                  {t('dashboard.birthday_donations.celebration_label', { defaultValue: 'Celebration Friday' })}:{' '}
                  {celebrationDate.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}
                </Text>
              )}
            </View>
          )}

          {selectedBirthday && (
            <>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>
                    {isPreschool
                      ? t('dashboard.birthday_donations.expected_school', { defaultValue: 'School target' })
                      : t('dashboard.birthday_donations.expected_amount', { defaultValue: 'Expected' })}
                  </Text>
                  <Text style={styles.summaryValue}>R{expectedAmount.toFixed(2)}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>
                    {isPreschool
                      ? t('dashboard.birthday_donations.received_school', { defaultValue: 'School received' })
                      : t('dashboard.birthday_donations.total_received', { defaultValue: 'Received' })}
                  </Text>
                  <Text style={styles.summaryValue}>R{totalReceived.toFixed(2)}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>
                    {isPreschool
                      ? t('dashboard.birthday_donations.remaining_school', { defaultValue: 'School remaining' })
                      : t('dashboard.birthday_donations.remaining', { defaultValue: 'Remaining' })}
                  </Text>
                  <Text style={styles.summaryValue}>R{remainingAmount.toFixed(2)}</Text>
                </View>
              </View>
              {isPreschool && (
                <Text style={styles.muted}>
                  {t('dashboard.birthday_donations.class_progress', {
                    defaultValue: 'Your class: R{{received}} of R{{expected}}',
                    received: classReceived.toFixed(2),
                    expected: classExpectedAmount.toFixed(2),
                  })}
                </Text>
              )}

              <View style={styles.formSection}>
                <Text style={styles.label}>{t('dashboard.birthday_donations.method_label', { defaultValue: 'Payment method' })}</Text>
                <View style={styles.methodRow}>
                  {PAYMENT_METHODS.map((method) => {
                    const selected = method === paymentMethod;
                    return (
                      <TouchableOpacity
                        key={method}
                        style={[styles.methodChip, selected && { backgroundColor: theme.primary }]}
                        onPress={() => setPaymentMethod(method)}
                      >
                        <Text style={[styles.methodText, selected && { color: '#fff' }]}>
                          {t(`dashboard.birthday_donations.methods.${method}`, { defaultValue: method.toUpperCase() })}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {error && <Text style={styles.errorText}>{error}</Text>}

              <View style={styles.listSection}>
                <Text style={styles.sectionTitle}>
                  {t('dashboard.birthday_donations.pending_title', { defaultValue: 'Not paid yet' })}
                  {` (${unpaidStudents.length})`}
                </Text>
                {loadingDonations ? (
                  <Text style={styles.muted}>{t('common.loading', { defaultValue: 'Loading...' })}</Text>
                ) : unpaidStudents.length === 0 ? (
                  <Text style={styles.muted}>{t('dashboard.birthday_donations.all_paid', { defaultValue: 'Everyone is paid up 🎉' })}</Text>
                ) : (
                  unpaidStudents.map((student) => (
                    <View key={student.id} style={styles.studentRow}>
                      <Text style={styles.studentName}>{student.firstName} {student.lastName}</Text>
                      <TouchableOpacity
                        style={styles.payButton}
                        onPress={() => handleMarkPaid(student)}
                        disabled={savingId === student.id}
                      >
                        <Text style={styles.payButtonText}>
                          {savingId === student.id
                            ? t('common.saving', { defaultValue: 'Saving...' })
                            : t('dashboard.birthday_donations.mark_paid', { defaultValue: 'Mark paid' })}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>

              <View style={styles.listSection}>
                <Text style={styles.sectionTitle}>
                  {t('dashboard.birthday_donations.paid_title', { defaultValue: 'Paid' })}
                  {` (${paidStudents.length})`}
                </Text>
                {paidStudents.length === 0 ? (
                  <Text style={styles.muted}>{t('dashboard.birthday_donations.no_paid', { defaultValue: 'No payments recorded yet.' })}</Text>
                ) : (
                  paidStudents.map((student) => (
                    <View key={student.id} style={styles.studentRow}>
                      <Text style={styles.studentName}>{student.firstName} {student.lastName}</Text>
                      <View style={styles.paidActions}>
                        <Text style={styles.paidBadge}>{t('dashboard.birthday_donations.paid_badge', { defaultValue: 'Paid' })}</Text>
                        <TouchableOpacity
                          style={styles.unpayButton}
                          onPress={() => {
                            const donationEntry = paidEntriesByStudentId.get(student.id);
                            if (!donationEntry) return;
                            Alert.alert(
                              t('dashboard.birthday_donations.confirm_unpaid_title', { defaultValue: 'Mark unpaid?' }),
                              t('dashboard.birthday_donations.confirm_unpaid_message', {
                                defaultValue: 'This will remove the payment for {{name}}.',
                                name: `${student.firstName} ${student.lastName}`.trim(),
                              }),
                              [
                                { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
                                {
                                  text: t('dashboard.birthday_donations.confirm_unpaid_cta', { defaultValue: 'Mark unpaid' }),
                                  style: 'destructive',
                                  onPress: () => handleMarkUnpaid(student, donationEntry),
                                },
                              ]
                            );
                          }}
                          disabled={savingId === student.id}
                        >
                          <Text style={styles.unpayButtonText}>
                            {savingId === student.id
                              ? t('common.saving', { defaultValue: 'Saving...' })
                              : t('dashboard.birthday_donations.mark_unpaid', { defaultValue: 'Mark unpaid' })}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </>
          )}
        </>
      )}
    </View>
  );
};

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: theme.textSecondary,
    marginBottom: 12,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 6,
  },
  muted: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  classRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  classChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: theme.background,
    borderWidth: 1,
    borderColor: theme.border,
  },
  classChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.text,
  },
  birthdayPicker: {
    marginBottom: 12,
  },
  windowRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  windowChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: theme.background,
    borderWidth: 1,
    borderColor: theme.border,
  },
  windowChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.text,
  },
  birthdayPickerList: {
    gap: 8,
  },
  birthdayChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: theme.background,
    borderWidth: 1,
    borderColor: theme.border,
  },
  birthdayChipName: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.text,
  },
  birthdayChipMeta: {
    fontSize: 11,
    color: theme.textSecondary,
    marginTop: 2,
  },
  birthdayCard: {
    backgroundColor: theme.background,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 12,
  },
  birthdayName: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 4,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  summaryItem: {
    flex: 1,
    backgroundColor: theme.background,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  summaryLabel: {
    fontSize: 11,
    color: theme.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.text,
    marginTop: 4,
  },
  formSection: {
    marginBottom: 12,
  },
  methodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  methodChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: theme.background,
    borderWidth: 1,
    borderColor: theme.border,
  },
  methodText: {
    fontSize: 12,
    color: theme.text,
    fontWeight: '600',
  },
  listSection: {
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 8,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  studentName: {
    fontSize: 13,
    color: theme.text,
  },
  payButton: {
    backgroundColor: theme.primary,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  payButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  paidBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.success,
  },
  paidActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unpayButton: {
    borderWidth: 1,
    borderColor: theme.error,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  unpayButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.error,
  },
  errorText: {
    marginTop: 8,
    color: theme.error,
    fontSize: 12,
  },
});
