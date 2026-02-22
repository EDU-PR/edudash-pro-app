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

function getTodayKey(): string {
  return new Date().toISOString().split('T')[0];
}

function buildImageBudgetKey(dayKey?: string): string {
  return `${FREE_IMAGE_BUDGET_KEY_PREFIX}${dayKey || getTodayKey()}`;
}

function buildAutoScanBudgetKey(dayKey?: string): string {
  return `${AUTO_SCAN_BUDGET_KEY_PREFIX}${dayKey || getTodayKey()}`;
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

export async function loadAutoScanBudget(tier?: string | null): Promise<ImageBudget> {
  const dailyLimit = resolveAutoScanDailyLimit(tier);
  try {
    const raw = await AsyncStorage.getItem(buildAutoScanBudgetKey());
    if (!raw) {
      return {
        remainingCount: dailyLimit,
        usedCount: 0,
        totalCount: dailyLimit,
        percentUsed: 0,
      };
    }
    const parsed = JSON.parse(raw) as { usedCount?: number };
    const usedCount = typeof parsed.usedCount === 'number' ? parsed.usedCount : 0;
    const remainingCount = Math.max(0, dailyLimit - usedCount);
    return {
      remainingCount,
      usedCount,
      totalCount: dailyLimit,
      percentUsed: (usedCount / dailyLimit) * 100,
    };
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

export async function trackAutoScanUsage(tier?: string | null, count: number = 1): Promise<void> {
  try {
    if (count <= 0) return;
    const key = buildAutoScanBudgetKey();
    const raw = await AsyncStorage.getItem(key);
    const current = raw ? (JSON.parse(raw) as { usedCount?: number }) : { usedCount: 0 };
    const dailyLimit = resolveAutoScanDailyLimit(tier);
    const nextCount = Math.max(0, Math.min(dailyLimit, (current.usedCount || 0) + count));
    await AsyncStorage.setItem(key, JSON.stringify({ usedCount: nextCount }));
  } catch (error) {
    console.error('[AutoScanBudget] Failed to track usage:', error);
  }
}

export async function hasAutoScanBudget(tier?: string | null, requiredCount: number = 1): Promise<boolean> {
  const budget = await loadAutoScanBudget(tier);
  return budget.remainingCount >= requiredCount;
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
