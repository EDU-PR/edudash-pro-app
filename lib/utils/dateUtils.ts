/**
 * Date Utilities
 * 
 * Shared date manipulation functions for consistent date handling
 * across the application.
 */

/**
 * Convert JavaScript's Sunday-based day of week to Monday-based index
 * JavaScript: Sunday=0, Monday=1, ..., Saturday=6
 * Result: Monday=0, Tuesday=1, ..., Sunday=6
 * 
 * @param date - The date to get the Monday-based day index from
 * @returns Day index where Monday=0 and Sunday=6
 */
export function getMondayBasedDayIndex(date: Date): number {
  // Formula: (dayOfWeek + 6) % 7 shifts Sunday (0) to position 6, and Monday (1) to position 0
  return (date.getDay() + 6) % 7;
}

/**
 * Get week labels starting from Monday
 */
export function getWeekLabels(format: 'short' | 'full' = 'short'): string[] {
  if (format === 'full') {
    return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  }
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
}

/**
 * Initialize an array for weekly data (7 elements, one for each day)
 */
export function createWeekDataArray<T>(defaultValue: T): T[] {
  return Array(7).fill(defaultValue);
}

/**
 * Format date as ZA locale
 */
export function formatDateZA(dateString: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return date.toLocaleDateString('en-ZA', options || {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format currency as ZAR
 */
export function formatZAR(amount: number): string {
  return `R${amount.toFixed(2)}`;
}

/**
 * Format time string (HH:MM:SS or HH:MM) to readable format
 */
export function formatTime(timeString: string): string {
  if (!timeString) return '';
  const [hours, minutes] = timeString.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(minutes).padStart(2, '0')} ${period}`;
}

/**
 * Format relative time (e.g., "2 hours ago", "Yesterday", etc.)
 */
export function formatRelativeTime(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay} days ago`;
  
  return date.toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' });
}

export function parseDateValue(value?: string | Date | null): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatLocalDateISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function isLikelyUtcMonthBoundaryShift(rawValue?: string | null, parsedDate?: Date | null): boolean {
  if (!rawValue || rawValue.includes('T')) return false;
  const date = parsedDate || parseDateValue(rawValue);
  if (!date) return false;
  const day = date.getDate();
  if (day < 28) return false;
  const monthEndDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return day === monthEndDay;
}

type MonthISOOptions = {
  recoverUtcMonthBoundary?: boolean;
  fallbackDate?: Date | null;
};

function resolveMonthAnchorDate(value: string | Date | null | undefined, options?: MonthISOOptions): Date {
  const fallback = options?.fallbackDate === undefined ? new Date() : options.fallbackDate;
  const parsed = parseDateValue(value) || fallback || new Date();
  const rawValue = typeof value === 'string' ? value : null;
  const shouldRecover = Boolean(options?.recoverUtcMonthBoundary) && isLikelyUtcMonthBoundaryShift(rawValue, parsed);

  if (shouldRecover) {
    return new Date(parsed.getFullYear(), parsed.getMonth() + 1, 1);
  }
  return new Date(parsed.getFullYear(), parsed.getMonth(), 1);
}

export function getMonthStartISO(value?: string | Date | null, options?: MonthISOOptions): string {
  const anchor = resolveMonthAnchorDate(value, options);
  return formatLocalDateISO(anchor);
}

export function getMonthEndISO(value?: string | Date | null, options?: MonthISOOptions): string {
  const anchor = resolveMonthAnchorDate(value, options);
  const monthEnd = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  return formatLocalDateISO(monthEnd);
}

export function getDateOnlyISO(value?: string | Date | null, fallbackDate?: Date): string {
  const parsed = parseDateValue(value) || fallbackDate || new Date();
  return formatLocalDateISO(parsed);
}
