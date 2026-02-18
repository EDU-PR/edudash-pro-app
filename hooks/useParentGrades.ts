/**
 * useParentGrades — fetches real graded homework data for parent's children
 *
 * Queries homework_submissions + homework_assignments to build:
 *   - Per-subject average grades
 *   - Overall average, trend data
 *   - Recent scores per subject
 *
 * ≤200 lines per WARP.md
 */

import { useState, useEffect, useCallback } from 'react';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';

export interface SubjectGrade {
  subject: string;
  grade: number;
  trend: 'up' | 'down' | 'stable';
  recentScore: number;
  count: number;
  childName?: string;
  childId?: string;
}

export interface GradesOverview {
  average: number;
  totalSubjects: number;
  improvement: number;
}

export interface ParentGradesData {
  overview: GradesOverview;
  subjects: SubjectGrade[];
  isEmpty: boolean;
}

export function useParentGrades() {
  const { user } = useAuth();
  const [data, setData] = useState<ParentGradesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGrades = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);

    try {
      const supabase = assertSupabase();

      // 1. Get parent's children
      const { data: children, error: childErr } = await supabase
        .from('students')
        .select('id, first_name, last_name')
        .eq('parent_id', user.id);

      if (childErr) throw childErr;
      if (!children?.length) {
        setData({ overview: { average: 0, totalSubjects: 0, improvement: 0 }, subjects: [], isEmpty: true });
        setLoading(false);
        return;
      }

      const childIds = children.map((c: any) => c.id);
      const childMap = new Map(children.map((c: any) => [c.id, `${c.first_name || ''} ${c.last_name || ''}`.trim()]));

      // 2. Fetch graded submissions with assignment info (last 90 days)
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90);

      const { data: submissions, error: subErr } = await supabase
        .from('homework_submissions')
        .select('id, student_id, grade, graded_at, homework_assignments!inner(title, subject)')
        .in('student_id', childIds)
        .not('grade', 'is', null)
        .gte('graded_at', cutoff.toISOString())
        .order('graded_at', { ascending: false })
        .limit(200);

      if (subErr) throw subErr;
      if (!submissions?.length) {
        setData({ overview: { average: 0, totalSubjects: 0, improvement: 0 }, subjects: [], isEmpty: true });
        setLoading(false);
        return;
      }

      // 3. Group by subject
      const subjectMap = new Map<string, { scores: number[]; childId: string; childName: string }>();

      for (const sub of submissions as any[]) {
        const assignment = sub.homework_assignments;
        const subject = assignment?.subject || assignment?.title?.split(':')[0]?.trim() || 'General';
        const key = `${sub.student_id}-${subject}`;

        if (!subjectMap.has(key)) {
          subjectMap.set(key, { scores: [], childId: sub.student_id, childName: childMap.get(sub.student_id) || 'Child' });
        }
        subjectMap.get(key)!.scores.push(sub.grade);
      }

      // 4. Build SubjectGrade[] with trends
      const subjects: SubjectGrade[] = [];
      for (const [key, val] of subjectMap) {
        const subject = key.split('-').slice(1).join('-');
        const avg = Math.round(val.scores.reduce((a, b) => a + b, 0) / val.scores.length);
        const recentScore = val.scores[0]; // already sorted by graded_at desc
        const half = Math.floor(val.scores.length / 2);
        let trend: 'up' | 'down' | 'stable' = 'stable';
        if (val.scores.length >= 2) {
          const recentAvg = val.scores.slice(0, Math.max(1, half)).reduce((a, b) => a + b, 0) / Math.max(1, half);
          const olderAvg = val.scores.slice(half).reduce((a, b) => a + b, 0) / Math.max(1, val.scores.length - half);
          if (recentAvg - olderAvg > 3) trend = 'up';
          else if (olderAvg - recentAvg > 3) trend = 'down';
        }

        subjects.push({
          subject,
          grade: avg,
          trend,
          recentScore,
          count: val.scores.length,
          childName: children.length > 1 ? val.childName : undefined,
          childId: val.childId,
        });
      }

      // Sort by subject name
      subjects.sort((a, b) => a.subject.localeCompare(b.subject));

      // 5. Overall stats
      const allScores = (submissions as any[]).map(s => s.grade);
      const average = Math.round(allScores.reduce((a: number, b: number) => a + b, 0) / allScores.length);

      // Month-over-month improvement
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recent = (submissions as any[]).filter(s => new Date(s.graded_at) >= thirtyDaysAgo).map(s => s.grade);
      const older = (submissions as any[]).filter(s => new Date(s.graded_at) < thirtyDaysAgo).map(s => s.grade);
      const recentAvg = recent.length ? recent.reduce((a: number, b: number) => a + b, 0) / recent.length : average;
      const olderAvg = older.length ? older.reduce((a: number, b: number) => a + b, 0) / older.length : average;
      const improvement = Math.round(recentAvg - olderAvg);

      setData({
        overview: { average, totalSubjects: subjects.length, improvement },
        subjects,
        isEmpty: false,
      });
    } catch (e: any) {
      logger.error('[useParentGrades] Fetch failed', { error: e?.message });
      setError(e?.message || 'Failed to load grades');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchGrades(); }, [fetchGrades]);

  return { data, loading, error, refresh: fetchGrades };
}
