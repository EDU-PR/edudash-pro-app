/**
 * ai-usage Edge Function
 *
 * Centralized AI usage tracking and querying service.
 * Handles: user limits, org limits, school usage summaries,
 * recent usage logs, quota status, recording usage, and bulk sync.
 *
 * Actions: user_limits | org_limits | school_usage_summary | recent_usage |
 *          quota_status | log | bulk_increment
 */
import { serve } from 'https://deno.land/std@0.214.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsOptions } from '../_shared/cors.ts';

type JsonRecord = Record<string, unknown>;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handleCorsOptions(req);
  const cors = getCorsHeaders(req);
  const json = (body: JsonRecord, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return json({ error: 'Invalid token' }, 401);

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'user_limits';

    switch (action) {
      // ──────────────────────────────────────────────────────────────
      // USER LIMITS — returns current tier, usage, and remaining quota
      // ──────────────────────────────────────────────────────────────
      case 'user_limits': {
        const targetUserId = body.user_id || user.id;

        // Get tier info
        const { data: tierRow } = await supabase
          .from('user_ai_tiers')
          .select('tier')
          .eq('user_id', targetUserId)
          .maybeSingle();

        const currentTier = tierRow?.tier || 'free';

        // Get tier limits
        const { data: limits } = await supabase
          .from('ai_usage_tiers')
          .select('*')
          .eq('tier_name', currentTier)
          .maybeSingle();

        // Get current month usage
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);

        const { data: usage } = await supabase
          .from('ai_request_log')
          .select('service_type, tokens_in, tokens_out')
          .eq('user_id', targetUserId)
          .gte('created_at', monthStart.toISOString());

        const usageCounts: Record<string, number> = {};
        let totalTokensIn = 0;
        let totalTokensOut = 0;
        for (const row of usage || []) {
          const st = row.service_type || 'chat_message';
          usageCounts[st] = (usageCounts[st] || 0) + 1;
          totalTokensIn += row.tokens_in || 0;
          totalTokensOut += row.tokens_out || 0;
        }

        const chatLimit = limits?.chat_messages_per_day
          ? limits.chat_messages_per_day * 30
          : 300;
        const chatUsed = usageCounts['chat_message'] || 0;

        return json({
          user_id: targetUserId,
          tier: currentTier,
          limits: {
            chat_messages_monthly: chatLimit,
            lesson_generation_monthly: limits?.lesson_generation_per_day ? limits.lesson_generation_per_day * 30 : 30,
            grading_monthly: limits?.grading_per_day ? limits.grading_per_day * 30 : 30,
          },
          usage: usageCounts,
          remaining: {
            chat_messages: Math.max(0, chatLimit - chatUsed),
          },
          tokens: { total_in: totalTokensIn, total_out: totalTokensOut },
          period_start: monthStart.toISOString(),
        });
      }

      // ──────────────────────────────────────────────────────────────
      // ORG LIMITS — organization-level usage summary
      // ──────────────────────────────────────────────────────────────
      case 'org_limits': {
        const orgId = body.preschool_id || body.organization_id;
        if (!orgId) return json({ error: 'preschool_id required' }, 400);

        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);

        const { data: orgUsage, count } = await supabase
          .from('ai_request_log')
          .select('service_type, tokens_in, tokens_out, user_id', { count: 'exact' })
          .eq('org_id', orgId)
          .gte('created_at', monthStart.toISOString());

        const uniqueUsers = new Set((orgUsage || []).map((r: any) => r.user_id));
        let orgTokensIn = 0;
        let orgTokensOut = 0;
        for (const row of orgUsage || []) {
          orgTokensIn += row.tokens_in || 0;
          orgTokensOut += row.tokens_out || 0;
        }

        return json({
          organization_id: orgId,
          total_requests: count || 0,
          unique_users: uniqueUsers.size,
          tokens: { total_in: orgTokensIn, total_out: orgTokensOut },
          period_start: monthStart.toISOString(),
        });
      }

      // ──────────────────────────────────────────────────────────────
      // SCHOOL USAGE SUMMARY — detailed breakdown with trends
      // ──────────────────────────────────────────────────────────────
      case 'school_usage_summary': {
        const schoolId = body.preschool_id || body.organization_id;
        if (!schoolId) return json({ error: 'preschool_id required' }, 400);

        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

        const [thisMonth, lastMonth] = await Promise.all([
          supabase
            .from('ai_request_log')
            .select('service_type, tokens_in, tokens_out', { count: 'exact' })
            .eq('org_id', schoolId)
            .gte('created_at', thisMonthStart.toISOString()),
          supabase
            .from('ai_request_log')
            .select('service_type', { count: 'exact' })
            .eq('org_id', schoolId)
            .gte('created_at', lastMonthStart.toISOString())
            .lt('created_at', thisMonthStart.toISOString()),
        ]);

        const thisCount = thisMonth.count || 0;
        const lastCount = lastMonth.count || 0;
        const trend = lastCount > 0
          ? ((thisCount - lastCount) / lastCount) * 100
          : thisCount > 0 ? 100 : 0;

        const byType: Record<string, number> = {};
        for (const row of thisMonth.data || []) {
          const st = (row as any).service_type || 'unknown';
          byType[st] = (byType[st] || 0) + 1;
        }

        return json({
          organization_id: schoolId,
          current_month: { total_requests: thisCount, by_service_type: byType },
          previous_month: { total_requests: lastCount },
          trend_percent: Math.round(trend * 10) / 10,
          period: {
            current: thisMonthStart.toISOString(),
            previous: lastMonthStart.toISOString(),
          },
        });
      }

      // ──────────────────────────────────────────────────────────────
      // RECENT USAGE — paginated usage logs
      // ──────────────────────────────────────────────────────────────
      case 'recent_usage': {
        const limit = Math.min(body.limit || 20, 100);
        const offset = body.offset || 0;

        let query = supabase
          .from('ai_request_log')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (body.scope === 'user' && body.user_id) {
          query = query.eq('user_id', body.user_id);
        } else if (body.scope === 'school' && body.preschool_id) {
          query = query.eq('org_id', body.preschool_id);
        } else {
          // Default to current user
          query = query.eq('user_id', user.id);
        }

        if (body.service_type) {
          query = query.eq('service_type', body.service_type);
        }

        const { data: logs, count, error: logsError } = await query;
        if (logsError) {
          console.error('[ai-usage] Recent usage query error:', logsError);
          return json({ error: 'Failed to fetch usage logs' }, 500);
        }

        return json({
          logs: logs || [],
          total: count || 0,
          limit,
          offset,
        });
      }

      // ──────────────────────────────────────────────────────────────
      // QUOTA STATUS — check remaining quota for a service type
      // ──────────────────────────────────────────────────────────────
      case 'quota_status': {
        const targetUser = body.user_id || user.id;
        const serviceType = body.service_type || 'chat_message';

        // Use the existing RPC
        const { data: quotaData, error: quotaError } = await supabase.rpc(
          'check_ai_usage_limit',
          {
            p_user_id: targetUser,
            p_service_type: serviceType,
          },
        );

        if (quotaError) {
          console.error('[ai-usage] Quota check error:', quotaError);
          return json({ error: 'Quota check failed' }, 500);
        }

        return json(quotaData || { allowed: true, remaining: 999 });
      }

      // ──────────────────────────────────────────────────────────────
      // LOG — record a single usage event
      // ──────────────────────────────────────────────────────────────
      case 'log': {
        const event = body.event;
        if (!event) return json({ error: 'event required' }, 400);

        const { error: logError } = await supabase.rpc('record_ai_usage', {
          p_user_id: user.id,
          p_model: event.model || 'unknown',
          p_tokens_in: event.tokens_in || 0,
          p_tokens_out: event.tokens_out || 0,
          p_service_type: event.feature || event.service_type || 'chat_message',
          p_org_id: event.organization_id || null,
        });

        if (logError) {
          console.error('[ai-usage] Log error:', logError);
          return json({ error: 'Failed to log usage' }, 500);
        }

        return json({ success: true });
      }

      // ──────────────────────────────────────────────────────────────
      // BULK INCREMENT — sync batch of local usage
      // ──────────────────────────────────────────────────────────────
      case 'bulk_increment': {
        const feature = body.feature;
        const count = body.count || 1;

        if (!feature) return json({ error: 'feature required' }, 400);

        // Record each increment individually via RPC
        let successCount = 0;
        for (let i = 0; i < Math.min(count, 100); i++) {
          const { error: incError } = await supabase.rpc('record_ai_usage', {
            p_user_id: user.id,
            p_model: 'bulk_sync',
            p_tokens_in: 0,
            p_tokens_out: 0,
            p_service_type: feature,
            p_org_id: null,
          });
          if (!incError) successCount++;
        }

        return json({ success: true, synced: successCount, requested: count });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (error) {
    console.error('[ai-usage] Error:', error);
    return json({ error: 'Internal server error' }, 500);
  }
});
