/**
 * Label normalisation, purpose resolution, accounting-month resolution,
 * and payment-amount resolution helpers.
 */

import { inferFeeCategoryCode } from '@/lib/utils/feeUtils';
import { monthStartIsoFromValue, monthStartIsoWithCutoff } from './dateHelpers';

export const CATEGORY_LABELS: Record<string, string> = {
  tuition: 'Tuition',
  registration: 'Registration',
  uniform: 'Uniform',
  aftercare: 'Aftercare',
  transport: 'Transport',
  meal: 'Meals',
  ad_hoc: 'Other',
};

export function normalizeReference(value?: string | null): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

export function normalizePurposeLabel(raw: unknown): string {
  const value = String(raw || '').trim().toLowerCase();
  if (!value) return 'General';
  if (value.includes('tuition') || value === 'fees' || value.includes('school fee')) return 'Tuition';
  if (value.includes('registration') || value.includes('admission') || value.includes('enrol')) return 'Registration';
  if (value.includes('uniform')) return 'Uniform';
  if (value.includes('aftercare')) return 'Aftercare';
  if (value.includes('transport') || value.includes('bus') || value.includes('shuttle')) return 'Transport';
  if (value.includes('meal') || value.includes('food') || value.includes('lunch') || value.includes('snack')) return 'Meals';
  if (value.includes('book') || value.includes('stationery') || value.includes('material')) return 'Learning Materials';
  if (value.includes('trip') || value.includes('excursion') || value.includes('event')) return 'Excursions & Events';
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function resolvePaymentPurposeLabel(payment: any): string {
  const metadata =
    payment?.metadata && typeof payment.metadata === 'object' ? payment.metadata : {};
  const categoryCode = inferFeeCategoryCode(
    payment?.category_code ||
      metadata?.category_code ||
      metadata?.fee_category ||
      metadata?.category ||
      payment?.description ||
      metadata?.payment_context ||
      'tuition',
  );
  const categoryLabel = CATEGORY_LABELS[categoryCode];
  if (categoryLabel) return categoryLabel;
  const firstCandidate = [
    metadata?.payment_context,
    metadata?.payment_purpose,
    metadata?.purpose,
    metadata?.fee_type,
    payment?.description,
  ].find((candidate) => typeof candidate === 'string' && candidate.trim().length > 0);
  return normalizePurposeLabel(firstCandidate || categoryCode);
}

export function resolvePopPurposeLabel(upload: any): string {
  const categoryCode = inferFeeCategoryCode(
    upload?.category_code || upload?.description || upload?.title || 'tuition',
  );
  const categoryLabel = CATEGORY_LABELS[categoryCode];
  if (categoryLabel) return categoryLabel;
  return normalizePurposeLabel(upload?.description || upload?.title || 'General');
}

export function resolvePaymentAccountingMonth(payment: any): string | null {
  const metadata =
    payment?.metadata && typeof payment.metadata === 'object' ? payment.metadata : {};
  const explicitValues: Array<{
    value: string | null | undefined;
    recoverUtcMonthBoundary?: boolean;
  }> = [
    { value: metadata?.payment_for_month, recoverUtcMonthBoundary: true },
    { value: metadata?.billing_month, recoverUtcMonthBoundary: true },
    { value: metadata?.payment_month, recoverUtcMonthBoundary: true },
    { value: payment?.billing_month, recoverUtcMonthBoundary: true },
  ];

  for (const candidate of explicitValues) {
    const monthIso = monthStartIsoFromValue(
      typeof candidate.value === 'string' ? candidate.value : null,
      { recoverUtcMonthBoundary: candidate.recoverUtcMonthBoundary },
    );
    if (monthIso) return monthIso;
  }

  const fallbackDates = [
    payment?.transaction_date,
    metadata?.payment_date,
    payment?.created_at,
  ];
  for (const dateValue of fallbackDates) {
    const monthIso = monthStartIsoWithCutoff(
      typeof dateValue === 'string' ? dateValue : null,
      { applyCutoff: true },
    );
    if (monthIso) return monthIso;
  }

  return null;
}

export function resolvePopAccountingMonth(upload: any): string | null {
  const explicit = monthStartIsoFromValue(
    upload?.payment_for_month || upload?.billing_month,
    { recoverUtcMonthBoundary: true },
  );
  if (explicit) return explicit;

  const fallback = [upload?.payment_date, upload?.created_at];
  for (const value of fallback) {
    const monthIso = monthStartIsoWithCutoff(typeof value === 'string' ? value : null, {
      applyCutoff: true,
    });
    if (monthIso) return monthIso;
  }

  return null;
}

export function resolvePaymentAmount(payment: any): number {
  const amount = Number(payment?.amount);
  if (Number.isFinite(amount) && amount > 0) return amount;
  const cents = Number(payment?.amount_cents);
  if (Number.isFinite(cents) && cents > 0) return cents / 100;
  return 0;
}
