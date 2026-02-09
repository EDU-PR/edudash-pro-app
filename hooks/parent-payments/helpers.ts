/** Pure helper functions and types for parent payment hooks */
import type { PaymentChild } from '@/types/payments';

export const isTuitionFee = (feeType?: string | null, name?: string | null, description?: string | null) => {
  const text = `${feeType ?? ''} ${name ?? ''} ${description ?? ''}`.toLowerCase();
  return text.includes('tuition') || text.includes('school fees') || text.includes('school fee') || text.includes('monthly');
};
export const resolveAgeGroupLabel = (child?: PaymentChild) => {
  const directName = child?.age_group?.name || child?.age_group_ref_data?.name || child?.grade_level || child?.grade;
  if (directName) return directName;
  const min = child?.age_group?.age_min ?? child?.age_group_ref_data?.age_min ?? null;
  const max = child?.age_group?.age_max ?? child?.age_group_ref_data?.age_max ?? null;
  if (min != null || max != null) {
    if (min != null && max != null) return `${min}-${max}`;
    if (min != null) return `${min}+`;
    if (max != null) return `0-${max}`;
  }
  return null;
};
export const buildFeeContext = (child?: PaymentChild) => ({
  dateOfBirth: child?.date_of_birth ?? null,
  ageGroupLabel: resolveAgeGroupLabel(child),
  gradeLevel: child?.grade_level ?? child?.grade ?? null,
});
export const toMonthKey = (value?: string | null): string | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};
export type ReceiptInfo = { receiptUrl?: string | null; receiptStoragePath?: string | null };
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const getEnrollmentMonthStart = (date?: string | null) => {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), 1);
};
export const getNextFeeMonth = () => {
  const now = new Date();
  const day = now.getDate(), month = now.getMonth(), year = now.getFullYear();
  if (day > 7) return month === 11 ? { month: 0, year: year + 1 } : { month: month + 1, year };
  return { month, year };
};
