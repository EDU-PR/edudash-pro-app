/**
 * Utility functions for subscription upgrade screen
 */

/**
 * Get first value from array/string param
 */
export const takeFirst = (v: string | string[] | undefined): string | undefined => {
  if (Array.isArray(v)) return v[0];
  return v;
};

/**
 * Safe color helper - use rgba() to avoid platform-specific hex alpha format issues
 */
export const withAlpha = (hex: string, alpha = 0.125): string => {
  try {
    const match = /^#([0-9A-Fa-f]{6})$/.exec(hex);
    if (match) {
      const int = parseInt(match[1], 16);
      const r = (int >> 16) & 255;
      const g = (int >> 8) & 255;
      const b = int & 255;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  } catch {
    // ignore and use fallback
  }
  return `rgba(31, 41, 55, ${alpha})`;
};

/**
 * Get color for plan tier
 */
export const getPlanColor = (tier: string): string => {
  switch (tier.toLowerCase()) {
    case 'starter': return '#3b82f6';
    case 'premium': return '#8b5cf6';
    case 'enterprise': return '#f59e0b';
    default: return '#00f5ff';
  }
};

/**
 * Convert price from cents to rands
 */
export const convertPrice = (price: number): number => {
  // If price >= 100, assume it's in cents, otherwise assume rands
  return price >= 100 ? price / 100 : price;
};

/**
 * Normalize tier string for comparison
 */
export const normalizeTier = (v: string): string => 
  String(v || '').toLowerCase().replace(/-/g, '_');
