import type { TeacherStudentSummary } from '@/hooks/useTeacherStudents';

// ── Constants ──────────────────────────────────────────────────────────────────

export const DEFAULT_AMOUNT = 25;
export const PAYMENT_METHODS = ['cash', 'eft', 'card', 'other'] as const;
export const MAX_UPCOMING_BIRTHDAYS = 6;
export const UPCOMING_WINDOW_DAYS = 30;
export const PAST_WINDOW_DAYS = 90;

// ── Types ──────────────────────────────────────────────────────────────────────

export type PaymentMethod = typeof PAYMENT_METHODS[number];
export type BirthdayWindowMode = 'upcoming' | 'recent' | 'all';

export interface UpcomingBirthday {
  student: TeacherStudentSummary;
  date: Date;
  daysUntil: number;
  isPast: boolean;
  key: string;
}

export interface StudentRow {
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

export interface BirthdayDonationRegisterProps {
  organizationId?: string | null;
}

// ── Utility functions ──────────────────────────────────────────────────────────

export const padDatePart = (value: number): string =>
  String(value).padStart(2, '0');

export const formatDateKey = (date: Date): string =>
  `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;

export const startOfWeekMonday = (date: Date): Date => {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = result.getDay();
  const mondayOffset = (day + 6) % 7;
  result.setDate(result.getDate() - mondayOffset);
  return result;
};

export const getCelebrationFriday = (date: Date): Date => {
  const weekStart = startOfWeekMonday(date);
  const friday = new Date(weekStart);
  friday.setDate(weekStart.getDate() + 4);
  return friday;
};

export const parseDateParts = (
  value?: string | null,
): { month: number; day: number } | null => {
  if (!value) return null;
  const datePart = value.split('T')[0] || value;
  const [year, month, day] = datePart.split('-').map((part) => Number(part));
  if (!year || !month || !day) return null;
  return { month, day };
};

export const getBirthdayWindow = (
  students: TeacherStudentSummary[],
  mode: BirthdayWindowMode,
): UpcomingBirthday[] => {
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const entries: UpcomingBirthday[] = [];
  const dayMs = 1000 * 60 * 60 * 24;
  const seen = new Set<string>();
  const currentYear = startOfToday.getFullYear();

  if (mode === 'all') {
    students.forEach((student) => {
      const parts = parseDateParts(student.dateOfBirth);
      if (!parts) return;
      const thisYearBirthday = new Date(currentYear, parts.month - 1, parts.day);
      const daysUntil = Math.round(
        (thisYearBirthday.getTime() - startOfToday.getTime()) / dayMs,
      );
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

  students.forEach((student) => {
    const parts = parseDateParts(student.dateOfBirth);
    if (!parts) return;
    const thisYearBirthday = new Date(currentYear, parts.month - 1, parts.day);

    if (includeUpcoming && thisYearBirthday >= startOfToday) {
      const daysUntil = Math.round(
        (thisYearBirthday.getTime() - startOfToday.getTime()) / dayMs,
      );
      if (daysUntil >= 0 && daysUntil <= UPCOMING_WINDOW_DAYS) {
        const key = `${student.id}|${formatDateKey(thisYearBirthday)}`;
        if (!seen.has(key)) {
          seen.add(key);
          entries.push({ student, date: thisYearBirthday, daysUntil, isPast: false, key });
        }
      }
    }

    if (includePast && thisYearBirthday < startOfToday) {
      const daysSince = Math.round(
        (startOfToday.getTime() - thisYearBirthday.getTime()) / dayMs,
      );
      if (daysSince >= 0 && daysSince <= PAST_WINDOW_DAYS) {
        const key = `${student.id}|${formatDateKey(thisYearBirthday)}`;
        if (!seen.has(key)) {
          seen.add(key);
          entries.push({
            student,
            date: thisYearBirthday,
            daysUntil: -daysSince,
            isPast: true,
            key,
          });
        }
      }
    }
  });

  entries.sort((a, b) => {
    if (a.daysUntil !== b.daysUntil) return a.daysUntil - b.daysUntil;
    return `${a.student.firstName} ${a.student.lastName}`.localeCompare(
      `${b.student.firstName} ${b.student.lastName}`,
    );
  });

  if (mode === 'upcoming') {
    return entries.slice(0, MAX_UPCOMING_BIRTHDAYS);
  }

  return entries;
};
