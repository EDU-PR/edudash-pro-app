/**
 * Simple single-field check: does this label/string mention "uniform"?
 * Use for quick filtering of fee types, descriptions, or references.
 */
export const isUniformLabel = (value?: string | null): boolean =>
  (value || '').toLowerCase().includes('uniform');

export type SchoolFeeCategoryCode =
  | 'tuition'
  | 'registration'
  | 'deposit'
  | 'transport'
  | 'meals'
  | 'activities'
  | 'aftercare'
  | 'excursion'
  | 'fundraiser'
  | 'donation_drive'
  | 'uniform'
  | 'books'
  | 'other';

export const SCHOOL_FEE_CATEGORIES: readonly SchoolFeeCategoryCode[] = [
  'tuition',
  'registration',
  'deposit',
  'transport',
  'meals',
  'activities',
  'aftercare',
  'excursion',
  'fundraiser',
  'donation_drive',
  'uniform',
  'books',
  'other',
] as const;

export const isTuitionFee = (
  feeType?: string | null,
  name?: string | null,
  description?: string | null
): boolean => {
  const text = `${feeType ?? ''} ${name ?? ''} ${description ?? ''}`.toLowerCase();
  return (
    text.includes('tuition') ||
    text.includes('school fees') ||
    text.includes('school fee') ||
    text.includes('monthly')
  );
};

export const isUniformFee = (
  feeType?: string | null,
  name?: string | null,
  description?: string | null
): boolean => {
  const text = `${feeType ?? ''} ${name ?? ''} ${description ?? ''}`.toLowerCase();
  return text.includes('uniform');
};

export const getUniformItemType = (
  feeType?: string | null,
  name?: string | null,
  description?: string | null
): 'set' | 'tshirt' | 'shorts' | null => {
  const text = `${feeType ?? ''} ${name ?? ''} ${description ?? ''}`.toLowerCase();
  const normalizedFeeType = (feeType ?? '').toLowerCase();
  const mentionsSet =
    /\bfull\s*set\b/.test(text) ||
    /\bcomplete\s*set\b/.test(text) ||
    /\buniform\s*set\b/.test(text) ||
    (/\bset\b/.test(text) && text.includes('uniform'));

  if (normalizedFeeType.includes('set') || mentionsSet) {
    return 'set';
  }
  if (/t[\s-]?shirt|tee|top/.test(text)) {
    return 'tshirt';
  }
  if (/shorts?\b/.test(text)) {
    return 'shorts';
  }
  if (normalizedFeeType === 'uniform') {
    return 'set';
  }
  if (text.includes('uniform')) {
    return 'set';
  }
  return null;
};

export const inferPaymentCategory = (value?: string | null): string => {
  const text = (value ?? '').toLowerCase();
  if (!text) return 'Tuition';
  if (text.includes('uniform')) return 'Uniform';
  if (/\b(excursion|trip|tour|outing)\b/.test(text)) return 'Excursions';
  if (/\b(fundraiser|raffle|market\s*day|bake\s*sale)\b/.test(text)) return 'Fundraiser';
  if (/\b(donation|sponsor|sponsorship|contribution)\b/.test(text)) return 'Donations';
  if (/\b(registration|admission|enrolment|enrollment)\b/.test(text)) return 'Registration';
  if (/\b(deposit|enrolment fee|enrollment fee)\b/.test(text)) return 'Deposit';
  if (/\b(book|stationery|materials|supplies)\b/.test(text)) return 'Materials';
  if (/\b(transport|bus|shuttle)\b/.test(text)) return 'Transport';
  if (/\b(meal|lunch|snack|food)\b/.test(text)) return 'Meals';
  if (/\b(activity|event|camp)\b/.test(text)) return 'Activities';
  return 'Tuition';
};

export const normalizeSchoolFeeCategoryCode = (value?: string | null): SchoolFeeCategoryCode => {
  const text = (value ?? '').toLowerCase().trim();
  if (!text) return 'tuition';

  if (
    text === 'uniform_tshirt' ||
    text === 'uniform_shorts' ||
    text === 'uniform_set' ||
    text.startsWith('uniform') ||
    /\buniform\b/.test(text)
  ) {
    return 'uniform';
  }

  if (/\b(registration|admission|enrolment|enrollment)\b/.test(text)) {
    return 'registration';
  }

  if (/\b(deposit|holding fee|seat fee)\b/.test(text)) {
    return 'deposit';
  }

  if (/\b(aftercare|after care)\b/.test(text)) {
    return 'aftercare';
  }

  if (/\b(transport|bus|shuttle)\b/.test(text)) {
    return 'transport';
  }

  if (/\b(meal|food|catering|lunch|snack)\b/.test(text)) {
    return 'meals';
  }

  if (/\b(excursion|trip|tour|outing)\b/.test(text)) {
    return 'excursion';
  }

  if (/\b(fundraiser|raffle|bake sale|walk-a-thon|fun run)\b/.test(text)) {
    return 'fundraiser';
  }

  if (/\b(donation|sponsor|sponsorship|contribution)\b/.test(text)) {
    return 'donation_drive';
  }

  if (/\b(book|stationery|materials|supplies)\b/.test(text)) {
    return 'books';
  }

  if (/\b(activity|event|camp|club|extra mural|extramural)\b/.test(text)) {
    return 'activities';
  }

  if (/\b(tuition|school fee|monthly)\b/.test(text)) {
    return 'tuition';
  }

  if (text === 'ad_hoc' || text === 'adhoc' || text === 'other') {
    return 'other';
  }

  return 'other';
};

export const normalizeFeeCategoryCode = (value?: string | null):
  | 'tuition'
  | 'registration'
  | 'uniform'
  | 'aftercare'
  | 'transport'
  | 'meal'
  | 'ad_hoc' => {
  const normalized = normalizeSchoolFeeCategoryCode(value);

  if (normalized === 'meals') return 'meal';
  if (normalized === 'tuition') return 'tuition';
  if (normalized === 'registration') return 'registration';
  if (normalized === 'uniform') return 'uniform';
  if (normalized === 'aftercare') return 'aftercare';
  if (normalized === 'transport') return 'transport';

  // Legacy finance ledgers still treat extended categories as ad_hoc.
  return 'ad_hoc';
};

export const inferFeeCategoryCode = (value?: string | null) => normalizeFeeCategoryCode(value);
export const inferSchoolFeeCategoryCode = (value?: string | null) => normalizeSchoolFeeCategoryCode(value);
