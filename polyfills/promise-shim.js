/**
 * Promise.any polyfill shim for React Native / Hermes
 * 
 * This file is loaded by Metro's getModulesRunBeforeMainModule
 * which ensures it runs BEFORE any other app code (including Daily.co SDK).
 * 
 * IMPORTANT: This is a CommonJS file (.js) because shims run very early in Metro's
 * boot process before TypeScript compilation.
 * 
 * The polyfill is installed IMMEDIATELY and SYNCHRONOUSLY at module load time.
 */

// Get the global object (works in all environments)
var g = typeof globalThis !== 'undefined' ? globalThis :
        typeof global !== 'undefined' ? global :
        typeof window !== 'undefined' ? window :
        typeof self !== 'undefined' ? self : this;

// AggregateError polyfill (required for Promise.any)
if (typeof g.AggregateError === 'undefined') {
  g.AggregateError = function AggregateError(errors, message) {
    var instance = new Error(message || 'All promises were rejected');
    instance.name = 'AggregateError';
    instance.errors = Array.isArray(errors) ? errors : Array.from(errors);
    Object.setPrototypeOf(instance, g.AggregateError.prototype);
    return instance;
  };
  g.AggregateError.prototype = Object.create(Error.prototype);
  g.AggregateError.prototype.constructor = g.AggregateError;
}

// Promise.any polyfill
if (typeof Promise !== 'undefined' && typeof Promise.any !== 'function') {
  Promise.any = function promiseAny(iterable) {
    return new Promise(function(resolve, reject) {
      var promises = Array.from(iterable);
      
      if (promises.length === 0) {
        reject(new g.AggregateError([], 'All promises were rejected'));
        return;
      }

      var errors = new Array(promises.length);
      var rejectionCount = 0;
      var resolved = false;

      promises.forEach(function(promise, index) {
        Promise.resolve(promise).then(
          function(value) {
            if (!resolved) {
              resolved = true;
              resolve(value);
            }
          },
          function(reason) {
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
  };
  
  // Also patch global.Promise if it's different from the local Promise
  if (g.Promise && g.Promise !== Promise && typeof g.Promise.any !== 'function') {
    g.Promise.any = Promise.any;
  }
  
  console.log('[PromiseShim] ✅ Promise.any polyfill installed');
} else if (typeof Promise !== 'undefined' && typeof Promise.any === 'function') {
  console.log('[PromiseShim] Promise.any already available (native)');
}

// Export for module system compatibility
module.exports = { installed: typeof Promise.any === 'function' };
