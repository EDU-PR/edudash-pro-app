/**
 * Greeting Manager — Once-per-day, dynamic, role-aware greetings for Dash
 *
 * Ensures the AI greeting is shown only once per calendar day per user.
 * Generates contextual greetings based on:
 * - Time of day (morning/afternoon/evening)
 * - User role
 * - Day of week (Monday motivation, Friday wrap-up, etc.)
 * - Locale/language
 * - User's name
 * - Organization type
 *
 * ≤200 lines (WARP.md hook limit)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Storage key ─────────────────────────────────────────────────────

const GREETING_KEY = '@dash_greeting_date';

// ── Types ───────────────────────────────────────────────────────────

export interface GreetingContext {
  userName?: string | null;
  role?: string | null;
  orgType?: string | null;
  /** ISO language code e.g. 'en', 'af', 'zu' */
  language?: string | null;
}

// ── Guard: once per day ─────────────────────────────────────────────

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Returns true if Dash has NOT yet greeted today. If true, marks today as greeted.
 * Subsequent calls on the same calendar day return false.
 */
export async function shouldGreetToday(userId?: string): Promise<boolean> {
  try {
    const key = userId ? `${GREETING_KEY}_${userId}` : GREETING_KEY;
    const stored = await AsyncStorage.getItem(key);
    const today = todayKey();
    if (stored === today) return false;
    await AsyncStorage.setItem(key, today);
    return true;
  } catch {
    // If storage fails, greet anyway — better UX than silence
    return true;
  }
}

/**
 * Reset greeting state (for testing or manual trigger).
 */
export async function resetGreetingState(userId?: string): Promise<void> {
  const key = userId ? `${GREETING_KEY}_${userId}` : GREETING_KEY;
  await AsyncStorage.removeItem(key).catch(() => {});
}

// ── Time of day ─────────────────────────────────────────────────────

type TimeOfDay = 'morning' | 'afternoon' | 'evening';

function getTimeOfDay(): TimeOfDay {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

// ── Day-of-week flavor ──────────────────────────────────────────────

function getDayFlavor(): string | null {
  const day = new Date().getDay();
  const flavors: Record<number, string> = {
    1: 'Fresh start to the week',
    3: 'Halfway through — keep going',
    5: 'Almost weekend — let\'s finish strong',
  };
  return flavors[day] || null;
}

// ── Role context ────────────────────────────────────────────────────

function getRolePurpose(role: string): string {
  switch (role) {
    case 'super_admin':
    case 'admin':
      return 'Ready to help manage the platform';
    case 'user':
    case 'guest':
      return 'Ready when you are';
    case 'principal':
    case 'principal_admin':
      return 'Here to support your school';
    case 'teacher':
      return 'Let\'s make today\'s lessons count';
    case 'parent':
      return 'Here to help with your child\'s learning';
    case 'student':
    case 'learner':
      return 'Ready to learn something awesome together';
    default:
      return 'How can I help you today';
  }
}

// ── Greeting builder ────────────────────────────────────────────────

const TIME_LABELS: Record<string, Record<TimeOfDay, string>> = {
  en: { morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening' },
  af: { morning: 'Goeie môre', afternoon: 'Goeiemiddag', evening: 'Goeienaand' },
  zu: { morning: 'Sawubona ekuseni', afternoon: 'Sawubona ntambama', evening: 'Sawubona kusihlwa' },
  st: { morning: 'Dumela hoseng', afternoon: 'Dumela motsheare', evening: 'Dumela mantsiboea' },
  nso: { morning: 'Thobela gosasa', afternoon: 'Thobela mosegare', evening: 'Thobela bosigo' },
  fr: { morning: 'Bonjour', afternoon: 'Bon après-midi', evening: 'Bonsoir' },
  pt: { morning: 'Bom dia', afternoon: 'Boa tarde', evening: 'Boa noite' },
  es: { morning: 'Buenos días', afternoon: 'Buenas tardes', evening: 'Buenas noches' },
  de: { morning: 'Guten Morgen', afternoon: 'Guten Tag', evening: 'Guten Abend' },
};

/**
 * Build a dynamic, contextual greeting string.
 * Never returns the same generic text — it always reflects the current
 * time, day, role, language, and user name.
 */
export function buildDynamicGreeting(ctx: GreetingContext): string {
  const tod = getTimeOfDay();
  const lang = (ctx.language || 'en').toLowerCase().slice(0, 2);
  const labels = TIME_LABELS[lang] || TIME_LABELS.en;
  const timeGreet = labels[tod];

  const name = ctx.userName?.trim();
  const role = (ctx.role || 'user').toLowerCase();
  const purpose = getRolePurpose(role);
  const dayNote = getDayFlavor();

  // Build the greeting parts
  const parts: string[] = [];

  // Time-of-day + name
  parts.push(name ? `${timeGreet}, ${name}!` : `${timeGreet}!`);

  // Day flavor (Mon/Wed/Fri only — not redundant)
  if (dayNote) {
    parts.push(`${dayNote}.`);
  }

  // Role purpose
  parts.push(`${purpose}.`);

  return parts.join(' ');
}

/**
 * Build the AI directive for generating a richer greeting.
 * This is sent as context (NOT as a user message) so the AI
 * can produce a natural, non-generic greeting.
 */
export function buildGreetingDirective(ctx: GreetingContext): string {
  const tod = getTimeOfDay();
  const name = ctx.userName?.trim();
  const role = (ctx.role || 'user').toLowerCase();
  const day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];

  const parts = [
    `Greet the user warmly in one sentence.`,
    `It is ${tod} on ${day}.`,
    name ? `Their name is ${name}.` : null,
    `Their role is ${role}.`,
    ctx.orgType ? `Organization type: ${ctx.orgType}.` : null,
    `Don't be generic. Reference the time or day naturally.`,
    `Keep it warm, brief, and end with a very short question about how you can help.`,
    ctx.language && ctx.language !== 'en'
      ? `Respond in the user's preferred language (${ctx.language}).`
      : null,
  ];

  return parts.filter(Boolean).join(' ');
}
