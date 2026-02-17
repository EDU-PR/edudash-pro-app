/**
 * AI Usage Edge Function
 * 
 * Central router for all AI usage tracking, quota management, and allocation operations.
 * 
 * Supported actions:
 *   - (none / default): Get current user's usage summary
 *   - limits: Get server-defined limits for the calling user
 *   - log: Record a single AI usage event
 *   - bulk_increment: Increment usage counter for a feature
 *   - user_limits: Get detailed user AI limits
 *   - org_limits: Get organization AI limits
 *   - school_usage_summary: School-wide usage summary
 *   - recent_usage: Recent usage log entries
 *   - quota_status: Quota status for a specific service type
 *   - school_subscription_details: School AI subscription info
 *   - teacher_allocations: All teacher allocations for a school
 *   - allocate_teacher_quotas: Allocate quotas to a teacher
 *   - request_teacher_quotas: Teacher self-request for quotas
 *   - get_teacher_allocation: Get specific teacher's allocation
 *   - allocation_history: Audit trail for allocations
 * 
 * Auth: Bearer token required for all actions
 */

import { serve } from 'https://deno.land/std@0.214.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsOptions } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
}

// Tier quota definitions
const TIER_QUOTAS: Record<string, Record<string, number>> = {
  free: {
    chat_messages: 300,
    lesson_generation: 5,
    grading_assistance: 10,
    homework_help: 20,
    homework_help_agentic: 5,
    transcription: 5,
    explanation: 30,
    exam_generation: 3,
  },
  trial: {
    chat_messages: 300,
    lesson_generation: 10,
    grading_assistance: 20,
    homework_help: 40,
    homework_help_agentic: 10,
    transcription: 10,
    explanation: 50,
    exam_generation: 5,
  },
  starter: {
    chat_messages: 1500,
    lesson_generation: 30,
    grading_assistance: 60,
    homework_help: 120,
    homework_help_agentic: 30,
    transcription: 30,
    explanation: 150,
    exam_generation: 15,
  },
  basic: {
    chat_messages: 3000,
    lesson_generation: 60,
    grading_assistance: 120,
    homework_help: 240,
    homework_help_agentic: 60,
    transcription: 60,
    explanation: 300,
    exam_generation: 30,
  },
  premium: {
    chat_messages: 6000,
    lesson_generation: 120,
    grading_assistance: 240,
    homework_help: 480,
    homework_help_agentic: 120,
    transcription: 120,
    explanation: 600,
    exam_generation: 60,
  },
  pro: {
    chat_messages: 15000,
    lesson_generation: 300,
    grading_assistance: 600,
    homework_help: 1200,
    homework_help_agentic: 300,
    transcription: 300,
    explanation: 1500,
    exam_generation: 150,
  },
  enterprise: {
    chat_messages: 999999,
    lesson_generation: 999999,
    grading_assistance: 999999,
    homework_help: 999999,
    homework_help_agentic: 999999,
    transcription: 999999,
    explanation: 999999,
    exam_generation: 999999,
  },
};

function normalizeTier(tier: string): string {
  const t = (tier || 'free').toLowerCase().trim();
  if (t.startsWith('parent_')) return t.replace('parent_', '');
  if (t === 'superadmin' || t === 'super_admin') return 'enterprise';
  if (Object.keys(TIER_QUOTAS).includes(t)) return t;
  return 'free';
}

function getQuotasForTier(tier: string): Record<string, number> {
  return TIER_QUOTAS[normalizeTier(tier)] || TIER_QUOTAS.free;
}

// Platform schools get unlimited usage
const PLATFORM_SCHOOL_IDS = [
  '00000000-0000-0000-0000-000000000001', // Community School
  '00000000-0000-0000-0000-000000000002', // EduDash Pro Main
];

const SERVICE_TO_REQUEST_TYPES: Record<string, string[]> = {
  chat_messages: ['chat_message', 'dash_conversation', 'conversation', 'chat_messages'],
  lesson_generation: ['lesson_generation'],
  grading_assistance: ['grading_assistance', 'exam_generation'],
  homework_help: ['homework_help', 'explanation', 'tutor_help', 'tutor_session'],
  homework_help_agentic: ['homework_help_agentic', 'explanation'],
  transcription: ['transcription'],
  explanation: ['explanation', 'homework_help'],
  exam_generation: ['exam_generation', 'grading_assistance'],
  image_generation: ['image_generation', 'generate_image'],
};

function normalizeServiceType(raw: string): string {
  const value = (raw || '').trim().toLowerCase();
  if (!value) return 'chat_messages';
  if (value === 'chat_message' || value === 'conversation' || value === 'dash_conversation') return 'chat_messages';
  if (value === 'exam_generation') return 'grading_assistance';
  if (value === 'explanation' || value === 'tutor_help' || value === 'tutor_session') return 'homework_help';
  if (value === 'generate_image') return 'image_generation';
  return value;
}

function getRequestTypesForService(rawServiceType: string): string[] {
  const normalized = normalizeServiceType(rawServiceType);
  return SERVICE_TO_REQUEST_TYPES[normalized] || [normalized];
}

function mapRequestTypeToService(rawRequestType?: string | null): string {
  const requestType = (rawRequestType || '').trim().toLowerCase();
  if (!requestType) return 'unknown';
  if (requestType === 'chat_message' || requestType === 'conversation' || requestType === 'dash_conversation') {
    return 'chat_messages';
  }
  if (requestType === 'explanation' || requestType === 'tutor_help' || requestType === 'tutor_session') {
    return 'homework_help';
  }
  if (requestType === 'exam_generation') return 'grading_assistance';
  if (requestType === 'generate_image') return 'image_generation';
  return requestType;
}

async function getSchoolUserIds(supabase: any, preschoolId: string): Promise<string[]> {
  const ids = new Set<string>();
  const { data: byOrganization, error: byOrganizationError } = await supabase
    .from('profiles')
    .select('id')
    .eq('organization_id', preschoolId)
    .limit(5000);
  if (byOrganizationError) {
    console.warn('[ai-usage] organization_id profile lookup failed:', byOrganizationError.message);
  }

  for (const row of byOrganization || []) {
    if (row?.id) ids.add(row.id);
  }

  const { data: byPreschool, error: byPreschoolError } = await supabase
    .from('profiles')
    .select('id')
    .eq('preschool_id', preschoolId)
    .limit(5000);
  if (byPreschoolError) {
    console.warn('[ai-usage] preschool_id profile lookup failed:', byPreschoolError.message);
  }

  for (const row of byPreschool || []) {
    if (row?.id) ids.add(row.id);
  }

  return Array.from(ids);
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return handleCorsOptions(req);
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY!);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const action = body.action || 'usage_summary';

    const respond = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    // ─── Route by action ─────────────────────────────────────────────

    switch (action) {
      // Default: return user's monthly usage counters
      case 'usage_summary': {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        const { data: usage } = await supabase
          .from('ai_request_log')
          .select('request_type')
          .eq('user_id', user.id)
          .gte('created_at', monthStart);

        const counts: Record<string, number> = {};
        for (const row of usage || []) {
          const key = mapRequestTypeToService(row.request_type);
          counts[key] = (counts[key] || 0) + 1;
        }

        return respond({ monthly: counts });
      }

      // Get server-defined limits for the user
      case 'limits': {
        // Get user tier
        const { data: tierRow } = await supabase
          .from('user_ai_tiers')
          .select('tier')
          .eq('user_id', user.id)
          .maybeSingle();

        const tier = normalizeTier(tierRow?.tier || 'free');
        const quotas = getQuotasForTier(tier);

        return respond({
          quotas,
          overageRequiresPrepay: tier === 'free' || tier === 'trial',
          models: ['claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022'],
          source: 'server',
          tier,
        });
      }

      // Log a usage event
      case 'log': {
        const event = body.event;
        if (!event) return respond({ error: 'Missing event' }, 400);

        const serviceType = normalizeServiceType(
          event.feature || event.service_type || event.request_type || 'chat_messages',
        );
        const requestType = getRequestTypesForService(serviceType)[0] || 'chat_message';
        const tokensIn = Number(event.tokens_in || 0);
        const tokensOut = Number(event.tokens_out || 0);

        await supabase.from('ai_request_log').insert({
          user_id: user.id,
          request_type: requestType,
          function_name: event.function_name || null,
          status: event.status || 'success',
          response_time_ms: event.response_time_ms || null,
          tokens_used: Number.isFinite(tokensIn + tokensOut) ? tokensIn + tokensOut : null,
          metadata: {
            ...(event.metadata || {}),
            service_type: serviceType,
            model: event.model || 'unknown',
            tokens_in: tokensIn,
            tokens_out: tokensOut,
          },
          created_at: event.timestamp || new Date().toISOString(),
        });

        return respond({ success: true });
      }

      // Bulk increment for a feature
      case 'bulk_increment': {
        const { feature, count } = body;
        if (!feature || !count) return respond({ error: 'Missing feature or count' }, 400);
        const serviceType = normalizeServiceType(feature);
        const requestType = getRequestTypesForService(serviceType)[0] || 'chat_message';

        const rows = Array.from({ length: count }, () => ({
          user_id: user.id,
          request_type: requestType,
          function_name: 'bulk_increment',
          status: 'success',
          tokens_used: 0,
          metadata: {
            service_type: serviceType,
            source: 'bulk_increment',
          },
          created_at: new Date().toISOString(),
        }));

        await supabase.from('ai_request_log').insert(rows);
        return respond({ success: true, synced: count });
      }

      // User limits: tier + quotas + current usage
      case 'user_limits': {
        const targetUserId = body.user_id || user.id;

        const { data: tierRow } = await supabase
          .from('user_ai_tiers')
          .select('tier')
          .eq('user_id', targetUserId)
          .maybeSingle();

        const tier = normalizeTier(tierRow?.tier || 'free');
        const quotas = getQuotasForTier(tier);

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        const { data: usage } = await supabase
          .from('ai_request_log')
          .select('request_type')
          .eq('user_id', targetUserId)
          .gte('created_at', monthStart);

        const currentUsage: Record<string, number> = {};
        for (const row of usage || []) {
          const key = mapRequestTypeToService(row.request_type);
          currentUsage[key] = (currentUsage[key] || 0) + 1;
        }

        return respond({
          user_id: targetUserId,
          tier,
          quotas,
          current_usage: currentUsage,
          period_start: monthStart,
        });
      }

      // Org limits
      case 'org_limits': {
        const { preschool_id } = body;
        if (!preschool_id) return respond({ error: 'Missing preschool_id' }, 400);

        const isUnlimited = PLATFORM_SCHOOL_IDS.includes(preschool_id);

        const { data: school } = await supabase
          .from('preschools')
          .select('subscription_tier, name')
          .eq('id', preschool_id)
          .maybeSingle();

        const tier = isUnlimited ? 'enterprise' : normalizeTier(school?.subscription_tier || 'free');
        const quotas = getQuotasForTier(tier);

        return respond({
          preschool_id,
          school_name: school?.name || 'Unknown',
          tier,
          quotas,
          is_unlimited: isUnlimited,
        });
      }

      // School usage summary
      case 'school_usage_summary': {
        const { preschool_id } = body;
        if (!preschool_id) return respond({ error: 'Missing preschool_id' }, 400);

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const schoolUserIds = await getSchoolUserIds(supabase, preschool_id);

        if (schoolUserIds.length === 0) {
          return respond({
            preschool_id,
            period_start: monthStart,
            total_requests: 0,
            by_service: {},
            by_user: {},
            by_day: {},
          });
        }

        const { data: usage } = await supabase
          .from('ai_request_log')
          .select('request_type, user_id, created_at')
          .in('user_id', schoolUserIds)
          .gte('created_at', monthStart)
          .limit(5000);

        const byService: Record<string, number> = {};
        const byUser: Record<string, number> = {};
        const byDay: Record<string, number> = {};

        for (const row of usage || []) {
          const serviceKey = mapRequestTypeToService(row.request_type);
          byService[serviceKey] = (byService[serviceKey] || 0) + 1;
          byUser[row.user_id] = (byUser[row.user_id] || 0) + 1;
          const day = (row.created_at || '').slice(0, 10);
          byDay[day] = (byDay[day] || 0) + 1;
        }

        return respond({
          preschool_id,
          period_start: monthStart,
          total_requests: (usage || []).length,
          by_service: byService,
          by_user: byUser,
          by_day: byDay,
        });
      }

      // Recent usage
      case 'recent_usage': {
        const limit = body.limit || 50;
        const offset = body.offset || 0;

        let query = supabase
          .from('ai_request_log')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (body.scope === 'user' || body.user_id) {
          query = query.eq('user_id', body.user_id || user.id);
        } else if (body.scope === 'school' && body.preschool_id) {
          const schoolUserIds = await getSchoolUserIds(supabase, body.preschool_id);
          if (schoolUserIds.length === 0) {
            return respond({ logs: [], total: 0 });
          }
          query = query.in('user_id', schoolUserIds);
        } else {
          query = query.eq('user_id', user.id);
        }

        if (body.service_type) {
          query = query.in('request_type', getRequestTypesForService(body.service_type));
        }

        const { data, count } = await query;

        const logs = (data || []).map((row: any) => ({
          ...row,
          service_type: mapRequestTypeToService(row.request_type),
        }));

        return respond({ logs, total: count || 0 });
      }

      // Quota status for a specific service
      case 'quota_status': {
        const serviceType = body.service_type;
        const targetUserId = body.user_id || user.id;
        if (!serviceType) return respond({ error: 'Missing service_type' }, 400);
        const normalizedServiceType = normalizeServiceType(serviceType);
        const requestTypes = getRequestTypesForService(normalizedServiceType);

        const { data: tierRow } = await supabase
          .from('user_ai_tiers')
          .select('tier')
          .eq('user_id', targetUserId)
          .maybeSingle();

        const tier = normalizeTier(tierRow?.tier || 'free');
        const quotas = getQuotasForTier(tier);
        const limit = quotas[normalizedServiceType] ?? quotas[serviceType] ?? 0;

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        const { count } = await supabase
          .from('ai_request_log')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', targetUserId)
          .in('request_type', requestTypes)
          .gte('created_at', monthStart);

        const current = count || 0;
        const remaining = Math.max(0, limit - current);

        return respond({
          user_id: targetUserId,
          service_type: normalizedServiceType,
          tier,
          limit,
          current,
          remaining,
          allowed: remaining > 0 || limit >= 999999,
        });
      }

      // School subscription details
      case 'school_subscription_details': {
        const { preschool_id } = body;
        if (!preschool_id) return respond({ error: 'Missing preschool_id' }, 400);

        const { data: school } = await supabase
          .from('preschools')
          .select('id, name, subscription_tier, subscription_status, created_at')
          .eq('id', preschool_id)
          .maybeSingle();

        if (!school) return respond({ error: 'School not found' }, 404);

        const tier = normalizeTier(school.subscription_tier || 'free');

        return respond({
          preschool_id: school.id,
          name: school.name,
          subscription_tier: tier,
          subscription_status: school.subscription_status || 'active',
          quotas: getQuotasForTier(tier),
          is_unlimited: PLATFORM_SCHOOL_IDS.includes(preschool_id),
          allow_teacher_self_allocation: tier !== 'free' && tier !== 'trial',
        });
      }

      // Teacher allocations for a school
      case 'teacher_allocations': {
        const { preschool_id } = body;
        if (!preschool_id) return respond({ error: 'Missing preschool_id' }, 400);

        const { data: allocations } = await supabase
          .from('teacher_ai_allocations')
          .select('*')
          .eq('preschool_id', preschool_id)
          .eq('is_active', true);

        return respond({ allocations: allocations || [] });
      }

      // Get a specific teacher's allocation
      case 'get_teacher_allocation': {
        const { preschool_id, user_id: targetId } = body;
        if (!preschool_id) return respond({ error: 'Missing preschool_id' }, 400);

        const { data: allocation } = await supabase
          .from('teacher_ai_allocations')
          .select('*')
          .eq('preschool_id', preschool_id)
          .eq('user_id', targetId || user.id)
          .eq('is_active', true)
          .maybeSingle();

        return respond({ allocation: allocation || null });
      }

      // Allocate quotas to a teacher
      case 'allocate_teacher_quotas': {
        const { preschool_id, teacher_id, quotas, allocated_by, reason, auto_renew, priority_level } = body;
        if (!preschool_id || !teacher_id || !quotas) {
          return respond({ error: 'Missing required fields' }, 400);
        }

        // Upsert allocation
        const { data: allocation, error: upsertErr } = await supabase
          .from('teacher_ai_allocations')
          .upsert({
            preschool_id,
            user_id: teacher_id,
            allocated_quotas: quotas,
            allocated_by: allocated_by || user.id,
            reason: reason || 'Admin allocation',
            auto_renew: auto_renew || false,
            priority_level: priority_level || 'normal',
            is_active: true,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'preschool_id,user_id' })
          .select()
          .single();

        if (upsertErr) return respond({ error: upsertErr.message }, 500);

        return respond({ success: true, allocation });
      }

      // Teacher self-request for quotas
      case 'request_teacher_quotas': {
        const { preschool_id, teacher_id, requested_quotas, urgency } = body;
        if (!preschool_id || !teacher_id) {
          return respond({ error: 'Missing required fields' }, 400);
        }

        // Create a request (stored in a general requests table or returned)
        // For now, return the request ID for tracking
        const requestId = crypto.randomUUID();

        return respond({
          success: true,
          request_id: requestId,
          status: 'pending_approval',
          message: 'Quota request submitted. Your administrator will review it.',
        });
      }

      // Allocation history (audit trail)
      case 'allocation_history': {
        const { preschool_id, teacher_id, limit: histLimit, offset: histOffset } = body;
        if (!preschool_id) return respond({ error: 'Missing preschool_id' }, 400);

        let query = supabase
          .from('teacher_ai_allocation_history')
          .select('*', { count: 'exact' })
          .eq('preschool_id', preschool_id)
          .order('created_at', { ascending: false })
          .range(histOffset || 0, (histOffset || 0) + (histLimit || 50) - 1);

        if (teacher_id) {
          query = query.eq('teacher_id', teacher_id);
        }

        const { data: history, count } = await query;

        return respond({ history: history || [], total: count || 0 });
      }

      default:
        return respond({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error('[ai-usage] Error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      },
    );
  }
});
