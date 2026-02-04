/**
 * Voice Budget Manager
 * 
 * Manages free tier voice input budget (10 minutes per day).
 * Paid tiers have unlimited voice input.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const FREE_VOICE_BUDGET_MS = 10 * 60 * 1000; // 10 minutes
const FREE_VOICE_BUDGET_KEY_PREFIX = '@dash_voice_free_budget_';

function getTodayKey(): string {
  return new Date().toISOString().split('T')[0];
}

function buildVoiceBudgetKey(dayKey?: string): string {
  return `${FREE_VOICE_BUDGET_KEY_PREFIX}${dayKey || getTodayKey()}`;
}

export interface VoiceBudget {
  remainingMs: number;
  usedMs: number;
  totalMs: number;
  percentUsed: number;
}

/**
 * Load current voice budget for today
 */
export async function loadVoiceBudget(): Promise<VoiceBudget> {
  try {
    const raw = await AsyncStorage.getItem(buildVoiceBudgetKey());
    if (!raw) {
      return {
        remainingMs: FREE_VOICE_BUDGET_MS,
        usedMs: 0,
        totalMs: FREE_VOICE_BUDGET_MS,
        percentUsed: 0,
      };
    }

    const parsed = JSON.parse(raw) as { usedMs?: number };
    const usedMs = typeof parsed.usedMs === 'number' ? parsed.usedMs : 0;
    const remainingMs = Math.max(0, FREE_VOICE_BUDGET_MS - usedMs);

    return {
      remainingMs,
      usedMs,
      totalMs: FREE_VOICE_BUDGET_MS,
      percentUsed: (usedMs / FREE_VOICE_BUDGET_MS) * 100,
    };
  } catch (error) {
    console.error('[VoiceBudget] Failed to load:', error);
    return {
      remainingMs: FREE_VOICE_BUDGET_MS,
      usedMs: 0,
      totalMs: FREE_VOICE_BUDGET_MS,
      percentUsed: 0,
    };
  }
}

/**
 * Track voice input usage (only for free tier)
 */
export async function trackVoiceUsage(durationMs: number): Promise<void> {
  try {
    const key = buildVoiceBudgetKey();
    const raw = await AsyncStorage.getItem(key);
    const current = raw ? (JSON.parse(raw) as { usedMs?: number }) : { usedMs: 0 };
    const newUsedMs = (current.usedMs || 0) + durationMs;

    await AsyncStorage.setItem(key, JSON.stringify({ usedMs: newUsedMs }));
  } catch (error) {
    console.error('[VoiceBudget] Failed to track usage:', error);
  }
}

/**
 * Check if user has voice budget remaining
 */
export async function hasVoiceBudget(requiredMs: number = 1000): Promise<boolean> {
  const budget = await loadVoiceBudget();
  return budget.remainingMs >= requiredMs;
}

/**
 * Reset voice budget (for testing or admin purposes)
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
 * Get human-readable time remaining
 */
export function formatTimeRemaining(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}
