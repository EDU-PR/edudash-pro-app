import AsyncStorage from '@react-native-async-storage/async-storage';

export type LearningHubUsage = {
  date: string;
  lessonsUsed: number;
  activitiesUsed: number;
  aiHintsUsed: number;
};

const STORAGE_PREFIX = 'learning_hub_usage';

function todayKey(date = new Date()): string {
  return date.toISOString().split('T')[0];
}

function safeNumber(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

export async function getLearningHubUsage(userId?: string | null): Promise<LearningHubUsage> {
  const key = `${STORAGE_PREFIX}:${userId || 'anonymous'}`;
  try {
    const raw = await AsyncStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : null;
    const today = todayKey();

    if (!parsed || parsed.date !== today) {
      const fresh: LearningHubUsage = {
        date: today,
        lessonsUsed: 0,
        activitiesUsed: 0,
        aiHintsUsed: 0,
      };
      await AsyncStorage.setItem(key, JSON.stringify(fresh));
      return fresh;
    }

    return {
      date: parsed.date || today,
      lessonsUsed: safeNumber(parsed.lessonsUsed),
      activitiesUsed: safeNumber(parsed.activitiesUsed),
      aiHintsUsed: safeNumber(parsed.aiHintsUsed),
    };
  } catch {
    return {
      date: todayKey(),
      lessonsUsed: 0,
      activitiesUsed: 0,
      aiHintsUsed: 0,
    };
  }
}

export async function incrementLearningHubUsage(
  userId: string | null | undefined,
  updates: Partial<Pick<LearningHubUsage, 'lessonsUsed' | 'activitiesUsed' | 'aiHintsUsed'>>,
): Promise<LearningHubUsage> {
  const current = await getLearningHubUsage(userId);
  const next: LearningHubUsage = {
    ...current,
    lessonsUsed: current.lessonsUsed + safeNumber(updates.lessonsUsed),
    activitiesUsed: current.activitiesUsed + safeNumber(updates.activitiesUsed),
    aiHintsUsed: current.aiHintsUsed + safeNumber(updates.aiHintsUsed),
  };
  const key = `${STORAGE_PREFIX}:${userId || 'anonymous'}`;
  try {
    await AsyncStorage.setItem(key, JSON.stringify(next));
  } catch {
    // ignore storage failures
  }
  return next;
}
