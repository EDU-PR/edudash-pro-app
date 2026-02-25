/**
 * learningStreakStore.ts
 *
 * Tracks daily learning streaks, session statistics, XP points, and daily goal
 * progress for the Dash Tutor feature.  Data is persisted locally via
 * AsyncStorage so it survives app restarts and works offline.
 *
 * All date comparisons use the Africa/Johannesburg timezone (SAST, UTC+2) so
 * a student's "day" boundary is midnight in their local timezone regardless
 * of the device's system clock setting.
 *
 * Storage key: `@dash_learning_stats`
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '@/lib/logger';

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = '@dash_learning_stats';
const TZ = 'Africa/Johannesburg';
const DEFAULT_DAILY_GOAL = 3;

const XP_PER_QUESTION = 10;
const XP_BONUS_CORRECT = 5;
const XP_BONUS_DAILY_GOAL = 50;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LearningStats {
  currentStreak: number;
  bestStreak: number;
  totalSessions: number;
  totalQuestions: number;
  totalCorrect: number;
  todaySessions: number;
  dailyGoal: number;
  xpTotal: number;
  xpToday: number;
  /** Mon (index 0) through Sun (index 6) — true if at least one session occurred that day this week */
  weekActivity: boolean[];
  /** ISO-8601 date string (YYYY-MM-DD) in SAST of the last recorded session */
  lastSessionDate: string;
}

// ─── Timezone-aware helpers ──────────────────────────────────────────────────

/**
 * Returns the current date string (YYYY-MM-DD) in Africa/Johannesburg.
 */
function todaySAST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
}

/**
 * Returns yesterday's date string (YYYY-MM-DD) in Africa/Johannesburg.
 */
function yesterdaySAST(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString('en-CA', { timeZone: TZ });
}

/**
 * Returns the ISO day-of-week index (0 = Mon … 6 = Sun) for the current
 * moment in SAST.
 */
function currentDayIndexSAST(): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'short',
  }).formatToParts(new Date());
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const map: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  return map[weekday] ?? 0;
}

/**
 * Returns the SAST date string (YYYY-MM-DD) for each day Mon–Sun of the
 * current week.
 */
function weekDatesSAST(): string[] {
  const todayIdx = currentDayIndexSAST();
  const now = new Date();
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - todayIdx + i);
    dates.push(d.toLocaleDateString('en-CA', { timeZone: TZ }));
  }
  return dates;
}

// ─── Default stats ───────────────────────────────────────────────────────────

function defaultStats(): LearningStats {
  return {
    currentStreak: 0,
    bestStreak: 0,
    totalSessions: 0,
    totalQuestions: 0,
    totalCorrect: 0,
    todaySessions: 0,
    dailyGoal: DEFAULT_DAILY_GOAL,
    xpTotal: 0,
    xpToday: 0,
    weekActivity: [false, false, false, false, false, false, false],
    lastSessionDate: '',
  };
}

// ─── Internal persistence ────────────────────────────────────────────────────

interface PersistedLearningStats extends LearningStats {
  /** Individual session-date strings (YYYY-MM-DD in SAST) used to rebuild weekActivity */
  _sessionDates?: string[];
}

async function readRaw(): Promise<PersistedLearningStats> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultStats(), _sessionDates: [] };
    const parsed: PersistedLearningStats = JSON.parse(raw);
    return { ...defaultStats(), ...parsed };
  } catch (err) {
    logger.warn('[learningStreakStore] readRaw failed', err);
    return { ...defaultStats(), _sessionDates: [] };
  }
}

async function writeRaw(data: PersistedLearningStats): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    logger.warn('[learningStreakStore] writeRaw failed', err);
  }
}

/**
 * Reconcile day-boundary transitions.  If the stored `lastSessionDate` is
 * from a previous day we need to:
 * - Reset `todaySessions` and `xpToday` to 0
 * - Check whether the streak should continue or break
 * - Recompute `weekActivity` from persisted `_sessionDates`
 */
function reconcile(stored: PersistedLearningStats): PersistedLearningStats {
  const today = todaySAST();
  const yesterday = yesterdaySAST();

  if (stored.lastSessionDate === today) {
    return stored;
  }

  const out = { ...stored };

  out.todaySessions = 0;
  out.xpToday = 0;

  if (out.lastSessionDate && out.lastSessionDate !== yesterday) {
    out.currentStreak = 0;
  }

  const weekDates = weekDatesSAST();
  const sessionSet = new Set(out._sessionDates ?? []);
  out.weekActivity = weekDates.map((d) => sessionSet.has(d));

  return out;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Retrieve the current learning statistics, reconciled for the current SAST
 * day.  Safe to call frequently — reads from AsyncStorage.
 */
export async function getLearningStats(): Promise<LearningStats> {
  const stored = await readRaw();
  const reconciled = reconcile(stored);

  if (reconciled !== stored) {
    await writeRaw(reconciled);
  }

  const {
    currentStreak,
    bestStreak,
    totalSessions,
    totalQuestions,
    totalCorrect,
    todaySessions,
    dailyGoal,
    xpTotal,
    xpToday,
    weekActivity,
    lastSessionDate,
  } = reconciled;

  return {
    currentStreak,
    bestStreak,
    totalSessions,
    totalQuestions,
    totalCorrect,
    todaySessions,
    dailyGoal,
    xpTotal,
    xpToday,
    weekActivity,
    lastSessionDate,
  };
}

/**
 * Record the completion of a tutor session.
 *
 * XP Calculation:
 * - 10 XP per question answered
 * - 5 XP bonus per correct answer
 * - 50 XP bonus when daily goal is first reached for the day
 *
 * Returns the updated stats after recording.
 */
export async function recordSessionComplete(session: {
  questionsAnswered: number;
  correctAnswers: number;
  mode: string;
  subject?: string;
}): Promise<LearningStats> {
  const stored = await readRaw();
  const data = reconcile(stored);
  const today = todaySAST();
  const yesterday = yesterdaySAST();

  const questionXP = session.questionsAnswered * XP_PER_QUESTION;
  const correctXP = session.correctAnswers * XP_BONUS_CORRECT;
  let bonusXP = 0;

  data.totalSessions += 1;
  data.totalQuestions += session.questionsAnswered;
  data.totalCorrect += session.correctAnswers;
  data.todaySessions += 1;

  const wasGoalMet = data.todaySessions - 1 >= data.dailyGoal;
  const isGoalNowMet = data.todaySessions >= data.dailyGoal;
  if (!wasGoalMet && isGoalNowMet) {
    bonusXP = XP_BONUS_DAILY_GOAL;
  }

  const earnedXP = questionXP + correctXP + bonusXP;
  data.xpTotal += earnedXP;
  data.xpToday += earnedXP;

  if (data.lastSessionDate !== today) {
    if (data.lastSessionDate === yesterday || data.lastSessionDate === '') {
      data.currentStreak += 1;
    } else {
      data.currentStreak = 1;
    }
  }

  if (data.currentStreak > data.bestStreak) {
    data.bestStreak = data.currentStreak;
  }

  data.lastSessionDate = today;

  const sessionDates = new Set(data._sessionDates ?? []);
  sessionDates.add(today);
  const cutoff = weekDatesSAST()[0];
  data._sessionDates = [...sessionDates].filter((d) => d >= cutoff);

  const weekDates = weekDatesSAST();
  data.weekActivity = weekDates.map((d) => sessionDates.has(d));

  await writeRaw(data);

  return getLearningStats();
}

/**
 * Change the daily session goal. Must be at least 1.
 */
export async function resetDailyGoal(goal: number): Promise<void> {
  const stored = await readRaw();
  stored.dailyGoal = Math.max(1, Math.round(goal));
  await writeRaw(stored);
}

/**
 * Returns a motivational streak message tailored to the learner's current
 * progress.
 */
export function getStreakMessage(stats: LearningStats): string {
  const { currentStreak, todaySessions, dailyGoal, bestStreak } = stats;

  if (todaySessions === 0) {
    if (currentStreak > 0) {
      return `You're on a ${currentStreak}-day streak! Start today's session to keep it going 🔥`;
    }
    return 'Start a session to begin your learning streak! 🚀';
  }

  if (todaySessions >= dailyGoal) {
    if (currentStreak >= bestStreak && currentStreak > 1) {
      return `New record! ${currentStreak}-day streak and daily goal smashed! 🏆`;
    }
    return `Daily goal reached! ${currentStreak}-day streak — you're on fire! 🔥`;
  }

  const remaining = dailyGoal - todaySessions;
  return `${remaining} more session${remaining === 1 ? '' : 's'} to hit your daily goal. Keep going! 💪`;
}
