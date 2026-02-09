/**
 * Normalize Metro rewrite URLs so HMR always receives an absolute HTTP URL.
 *
 * Expo/Metro HMR uses `new URL(requestUrl)` internally. If requestUrl is
 * relative or malformed, HMR can crash with "TypeError: Invalid URL".
 */

const DEFAULT_FALLBACK_ORIGIN = 'http://127.0.0.1:8081';

function ensureHttpOrigin(origin) {
  const candidate = (origin || '').trim();
  if (!candidate) return DEFAULT_FALLBACK_ORIGIN;

  // Protocol-relative host
  if (candidate.startsWith('//')) {
    return `http:${candidate}`;
  }

  // Host without protocol
  if (!candidate.startsWith('http://') && !candidate.startsWith('https://')) {
    return `http://${candidate.replace(/^\/+/, '')}`;
  }

  return candidate;
}

function normalizeMetroRequestUrl(rawUrl, options = {}) {
  const fallbackOrigin = ensureHttpOrigin(options.fallbackOrigin);
  const input = String(rawUrl || '').trim();

  try {
    if (!input) {
      return `${fallbackOrigin}/`;
    }

    // Already absolute
    const parsed = new URL(input);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {
    // Continue with fallback normalization paths below.
  }

  try {
    // Protocol-relative URL like //127.0.0.1:8081/index.bundle
    if (input.startsWith('//')) {
      return new URL(`http:${input}`).toString();
    }

    // Relative path (/index.bundle?platform=android...)
    if (input.startsWith('/')) {
      return new URL(input, fallbackOrigin).toString();
    }

    // Plain path/query without leading slash
    return new URL(`/${input.replace(/^\/+/, '')}`, fallbackOrigin).toString();
  } catch (error) {
    if (typeof options.onError === 'function') {
      options.onError(error, { rawUrl, fallbackOrigin });
    }
    return `${fallbackOrigin}/`;
  }
}

module.exports = {
  DEFAULT_FALLBACK_ORIGIN,
  normalizeMetroRequestUrl,
};
