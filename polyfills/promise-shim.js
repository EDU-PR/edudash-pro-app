/**
 * Promise.any polyfill shim for React Native / Hermes
 *
 * Loaded by Metro's getModulesRunBeforeMainModule BEFORE any app code.
 * This ensures Promise.any exists before Daily.co's mediasoup-client
 * captures the Promise constructor at module init time.
 *
 * IMPORTANT: CommonJS (.js) — shims run before TypeScript compilation.
 *
 * DESIGN: Ultra-simple, no IIFE, no strict mode. Uses direct assignment
 * first (fastest path), falls back to Object.defineProperty, and has a
 * nuclear fallback that replaces globalThis.Promise with a thin wrapper.
 */

/* eslint-disable no-var */

// ── AggregateError polyfill ──────────────────────────────────────────
if (typeof globalThis.AggregateError === 'undefined') {
  globalThis.AggregateError = function AggregateError(errors, message) {
    var err = new Error(message || 'All promises were rejected');
    err.name = 'AggregateError';
    err.errors = Array.isArray(errors) ? errors : Array.from(errors);
    return err;
  };
}

// ── Promise.any implementation ───────────────────────────────────────
function _promiseAny(iterable) {
  var P = typeof Promise !== 'undefined' ? Promise : globalThis.Promise;
  return new P(function (resolve, reject) {
    var promises = Array.isArray(iterable) ? iterable : Array.from(iterable);
    if (promises.length === 0) {
      reject(new globalThis.AggregateError([], 'All promises were rejected'));
      return;
    }
    var errors = new Array(promises.length);
    var rejections = 0;
    var done = false;
    for (var i = 0; i < promises.length; i++) {
      (function (idx) {
        P.resolve(promises[idx]).then(
          function (value) {
            if (!done) {
              done = true;
              resolve(value);
            }
          },
          function (reason) {
            if (!done) {
              errors[idx] = reason;
              rejections++;
              if (rejections === promises.length) {
                reject(
                  new globalThis.AggregateError(
                    errors,
                    'All promises were rejected'
                  )
                );
              }
            }
          }
        );
      })(i);
    }
  });
}

// ── Install on a target Promise constructor ──────────────────────────
function _install(target, label) {
  if (!target || typeof target !== 'function') return false;
  if (typeof target.any === 'function') return false; // already native
  try {
    target.any = _promiseAny;
    if (typeof target.any === 'function') {
      console.log('[PromiseShim] ✅ Installed on ' + label);
      return true;
    }
  } catch (e) { /* direct assign failed */ }
  try {
    Object.defineProperty(target, 'any', {
      value: _promiseAny,
      writable: true,
      configurable: true,
      enumerable: false,
    });
    if (typeof target.any === 'function') {
      console.log('[PromiseShim] ✅ Installed via defineProperty on ' + label);
      return true;
    }
  } catch (e2) {
    console.warn('[PromiseShim] ❌ Failed on ' + label + ':', e2);
  }
  return false;
}

var installed = 0;

// 1. Local Promise binding (most important — this is what all code resolves to)
if (_install(Promise, 'Promise')) installed++;

// 2. globalThis.Promise
if (typeof globalThis !== 'undefined' && globalThis.Promise) {
  if (_install(globalThis.Promise, 'globalThis.Promise')) installed++;
}

// 3. global.Promise (Node/RN fallback global)
if (typeof global !== 'undefined' && global.Promise) {
  if (_install(global.Promise, 'global.Promise')) installed++;
}

// 4. Promise.prototype.constructor (catches bundled code via prototype chain)
if (Promise.prototype && Promise.prototype.constructor) {
  if (_install(Promise.prototype.constructor, 'Promise.prototype.constructor'))
    installed++;
}

// ── Nuclear fallback: replace Promise globally ───────────────────────
// If NOTHING above worked (Hermes may freeze native Promise), wrap it.
if (typeof Promise.any !== 'function') {
  console.error(
    '[PromiseShim] ❌ Promise.any STILL undefined after all attempts.',
    'Applying nuclear fix: wrapping globalThis.Promise'
  );

  var OrigPromise = Promise;
  var WP = function Promise(executor) {
    return new OrigPromise(executor);
  };
  var keys = Object.getOwnPropertyNames(OrigPromise);
  for (var k = 0; k < keys.length; k++) {
    var key = keys[k];
    if (key !== 'prototype' && key !== 'length' && key !== 'name') {
      try { WP[key] = OrigPromise[key]; } catch (e) { /* skip */ }
    }
  }
  WP.prototype = OrigPromise.prototype;
  WP.resolve = function (v) { return OrigPromise.resolve(v); };
  WP.reject  = function (v) { return OrigPromise.reject(v); };
  WP.all     = function (v) { return OrigPromise.all(v); };
  WP.race    = function (v) { return OrigPromise.race(v); };
  if (typeof OrigPromise.allSettled === 'function') {
    WP.allSettled = function (v) { return OrigPromise.allSettled(v); };
  }
  WP.any = _promiseAny;

  if (typeof globalThis !== 'undefined') globalThis.Promise = WP;
  if (typeof global !== 'undefined') global.Promise = WP;

  if (typeof WP.any === 'function') {
    console.log('[PromiseShim] ✅ Nuclear fix applied — Promise replaced globally');
    installed++;
  } else {
    console.error('[PromiseShim] ❌ Nuclear fix ALSO failed!');
  }
}

console.log(
  '[PromiseShim] Done:',
  installed, 'install(s),',
  'Promise.any:', typeof Promise.any,
  'globalThis.Promise.any:',
  typeof (typeof globalThis !== 'undefined' &&
    globalThis.Promise &&
    globalThis.Promise.any)
);

module.exports = { installed: typeof Promise.any === 'function' };
