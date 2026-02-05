/**
 * Image Budget Manager
 *
 * Manages free tier image upload budget (10 images per day).
 * Paid tiers have unlimited image uploads.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const FREE_IMAGE_BUDGET_PER_DAY = 10;
const FREE_IMAGE_BUDGET_KEY_PREFIX = '@dash_image_free_budget_';

function getTodayKey(): string {
  return new Date().toISOString().split('T')[0];
}

function buildImageBudgetKey(dayKey?: string): string {
  return `${FREE_IMAGE_BUDGET_KEY_PREFIX}${dayKey || getTodayKey()}`;
}

export interface ImageBudget {
  remainingCount: number;
  usedCount: number;
  totalCount: number;
  percentUsed: number;
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
