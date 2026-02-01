/// <reference path="../../../types/deno-std.d.ts" />
// Supabase Edge Function: superadmin-set-temp-password
// Allows superadmins to set a temporary password for a user and force a reset on next login.

import { serve } from "std/http/server.ts";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type TempPasswordRequest = {
  target_user_id?: string;
  user_id?: string;
  email?: string;
  temp_password?: string;
  password?: string;
};

function jsonResponse(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function generateTempPassword(length = 12) {
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const symbols = "!@#$%";
  const all = lower + upper + digits + symbols;

  const size = Math.max(length, 8);
  const bytes = crypto.getRandomValues(new Uint8Array(size));

  const chars: string[] = [
    lower[bytes[0] % lower.length],
    upper[bytes[1] % upper.length],
    digits[bytes[2] % digits.length],
    symbols[bytes[3] % symbols.length],
  ];

  for (let i = 4; i < size; i += 1) {
    chars.push(all[bytes[i] % all.length]);
  }

  // Shuffle to avoid predictable placement
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = bytes[i % bytes.length] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[superadmin-set-temp-password] Missing Supabase env vars");
    return jsonResponse(500, { success: false, error: "Supabase configuration missing" });
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader) {
    return jsonResponse(401, { success: false, error: "Unauthorized" });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    console.error("[superadmin-set-temp-password] Auth error:", authError);
    return jsonResponse(401, { success: false, error: "Unauthorized" });
  }

  const actorId = authData.user.id;

  const { data: actorProfile, error: actorProfileError } = await supabaseAdmin
    .from("profiles")
    .select("id, email, role")
    .eq("id", actorId)
    .maybeSingle();

  if (actorProfileError || !actorProfile) {
    console.error("[superadmin-set-temp-password] Profile error:", actorProfileError);
    return jsonResponse(403, { success: false, error: "Profile not found" });
  }

  const role = (actorProfile.role || "").toLowerCase();
  if (role !== "super_admin" && role !== "superadmin") {
    return jsonResponse(403, { success: false, error: "Insufficient permissions" });
  }

  let body: TempPasswordRequest;
  try {
    body = await req.json();
  } catch (parseError) {
    console.error("[superadmin-set-temp-password] Invalid JSON:", parseError);
    return jsonResponse(400, { success: false, error: "Invalid JSON payload" });
  }

  const targetUserId = body.target_user_id || body.user_id || null;
  const targetEmail = body.email || null;
  const providedPassword = body.temp_password || body.password || null;

  let resolvedUserId = targetUserId;
  let resolvedEmail = targetEmail;

  if (!resolvedUserId && targetEmail) {
    const { data: emailLookup, error: emailError } = await supabaseAdmin
      .schema("auth")
      .from("users")
      .select("id, email")
      .eq("email", targetEmail)
      .maybeSingle();
    if (emailError || !emailLookup?.id) {
      console.error("[superadmin-set-temp-password] User lookup failed:", emailError);
      return jsonResponse(404, { success: false, error: "User not found" });
    }
    resolvedUserId = emailLookup.id;
    resolvedEmail = emailLookup.email || targetEmail;
  }

  if (!resolvedUserId) {
    return jsonResponse(400, { success: false, error: "Missing target_user_id or email" });
  }

  const { data: targetUserData } = await supabaseAdmin.auth.admin.getUserById(resolvedUserId);
  const existingMetadata = targetUserData?.user?.user_metadata || {};
  if (!resolvedEmail && targetUserData?.user?.email) {
    resolvedEmail = targetUserData.user.email;
  }

  const tempPassword =
    typeof providedPassword === "string" && providedPassword.trim().length >= 8
      ? providedPassword.trim()
      : generateTempPassword();

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(resolvedUserId, {
    password: tempPassword,
    user_metadata: {
      ...existingMetadata,
      force_password_change: true,
      temp_password_issued_at: new Date().toISOString(),
      temp_password_issued_by: actorId,
      temp_password_issued_by_email: actorProfile.email || null,
    },
  });

  if (updateError) {
    console.error("[superadmin-set-temp-password] Update error:", updateError);
    return jsonResponse(500, { success: false, error: "Failed to update user password" });
  }

  // Best-effort: mark custom users table if present
  try {
    await supabaseAdmin
      .from("users")
      .update({ password_reset_required: true })
      .or(`id.eq.${resolvedUserId},auth_user_id.eq.${resolvedUserId}`);
  } catch (error) {
    console.warn("[superadmin-set-temp-password] Failed to update users table:", error);
  }

  // Best-effort: log superadmin action
  try {
    await supabaseAdmin.from("superadmin_user_actions").insert({
      action: "password_reset",
      admin_id: actorId,
      admin_user_id: actorId,
      description: "Temporary password issued by superadmin",
      target_user_id: resolvedUserId,
      resource_id: resolvedUserId,
      resource_type: "auth_user",
    });
  } catch (error) {
    console.warn("[superadmin-set-temp-password] Failed to log action:", error);
  }

  return jsonResponse(200, {
    success: true,
    user_id: resolvedUserId,
    email: resolvedEmail,
    temp_password: tempPassword,
    force_password_change: true,
  });
});
