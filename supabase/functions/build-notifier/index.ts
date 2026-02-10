// @ts-nocheck - Deno Edge Function with URL imports
/**
 * Build Notifier — EAS Build Webhook Handler
 *
 * Receives webhooks from Expo EAS when builds complete/fail.
 * Notifies super-admins and testers via push notifications + optional
 * Discord/Slack webhook, and logs the build event.
 *
 * Auth: HMAC-SHA1 signature verification via EAS_WEBHOOK_SECRET
 *       OR service-role / CRON_SECRET for manual invocation
 *
 * Setup:
 *   supabase secrets set EAS_WEBHOOK_SECRET="<openssl rand -base64 32>"
 *   supabase secrets set DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
 *   eas webhook:create --event BUILD --url <function_url> --secret <secret>
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0?dts';

// ─── Environment ─────────────────────────────────────────
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET') || '';
const EAS_WEBHOOK_SECRET = Deno.env.get('EAS_WEBHOOK_SECRET') || '';
const DISCORD_WEBHOOK_URL = Deno.env.get('DISCORD_WEBHOOK_URL') || '';
const SLACK_WEBHOOK_URL = Deno.env.get('SLACK_WEBHOOK_URL') || '';

// ─── Types ───────────────────────────────────────────────
interface EASBuildWebhookPayload {
  id: string;
  accountName: string;
  projectName: string;
  appId: string;
  initiatingActor: { id: string; displayName: string } | null;
  platform: 'ios' | 'android';
  buildProfile: string;
  sdkVersion: string;
  status: 'finished' | 'errored' | 'canceled' | 'new' | 'in-queue' | 'in-progress';
  artifacts?: {
    buildUrl?: string;
    applicationArchiveUrl?: string;
    logsUrl?: string;
  };
  metadata?: {
    appVersion?: string;
    appBuildVersion?: string;
    runtimeVersion?: string;
    distribution?: string;
    channel?: string;
    buildNumber?: string;
  };
  error?: { message?: string; errorCode?: string };
  createdAt: string;
  completedAt?: string;
}

// ─── HMAC Signature Verification ─────────────────────────
async function verifyEASSignature(
  body: string,
  signature: string | null,
  secret: string,
): Promise<boolean> {
  if (!signature || !secret) return false;

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const computedHex = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const normalized = signature.trim().toLowerCase();
    return (
      normalized === computedHex ||
      normalized === `sha1=${computedHex}`
    );
  } catch {
    return false;
  }
}

// ─── CORS Headers ────────────────────────────────────────
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, expo-signature',
  'Content-Type': 'application/json',
};

Deno.serve(async (req: Request): Promise<Response> => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const rawBody = await req.text();

  try {
    // ─── Auth: 3-way verification ──────────────
    const expoSignature = req.headers.get('expo-signature');
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    const isEASWebhook = await verifyEASSignature(rawBody, expoSignature, EAS_WEBHOOK_SECRET);
    const isServiceRole = token === SUPABASE_SERVICE_ROLE_KEY;
    const isCronSecret = !!CRON_SECRET && token === CRON_SECRET;

    let isValidJWT = false;
    if (token && !isServiceRole && !isCronSecret) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        isValidJWT = payload.role === 'service_role';
      } catch {
        // ignore
      }
    }

    if (!isEASWebhook && !isServiceRole && !isCronSecret && !isValidJWT) {
      console.warn('[BuildNotifier] Unauthorized request');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: CORS_HEADERS },
      );
    }

    const payload: EASBuildWebhookPayload = JSON.parse(rawBody);
    const { id, platform, buildProfile, status, metadata, artifacts, error: buildError } = payload;

    console.log(`[BuildNotifier] Build ${id}: ${status} (${platform}/${buildProfile})`);

    // Skip non-terminal statuses
    if (!['finished', 'errored', 'canceled'].includes(status)) {
      return new Response(
        JSON.stringify({ success: true, message: `Build ${status}, skipping notification` }),
        { status: 200, headers: CORS_HEADERS },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ─── Build notification content ────────────
    const platformLabel = platform?.toUpperCase() || 'UNKNOWN';
    const version = metadata?.appVersion || 'unknown';
    const channel = metadata?.channel || buildProfile || 'default';
    const buildUrl = artifacts?.buildUrl || artifacts?.applicationArchiveUrl || '';

    let title: string;
    let body: string;
    let color: number; // Discord embed color

    switch (status) {
      case 'finished':
        title = `🚀 New ${platformLabel} Build Available`;
        body = `${channel} build v${version} is ready for testing`;
        color = 0x22c55e; // green
        break;
      case 'errored':
        title = `❌ ${platformLabel} Build Failed`;
        body = `${channel} build v${version} failed: ${buildError?.message || 'unknown error'}`;
        color = 0xef4444; // red
        break;
      case 'canceled':
        title = `⏹ ${platformLabel} Build Canceled`;
        body = `${channel} build v${version} was canceled`;
        color = 0xf59e0b; // amber
        break;
      default:
        title = `${platformLabel} Build Update`;
        body = `Build ${id} status: ${status}`;
        color = 0x6b7280; // gray
    }

    // ─── Log build event in audit_events ───────
    await supabase.from('audit_events').insert({
      event_type: 'system_action',
      actor_id: null,
      metadata: {
        action: 'build_notification',
        build_id: id,
        platform,
        build_profile: buildProfile,
        status,
        version,
        channel,
        build_url: buildUrl,
        error_message: buildError?.message || null,
        completed_at: payload.completedAt || null,
      },
    }).then(({ error: auditErr }) => {
      if (auditErr) console.warn('[BuildNotifier] Audit log failed:', auditErr.message);
    });

    // ─── Fetch notification targets ────────────
    // Notify: super_admins + profiles with is_tester = true
    const { data: targets, error: targetsError } = await supabase
      .from('profiles')
      .select('id, first_name, auth_user_id')
      .or('role.in.(super_admin,superadmin),is_tester.eq.true');

    if (targetsError) {
      console.error('[BuildNotifier] Failed to fetch targets:', targetsError.message);
    }

    const recipientIds = (targets || [])
      .map((t) => t.auth_user_id || t.id)
      .filter(Boolean);

    console.log(`[BuildNotifier] Notifying ${recipientIds.length} users`);

    // ─── Insert in-app notifications ───────────
    const notificationRecords = recipientIds.map((userId: string) => ({
      user_id: userId,
      title,
      body,
      type: 'system',
      data: {
        type: 'new_build',
        build_id: id,
        platform,
        build_profile: buildProfile,
        version,
        channel,
        build_url: buildUrl,
        status,
      },
      read: false,
    }));

    if (notificationRecords.length > 0) {
      const { error: notifErr } = await supabase
        .from('notifications')
        .insert(notificationRecords);

      if (notifErr) {
        console.error('[BuildNotifier] Notification insert failed:', notifErr.message);
      }
    }

    // ─── Push notifications via Expo ───────────
    let pushCount = 0;
    if (status === 'finished' && recipientIds.length > 0) {
      const { data: pushDevices } = await supabase
        .from('push_devices')
        .select('expo_push_token, user_id')
        .in('user_id', recipientIds)
        .eq('is_active', true);

      // Deduplicate by user_id (keep first occurrence)
      const seenUsers = new Set<string>();
      const uniqueDevices = (pushDevices || []).filter((d: any) => {
        if (seenUsers.has(d.user_id)) return false;
        seenUsers.add(d.user_id);
        return true;
      });

      const expoPushMessages = uniqueDevices
        .filter((pt: any) => pt.expo_push_token?.startsWith('ExponentPushToken'))
        .map((pt: any) => ({
          to: pt.expo_push_token,
          sound: 'default',
          title,
          body,
          data: { type: 'new_build', build_url: buildUrl },
          channelId: 'system',
        }));

      if (expoPushMessages.length > 0) {
        try {
          // Expo push API supports batches of up to 100
          for (let i = 0; i < expoPushMessages.length; i += 100) {
            const batch = expoPushMessages.slice(i, i + 100);
            const pushRes = await fetch('https://exp.host/--/api/v2/push/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(batch),
            });

            if (!pushRes.ok) {
              console.warn(`[BuildNotifier] Expo push batch ${i} failed: ${pushRes.status}`);
            }
          }
          pushCount = expoPushMessages.length;
        } catch (pushErr) {
          console.error('[BuildNotifier] Push send error:', pushErr);
        }
      }
    }

    // ─── Discord webhook (optional) ────────────
    if (DISCORD_WEBHOOK_URL) {
      try {
        await fetch(DISCORD_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            embeds: [{
              title: `${title} — ${channel}`,
              description: body,
              color,
              fields: [
                { name: 'Platform', value: platformLabel, inline: true },
                { name: 'Version', value: version, inline: true },
                { name: 'Channel', value: channel, inline: true },
                ...(buildUrl ? [{ name: 'Download', value: `[Build Link](${buildUrl})` }] : []),
              ],
              timestamp: new Date().toISOString(),
            }],
          }),
        });
      } catch (discordErr) {
        console.warn('[BuildNotifier] Discord webhook failed:', discordErr);
      }
    }

    // ─── Slack webhook (optional) ──────────────
    if (SLACK_WEBHOOK_URL) {
      try {
        const emoji = status === 'finished' ? ':rocket:' : status === 'errored' ? ':x:' : ':stop_button:';
        await fetch(SLACK_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `${emoji} *${title}*\n${body}${buildUrl ? `\n<${buildUrl}|Download Build>` : ''}`,
          }),
        });
      } catch (slackErr) {
        console.warn('[BuildNotifier] Slack webhook failed:', slackErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        build_id: id,
        status,
        platform,
        version,
        notified: recipientIds.length,
        push_sent: pushCount,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: CORS_HEADERS },
    );
  } catch (err) {
    console.error('[BuildNotifier] Error:', err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: CORS_HEADERS },
    );
  }
});
