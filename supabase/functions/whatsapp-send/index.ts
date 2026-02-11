/**
 * WhatsApp Send Edge Function
 * 
 * Sends WhatsApp messages via WhatsApp Business API.
 * Used by DashWhatsAppIntegration service for onboarding and communication flows.
 * 
 * Expected body: { to, type, text: { body }, quick_replies? }
 * Auth: Bearer token required
 * 
 * NOTE: Requires WhatsApp Business API credentials to be configured.
 * Currently returns success with a log entry when API is not configured.
 */

import { serve } from 'https://deno.land/std@0.214.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsOptions } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const WHATSAPP_API_TOKEN = Deno.env.get('WHATSAPP_API_TOKEN') || '';
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') || '';

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
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
    const { to, type, text, quick_replies } = body;

    if (!to || !text?.body) {
      return new Response(JSON.stringify({ error: 'Missing required fields: to, text.body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If WhatsApp API not configured, log and return gracefully
    if (!WHATSAPP_API_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
      console.log('[whatsapp-send] WhatsApp API not configured. Message would be:', {
        to,
        text: text.body.substring(0, 100),
      });
      return new Response(
        JSON.stringify({
          success: true,
          simulated: true,
          message: 'WhatsApp API not configured — message logged but not sent',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Send via WhatsApp Business API (Meta Graph API)
    const waPayload: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      to,
      type: type || 'text',
    };

    if (type === 'text' || !type) {
      waPayload.text = { body: text.body };
    }

    // Add interactive quick replies if present
    if (quick_replies && quick_replies.length > 0) {
      waPayload.type = 'interactive';
      waPayload.interactive = {
        type: 'button',
        body: { text: text.body },
        action: {
          buttons: quick_replies.slice(0, 3).map((reply: string, idx: number) => ({
            type: 'reply',
            reply: {
              id: `reply_${idx}`,
              title: reply.substring(0, 20),
            },
          })),
        },
      };
    }

    const waResponse = await fetch(
      `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${WHATSAPP_API_TOKEN}`,
        },
        body: JSON.stringify(waPayload),
      },
    );

    if (!waResponse.ok) {
      const errText = await waResponse.text();
      console.error('[whatsapp-send] WhatsApp API error:', waResponse.status, errText);
      throw new Error(`WhatsApp API error: ${waResponse.status}`);
    }

    const waData = await waResponse.json();
    console.log('[whatsapp-send] Message sent:', { to, messageId: waData.messages?.[0]?.id });

    return new Response(
      JSON.stringify({
        success: true,
        message_id: waData.messages?.[0]?.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[whatsapp-send] Error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
