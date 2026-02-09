/**
 * Calls system E2E (Supabase + Daily Edge Functions).
 *
 * Covers a real cross-user lifecycle:
 * - teacher creates Daily room
 * - teacher creates active call row (ringing)
 * - parent sees incoming call
 * - parent answers (connected)
 * - both fetch Daily tokens
 * - teacher ends call (ended with duration)
 * - both can read call history
 *
 * This suite runs only when required env vars are present.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import { randomUUID } from 'crypto';

type CallStatus = 'ringing' | 'connected' | 'ended' | 'rejected' | 'missed' | 'busy';

interface SignedInUser {
  id: string;
  accessToken: string;
}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

const TEACHER_EMAIL = process.env.E2E_TEACHER_EMAIL || 'test.teacher@edudashpro.test';
const TEACHER_PASSWORD = process.env.E2E_TEACHER_PASSWORD || 'TestTeacher123!';
const PARENT_EMAIL = process.env.E2E_PARENT_EMAIL || 'test.parent@edudashpro.test';
const PARENT_PASSWORD = process.env.E2E_PARENT_PASSWORD || 'TestParent123!';

const RUN_E2E = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
const CALLS_E2E_TIMEOUT_MS = 60_000;

let teacherClient: SupabaseClient;
let parentClient: SupabaseClient;
let teacherUser: SignedInUser;
let parentUser: SignedInUser;
let roomName = '';
let meetingUrl = '';
const createdCallIds: string[] = [];

const createTestClient = () =>
  createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

const signIn = async (
  client: SupabaseClient,
  email: string,
  password: string
): Promise<SignedInUser> => {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session || !data.user) {
    throw new Error(`Failed sign in for ${email}: ${error?.message || 'unknown error'}`);
  }

  return {
    id: data.user.id,
    accessToken: data.session.access_token,
  };
};

const callFunction = async (
  fnName: 'daily-rooms' | 'daily-token',
  bearerToken: string,
  payload: Record<string, unknown>
) => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bearerToken}`,
    },
    body: JSON.stringify(payload),
  });

  const raw = await response.text();
  let json: unknown = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    json = { raw };
  }

  return { response, json };
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForCallStatus = async (
  client: SupabaseClient,
  callId: string,
  expectedStatus: CallStatus,
  userId: string,
  timeoutMs = 15_000
) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { data, error } = await client
      .from('active_calls')
      .select('status')
      .eq('call_id', callId)
      .or(`caller_id.eq.${userId},callee_id.eq.${userId}`)
      .maybeSingle();

    if (!error && data?.status === expectedStatus) {
      return true;
    }
    await sleep(300);
  }
  return false;
};

const describeCallsE2E = RUN_E2E ? describe : describe.skip;

describeCallsE2E('Calls System E2E', () => {
  jest.setTimeout(CALLS_E2E_TIMEOUT_MS);

  beforeAll(async () => {
    teacherClient = createTestClient();
    parentClient = createTestClient();
    teacherUser = await signIn(teacherClient, TEACHER_EMAIL, TEACHER_PASSWORD);
    parentUser = await signIn(parentClient, PARENT_EMAIL, PARENT_PASSWORD);
  });

  afterAll(async () => {
    if (!RUN_E2E || createdCallIds.length === 0) return;

    // Cleanup best effort (don't fail suite on cleanup issues).
    await teacherClient.from('active_calls').delete().in('call_id', createdCallIds);
    await parentClient.auth.signOut();
    await teacherClient.auth.signOut();
  });

  test('teacher can create Daily room and both users can fetch call tokens', async () => {
    const roomPayload = {
      action: 'create',
      name: `e2e-call-${Date.now()}`,
      privacy: 'private',
      properties: {
        exp: Math.floor(Date.now() / 1000) + 1800,
        enable_chat: false,
        enable_screenshare: false,
      },
    };

    const { response, json } = await callFunction('daily-rooms', teacherUser.accessToken, roomPayload);
    expect(response.ok).toBe(true);

    const room = (json as { room?: { name?: string; url?: string } })?.room;
    expect(typeof room?.name).toBe('string');
    expect(typeof room?.url).toBe('string');

    roomName = room?.name || '';
    meetingUrl = room?.url || '';

    const teacherTokenResult = await callFunction('daily-token', teacherUser.accessToken, {
      roomName,
      userName: 'E2E Teacher',
    });
    expect(teacherTokenResult.response.ok).toBe(true);
    expect(
      typeof (teacherTokenResult.json as { token?: string })?.token === 'string' &&
        (teacherTokenResult.json as { token?: string })?.token?.length
    ).toBeTruthy();

    const parentTokenResult = await callFunction('daily-token', parentUser.accessToken, {
      roomName,
      userName: 'E2E Parent',
    });
    expect(parentTokenResult.response.ok).toBe(true);
    expect(
      typeof (parentTokenResult.json as { token?: string })?.token === 'string' &&
        (parentTokenResult.json as { token?: string })?.token?.length
    ).toBeTruthy();
  });

  test('call lifecycle persists across participants (ringing -> connected -> ended)', async () => {
    const callId = randomUUID();
    createdCallIds.push(callId);

    const { error: insertError } = await teacherClient.from('active_calls').insert({
      call_id: callId,
      call_type: 'voice',
      caller_id: teacherUser.id,
      callee_id: parentUser.id,
      caller_name: 'E2E Teacher',
      meeting_url: meetingUrl || null,
      status: 'ringing',
      started_at: new Date().toISOString(),
    });
    expect(insertError).toBeNull();

    const parentSawRinging = await waitForCallStatus(parentClient, callId, 'ringing', parentUser.id);
    expect(parentSawRinging).toBe(true);

    const answeredAt = new Date().toISOString();
    const { error: answerError } = await parentClient
      .from('active_calls')
      .update({
        status: 'connected',
        answered_at: answeredAt,
      })
      .eq('call_id', callId)
      .eq('callee_id', parentUser.id);
    expect(answerError).toBeNull();

    const teacherSawConnected = await waitForCallStatus(teacherClient, callId, 'connected', teacherUser.id);
    expect(teacherSawConnected).toBe(true);

    const endedAt = new Date().toISOString();
    const { error: endError } = await teacherClient
      .from('active_calls')
      .update({
        status: 'ended',
        ended_at: endedAt,
        duration_seconds: 42,
      })
      .eq('call_id', callId)
      .eq('caller_id', teacherUser.id);
    expect(endError).toBeNull();

    const parentSawEnded = await waitForCallStatus(parentClient, callId, 'ended', parentUser.id);
    expect(parentSawEnded).toBe(true);

    const { data: teacherHistory, error: teacherHistoryError } = await teacherClient
      .from('active_calls')
      .select('call_id, caller_id, callee_id, status, duration_seconds')
      .eq('call_id', callId)
      .or(`caller_id.eq.${teacherUser.id},callee_id.eq.${teacherUser.id}`)
      .maybeSingle();
    expect(teacherHistoryError).toBeNull();
    expect(teacherHistory?.status).toBe('ended');
    expect(teacherHistory?.duration_seconds).toBe(42);

    const { data: parentHistory, error: parentHistoryError } = await parentClient
      .from('active_calls')
      .select('call_id, caller_id, callee_id, status')
      .eq('call_id', callId)
      .or(`caller_id.eq.${parentUser.id},callee_id.eq.${parentUser.id}`)
      .maybeSingle();
    expect(parentHistoryError).toBeNull();
    expect(parentHistory?.call_id).toBe(callId);
    expect(parentHistory?.status).toBe('ended');
  });

  test('missed call status is visible in callee history', async () => {
    const callId = randomUUID();
    createdCallIds.push(callId);

    const { error: insertError } = await teacherClient.from('active_calls').insert({
      call_id: callId,
      call_type: 'voice',
      caller_id: teacherUser.id,
      callee_id: parentUser.id,
      caller_name: 'E2E Teacher',
      meeting_url: null,
      status: 'missed',
      started_at: new Date().toISOString(),
      ended_at: new Date().toISOString(),
      duration_seconds: 0,
    });
    expect(insertError).toBeNull();

    const { data, error } = await parentClient
      .from('active_calls')
      .select('call_id, status, duration_seconds')
      .eq('call_id', callId)
      .eq('callee_id', parentUser.id)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data?.status).toBe('missed');
    expect(data?.duration_seconds).toBe(0);
  });
});

if (!RUN_E2E) {
  describe('Calls System E2E (skipped)', () => {
    test('set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to run', () => {
      expect(true).toBe(true);
    });
  });
}
