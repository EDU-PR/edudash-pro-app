import type { TutorSession } from '@/hooks/dash-assistant/tutorTypes';
import { logger } from '@/lib/logger';
import { assertSupabase } from '@/lib/supabase';

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface TutorSessionRecord {
  session_id: string;
  user_id: string;
  student_id: string | null;
  preschool_id: string | null;
  mode: TutorSession['mode'];
  subject: string | null;
  grade: string | null;
  topic: string | null;
  difficulty: number;
  questions_asked: number;
  correct_count: number;
  score: number | null;
  started_at: string;
  ended_at: string | null;
  state: Record<string, unknown>;
  curriculum_alignment: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TutorSessionStateEnvelope {
  session: TutorSession;
  conversationId: string | null;
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export const isUuid = (value?: string | null): boolean => UUID_V4_REGEX.test(String(value || '').trim());

function randomHex(bytes: number): string {
  let out = '';
  for (let i = 0; i < bytes; i += 1) {
    out += Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
  }
  return out;
}

export function createTutorSessionId(): string {
  try {
    if (typeof globalThis?.crypto?.randomUUID === 'function') {
      return globalThis.crypto.randomUUID();
    }
  } catch {
    // Fallback to pseudo UUID if runtime randomUUID isn't available.
  }

  const part1 = randomHex(4);
  const part2 = randomHex(2);
  const part3 = `4${randomHex(2).slice(1)}`;
  const variantNibble = (8 + Math.floor(Math.random() * 4)).toString(16);
  const part4 = `${variantNibble}${randomHex(2).slice(1)}`;
  const part5 = randomHex(6);
  return `${part1}-${part2}-${part3}-${part4}-${part5}`;
}

export function calculateTutorScore(session: TutorSession): number | null {
  const total = Number(session.totalQuestions || 0);
  if (!Number.isFinite(total) || total <= 0) return null;
  const correct = Number(session.correctCount || 0);
  if (!Number.isFinite(correct) || correct < 0) return null;
  return Number(((correct / total) * 100).toFixed(2));
}

export async function upsertTutorSessionRecord(params: {
  userId: string;
  session: TutorSession;
  conversationId?: string | null;
  preschoolId?: string | null;
  studentId?: string | null;
  curriculumAlignment?: Record<string, unknown> | null;
}): Promise<void> {
  const { userId, session, conversationId, preschoolId, studentId, curriculumAlignment } = params;
  if (!userId || !session?.id || !isUuid(session.id)) return;

  const supabase = assertSupabase();
  const payload = {
    session_id: session.id,
    user_id: userId,
    student_id: studentId || null,
    preschool_id: preschoolId || null,
    mode: session.mode,
    subject: session.subject || null,
    grade: session.grade || null,
    topic: session.topic || null,
    difficulty: clamp(Number(session.difficulty || 1), 1, 5),
    questions_asked: Math.max(0, Number(session.totalQuestions || 0)),
    correct_count: Math.max(0, Number(session.correctCount || 0)),
    score: calculateTutorScore(session),
    state: {
      session,
      conversation_id: conversationId || null,
    },
    curriculum_alignment: curriculumAlignment || {},
  };

  const { error } = await supabase
    .from('tutor_sessions')
    .upsert(payload, { onConflict: 'session_id' });

  if (error) {
    logger.warn('[TutorSessionService] upsertTutorSessionRecord failed', error);
    throw error;
  }
}

export async function completeTutorSessionRecord(params: {
  userId: string;
  session: TutorSession;
  conversationId?: string | null;
  preschoolId?: string | null;
  studentId?: string | null;
  curriculumAlignment?: Record<string, unknown> | null;
}): Promise<void> {
  const { userId, session, conversationId, preschoolId, studentId, curriculumAlignment } = params;
  if (!userId || !session?.id || !isUuid(session.id)) return;

  const supabase = assertSupabase();
  const payload = {
    student_id: studentId || null,
    preschool_id: preschoolId || null,
    mode: session.mode,
    subject: session.subject || null,
    grade: session.grade || null,
    topic: session.topic || null,
    difficulty: clamp(Number(session.difficulty || 1), 1, 5),
    questions_asked: Math.max(0, Number(session.totalQuestions || 0)),
    correct_count: Math.max(0, Number(session.correctCount || 0)),
    score: calculateTutorScore(session),
    state: {
      session,
      conversation_id: conversationId || null,
      completed: true,
    },
    curriculum_alignment: curriculumAlignment || {},
    ended_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('tutor_sessions')
    .update(payload)
    .eq('session_id', session.id)
    .eq('user_id', userId);

  if (error) {
    logger.warn('[TutorSessionService] completeTutorSessionRecord failed', error);
    throw error;
  }
}

export async function loadLatestActiveTutorSessionRecord(
  userId: string,
): Promise<TutorSessionRecord | null> {
  if (!userId) return null;
  const supabase = assertSupabase();

  const { data, error } = await supabase
    .from('tutor_sessions')
    .select('*')
    .eq('user_id', userId)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.warn('[TutorSessionService] loadLatestActiveTutorSessionRecord failed', error);
    return null;
  }

  return (data || null) as TutorSessionRecord | null;
}

function toStringOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function mapRecordToTutorSessionEnvelope(
  record: TutorSessionRecord,
): TutorSessionStateEnvelope | null {
  if (!record) return null;

  const rawState = (record.state && typeof record.state === 'object') ? record.state : {};
  const stateSession = (rawState as { session?: TutorSession }).session;
  const conversationIdFromState = toStringOrNull(
    (rawState as { conversation_id?: string }).conversation_id,
  );

  if (stateSession?.id) {
    return {
      session: stateSession,
      conversationId: conversationIdFromState,
    };
  }

  if (!isUuid(record.session_id)) return null;

  return {
    session: {
      id: record.session_id,
      mode: record.mode,
      subject: record.subject,
      grade: record.grade,
      topic: record.topic,
      awaitingAnswer: false,
      currentQuestion: null,
      expectedAnswer: null,
      questionIndex: 0,
      totalQuestions: Math.max(0, Number(record.questions_asked || 0)),
      correctCount: Math.max(0, Number(record.correct_count || 0)),
      maxQuestions: 5,
      difficulty: clamp(Number(record.difficulty || 1), 1, 5),
      incorrectStreak: 0,
      correctStreak: 0,
      attemptsOnQuestion: 0,
      phonicsMode: false,
      phonicsStage: null,
      phonicsMastered: [],
    },
    conversationId: conversationIdFromState,
  };
}
