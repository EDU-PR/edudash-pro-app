/**
 * useClassTutorAnalytics
 *
 * Fetches aggregated tutor analytics for a teacher's class using the
 * `get_class_tutor_analytics` RPC. Returns per-student, per-subject
 * accuracy data for heatmap rendering, plus drilldown helper.
 *
 * ≤ 200 lines (WARP.md compliant)
 */

import { useState, useEffect, useCallback } from 'react';
import { assertSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TutorAnalyticsRow {
  student_id: string;
  student_name: string;
  subject: string;
  total_attempts: number;
  correct_count: number;
  accuracy_pct: number;
  avg_score: number;
  last_attempt_at: string;
  session_count: number;
  modes_used: string[];
}

export interface TutorSessionSummary {
  session_id: string;
  mode: string;
  subject: string;
  grade: string;
  topic: string;
  total_questions: number;
  correct_answers: number;
  accuracy_pct: number;
  started_at: string;
  ended_at: string;
}

export interface StudentHeatmapCell {
  studentId: string;
  studentName: string;
  subjects: Record<string, {
    accuracy: number;
    attempts: number;
    sessions: number;
    avgScore: number;
  }>;
  overallAccuracy: number;
  totalAttempts: number;
}

export interface ClassTutorAnalytics {
  heatmap: StudentHeatmapCell[];
  subjects: string[];
  totalStudentsWithData: number;
  classAccuracy: number;
}

// ─── Transform ───────────────────────────────────────────────────────────────

function buildHeatmap(rows: TutorAnalyticsRow[]): ClassTutorAnalytics {
  const subjectSet = new Set<string>();
  const studentMap = new Map<string, StudentHeatmapCell>();

  for (const row of rows) {
    subjectSet.add(row.subject);

    let cell = studentMap.get(row.student_id);
    if (!cell) {
      cell = {
        studentId: row.student_id,
        studentName: row.student_name,
        subjects: {},
        overallAccuracy: 0,
        totalAttempts: 0,
      };
      studentMap.set(row.student_id, cell);
    }

    cell.subjects[row.subject] = {
      accuracy: row.accuracy_pct ?? 0,
      attempts: row.total_attempts,
      sessions: row.session_count,
      avgScore: row.avg_score ?? 0,
    };
    cell.totalAttempts += row.total_attempts;
  }

  // Compute overall per-student accuracy
  for (const cell of studentMap.values()) {
    const entries = Object.values(cell.subjects);
    if (entries.length === 0) continue;
    const totalCorrect = entries.reduce((s, e) => s + Math.round(e.accuracy * e.attempts / 100), 0);
    cell.overallAccuracy = cell.totalAttempts > 0
      ? Math.round(1000 * totalCorrect / cell.totalAttempts) / 10
      : 0;
  }

  const heatmap = Array.from(studentMap.values()).sort((a, b) =>
    a.studentName.localeCompare(b.studentName),
  );

  const totalAttempts = heatmap.reduce((s, c) => s + c.totalAttempts, 0);
  const totalCorrect = rows.reduce((s, r) => s + r.correct_count, 0);
  const classAccuracy = totalAttempts > 0
    ? Math.round(1000 * totalCorrect / totalAttempts) / 10
    : 0;

  return {
    heatmap,
    subjects: Array.from(subjectSet).sort(),
    totalStudentsWithData: heatmap.length,
    classAccuracy,
  };
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useClassTutorAnalytics(classId: string | null, sinceDays = 30) {
  const [data, setData] = useState<ClassTutorAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!classId) { setData(null); return; }
    setLoading(true);
    setError(null);
    try {
      const since = new Date(Date.now() - sinceDays * 86_400_000).toISOString();
      const { data: rows, error: rpcError } = await assertSupabase()
        .rpc('get_class_tutor_analytics', { p_class_id: classId, p_since: since });

      if (rpcError) throw rpcError;
      setData(buildHeatmap((rows as TutorAnalyticsRow[]) ?? []));
    } catch (err: any) {
      logger.error('[useClassTutorAnalytics] fetch failed', err);
      setError(err?.message ?? 'Failed to load analytics');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [classId, sinceDays]);

  useEffect(() => { fetch(); }, [fetch]);

  const fetchStudentSessions = useCallback(async (studentId: string): Promise<TutorSessionSummary[]> => {
    try {
      const { data: rows, error: rpcError } = await assertSupabase()
        .rpc('get_student_tutor_sessions', { p_student_id: studentId });
      if (rpcError) throw rpcError;
      return (rows as TutorSessionSummary[]) ?? [];
    } catch (err: any) {
      logger.error('[useClassTutorAnalytics] student drilldown failed', err);
      return [];
    }
  }, []);

  return { data, loading, error, refetch: fetch, fetchStudentSessions };
}
