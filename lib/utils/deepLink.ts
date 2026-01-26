export type DeepLinkParseResult = {
  path: string;
  queryParams: Record<string, string>;
  hashParams: Record<string, string>;
  params: Record<string, string>;
};

const EMPTY_RESULT: DeepLinkParseResult = {
  path: '/',
  queryParams: {},
  hashParams: {},
  params: {},
};

function collectParams(searchParams: URLSearchParams): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    if (!key) continue;
    result[key] = value;
  }
  return result;
}

function parseHashParams(rawHash: string): Record<string, string> {
  const cleaned = rawHash.startsWith('#') ? rawHash.slice(1) : rawHash;
  if (!cleaned || !cleaned.includes('=')) return {};
  return collectParams(new URLSearchParams(cleaned));
}

function normalizeDeepLinkPath(url: URL): string {
  const pathname = url.pathname || '';
  const host = url.host || '';
  const protocol = url.protocol || '';

  if (protocol === 'http:' || protocol === 'https:') {
    return pathname && pathname !== '/' ? pathname : '/';
  }

  const combined = host
    ? `${host}${pathname && pathname !== '/' ? pathname : ''}`
    : pathname;

  if (!combined) return '/';
  return `/${combined.replace(/^\/+/, '')}`;
}

function fallbackParse(rawUrl: string): DeepLinkParseResult {
  try {
    const isHttp = rawUrl.startsWith('http://') || rawUrl.startsWith('https://');
    const withoutScheme = rawUrl.replace(/^[^:]+:\/\//, '');
    const [beforeHash, hashPart = ''] = withoutScheme.split('#', 2);
    const [beforeQuery, queryPart = ''] = beforeHash.split('?', 2);

    let pathPart = beforeQuery;
    if (isHttp) {
      const slashIndex = beforeQuery.indexOf('/');
      pathPart = slashIndex >= 0 ? beforeQuery.slice(slashIndex) : '/';
    }

    const path = pathPart ? `/${pathPart.replace(/^\/+/, '')}` : '/';
    const queryParams = collectParams(new URLSearchParams(queryPart));
    const hashParams = collectParams(new URLSearchParams(hashPart));
    const params = { ...hashParams, ...queryParams };

    return { path, queryParams, hashParams, params };
  } catch {
    return EMPTY_RESULT;
  }
}

export function parseDeepLinkUrl(rawUrl?: string | null): DeepLinkParseResult {
  if (!rawUrl || typeof rawUrl !== 'string') return EMPTY_RESULT;

  try {
    const url = new URL(rawUrl);
    const queryParams = collectParams(url.searchParams);
    const hashParams = parseHashParams(url.hash || '');
    const params = { ...hashParams, ...queryParams };
    const path = normalizeDeepLinkPath(url);
    return { path, queryParams, hashParams, params };
  } catch {
    return fallbackParse(rawUrl);
  }
}
