// Supabase Edge Function: send-email
// Sends emails via Resend with proper security and validation
// Requires RESEND_API_KEY in Supabase secrets

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "EduDash Pro <onboarding@resend.dev>";
const ENVIRONMENT = Deno.env.get("ENVIRONMENT") || "production";

const RATE_LIMIT_PER_HOUR = 50;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const isServiceRole = SUPABASE_SERVICE_ROLE_KEY && authHeader.includes(SUPABASE_SERVICE_ROLE_KEY);

    let orgId: string | null = null;
    let userId: string | null = null;
    let isSystemEmail = false;

    // Create admin client for logging
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (isServiceRole) {
      isSystemEmail = true;
      console.log("[send-email] Service role request - system email");
    } else {
      // Regular user authentication
      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: authData, error: authError } = await userClient.auth.getUser();
      if (authError || !authData.user) {
        console.error("[send-email] Auth error:", authError);
        return new Response(
          JSON.stringify({ success: false, error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      userId = authData.user.id;

      const { data: profile, error: profileError } = await userClient
        .from("profiles")
        .select("id, organization_id, preschool_id, role")
        .eq("id", authData.user.id)
        .single();

      if (profileError || !profile) {
        console.error("[send-email] Profile error:", profileError);
        return new Response(
          JSON.stringify({ success: false, error: "Profile not found" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      orgId = profile.organization_id || profile.preschool_id;

      const allowedRoles = ["principal", "principal_admin", "superadmin", "super_admin", "teacher"];
      if (!allowedRoles.includes(profile.role)) {
        return new Response(
          JSON.stringify({ success: false, error: "Insufficient permissions" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const body = await req.json();
    console.log("[send-email] Request:", { to: body.to, subject: body.subject });

    if (!body.to || !body.subject || !body.body) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: to, subject, body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!body.confirmed) {
      return new Response(
        JSON.stringify({ success: false, error: "Email sending requires confirmed: true" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let emailsUsed = 0;

    // Check rate limit (skip for system emails)
    if (!isSystemEmail && orgId) {
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await adminClient
        .from("email_logs")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .gte("created_at", hourAgo);

      emailsUsed = count || 0;
      if (emailsUsed >= RATE_LIMIT_PER_HOUR) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Rate limit exceeded",
            rate_limit: { used: emailsUsed, limit: RATE_LIMIT_PER_HOUR, remaining: 0 },
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (!RESEND_API_KEY) {
      console.error("[send-email] RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (ENVIRONMENT === "development") {
      console.log("[send-email] TEST MODE - would send to:", body.to);
      return new Response(
        JSON.stringify({ success: true, message_id: "test-" + Date.now(), warning: "TEST MODE" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build email payload
    const emailPayload: Record<string, unknown> = {
      from: FROM_EMAIL,
      to: Array.isArray(body.to) ? body.to : [body.to],
      subject: body.subject,
    };

    if (body.is_html !== false) {
      emailPayload.html = body.body;
    } else {
      emailPayload.text = body.body;
    }

    if (body.reply_to) emailPayload.reply_to = body.reply_to;
    if (body.cc) emailPayload.cc = body.cc;
    if (body.bcc) emailPayload.bcc = body.bcc;

    console.log("[send-email] Sending via Resend:", { to: emailPayload.to, from: FROM_EMAIL });

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify(emailPayload),
    });

    const resendData = await resendResponse.json();
    console.log("[send-email] Resend response:", { status: resendResponse.status, data: resendData });

    if (!resendResponse.ok) {
      console.error("[send-email] Resend error:", resendData);

      try {
        await adminClient.from("email_logs").insert({
          organization_id: orgId,
          user_id: userId,
          recipient: Array.isArray(body.to) ? body.to.join(",") : body.to,
          subject: body.subject,
          status: "failed",
          error_message: resendData.message || "Unknown error",
          metadata: { resend_error: resendData },
        });
      } catch (logErr) {
        console.log("[send-email] Could not log failed email:", logErr);
      }

      return new Response(
        JSON.stringify({ success: false, error: resendData.message || "Failed to send email" }),
        { status: resendResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    try {
      await adminClient.from("email_logs").insert({
        organization_id: orgId,
        user_id: userId,
        recipient: Array.isArray(body.to) ? body.to.join(",") : body.to,
        subject: body.subject,
        status: "sent",
        message_id: resendData.id,
        metadata: { resend_response: resendData },
      });
    } catch (logErr) {
      console.log("[send-email] Could not log sent email:", logErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message_id: resendData.id,
        rate_limit: {
          used: emailsUsed + 1,
          limit: RATE_LIMIT_PER_HOUR,
          remaining: RATE_LIMIT_PER_HOUR - emailsUsed - 1,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[send-email] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
