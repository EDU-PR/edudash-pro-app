/**
 * Centralized logging utility
 * 
 * Usage:
 * - Use logger.debug() for development-only logs
 * - Use logger.warn() for development-only warnings
 * - Use logger.error() for errors that should always be logged (sent to Sentry in production)
 * 
 * Benefits:
 * - console.log/warn statements only run in development (__DEV__)
 * - console.error always runs for error tracking
 * - Consistent formatting with tags
 * - Easy to switch to Sentry/other logging service in future
 */

export const logger = {
  /**
   * Debug logging - only in development
   * @param tag - Component or module name (e.g., 'MessagesRealtime')
   * @param args - Data to log
   */
  debug: (tag: string, ...args: any[]) => {
    if (__DEV__) {
      console.log(`[${tag}]`, ...args);
    }
  },

  /**
   * Warning logging - only in development
   * @param tag - Component or module name
   * @param args - Data to log
   */
  warn: (tag: string, ...args: any[]) => {
    if (__DEV__) {
      console.warn(`[${tag}]`, ...args);
    }
  },

  /**
   * Error logging - always logged (sent to Sentry in production)
   * @param tag - Component or module name
   * @param args - Error data to log
   */
  error: (tag: string, ...args: any[]) => {
    console.error(`[${tag}]`, ...args);
    // Report to Sentry in production
    if (!__DEV__) {
      try {
        const { reportError } = require('@/lib/monitoring');
        const err = args[0] instanceof Error ? args[0] : new Error(`[${tag}] ${String(args[0])}`);
        reportError(err, { tag, details: args.slice(1) });
      } catch { /* monitoring not available */ }
    }
  },

  /**
   * Info logging - only in development
   * @param tag - Component or module name
   * @param args - Data to log
   */
  info: (tag: string, ...args: any[]) => {
    if (__DEV__) {
      console.info(`[${tag}]`, ...args);
    }
  },

  /**
   * Force error logging - always logged regardless of __DEV__
   * Used for critical errors that must be logged in production
   * @param tag - Component or module name
   * @param args - Error data to log
   */
  forceError: (tag: string, ...args: any[]) => {
    console.error(`[${tag}]`, ...args);
    // Report to Sentry in production
    if (!__DEV__) {
      try {
        const { reportError } = require('@/lib/monitoring');
        const err = args[0] instanceof Error ? args[0] : new Error(`[${tag}] ${String(args[0])}`);
        reportError(err, { tag, details: args.slice(1), forced: true });
      } catch { /* monitoring not available */ }
    }
  },
};

/**
 * Legacy compatibility - for gradual migration
 * Wrap existing console.log statements without refactoring
 */
export const devLog = (...args: any[]) => {
  if (__DEV__) {
    console.log(...args);
  }
};

export const devWarn = (...args: any[]) => {
  if (__DEV__) {
    console.warn(...args);
  }
};
