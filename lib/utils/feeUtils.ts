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
  if (/\b(donation|sponsor|sponsorship|contribution)\b/.test(text)) return 'Donations';
  if (/\b(registration|admission|enrolment|enrollment)\b/.test(text)) return 'Registration';
  if (/\b(book|stationery|materials|supplies)\b/.test(text)) return 'Materials';
  if (/\b(transport|bus|shuttle)\b/.test(text)) return 'Transport';
  if (/\b(meal|lunch|snack|food)\b/.test(text)) return 'Meals';
  if (/\b(activity|event|camp)\b/.test(text)) return 'Activities';
  return 'Tuition';
};
