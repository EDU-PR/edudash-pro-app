/**
 * Promise.any polyfill for React Native / Hermes
 * 
 * CRITICAL: This must run BEFORE any other modules load, especially Daily.co SDK.
 * Daily.co captures Promise at module load time, so we must patch it synchronously.
 * 
 * This ONLY adds Promise.any - it does NOT replace the Promise constructor.
 * (core-js causes infinite loops with Hermes because it replaces the entire Promise)
 */

// Immediately-invoked setup - runs synchronously at import time
(function setupPromisePolyfills() {
  'use strict';
  
  // Get the global object (works in all environments)
  const g: any = 
    typeof globalThis !== 'undefined' ? globalThis :
    typeof global !== 'undefined' ? global :
    typeof window !== 'undefined' ? window :
    typeof self !== 'undefined' ? self : {};

  // AggregateError polyfill
  if (typeof g.AggregateError === 'undefined') {
    class AggregateErrorPolyfill extends Error {
      errors: any[];
      constructor(errors: Iterable<any>, message?: string) {
        super(message || 'All promises were rejected');
        this.name = 'AggregateError';
        this.errors = Array.from(errors);
        // Fix prototype chain for ES5 environments
        Object.setPrototypeOf(this, AggregateErrorPolyfill.prototype);
      }
    }
    g.AggregateError = AggregateErrorPolyfill;
    // Also set on globalThis if different
    if (typeof globalThis !== 'undefined' && globalThis !== g) {
      (globalThis as any).AggregateError = AggregateErrorPolyfill;
    }
  }

  // Promise.any implementation
  function promiseAny<T>(iterable: Iterable<T | PromiseLike<T>>): Promise<Awaited<T>> {
    return new Promise((resolve, reject) => {
      const promises = Array.from(iterable);
      
      if (promises.length === 0) {
        reject(new g.AggregateError([], 'All promises were rejected'));
        return;
      }

      const errors: any[] = new Array(promises.length);
      let rejectionCount = 0;
      let resolved = false;

      promises.forEach((promise, index) => {
        Promise.resolve(promise).then(
          (value) => {
            if (!resolved) {
              resolved = true;
              resolve(value);
            }
          },
          (reason) => {
            if (!resolved) {
              errors[index] = reason;
              rejectionCount++;
              if (rejectionCount === promises.length) {
                reject(new g.AggregateError(errors, 'All promises were rejected'));
              }
            }
          }
        );
      });
    });
  }

  // Patch Promise.any if missing - use Object.defineProperty for better compatibility
  const PromiseConstructor = g.Promise || Promise;
  
  if (typeof PromiseConstructor.any !== 'function') {
    try {
      Object.defineProperty(PromiseConstructor, 'any', {
        value: promiseAny,
        writable: true,
        configurable: true,
        enumerable: false,
      });
    } catch (e) {
      // Fallback if defineProperty fails
      (PromiseConstructor as any).any = promiseAny;
    }
    
    // Also patch the local Promise if different from global
    if (Promise !== PromiseConstructor && typeof Promise.any !== 'function') {
      try {
        Object.defineProperty(Promise, 'any', {
          value: promiseAny,
          writable: true,
          configurable: true,
          enumerable: false,
        });
      } catch (e) {
        (Promise as any).any = promiseAny;
      }
    }
  }

  // Verify installation
  const isAvailable = typeof Promise.any === 'function';
  console.log('[Polyfill] Promise.any:', isAvailable ? '✅ installed' : '❌ FAILED');
  
  if (!isAvailable) {
    console.error('[Polyfill] CRITICAL: Promise.any polyfill failed to install!');
    console.error('[Polyfill] Daily.co SDK will not work correctly.');
  }
})();

// Export to make this a module  
export {};
