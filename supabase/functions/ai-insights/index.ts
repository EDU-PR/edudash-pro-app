/**
 * AI Insights Edge Function
 * 
 * Generates AI-powered insights for dashboards (teacher, principal, parent).
 * Uses AI to analyze usage patterns and provide actionable recommendations.
 * 
 * Expected body: { scope, period_days?, context? }
 * Auth: Bearer token required
 */

import { serve } from 'https://deno.land/std@0.214.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsOptions } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY=REDACTED
const ANTHROPIC_API_KEY=REDACTED

function getDefaultModelForTier(tier: string | null | undefined): string {
  const t = String(tier ?? 'free').toLowerCase();
  if (t.includes('enterprise') || t === 'superadmin' || t === 'super_admin') return 'claude-sonnet-4-20250514';
  if (t.includes('premium') || t.includes('pro') || t.includes('plus') || t.includes('basic')) return 'claude-3-5-haiku-20241022';
  if (t.includes('starter') || t === 'trial') return 'claude-3-5-haiku-20241022';
  return 'claude-3-haiku-20240307';
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return handleCorsOptions(req);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY!);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { scope, period_days = 14, context, model: bodyModel } = body;

    const { data: tier } = await supabase.rpc('get_user_subscription_tier', { user_id: user.id });
    const model = bodyModel || getDefaultModelForTier(tier);

    if (!scope || !['teacher', 'principal', 'parent'].includes(scope)) {
      return new Response(JSON.stringify({ error: 'Invalid scope' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user profile for context
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, preschool_id, organization_id, first_name')
      .eq('id', user.id)
      .maybeSingle();

    const orgId = profile?.preschool_id || profile?.organization_id;

    // Gather data for insights
    const now = new Date();
    const periodStart = new Date(now.getTime() - period_days * 24 * 60 * 60 * 1000).toISOString();

    // Get usage stats
    const { count: aiRequestCount } = await supabase
      .from('ai_request_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', periodStart);

    const contextStr = context ? JSON.stringify(context) : '';
    const dataContext = `User role: ${scope}, AI requests in last ${period_days} days: ${aiRequestCount || 0}. ${contextStr}`;

    if (!ANTHROPIC_API_KEY) {
      // Return static insights when AI not configured
      return new Response(JSON.stringify({
        bullets: [
          `You've used ${aiRequestCount || 0} AI features in the last ${period_days} days.`,
          'Tip: Try using the lesson generator to save prep time.',
          'Explore the exam builder for quick assessment creation.',
        ],
        confidence: 0.5,
        generated_at: new Date().toISOString(),
        scope,
        period_days,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const prompt = `You are an educational technology advisor for a South African preschool/ECD platform called EduDash Pro.
Generate 3-5 short, actionable insight bullets for a ${scope} user.

Context: ${dataContext}

Rules:
- Each bullet should be 1-2 sentences max
- Be encouraging and practical
- Reference South African curriculum (CAPS) where relevant
- Suggest specific platform features they could use
- Keep language simple and positive

Return ONLY a JSON array of strings, e.g.: ["Insight 1", "Insight 2", "Insight 3"]`;

    const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model!,
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    let bullets: string[] = [];
    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      const text = aiData.content?.[0]?.text || '[]';
      try {
        const match = text.match(/\[[\s\S]*\]/);
        bullets = match ? JSON.parse(match[0]) : [];
      } catch {
        bullets = [text];
      }
    }

    if (bullets.length === 0) {
      bullets = [`You've been active with ${aiRequestCount || 0} AI interactions recently. Keep it up!`];
    }

    return new Response(JSON.stringify({
      bullets,
      confidence: 0.8,
      generated_at: new Date().toISOString(),
      scope,
      period_days,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[ai-insights] Error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
