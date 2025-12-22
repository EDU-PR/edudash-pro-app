/**
 * Promise polyfills for React Native
 * Required for Daily.co SDK which uses Promise.any
 * CRITICAL: Must be loaded BEFORE any other imports
 * 
 * The Daily.co SDK's WebRTC code uses Promise.any internally.
 * Hermes engine (React Native) doesn't have Promise.any by default.
 */

// Declare global types
declare const global: any;
declare const __DEV__: boolean;

// AggregateError polyfill (needed for Promise.any rejections)
class AggregateErrorPolyfill extends Error {
  errors: any[];
  constructor(errors: any[], message: string) {
    super(message);
    this.name = 'AggregateError';
    this.errors = errors;
    // Fix prototype chain for instanceof checks
    Object.setPrototypeOf(this, AggregateErrorPolyfill.prototype);
  }
}

// Apply AggregateError to all global contexts immediately
if (typeof globalThis !== 'undefined' && !globalThis.AggregateError) {
  (globalThis as any).AggregateError = AggregateErrorPolyfill;
}
if (typeof global !== 'undefined' && !global.AggregateError) {
  global.AggregateError = AggregateErrorPolyfill;
}
if (typeof window !== 'undefined' && !(window as any).AggregateError) {
  (window as any).AggregateError = AggregateErrorPolyfill;
}

// Promise.any implementation following ES2021 spec
function promiseAny<T>(promises: Iterable<T | PromiseLike<T>>): Promise<Awaited<T>> {
  return new Promise((resolve, reject) => {
    const promiseArray = Array.from(promises);
    const errors: any[] = new Array(promiseArray.length);
    let rejectedCount = 0;
    
    if (promiseArray.length === 0) {
      reject(new AggregateErrorPolyfill([], 'All promises were rejected'));
      return;
    }

    promiseArray.forEach((promise, index) => {
      Promise.resolve(promise).then(
        resolve, // First fulfilled promise resolves the whole thing
        (error) => {
          errors[index] = error;
          rejectedCount++;
          if (rejectedCount === promiseArray.length) {
            reject(new AggregateErrorPolyfill(errors, 'All promises were rejected'));
          }
        }
      );
    });
  });
}

// Apply Promise.any to ALL possible Promise references
// This is critical because different parts of the app may reference different Promise objects

const applyPolyfill = (PromiseConstructor: any, name: string) => {
  if (PromiseConstructor && typeof PromiseConstructor.any !== 'function') {
    PromiseConstructor.any = promiseAny;
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log(`[Polyfill] Promise.any added to ${name}`);
    }
  }
};

// Apply to local Promise
applyPolyfill(Promise, 'Promise');

// Apply to globalThis.Promise (ES2020 global)
if (typeof globalThis !== 'undefined') {
  applyPolyfill(globalThis.Promise, 'globalThis.Promise');
}

// Apply to global.Promise (Node.js / React Native)
if (typeof global !== 'undefined') {
  applyPolyfill(global.Promise, 'global.Promise');
}

// Apply to window.Promise (Browser)
if (typeof window !== 'undefined') {
  applyPolyfill((window as any).Promise, 'window.Promise');
}

// Also patch the prototype to catch any dynamic Promise creation
// This is a last resort for WebRTC internal code
const originalPromiseResolve = Promise.resolve.bind(Promise);
const originalPromiseReject = Promise.reject.bind(Promise);

// Verify the polyfill works
if (typeof __DEV__ !== 'undefined' && __DEV__) {
  try {
    const testResult = Promise.any ? 'available' : 'missing';
    console.log(`[Polyfill] Promise.any status: ${testResult}`);
  } catch (e) {
    console.warn('[Polyfill] Promise.any verification failed:', e);
  }
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
