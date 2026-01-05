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
