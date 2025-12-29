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
 * 
 * CRITICAL FIX: Daily.co's mediasoup-client uses a bundled Promise that may not
 * see our polyfill. We need to ensure Promise.any is available on ALL Promise
 * references including the one Hermes provides natively.
 */

// Execute immediately - don't wait for anything
(function() {
  'use strict';
  
  // Get ALL possible global objects
  var globals = [];
  if (typeof globalThis !== 'undefined') globals.push(globalThis);
  if (typeof global !== 'undefined') globals.push(global);
  if (typeof window !== 'undefined') globals.push(window);
  if (typeof self !== 'undefined') globals.push(self);
  
  // Use the first available global
  var g = globals[0] || this;
  
  // AggregateError polyfill (required for Promise.any)
  function ensureAggregateError(target) {
    if (typeof target.AggregateError === 'undefined') {
      target.AggregateError = function AggregateError(errors, message) {
        var instance = new Error(message || 'All promises were rejected');
        instance.name = 'AggregateError';
        instance.errors = Array.isArray(errors) ? errors : Array.from(errors);
        Object.setPrototypeOf(instance, target.AggregateError.prototype);
        return instance;
      };
      target.AggregateError.prototype = Object.create(Error.prototype);
      target.AggregateError.prototype.constructor = target.AggregateError;
    }
  }
  
  // Install AggregateError on all globals
  globals.forEach(function(target) {
    ensureAggregateError(target);
  });

  // Promise.any implementation
  function createPromiseAny(PromiseConstructor, AggregateErrorClass) {
    return function promiseAny(iterable) {
      return new PromiseConstructor(function(resolve, reject) {
        var promises = Array.from(iterable);
        
        if (promises.length === 0) {
          reject(new AggregateErrorClass([], 'All promises were rejected'));
          return;
        }

        var errors = new Array(promises.length);
        var rejectionCount = 0;
        var resolved = false;

        promises.forEach(function(promise, index) {
          PromiseConstructor.resolve(promise).then(
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
                  reject(new AggregateErrorClass(errors, 'All promises were rejected'));
                }
              }
            }
          );
        });
      });
    };
  }
  
  // Install Promise.any on all globals that have a Promise
  var installedCount = 0;
  var promiseReferences = [];
  
  globals.forEach(function(target) {
    if (target && target.Promise) {
      promiseReferences.push(target.Promise);
      if (typeof target.Promise.any !== 'function') {
        try {
          // Use Object.defineProperty for better compatibility
          Object.defineProperty(target.Promise, 'any', {
            value: createPromiseAny(target.Promise, target.AggregateError || g.AggregateError),
            writable: true,
            configurable: true,
            enumerable: false
          });
          installedCount++;
        } catch (e) {
          // Fallback if defineProperty fails
      target.Promise.any = createPromiseAny(target.Promise, target.AggregateError || g.AggregateError);
      installedCount++;
        }
      }
    }
  });
  
  // Also install on the local Promise (in case it's different)
  if (typeof Promise !== 'undefined') {
    promiseReferences.push(Promise);
    if (typeof Promise.any !== 'function') {
      try {
        Object.defineProperty(Promise, 'any', {
          value: createPromiseAny(Promise, g.AggregateError),
          writable: true,
          configurable: true,
          enumerable: false
        });
        installedCount++;
      } catch (e) {
    Promise.any = createPromiseAny(Promise, g.AggregateError);
    installedCount++;
  }
    }
  }
  
  // CRITICAL: Check if all Promise references are the same object
  // If Daily.co captures a different Promise, we need to know
  var uniquePromises = {};
  promiseReferences.forEach(function(p) {
    if (p) {
      var key = p.toString();
      uniquePromises[key] = (uniquePromises[key] || 0) + 1;
    }
  });
  
  if (Object.keys(uniquePromises).length > 1) {
    console.warn('[PromiseShim] ⚠️ Multiple Promise constructors detected!', Object.keys(uniquePromises).length);
  }
  
  // CRITICAL: Patch Promise.prototype to catch bundled code that uses Promise.prototype.constructor
  // Daily.co's mediasoup-client bundles Promise and may access it via prototype
  var PromisePrototype = Promise && Promise.prototype;
  if (PromisePrototype && PromisePrototype.constructor) {
    var PromiseConstructor = PromisePrototype.constructor;
    if (PromiseConstructor && typeof PromiseConstructor.any !== 'function') {
      try {
        Object.defineProperty(PromiseConstructor, 'any', {
          value: createPromiseAny(PromiseConstructor, g.AggregateError),
          writable: true,
          configurable: true,
          enumerable: false
        });
        installedCount++;
        console.log('[PromiseShim] ✅ Patched Promise.prototype.constructor.any');
      } catch (e) {
        PromiseConstructor.any = createPromiseAny(PromiseConstructor, g.AggregateError);
        installedCount++;
      }
    }
  }
  
  // CRITICAL: Also patch any Promise found via Object.getPrototypeOf
  // This catches edge cases where code accesses Promise through prototype chain
  try {
    var protoPromise = Object.getPrototypeOf && Object.getPrototypeOf(Promise);
    if (protoPromise && protoPromise.constructor && typeof protoPromise.constructor.any !== 'function') {
      protoPromise.constructor.any = createPromiseAny(protoPromise.constructor, g.AggregateError);
      installedCount++;
      console.log('[PromiseShim] ✅ Patched Promise from prototype chain');
    }
  } catch (e) {
    // Ignore prototype access errors
  }
  
  if (installedCount > 0) {
    console.log('[PromiseShim] ✅ Promise.any polyfill installed on ' + installedCount + ' Promise reference(s)');
  } else {
    console.log('[PromiseShim] Promise.any already available (native or pre-installed)');
  }
  
  // CRITICAL: The issue is that Daily.co's mediasoup-client bundles Promise at build time
  // and captures it before our polyfill runs. We can't patch bundled code, but we can
  // ensure our polyfill runs as early as possible and patches ALL Promise references.
  // The polyfill is loaded via Metro's getModulesRunBeforeMainModule which should be early enough.
  
  // Final verification - test actual Promise.any call (async, don't block startup)
  setTimeout(function() {
    try {
      var testValue = 'test';
      var testPromise = Promise.any([Promise.resolve(testValue)]);
      if (testPromise && typeof testPromise.then === 'function') {
        testPromise.then(function(result) {
          if (result === testValue) {
            console.log('[PromiseShim] ✅ Promise.any functional test PASSED');
          } else {
            console.warn('[PromiseShim] ⚠️ Promise.any returned wrong value:', result, 'expected:', testValue);
          }
        }).catch(function(err) {
          console.error('[PromiseShim] ❌ Promise.any functional test FAILED:', err.message || err);
        });
      } else {
        console.warn('[PromiseShim] ⚠️ Promise.any exists but may not be functional');
      }
    } catch (testError) {
      console.error('[PromiseShim] ❌ Promise.any functional test FAILED:', testError.message || testError);
    }
  }, 100); // Small delay to ensure everything is initialized
  
  // Final verification
  console.log('[PromiseShim] Verification:', {
    'Promise.any': typeof Promise.any,
    'global.Promise.any': typeof (g.Promise && g.Promise.any),
    'AggregateError': typeof g.AggregateError,
  });
})();

// Export for module system compatibility
module.exports = { installed: typeof Promise.any === 'function' };
