/**
 * Daily.co SDK Wrapper with Promise.any polyfill injection
 * 
 * This wrapper ensures Promise.any exists BEFORE Daily.co SDK loads.
 * The Daily.co SDK internally uses Promise.any for WebRTC track consumption.
 * 
 * CRITICAL: This module MUST be imported instead of direct Daily SDK imports.
 */

// Force Promise.any polyfill installation FIRST
if (typeof Promise.any !== 'function') {
  console.log('[DailyWrapper] Installing Promise.any polyfill before SDK load...');
  
  // AggregateError polyfill
  if (!(globalThis as any).AggregateError) {
    (globalThis as any).AggregateError = class AggregateError extends Error {
      errors: any[];
      constructor(errors: any[], message: string) {
        super(message);
        this.name = 'AggregateError';
        this.errors = errors;
      }
    };
  }

  // Promise.any implementation
  const promiseAny = function<T>(promises: Iterable<T | PromiseLike<T>>): Promise<Awaited<T>> {
    return new Promise((resolve, reject) => {
      const promiseArray = Array.from(promises);
      
      if (promiseArray.length === 0) {
        reject(new (globalThis as any).AggregateError([], 'All promises were rejected'));
        return;
      }

      const errors: any[] = new Array(promiseArray.length);
      let rejectedCount = 0;
      let resolved = false;

      promiseArray.forEach((promise, index) => {
        Promise.resolve(promise).then(
          (value) => {
            if (!resolved) {
              resolved = true;
              resolve(value);
            }
          },
          (error) => {
            errors[index] = error;
            rejectedCount++;
            if (rejectedCount === promiseArray.length && !resolved) {
              reject(new (globalThis as any).AggregateError(errors, 'All promises were rejected'));
            }
          }
        );
      });
    });
  };

  // Install on Promise constructor
  (Promise as any).any = promiseAny;
  
  // Also install on global Promise reference
  (globalThis as any).Promise.any = promiseAny;
  
  console.log('[DailyWrapper] Promise.any polyfill installed');
} else {
  console.log('[DailyWrapper] Promise.any already exists');
}

// Verify installation
console.log('[DailyWrapper] Promise.any type:', typeof Promise.any);
console.log('[DailyWrapper] globalThis.Promise.any type:', typeof (globalThis as any).Promise.any);

// NOW load Daily SDK after polyfill is guaranteed to exist
let DailyModule: any;
try {
  console.log('[DailyWrapper] Loading @daily-co/react-native-daily-js...');
  DailyModule = require('@daily-co/react-native-daily-js');
  console.log('[DailyWrapper] Daily SDK loaded successfully');
  console.log('[DailyWrapper] Final Promise.any check:', typeof Promise.any);
} catch (error) {
  console.error('[DailyWrapper] Failed to load Daily SDK:', error);
  throw error;
}

// Export the Daily SDK
export default DailyModule.default || DailyModule;
export const DailyCall = DailyModule.DailyCall;
export const DailyEvent = DailyModule.DailyEvent;
