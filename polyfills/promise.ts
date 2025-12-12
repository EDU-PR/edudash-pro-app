/**
 * Promise polyfills for React Native
 * Required for Daily.co SDK which uses Promise.any
 */

// Get global object (works in React Native, Node, and browsers)
declare const global: any;
const globalThis_ = typeof globalThis !== 'undefined' ? globalThis : typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : ({} as any);

// Polyfill Promise.any if not available
if (!Promise.any) {
  (Promise as any).any = function (promises: Promise<any>[]) {
    return new Promise((resolve, reject) => {
      let errors: any[] = [];
      let remaining = promises.length;

      if (remaining === 0) {
        const AggregateError = (globalThis_ as any).AggregateError || Error;
        reject(new AggregateError([], 'All promises were rejected'));
        return;
      }

      promises.forEach((promise, index) => {
        Promise.resolve(promise).then(
          (value) => resolve(value),
          (error) => {
            errors[index] = error;
            remaining--;
            if (remaining === 0) {
              const AggregateError = (globalThis_ as any).AggregateError || Error;
              reject(new AggregateError(errors, 'All promises were rejected'));
            }
          }
        );
      });
    });
  };
  if (__DEV__) console.log('[Polyfill] Promise.any added');
}

// Polyfill AggregateError if not available
if (typeof (globalThis_ as any).AggregateError === 'undefined') {
  (globalThis_ as any).AggregateError = class AggregateError extends Error {
    errors: any[];
    constructor(errors: any[], message: string) {
      super(message);
      this.name = 'AggregateError';
      this.errors = errors;
    }
  };
  if (__DEV__) console.log('[Polyfill] AggregateError added');
}

// Polyfill Promise.allSettled if not available
if (!Promise.allSettled) {
  (Promise as any).allSettled = function (promises: Promise<any>[]) {
    return Promise.all(
      promises.map((p) =>
        Promise.resolve(p).then(
          (value) => ({ status: 'fulfilled' as const, value }),
          (reason) => ({ status: 'rejected' as const, reason })
        )
      )
    );
  };
  if (__DEV__) console.log('[Polyfill] Promise.allSettled added');
}
