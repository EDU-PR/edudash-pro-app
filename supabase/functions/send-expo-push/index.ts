import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

/**
 * Send Expo Push Notification
 * 
 * Sends push notifications to mobile devices using Expo's push notification service.
 * Used for incoming call notifications to wake the app when backgrounded.
 * 
 * Expo push notifications work with:
 * - iOS (APNs via Expo)
 * - Android (FCM via Expo)
 */

// Expo Push API endpoint
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface ExpoPushMessage {
  to: string | string[];
  title?: string;
  body?: string;
  subtitle?: string;
  data?: Record<string, any>;
  sound?: 'default' | null;
  ttl?: number;
  expiration?: number;
  priority?: 'default' | 'normal' | 'high';
  channelId?: string;
  categoryId?: string;
  badge?: number;
  mutableContent?: boolean;
}

interface SendExpoPushRequest {
  // Send to specific user IDs (will look up their push tokens)
  user_ids?: string[];
  // Or send directly to push tokens
  push_tokens?: string[];
  // Notification content
  title: string;
  body: string;
  subtitle?: string;
  data?: Record<string, any>;
  // Options
  sound?: 'default' | null;
  priority?: 'default' | 'normal' | 'high';
  channelId?: string;
  categoryId?: string;
  badge?: number;
  ttl?: number;
}

async function sendExpoPush(messages: ExpoPushMessage[]): Promise<{ success: boolean; errors?: any[] }> {
  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[send-expo-push] Expo API error:', errorText);
      return { success: false, errors: [{ message: errorText }] };
    }

    const result = await response.json();
    
    // Check for ticket errors
    const errors = result.data?.filter((ticket: any) => ticket.status === 'error') || [];
    
    if (errors.length > 0) {
      console.error('[send-expo-push] Some notifications failed:', errors);
    }
    
    return { success: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  } catch (error) {
    console.error('[send-expo-push] Failed to send:', error);
    return { success: false, errors: [error] };
  }
}

serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    // Verify auth (allow both service role and user tokens)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse request
    const body: SendExpoPushRequest = await req.json();
    const { 
      user_ids, 
      push_tokens: directTokens,
      title, 
      body: messageBody, 
      subtitle,
      data,
      sound = 'default',
      priority = 'high',
      channelId,
      categoryId,
      badge,
      ttl,
    } = body;

    if (!title || !messageBody) {
      return new Response(
        JSON.stringify({ error: 'title and body are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Collect push tokens
    let pushTokens: string[] = [];

    // Add direct tokens if provided
    if (directTokens && directTokens.length > 0) {
      pushTokens = pushTokens.concat(directTokens);
    }

    // Look up tokens by user IDs
    if (user_ids && user_ids.length > 0) {
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, expo_push_token')
        .in('id', user_ids)
        .not('expo_push_token', 'is', null);

      if (profileError) {
        console.error('[send-expo-push] Failed to fetch profiles:', profileError);
      } else if (profiles) {
        const tokens = profiles
          .map(p => p.expo_push_token)
          .filter((t): t is string => !!t && t.startsWith('ExponentPushToken'));
        pushTokens = pushTokens.concat(tokens);
      }
    }

    // Remove duplicates
    pushTokens = [...new Set(pushTokens)];

    if (pushTokens.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No valid push tokens found',
          user_ids_checked: user_ids?.length || 0,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[send-expo-push] Sending to ${pushTokens.length} devices`);

    // Build messages
    const messages: ExpoPushMessage[] = pushTokens.map(token => ({
      to: token,
      title,
      body: messageBody,
      subtitle,
      data,
      sound,
      priority,
      channelId,
      categoryId,
      badge,
      ttl,
      mutableContent: true,
    }));

    // Send
    const result = await sendExpoPush(messages);

    return new Response(
      JSON.stringify({
        success: result.success,
        sent_count: pushTokens.length,
        errors: result.errors,
      }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        } 
      }
    );
  } catch (error: any) {
    console.error('[send-expo-push] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        } 
      }
    );
  }
});
