/**
 * Voice Budget Manager
 *
 * Manages free tier voice input budget (10 minutes per day).
 * Paid tiers have unlimited voice input.
 *
 * Budget authority is server-first via RPC with local fallback for offline mode.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { assertSupabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';

export const FREE_VOICE_BUDGET_MS = 10 * 60 * 1000; // 10 minutes
const FREE_VOICE_BUDGET_KEY_PREFIX = '@dash_voice_free_budget_';
const VOICE_FEATURE = 'voice_input_ms';

type ServerBudgetRow = {
  allowed?: boolean;
  used?: number;
  used_count?: number;
  used_ms?: number;
  limit?: number;
  limit_value?: number;
  remaining?: number;
};

function getTodayKey(): string {
  return new Date().toISOString().split('T')[0];
}

function buildVoiceBudgetKey(dayKey?: string): string {
  return `${FREE_VOICE_BUDGET_KEY_PREFIX}${dayKey || getTodayKey()}`;
}

function normalizeTier(tier?: string | null): string {
  return String(tier || 'free').trim().toLowerCase();
}

function isFreeLikeTier(tier?: string | null): boolean {
  const normalized = normalizeTier(tier);
  return normalized === 'free' || normalized === 'trial';
}

function resolveVoiceDailyLimitMs(tier?: string | null): number {
  return isFreeLikeTier(tier) ? FREE_VOICE_BUDGET_MS : -1;
}

function reportAuthorityFallback(reason: string, tier?: string | null): void {
  try {
    track('counter.authority_fallback_local', {
      feature: VOICE_FEATURE,
      reason,
      tier: normalizeTier(tier),
    });
  } catch {
    // telemetry failures should not impact UX
  }
}

function toFiniteNumber(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function parseServerBudgetRow(data: unknown): ServerBudgetRow | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') return null;
  return row as ServerBudgetRow;
}

function buildVoiceBudget(usedMsRaw: unknown, totalMs: number): VoiceBudget {
  if (totalMs < 0) {
    return {
      remainingMs: Number.POSITIVE_INFINITY,
      usedMs: Math.max(0, toFiniteNumber(usedMsRaw, 0)),
      totalMs: -1,
      percentUsed: 0,
    };
  }
  const usedMs = Math.max(0, Math.min(totalMs, toFiniteNumber(usedMsRaw, 0)));
  const remainingMs = Math.max(0, totalMs - usedMs);
  return {
    remainingMs,
    usedMs,
    totalMs,
    percentUsed: totalMs > 0 ? (usedMs / totalMs) * 100 : 0,
  };
}

function buildBudgetFromServerRow(row: ServerBudgetRow, tier?: string | null): VoiceBudget {
  const fallbackLimit = resolveVoiceDailyLimitMs(tier);
  const limitRaw = row.limit ?? row.limit_value;
  const limit = Math.round(toFiniteNumber(limitRaw, fallbackLimit));
  const usedRaw = row.used ?? row.used_ms ?? row.used_count;
  const remainingRaw = row.remaining;

  if (limit < 0) {
    return {
      remainingMs: Number.POSITIVE_INFINITY,
      usedMs: Math.max(0, Math.round(toFiniteNumber(usedRaw, 0))),
      totalMs: -1,
      percentUsed: 0,
    };
  }

  const usedMs = Math.max(0, Math.min(limit, Math.round(toFiniteNumber(usedRaw, 0))));
  const remainingMs = Number.isFinite(remainingRaw)
    ? Math.max(0, Math.round(toFiniteNumber(remainingRaw, 0)))
    : Math.max(0, limit - usedMs);

  return {
    remainingMs: Math.min(limit, remainingMs),
    usedMs,
    totalMs: Math.max(1, limit),
    percentUsed: limit > 0 ? (usedMs / limit) * 100 : 0,
  };
}

async function getServerVoiceBudget(tier?: string | null): Promise<VoiceBudget | null> {
  const feature = String(VOICE_FEATURE || '').trim().toLowerCase();
  if (!feature) {
    throw new Error('VOICE_FEATURE is not configured');
  }
  const { data, error } = await assertSupabase().rpc('get_daily_media_budget', {
    p_feature: feature,
    p_tier: normalizeTier(tier) || 'free',
  });
  if (error) {
    console.error('[VoiceBudget] get_daily_media_budget failed', {
      code: (error as any)?.code,
      message: (error as any)?.message,
      details: (error as any)?.details,
      hint: (error as any)?.hint,
      tier: normalizeTier(tier),
    });
    throw error;
  }
  const row = parseServerBudgetRow(data);
  if (!row) return null;
  return buildBudgetFromServerRow(row, tier);
}

async function consumeServerVoiceBudget(tier: string | null | undefined, durationMs: number): Promise<VoiceBudget | null> {
  const { data, error } = await assertSupabase().rpc('consume_daily_media_budget', {
    p_feature: VOICE_FEATURE,
    p_amount: Math.max(0, Math.round(durationMs)),
    p_tier: normalizeTier(tier),
  });
  if (error) throw error;
  const row = parseServerBudgetRow(data);
  if (!row) return null;
  return buildBudgetFromServerRow(row, tier);
}

export interface VoiceBudget {
  remainingMs: number;
  usedMs: number;
  totalMs: number;
  percentUsed: number;
}

async function loadLocalVoiceBudget(tier?: string | null): Promise<VoiceBudget> {
  const limitMs = resolveVoiceDailyLimitMs(tier);
  if (limitMs < 0) {
    return {
      remainingMs: Number.POSITIVE_INFINITY,
      usedMs: 0,
      totalMs: -1,
      percentUsed: 0,
    };
  }

  try {
    const raw = await AsyncStorage.getItem(buildVoiceBudgetKey());
    if (!raw) {
      return {
        remainingMs: limitMs,
        usedMs: 0,
        totalMs: limitMs,
        percentUsed: 0,
      };
    }

    const parsed = JSON.parse(raw) as { usedMs?: number };
    return buildVoiceBudget(parsed.usedMs, limitMs);
  } catch (error) {
    console.error('[VoiceBudget] Failed to load local budget:', error);
    return {
      remainingMs: limitMs,
      usedMs: 0,
      totalMs: limitMs,
      percentUsed: 0,
    };
  }
}

async function trackLocalVoiceUsage(durationMs: number, tier?: string | null): Promise<void> {
  const limitMs = resolveVoiceDailyLimitMs(tier);
  if (limitMs < 0) return;

  try {
    const key = buildVoiceBudgetKey();
    const raw = await AsyncStorage.getItem(key);
    const current = raw ? (JSON.parse(raw) as { usedMs?: number }) : { usedMs: 0 };
    const newUsedMs = Math.max(0, Math.min(limitMs, (current.usedMs || 0) + Math.max(0, durationMs)));
    await AsyncStorage.setItem(key, JSON.stringify({ usedMs: newUsedMs }));
  } catch (error) {
    console.error('[VoiceBudget] Failed to track local usage:', error);
  }
}

/**
 * Load current voice budget for today.
 */
export async function loadVoiceBudget(tier?: string | null): Promise<VoiceBudget> {
  try {
    const serverBudget = await getServerVoiceBudget(tier);
    if (serverBudget) return serverBudget;
  } catch (error) {
    console.warn('[VoiceBudget] Server load failed, using local fallback:', error);
    reportAuthorityFallback('load_server_failed', tier);
  }
  return loadLocalVoiceBudget(tier);
}

/**
 * Track voice input usage (only for free-like tiers).
 */
export async function trackVoiceUsage(durationMs: number, tier?: string | null): Promise<void> {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return;

  try {
    const serverBudget = await consumeServerVoiceBudget(tier, durationMs);
    if (serverBudget) return;
  } catch (error) {
    console.warn('[VoiceBudget] Server consume failed, using local fallback:', error);
    reportAuthorityFallback('consume_server_failed', tier);
  }
  await trackLocalVoiceUsage(durationMs, tier);
}

/**
 * Check if user has voice budget remaining.
 */
export async function hasVoiceBudget(requiredMs: number = 1000, tier?: string | null): Promise<boolean> {
  const budget = await loadVoiceBudget(tier);
  if (!Number.isFinite(budget.remainingMs)) return true;
  return budget.remainingMs >= requiredMs;
}

/**
 * Reset local voice budget (for testing or admin purposes).
 */
export async function resetVoiceBudget(): Promise<void> {
  try {
    const key = buildVoiceBudgetKey();
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.error('[VoiceBudget] Failed to reset:', error);
  }
}

/**
 * Get human-readable time remaining.
 */
export function formatTimeRemaining(ms: number): string {
  if (!Number.isFinite(ms)) return 'Unlimited';
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

