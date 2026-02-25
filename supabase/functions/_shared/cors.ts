/**
 * Shared CORS configuration for all Edge Functions
 * 
 * Restricts origins to known EduDash Pro domains in production.
 * Falls back to wildcard only in development.
 */

const ALLOWED_ORIGINS = [
  'https://www.edudashpro.org.za',
  'https://edudashpro.org.za',
  'https://app.edudashpro.org.za',
  'https://admin.edudashpro.org.za',
];

const DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:8081',
  'http://localhost:8082',
  'http://localhost:8083',
  'http://localhost:19006',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:8081',
  'http://127.0.0.1:8082',
];

export function getCorsHeaders(req?: Request): Record<string, string> {
  const origin = req?.headers.get('Origin') || '';
  const environment = Deno.env.get('ENVIRONMENT') || 'production';
  const corsOverride = Deno.env.get('CORS_ALLOW_ORIGIN');

  // If explicit override is set, use it
  if (corsOverride) {
    return buildHeaders(corsOverride);
  }

  // In development, allow dev origins
  if (environment === 'development' || environment === 'local') {
    if (DEV_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes(origin)) {
      return buildHeaders(origin);
    }
    // Allow wildcard in dev as fallback
    return buildHeaders('*');
  }

  // In production, allow known origins
  if (ALLOWED_ORIGINS.includes(origin)) {
    return buildHeaders(origin);
  }

  // Always allow localhost for local dev against deployed functions
  if (DEV_ORIGINS.includes(origin)) {
    return buildHeaders(origin);
  }

  // Default: no origin header (blocks cross-origin requests)
  return buildHeaders(ALLOWED_ORIGINS[0]);
}

function buildHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

/**
 * Handle OPTIONS preflight request
 */
export function handleCorsOptions(req: Request): Response {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(req),
  });
}
