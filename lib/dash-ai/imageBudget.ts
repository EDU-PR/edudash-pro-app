/**
 * Image Budget Manager
 *
 * Manages free tier image upload budget (10 images per day).
 * Paid tiers have unlimited image uploads.
 *
 * Auto-scan quota is now server-authoritative via RPC with local fallback when
 * offline/unavailable.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { assertSupabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';

export const FREE_IMAGE_BUDGET_PER_DAY = 10;
const FREE_IMAGE_BUDGET_KEY_PREFIX = '@dash_image_free_budget_';
export const FREE_AUTO_SCAN_BUDGET_PER_DAY = 3;
export const PAID_AUTO_SCAN_BUDGET_PER_DAY = 7;
const AUTO_SCAN_BUDGET_KEY_PREFIX = '@dash_auto_scan_budget_';
const AUTO_SCAN_ANONYMOUS_KEY = 'anonymous';
const AUTO_SCAN_FEATURE = 'auto_scan';
const autoScanLockTails = new Map<string, Promise<unknown>>();

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

function buildImageBudgetKey(dayKey?: string): string {
  return `${FREE_IMAGE_BUDGET_KEY_PREFIX}${dayKey || getTodayKey()}`;
}

function normalizeAutoScanUserKey(userId?: string | null): string {
  const normalized = String(userId || '').trim();
  if (!normalized) return AUTO_SCAN_ANONYMOUS_KEY;
  return normalized.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function buildAutoScanBudgetKey(dayKey?: string, userId?: string | null): string {
  return `${AUTO_SCAN_BUDGET_KEY_PREFIX}${dayKey || getTodayKey()}_${normalizeAutoScanUserKey(userId)}`;
}

function normalizeTier(tier?: string | null): string {
  return String(tier || 'free').trim().toLowerCase();
}

function isFreeLikeTier(tier?: string | null): boolean {
  const normalized = normalizeTier(tier);
  return normalized === 'free' || normalized === 'trial';
}

export interface ImageBudget {
  remainingCount: number;
  usedCount: number;
  totalCount: number;
  percentUsed: number;
}

function resolveAutoScanDailyLimit(tier?: string | null): number {
  return isFreeLikeTier(tier) ? FREE_AUTO_SCAN_BUDGET_PER_DAY : PAID_AUTO_SCAN_BUDGET_PER_DAY;
}

async function withAutoScanLock<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = autoScanLockTails.get(key) || Promise.resolve();
  const next = previous.catch(() => undefined).then(task);
  autoScanLockTails.set(
    key,
    next.finally(() => {
      if (autoScanLockTails.get(key) === next) {
        autoScanLockTails.delete(key);
      }
    }),
  );
  return next;
}

function reportAuthorityFallback(reason: string, tier?: string | null): void {
  try {
    track('counter.authority_fallback_local', {
      feature: AUTO_SCAN_FEATURE,
      reason,
      tier: normalizeTier(tier),
    });
  } catch {
    // telemetry failures should not affect user flow
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

function buildAutoScanBudgetFromUsage(usedCountRaw: unknown, dailyLimit: number): ImageBudget {
  const usedCount = toFiniteNumber(usedCountRaw, 0);
  const clampedUsedCount = Math.max(0, Math.min(dailyLimit, usedCount));
  const remainingCount = Math.max(0, dailyLimit - clampedUsedCount);
  return {
    remainingCount,
    usedCount: clampedUsedCount,
    totalCount: dailyLimit,
    percentUsed: dailyLimit > 0 ? (clampedUsedCount / dailyLimit) * 100 : 0,
  };
}

function buildBudgetFromServerRow(row: ServerBudgetRow, tier?: string | null): ImageBudget {
  const fallbackLimit = resolveAutoScanDailyLimit(tier);
  const limitRaw = row.limit ?? row.limit_value;
  const limit = Math.max(1, Math.round(toFiniteNumber(limitRaw, fallbackLimit)));
  const usedRaw = row.used ?? row.used_count ?? row.used_ms;
  const used = Math.max(0, Math.round(toFiniteNumber(usedRaw, 0)));
  const remainingRaw = row.remaining;
  const remaining = Number.isFinite(remainingRaw)
    ? Math.max(0, Math.round(toFiniteNumber(remainingRaw, 0)))
    : Math.max(0, limit - used);

  return {
    remainingCount: Math.min(limit, remaining),
    usedCount: Math.min(limit, used),
    totalCount: limit,
    percentUsed: limit > 0 ? (Math.min(limit, used) / limit) * 100 : 0,
  };
}

async function getServerAutoScanBudget(tier?: string | null): Promise<ImageBudget | null> {
  const feature = String(AUTO_SCAN_FEATURE || '').trim().toLowerCase();
  if (!feature) {
    throw new Error('AUTO_SCAN_FEATURE is not configured');
  }
  const { data, error } = await assertSupabase().rpc('get_daily_media_budget', {
    p_feature: feature,
    p_tier: normalizeTier(tier) || 'free',
  });
  if (error) {
    console.error('[AutoScanBudget] get_daily_media_budget failed', {
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

async function consumeServerAutoScanBudget(tier?: string | null, count: number = 1): Promise<AutoScanConsumeResult | null> {
  const { data, error } = await assertSupabase().rpc('consume_daily_media_budget', {
    p_feature: AUTO_SCAN_FEATURE,
    p_amount: Math.max(0, Math.round(count)),
    p_tier: normalizeTier(tier),
  });
  if (error) throw error;
  const row = parseServerBudgetRow(data);
  if (!row) return null;
  return {
    allowed: row.allowed == null ? true : Boolean(row.allowed),
    budget: buildBudgetFromServerRow(row, tier),
  };
}

async function loadLocalAutoScanBudget(tier?: string | null, userId?: string | null): Promise<ImageBudget> {
  const dailyLimit = resolveAutoScanDailyLimit(tier);
  try {
    const raw = await AsyncStorage.getItem(buildAutoScanBudgetKey(undefined, userId));
    if (!raw) {
      return {
        remainingCount: dailyLimit,
        usedCount: 0,
        totalCount: dailyLimit,
        percentUsed: 0,
      };
    }
    const parsed = JSON.parse(raw) as { usedCount?: number };
    return buildAutoScanBudgetFromUsage(parsed.usedCount, dailyLimit);
  } catch (error) {
    console.error('[AutoScanBudget] Failed to load local budget:', error);
    return {
      remainingCount: dailyLimit,
      usedCount: 0,
      totalCount: dailyLimit,
      percentUsed: 0,
    };
  }
}

async function consumeLocalAutoScanBudget(
  tier?: string | null,
  count: number = 1,
  userId?: string | null,
): Promise<AutoScanConsumeResult> {
  const dailyLimit = resolveAutoScanDailyLimit(tier);
  const key = buildAutoScanBudgetKey(undefined, userId);

  return withAutoScanLock(key, async () => {
    if (count <= 0) {
      return {
        allowed: true,
        budget: await loadLocalAutoScanBudget(tier, userId),
      };
    }

    const raw = await AsyncStorage.getItem(key);
    const current = raw ? (JSON.parse(raw) as { usedCount?: number }) : { usedCount: 0 };
    const currentBudget = buildAutoScanBudgetFromUsage(current.usedCount, dailyLimit);
    const allowed = currentBudget.remainingCount >= count;

    // Always clamp and persist — even on denial — so repeated over-requests
    // cannot dodge the limit by requesting more than what remains each time.
    const nextUsed = Math.min(dailyLimit, currentBudget.usedCount + count);
    await AsyncStorage.setItem(key, JSON.stringify({ usedCount: nextUsed }));
    return {
      allowed,
      budget: buildAutoScanBudgetFromUsage(nextUsed, dailyLimit),
    };
  });
}

export async function loadAutoScanBudget(tier?: string | null, userId?: string | null): Promise<ImageBudget> {
  if (!userId) {
    return loadLocalAutoScanBudget(tier, userId);
  }
  try {
    const serverBudget = await getServerAutoScanBudget(tier);
    if (serverBudget) return serverBudget;
  } catch (error) {
    console.warn('[AutoScanBudget] Server load failed, using local fallback:', error);
    reportAuthorityFallback('load_server_failed', tier);
  }
  return loadLocalAutoScanBudget(tier, userId);
}

export async function trackAutoScanUsage(
  tier?: string | null,
  count: number = 1,
  userId?: string | null,
): Promise<void> {
  try {
    await consumeAutoScanBudget(tier, count, userId);
  } catch (error) {
    console.error('[AutoScanBudget] Failed to track usage:', error);
  }
}

export async function hasAutoScanBudget(
  tier?: string | null,
  requiredCount: number = 1,
  userId?: string | null,
): Promise<boolean> {
  const budget = await loadAutoScanBudget(tier, userId);
  return budget.remainingCount >= requiredCount;
}

export interface AutoScanConsumeResult {
  allowed: boolean;
  budget: ImageBudget;
}

export async function consumeAutoScanBudget(
  tier?: string | null,
  count: number = 1,
  userId?: string | null,
): Promise<AutoScanConsumeResult> {
  if (!userId) {
    return consumeLocalAutoScanBudget(tier, count, userId);
  }
  try {
    const serverResult = await consumeServerAutoScanBudget(tier, count);
    if (serverResult) return serverResult;
  } catch (error) {
    console.warn('[AutoScanBudget] Server consume failed, using local fallback:', error);
    reportAuthorityFallback('consume_server_failed', tier);
  }
  return consumeLocalAutoScanBudget(tier, count, userId);
}

/**
 * Load current image budget for today
 */
export async function loadImageBudget(): Promise<ImageBudget> {
  try {
    const raw = await AsyncStorage.getItem(buildImageBudgetKey());
    if (!raw) {
      return {
        remainingCount: FREE_IMAGE_BUDGET_PER_DAY,
        usedCount: 0,
        totalCount: FREE_IMAGE_BUDGET_PER_DAY,
        percentUsed: 0,
      };
    }

    const parsed = JSON.parse(raw) as { usedCount?: number };
    const usedCount = typeof parsed.usedCount === 'number' ? parsed.usedCount : 0;
    const remainingCount = Math.max(0, FREE_IMAGE_BUDGET_PER_DAY - usedCount);

    return {
      remainingCount,
      usedCount,
      totalCount: FREE_IMAGE_BUDGET_PER_DAY,
      percentUsed: (usedCount / FREE_IMAGE_BUDGET_PER_DAY) * 100,
    };
  } catch (error) {
    console.error('[ImageBudget] Failed to load:', error);
    return {
      remainingCount: FREE_IMAGE_BUDGET_PER_DAY,
      usedCount: 0,
      totalCount: FREE_IMAGE_BUDGET_PER_DAY,
      percentUsed: 0,
    };
  }
}

/**
 * Track image upload usage (only for free tier)
 */
export async function trackImageUsage(count: number = 1): Promise<void> {
  try {
    if (count <= 0) return;
    const key = buildImageBudgetKey();
    const raw = await AsyncStorage.getItem(key);
    const current = raw ? (JSON.parse(raw) as { usedCount?: number }) : { usedCount: 0 };
    const newUsedCount = (current.usedCount || 0) + count;

    await AsyncStorage.setItem(key, JSON.stringify({ usedCount: newUsedCount }));
  } catch (error) {
    console.error('[ImageBudget] Failed to track usage:', error);
  }
}

/**
 * Check if user has image budget remaining
 */
export async function hasImageBudget(requiredCount: number = 1): Promise<boolean> {
  const budget = await loadImageBudget();
  return budget.remainingCount >= requiredCount;
}

/**
 * Reset image budget (for testing or admin purposes)
 */
export async function resetImageBudget(): Promise<void> {
  try {
    const key = buildImageBudgetKey();
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.error('[ImageBudget] Failed to reset:', error);
  }
}

