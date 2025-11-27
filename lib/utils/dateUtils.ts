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
