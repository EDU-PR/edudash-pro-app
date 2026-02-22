/**
 * Image Budget Manager
 *
 * Manages free tier image upload budget (10 images per day).
 * Paid tiers have unlimited image uploads.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const FREE_IMAGE_BUDGET_PER_DAY = 10;
const FREE_IMAGE_BUDGET_KEY_PREFIX = '@dash_image_free_budget_';
export const FREE_AUTO_SCAN_BUDGET_PER_DAY = 3;
export const PAID_AUTO_SCAN_BUDGET_PER_DAY = 7;
const AUTO_SCAN_BUDGET_KEY_PREFIX = '@dash_auto_scan_budget_';
const AUTO_SCAN_ANONYMOUS_KEY = 'anonymous';
const autoScanLockTails = new Map<string, Promise<unknown>>();

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

export interface ImageBudget {
  remainingCount: number;
  usedCount: number;
  totalCount: number;
  percentUsed: number;
}

function resolveAutoScanDailyLimit(tier?: string | null): number {
  const normalized = String(tier || 'free').trim().toLowerCase();
  return normalized === 'free' ? FREE_AUTO_SCAN_BUDGET_PER_DAY : PAID_AUTO_SCAN_BUDGET_PER_DAY;
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
    })
  );
  return next;
}

function buildAutoScanBudgetFromUsage(usedCountRaw: unknown, dailyLimit: number): ImageBudget {
  const usedCount = typeof usedCountRaw === 'number' ? usedCountRaw : 0;
  const clampedUsedCount = Math.max(0, Math.min(dailyLimit, usedCount));
  const remainingCount = Math.max(0, dailyLimit - clampedUsedCount);
  return {
    remainingCount,
    usedCount: clampedUsedCount,
    totalCount: dailyLimit,
    percentUsed: (clampedUsedCount / dailyLimit) * 100,
  };
}

export async function loadAutoScanBudget(tier?: string | null, userId?: string | null): Promise<ImageBudget> {
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
    console.error('[AutoScanBudget] Failed to load:', error);
    return {
      remainingCount: dailyLimit,
      usedCount: 0,
      totalCount: dailyLimit,
      percentUsed: 0,
    };
  }
}

export async function trackAutoScanUsage(
  tier?: string | null,
  count: number = 1,
  userId?: string | null
): Promise<void> {
  try {
    if (count <= 0) return;
    const key = buildAutoScanBudgetKey(undefined, userId);
    const dailyLimit = resolveAutoScanDailyLimit(tier);
    await withAutoScanLock(key, async () => {
      const raw = await AsyncStorage.getItem(key);
      const current = raw ? (JSON.parse(raw) as { usedCount?: number }) : { usedCount: 0 };
      const nextCount = Math.max(0, Math.min(dailyLimit, (current.usedCount || 0) + count));
      await AsyncStorage.setItem(key, JSON.stringify({ usedCount: nextCount }));
    });
  } catch (error) {
    console.error('[AutoScanBudget] Failed to track usage:', error);
  }
}

export async function hasAutoScanBudget(
  tier?: string | null,
  requiredCount: number = 1,
  userId?: string | null
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
  userId?: string | null
): Promise<AutoScanConsumeResult> {
  const dailyLimit = resolveAutoScanDailyLimit(tier);
  const key = buildAutoScanBudgetKey(undefined, userId);

  return withAutoScanLock(key, async () => {
    if (count <= 0) {
      return {
        allowed: true,
        budget: await loadAutoScanBudget(tier, userId),
      };
    }

    const raw = await AsyncStorage.getItem(key);
    const current = raw ? (JSON.parse(raw) as { usedCount?: number }) : { usedCount: 0 };
    const currentBudget = buildAutoScanBudgetFromUsage(current.usedCount, dailyLimit);
    if (currentBudget.remainingCount < count) {
      return {
        allowed: false,
        budget: currentBudget,
      };
    }

    const nextUsed = Math.min(dailyLimit, currentBudget.usedCount + count);
    await AsyncStorage.setItem(key, JSON.stringify({ usedCount: nextUsed }));
    return {
      allowed: true,
      budget: buildAutoScanBudgetFromUsage(nextUsed, dailyLimit),
    };
  });
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
