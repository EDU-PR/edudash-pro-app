import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') || 'BLXiYIECWZGIlbDkQKKPhl3t86tGQRQDAHnNq5JHMg9btdbjiVgt3rLDeGhz5LveRarHS-9vY84aFkQrfApmNpE';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || 'qdFtH6ruCn2b__D7mT_vIAJKhK8i9mhYXVeISRKzGpM';
const VAPID_SUBJECT = 'mailto:noreply@edudashpro.org.za';

interface QueueItem {
  id: string;
  user_id: string;
  title: string;
  body: string;
  icon: string;
  badge: string;
  tag: string;
  data: Record<string, unknown>;
  require_interaction: boolean;
}

async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: { title: string; body: string; icon?: string; badge?: string; tag?: string; data?: Record<string, unknown>; requireInteraction?: boolean }
): Promise<void> {
  const payloadString = JSON.stringify(payload);
  
  // Import web-push library
  const webpush = await import('https://esm.sh/web-push@3.6.7');
  
  webpush.default.setVapidDetails(
    VAPID_SUBJECT,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );

  const pushSubscription = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  };

  await webpush.default.sendNotification(pushSubscription, payloadString);
}

async function processQueueItem(supabase: ReturnType<typeof createClient>, item: QueueItem): Promise<{ success: boolean; error?: string }> {
  try {
    // Get push subscriptions for this user
    const { data: subscriptions, error: fetchError } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', item.user_id);

    if (fetchError) {
      throw new Error(`Failed to fetch subscriptions: ${fetchError.message}`);
    }

    if (!subscriptions || subscriptions.length === 0) {
      // No subscriptions - mark as sent (nothing to do)
      await supabase
        .from('push_notification_queue')
        .update({ status: 'sent', processed_at: new Date().toISOString() })
        .eq('id', item.id);
      
      return { success: true };
    }

    // Build payload
    const payload = {
      title: item.title,
      body: item.body,
      icon: item.icon || '/icon-192.png',
      badge: item.badge || '/icon-192.png',
      tag: item.tag,
      data: item.data,
      requireInteraction: item.require_interaction,
    };

    // Send to all subscriptions for this user
    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        sendWebPush(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          payload
        )
      )
    );

    // Check results and clean up expired subscriptions
    const expiredIds: string[] = [];
    let anySuccess = false;

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        anySuccess = true;
      } else if (result.reason?.statusCode === 410) {
        // Subscription expired
        expiredIds.push(subscriptions[index].id);
      }
    });

    // Remove expired subscriptions
    if (expiredIds.length > 0) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('id', expiredIds);
    }

    // Update queue item status
    await supabase
      .from('push_notification_queue')
      .update({ 
        status: anySuccess ? 'sent' : 'failed',
        processed_at: new Date().toISOString(),
        error_message: anySuccess ? null : 'All subscriptions failed'
      })
      .eq('id', item.id);

    return { success: anySuccess };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error processing queue item ${item.id}:`, errorMessage);
    
    // Mark as failed
    await supabase
      .from('push_notification_queue')
      .update({ 
        status: 'failed',
        processed_at: new Date().toISOString(),
        error_message: errorMessage
      })
      .eq('id', item.id);

    return { success: false, error: errorMessage };
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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if this is a webhook trigger (from database)
    const body = await req.json().catch(() => ({}));
    
    if (body.type === 'INSERT' && body.record) {
      // Single item from webhook
      const item = body.record as QueueItem;
      console.log(`Processing single queue item: ${item.id}`);
      
      const result = await processQueueItem(supabase, item);
      
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Batch processing - get all pending items
    const { data: pendingItems, error: fetchError } = await supabase
      .from('push_notification_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(100); // Process up to 100 at a time

    if (fetchError) {
      throw new Error(`Failed to fetch queue: ${fetchError.message}`);
    }

    if (!pendingItems || pendingItems.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending notifications', processed: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${pendingItems.length} pending notifications`);

    // Process all items
    const results = await Promise.allSettled(
      pendingItems.map((item) => processQueueItem(supabase, item as QueueItem))
    );

    const sent = results.filter(r => r.status === 'fulfilled' && (r.value as { success: boolean }).success).length;
    const failed = results.length - sent;

    return new Response(
      JSON.stringify({
        message: 'Queue processed',
        processed: results.length,
        sent,
        failed,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error processing queue:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
