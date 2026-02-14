import { serve } from 'https://deno.land/std@0.214.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

type HealthStatus = 'healthy' | 'degraded' | 'down';

type MonitoredEndpoint = {
  serviceName: string;
  category: 'monitoring' | 'ai' | 'communication' | 'voice' | 'payment';
  functionPath: string;
};

type ProbeResult = {
  service_name: string;
  category: string;
  status: HealthStatus;
  response_time_ms: number;
  http_status: number | null;
  endpoint: string;
  error: string | null;
};

const MONITORED_ENDPOINTS: MonitoredEndpoint[] = [
  { serviceName: 'service-health-monitor', category: 'monitoring', functionPath: 'service-health-monitor' },
  { serviceName: 'ai-proxy', category: 'ai', functionPath: 'ai-proxy' },
  { serviceName: 'notifications-dispatcher', category: 'communication', functionPath: 'notifications-dispatcher' },
  { serviceName: 'daily-token', category: 'voice', functionPath: 'daily-token' },
  { serviceName: 'payfast-webhook', category: 'payment', functionPath: 'payfast-webhook' },
  { serviceName: 'student-activity-monitor', category: 'monitoring', functionPath: 'student-activity-monitor' },
];

function toStatus(httpStatus: number | null): HealthStatus {
  if (httpStatus === null) return 'down';
  if (httpStatus === 404) return 'down';
  if (httpStatus >= 500) return 'down';
  if (httpStatus >= 400) return 'degraded';
  return 'healthy';
}

async function probeFunctionEndpoint(
  endpoint: MonitoredEndpoint,
  timeoutMs = 6000,
): Promise<ProbeResult> {
  const url = `${SUPABASE_URL}/functions/v1/${endpoint.functionPath}`;
  const startedAt = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: 'OPTIONS',
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const elapsed = Date.now() - startedAt;
    return {
      service_name: endpoint.serviceName,
      category: endpoint.category,
      status: toStatus(response.status),
      response_time_ms: elapsed,
      http_status: response.status,
      endpoint: url,
      error: null,
    };
  } catch (error) {
    const elapsed = Date.now() - startedAt;
    return {
      service_name: endpoint.serviceName,
      category: endpoint.category,
      status: 'down',
      response_time_ms: elapsed,
      http_status: null,
      endpoint: url,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function probeDatabase(
  supabaseAdmin: ReturnType<typeof createClient>,
): Promise<ProbeResult> {
  const startedAt = Date.now();

  const { error } = await supabaseAdmin
    .from('service_health_status')
    .select('id', { head: true, count: 'exact' })
    .limit(1);

  const elapsed = Date.now() - startedAt;

  return {
    service_name: 'supabase-database',
    category: 'infrastructure',
    status: error ? 'down' : 'healthy',
    response_time_ms: elapsed,
    http_status: null,
    endpoint: 'supabase://public.service_health_status',
    error: error ? error.message : null,
  };
}

async function recordHealthCheck(
  supabaseAdmin: ReturnType<typeof createClient>,
  result: ProbeResult,
): Promise<void> {
  const metadata = {
    category: result.category,
    endpoint: result.endpoint,
    http_status: result.http_status,
    error: result.error,
    source: 'service-health-monitor',
    checked_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin.rpc('record_service_health_check', {
    p_service_name: result.service_name,
    p_status: result.status,
    p_response_time_ms: result.response_time_ms,
    p_metadata: metadata,
  });

  if (error) {
    throw new Error(`record_service_health_check failed for ${result.service_name}: ${error.message}`);
  }
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const runStartedAt = Date.now();

  try {
    const bodyText = await req.text();
    const parsed = bodyText ? JSON.parse(bodyText) : {};
    const selected = Array.isArray(parsed?.services)
      ? new Set<string>(parsed.services.map((v: unknown) => String(v)))
      : null;

    const endpoints = selected
      ? MONITORED_ENDPOINTS.filter((entry) => selected.has(entry.serviceName) || selected.has(entry.functionPath))
      : MONITORED_ENDPOINTS;

    const results: ProbeResult[] = [];

    // 1) DB probe
    const databaseResult = await probeDatabase(supabaseAdmin);
    results.push(databaseResult);

    // 2) Function endpoint probes
    for (const endpoint of endpoints) {
      const result = await probeFunctionEndpoint(endpoint);
      results.push(result);
    }

    const recordFailures: string[] = [];
    for (const result of results) {
      try {
        await recordHealthCheck(supabaseAdmin, result);
      } catch (error) {
        recordFailures.push(error instanceof Error ? error.message : String(error));
      }
    }

    const summary = {
      total: results.length,
      healthy: results.filter((r) => r.status === 'healthy').length,
      degraded: results.filter((r) => r.status === 'degraded').length,
      down: results.filter((r) => r.status === 'down').length,
      duration_ms: Date.now() - runStartedAt,
    };

    return new Response(
      JSON.stringify({
        ok: true,
        summary,
        results,
        record_failures: recordFailures,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // Best-effort write: capture monitor failure itself as a down event.
    try {
      await supabaseAdmin.rpc('record_service_health_check', {
        p_service_name: 'service-health-monitor',
        p_status: 'down',
        p_response_time_ms: Date.now() - runStartedAt,
        p_metadata: {
          category: 'monitoring',
          endpoint: `${SUPABASE_URL}/functions/v1/service-health-monitor`,
          source: 'service-health-monitor',
          error: message,
          checked_at: new Date().toISOString(),
        },
      });
    } catch {
      // Ignore secondary failures; primary error response below is authoritative.
    }

    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
