export interface FeeSelectionContext {
  dateOfBirth?: string | null;
  enrollmentDate?: string | null;
  ageGroupLabel?: string | null;
  gradeLevel?: string | null;
}

export interface FeeStructureCandidate {
  id: string;
  amount: number;
  name?: string | null;
  description?: string | null;
  fee_type?: string | null;
  grade_levels?: string[] | null;
  age_group?: string | null;
  grade_level?: string | null;
  effective_from?: string | null;
  created_at?: string | null;
  /** Structured age range — preferred over text-parsing when present */
  age_min_months?: number | null;
  age_max_months?: number | null;
}

interface AgeRange {
  minMonths?: number;
  maxMonths?: number;
}

type AgeUnit = 'months' | 'years';

const rangePattern = /(\d+(?:\.\d+)?)\s*(m|mo|mos|month|months|yr|yrs|year|years)?\s*(?:-|–|—|to)\s*(\d+(?:\.\d+)?)\s*(m|mo|mos|month|months|yr|yrs|year|years)?/i;

export function computeAgeMonths(dateOfBirth?: string | null, asOfDate?: string | null): number | null {
  if (!dateOfBirth) return null;
  const birthDate = new Date(dateOfBirth);
  if (Number.isNaN(birthDate.getTime())) return null;

  const anchorDate = asOfDate ? new Date(asOfDate) : new Date();
  if (Number.isNaN(anchorDate.getTime())) return null;

  let months =
    (anchorDate.getFullYear() - birthDate.getFullYear()) * 12 +
    (anchorDate.getMonth() - birthDate.getMonth());
  if (anchorDate.getDate() < birthDate.getDate()) {
    months -= 1;
  }

  return months < 0 ? null : months;
}

function normalizeUnit(value?: string | null): AgeUnit | null {
  if (!value) return null;
  const unit = value.toLowerCase();
  if (unit.startsWith('m')) return 'months';
  if (unit.startsWith('mo')) return 'months';
  if (unit.startsWith('yr') || unit.startsWith('yea')) return 'years';
  return null;
}

function toMonths(value: number, unit: AgeUnit): number {
  return unit === 'months' ? value : value * 12;
}

function detectLabelUnit(text: string): AgeUnit | null {
  const normalized = text.toLowerCase();
  if (/\bmonth|months|\bmo\b|\bmos\b/.test(normalized)) return 'months';
  if (/\byear|years|\byr\b|\byrs\b/.test(normalized)) return 'years';
  return null;
}

function parseAgeRange(text: string): AgeRange | null {
  const normalized = text.toLowerCase();
  const rangeMatch = normalized.match(rangePattern);
  const labelUnit = detectLabelUnit(normalized);
  if (rangeMatch) {
    const startValue = Number(rangeMatch[1]);
    const endValue = Number(rangeMatch[3]);
    if (!Number.isNaN(startValue) && !Number.isNaN(endValue)) {
      const startUnit = normalizeUnit(rangeMatch[2]) || normalizeUnit(rangeMatch[4]) || labelUnit || 'years';
      const endUnit = normalizeUnit(rangeMatch[4]) || normalizeUnit(rangeMatch[2]) || labelUnit || 'years';
      const min = toMonths(Math.min(startValue, endValue), startUnit);
      const max = toMonths(Math.max(startValue, endValue), endUnit);
      return { minMonths: Math.min(min, max), maxMonths: Math.max(min, max) };
    }
  }

  const numbers = normalized.match(/\d+/g)?.map((value) => Number(value)) ?? [];
  if (numbers.length === 0) return null;

  if (numbers.length >= 2) {
    const min = Math.min(...numbers);
    const max = Math.max(...numbers);
    const unit = labelUnit || 'years';
    return { minMonths: toMonths(min, unit), maxMonths: toMonths(max, unit) };
  }

  const value = numbers[0];
  if (Number.isNaN(value)) return null;
  const unit = labelUnit || 'years';
  const monthsValue = toMonths(value, unit);

  if (/(plus|\+|and up|or more|above)/.test(normalized)) {
    return { minMonths: monthsValue };
  }
  if (/(under|below|less than|<)/.test(normalized)) {
    return { maxMonths: monthsValue };
  }
  return { minMonths: monthsValue, maxMonths: monthsValue };
}

function isAgeInRange(ageMonths: number, range: AgeRange): boolean {
  if (range.minMonths != null && ageMonths < range.minMonths) return false;
  if (range.maxMonths != null && ageMonths > range.maxMonths) return false;
  return true;
}

function distanceToRange(ageMonths: number, range: AgeRange): number | null {
  if (range.minMonths == null && range.maxMonths == null) return null;
  if (range.minMonths != null && ageMonths < range.minMonths) return range.minMonths - ageMonths;
  if (range.maxMonths != null && ageMonths > range.maxMonths) return ageMonths - range.maxMonths;
  return 0;
}

function buildFeeLabels(fee: FeeStructureCandidate): string[] {
  const labels: Array<string | null | undefined> = [
    fee.name,
    fee.description,
    fee.age_group,
    fee.grade_level,
  ];
  const gradeLevels = fee.grade_levels ?? [];
  return [...labels, ...gradeLevels].filter((value): value is string => Boolean(value && value.trim()));
}

export function selectFeeStructureForChild<T extends FeeStructureCandidate>(
  structures: T[],
  context: FeeSelectionContext
): T | null {
  if (!structures.length) return null;
  if (structures.length === 1) return structures[0];

  const ageMonths = computeAgeMonths(context.dateOfBirth, context.enrollmentDate);
  const ageGroupLabel = context.ageGroupLabel?.toLowerCase().trim();
  const gradeLevel = context.gradeLevel?.toLowerCase().trim();

  const candidates = structures.map((fee) => {
    const labels = buildFeeLabels(fee);
    // Prefer structured age columns from DB over text-parsing
    const structuredRange: AgeRange | null =
      fee.age_min_months != null && fee.age_max_months != null
        ? { minMonths: fee.age_min_months, maxMonths: fee.age_max_months }
        : null;
    const textRanges = labels
      .map(parseAgeRange)
      .filter((range): range is AgeRange => range !== null);
    const ranges = structuredRange ? [structuredRange] : textRanges;
    const labelText = labels.join(' ').toLowerCase();
    return { fee, ranges, labelText };
  });

  if (ageMonths != null) {
    const matching = candidates
      .map((candidate) => {
        const matchingRanges = candidate.ranges.filter((range) => isAgeInRange(ageMonths, range));
        if (!matchingRanges.length) return null;
        const bestRangeWidth = Math.min(
          ...matchingRanges.map((range) => {
            const min = range.minMonths ?? 0;
            const max = range.maxMonths ?? min;
            return Math.max(0, max - min);
          })
        );
        return { candidate, bestRangeWidth };
      })
      .filter(
        (value): value is { candidate: (typeof candidates)[number]; bestRangeWidth: number } =>
          value !== null
      );

    if (matching.length) {
      const sorted = matching.sort((a, b) => {
        if (a.bestRangeWidth !== b.bestRangeWidth) {
          return a.bestRangeWidth - b.bestRangeWidth;
        }

        const aEffective = a.candidate.fee.effective_from
          ? new Date(a.candidate.fee.effective_from).getTime()
          : 0;
        const bEffective = b.candidate.fee.effective_from
          ? new Date(b.candidate.fee.effective_from).getTime()
          : 0;
        if (aEffective !== bEffective) {
          return bEffective - aEffective;
        }

        const aCreated = a.candidate.fee.created_at
          ? new Date(a.candidate.fee.created_at).getTime()
          : 0;
        const bCreated = b.candidate.fee.created_at
          ? new Date(b.candidate.fee.created_at).getTime()
          : 0;
        return bCreated - aCreated;
      });
      return sorted[0].candidate.fee;
    }
  }

  if (ageGroupLabel) {
    const labelMatch = candidates.find((candidate) => candidate.labelText.includes(ageGroupLabel));
    if (labelMatch) return labelMatch.fee;
  }

  if (gradeLevel) {
    const gradeMatch = candidates.find((candidate) => candidate.labelText.includes(gradeLevel));
    if (gradeMatch) return gradeMatch.fee;
  }

  if (ageMonths != null) {
    let best: { fee: T; distance: number } | null = null;
    candidates.forEach((candidate) => {
      candidate.ranges.forEach((range) => {
        const distance = distanceToRange(ageMonths, range);
        if (distance == null) return;
        if (!best || distance < best.distance) {
          best = { fee: candidate.fee, distance };
        }
      });
    });
    if (best) return best.fee;
  }

  return structures[0];
}
