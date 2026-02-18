/**
 * Unified Grading Engine
 *
 * Single entry point for all grading operations. Consolidates:
 *   - HomeworkService.gradeHomework() (ai-proxy path)
 *   - useGrader() hook (ai-gateway streaming path)
 *   - TeacherTools batch_grade (agent tool path)
 *
 * Adds: confidence scoring, auto-publish routing, parent notification,
 * unified grade storage, and analytics tracking.
 *
 * ≤500 lines per WARP.md
 */

import { assertSupabase } from '@/lib/supabase';
import { isAIEnabled } from '@/lib/ai/aiConfig';
import { getDefaultModelIdForTier } from '@/lib/ai/modelForTier';
import { track } from '@/lib/analytics';
import { getCurrentLanguage } from '@/lib/i18n';
import { logger } from '@/lib/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export type GradingApproach = 'percentage' | 'standard_10' | 'rubric' | 'competency';

export interface GradingInput {
  submissionId?: string;
  submissionContent: string;
  assignmentTitle: string;
  gradeLevel: string;
  studentId?: string;
  assignmentId?: string;
  /** Parent user ID — for sending notification */
  parentUserId?: string;
  /** Grading approach */
  approach?: GradingApproach;
  /** Optional rubric criteria */
  rubric?: string[];
  /** AI model override */
  model?: string;
  /** Subscription tier for default model when model not set */
  tier?: string;
}

export interface GradingResult {
  score: number | null;
  feedback: string;
  strengths: string[];
  areasForImprovement: string[];
  suggestions: string[];
  /** AI confidence in its grade (0-1). ≥0.85 auto-publishes */
  confidence: number;
  /** Whether a teacher must review before publishing */
  requiresReview: boolean;
  /** Letter grade derived from percentage */
  letterGrade: string;
}

export interface BatchGradingInput {
  assignmentId: string;
  rubric?: string;
  maxSubmissions?: number;
  model?: string;
  /** Subscription tier for default model when model not set */
  tier?: string;
}

export interface BatchGradingResult {
  graded: number;
  totalSubmissions: number;
  grades: Array<{
    submissionId: string;
    studentName: string;
    score: number;
    feedback: string;
    strengths: string[];
    areasToImprove: string[];
  }>;
  classSummary: {
    averageScore: number;
    commonMistakes: string[];
    recommendations: string[];
  };
}

// ─── Constants ───────────────────────────────────────────────────────────────

const AUTO_PUBLISH_CONFIDENCE = 0.85;
const REVIEW_THRESHOLD = 0.60;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getAILocale(): string {
  const lang = getCurrentLanguage();
  const sa: Record<string, string> = {
    en: 'en-ZA', af: 'af-ZA', zu: 'zu-ZA', xh: 'xh-ZA',
    st: 'st-ZA', tn: 'tn-ZA', ss: 'ss-ZA', nr: 'nr-ZA',
    ve: 've-ZA', ts: 'ts-ZA', nso: 'nso-ZA',
  };
  return sa[lang] || lang;
}

function toLetterGrade(pct: number): string {
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B+';
  if (pct >= 60) return 'B';
  if (pct >= 50) return 'C';
  if (pct >= 40) return 'D';
  return 'F';
}

/** Estimate AI confidence from the structure of the response */
function estimateConfidence(result: Partial<GradingResult>): number {
  let c = 0.5;
  if (typeof result.score === 'number' && result.score >= 0 && result.score <= 100) c += 0.2;
  if (result.feedback && result.feedback.length > 30) c += 0.1;
  if (result.strengths && result.strengths.length > 0) c += 0.05;
  if (result.areasForImprovement && result.areasForImprovement.length > 0) c += 0.05;
  if (result.suggestions && result.suggestions.length > 0) c += 0.05;
  return Math.min(1, c);
}

function buildPrompt(input: GradingInput): string {
  const ageMatch = String(input.gradeLevel || '').match(/(\d{1,2})/);
  const age = ageMatch ? Math.max(3, Math.min(12, parseInt(ageMatch[1], 10))) : 5;
  const rubricText = input.rubric?.length
    ? `Rubric criteria: ${input.rubric.join(', ')}`
    : 'Rubric: accuracy, completeness, effort, understanding';
  const approachText = input.approach === 'standard_10'
    ? 'Use a 1-10 scale (multiply by 10 for percentage).'
    : input.approach === 'competency'
      ? 'Use competency levels: mastered (90+), developing (60-89), beginning (below 60).'
      : 'Use percentage scoring (0-100).';

  return [
    `You are an experienced South African preschool/primary teacher. Grade this student submission.`,
    `Student age: ${age}. Grade level: ${input.gradeLevel}.`,
    `Assignment: ${input.assignmentTitle}`,
    rubricText,
    approachText,
    '',
    `Student's submission:`,
    input.submissionContent,
    '',
    `Respond with ONLY valid JSON:`,
    `{`,
    `  "score": <number 0-100>,`,
    `  "feedback": "<constructive feedback appropriate for age ${age}>",`,
    `  "strengths": ["<what they did well>"],`,
    `  "areasForImprovement": ["<areas to work on>"],`,
    `  "suggestions": ["<next steps for learning>"],`,
    `  "confidence": <number 0.0-1.0 indicating your confidence in the grade>`,
    `}`,
  ].join('\n');
}

// ─── Engine ──────────────────────────────────────────────────────────────────

export class GradingEngine {
  /**
   * Grade a single submission. This is the primary entry point.
   * Handles AI call, DB persistence, notification, and analytics.
   */
  static async grade(input: GradingInput): Promise<GradingResult> {
    const startMs = Date.now();
    track('edudash.ai.grading.started', {
      submissionId: input.submissionId,
      approach: input.approach || 'percentage',
    });

    if (!isAIEnabled()) {
      return {
        score: null,
        feedback: 'AI grading is not available. Please grade this submission manually.',
        strengths: [], areasForImprovement: [], suggestions: [],
        confidence: 0, requiresReview: true, letterGrade: '-',
      };
    }

    try {
      // 1. Call AI
      const prompt = buildPrompt(input);
      const model = input.model || getDefaultModelIdForTier(input.tier ?? 'free');
      const { data, error } = await assertSupabase().functions.invoke('ai-proxy', {
        body: {
          scope: 'teacher',
          service_type: 'grading_assistance',
          payload: { prompt, model },
          metadata: {
            assignment_title: input.assignmentTitle,
            grade_level: input.gradeLevel,
            locale: getAILocale(),
            language: getCurrentLanguage(),
          },
        },
      });
      if (error) throw error;

      // 2. Parse result
      const payload: any = data?.result || data || {};
      const score = typeof payload.score === 'number' ? Math.round(Math.min(100, Math.max(0, payload.score))) : null;
      const feedback: string = payload.feedback || 'Submission reviewed. Please verify the grade.';
      const strengths: string[] = Array.isArray(payload.strengths) ? payload.strengths : [];
      const areasForImprovement: string[] = Array.isArray(payload.areasForImprovement) ? payload.areasForImprovement : [];
      const suggestions: string[] = Array.isArray(payload.suggestions) ? payload.suggestions : [];
      const rawConfidence = typeof payload.confidence === 'number' ? payload.confidence : null;

      const result: GradingResult = {
        score,
        feedback,
        strengths,
        areasForImprovement,
        suggestions,
        confidence: rawConfidence ?? estimateConfidence({ score, feedback, strengths, areasForImprovement, suggestions }),
        requiresReview: score === null,
        letterGrade: score !== null ? toLetterGrade(score) : '-',
      };

      // 3. Determine auto-publish vs review
      if (result.confidence < REVIEW_THRESHOLD) {
        result.requiresReview = true;
      } else if (result.confidence >= AUTO_PUBLISH_CONFIDENCE && score !== null) {
        result.requiresReview = false;
      } else {
        result.requiresReview = true;
      }

      // 4. Persist to homework_submissions
      if (score !== null && input.submissionId) {
        await this.persistGrade(input.submissionId, result);
      }

      // 5. Send notification to parent
      if (score !== null && !result.requiresReview && input.parentUserId) {
        await this.notifyParent(input, result);
      }

      // 6. Analytics
      const durationMs = Date.now() - startMs;
      track('edudash.ai.grading.completed', {
        submissionId: input.submissionId,
        score,
        confidence: result.confidence,
        requiresReview: result.requiresReview,
        letterGrade: result.letterGrade,
        durationMs,
      });

      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('[GradingEngine] Grade failed', { error: msg, submissionId: input.submissionId });
      track('edudash.ai.grading.error', { submissionId: input.submissionId, error: msg });

      return {
        score: null,
        feedback: 'AI grading encountered an error. Please grade manually.',
        strengths: [], areasForImprovement: [], suggestions: [],
        confidence: 0, requiresReview: true, letterGrade: '-',
      };
    }
  }

  /**
   * Batch grade multiple submissions for an assignment.
   */
  static async batchGrade(input: BatchGradingInput): Promise<BatchGradingResult> {
    const supabase = assertSupabase();
    const maxSubs = Math.min(input.maxSubmissions || 10, 30);

    // Fetch ungraded submissions
    const { data: submissions, error: fetchErr } = await supabase
      .from('homework_submissions')
      .select('id, student_id, content, submitted_at, profiles!student_id(first_name, last_name)')
      .eq('homework_id', input.assignmentId)
      .is('score', null)
      .order('submitted_at', { ascending: true })
      .limit(maxSubs);

    if (fetchErr) throw fetchErr;
    if (!submissions?.length) {
      return { graded: 0, totalSubmissions: 0, grades: [], classSummary: { averageScore: 0, commonMistakes: [], recommendations: [] } };
    }

    // Build batch prompt
    const submissionBlock = submissions
      .map((s: any, i: number) => `--- Student ${i + 1} (${s.profiles?.first_name || 'Unknown'}) ---\n${s.content || '[empty]'}`)
      .join('\n\n');

    const prompt = [
      'You are an experienced South African teacher grading student work.',
      `Assignment ID: ${input.assignmentId}`,
      input.rubric ? `Rubric: ${input.rubric}` : 'Rubric: accuracy, completeness, effort',
      '',
      'Grade these submissions. Return ONLY valid JSON:',
      '{ "grades": [{ "student_index": 1, "score": 85, "feedback": "...", "strengths": ["..."], "areas_to_improve": ["..."] }],',
      '  "class_summary": { "average_score": 75, "common_mistakes": ["..."], "recommendations": ["..."] } }',
      '',
      'Submissions:',
      submissionBlock,
    ].join('\n');

    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token;
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ai-proxy`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          service_type: 'grading_assistance',
          payload: {
            prompt,
            model: input.model || getDefaultModelIdForTier(input.tier ?? 'free'),
          },
          max_tokens: 4096,
        }),
      },
    );

    if (!response.ok) throw new Error(`AI proxy returned ${response.status}`);
    const aiResult = await response.json();
    const content = aiResult?.content || aiResult?.text || '';

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    let parsed: any = {};
    if (jsonMatch) {
      try { parsed = JSON.parse(jsonMatch[0]); } catch { /* use raw */ }
    }

    const grades: BatchGradingResult['grades'] = [];

    // Save individual grades + send notifications
    if (parsed.grades && Array.isArray(parsed.grades)) {
      for (const grade of parsed.grades) {
        const idx = (grade.student_index || 1) - 1;
        const sub = submissions[idx] as any;
        if (!sub) continue;

        const score = Math.round(Math.min(100, Math.max(0, grade.score || 0)));
        await supabase
          .from('homework_submissions')
          .update({
            score,
            feedback: grade.feedback || '',
            graded_at: new Date().toISOString(),
            graded_by: 'ai',
            status: 'reviewed',
          })
          .eq('id', sub.id);

        grades.push({
          submissionId: sub.id,
          studentName: `${sub.profiles?.first_name || 'Unknown'} ${sub.profiles?.last_name || ''}`.trim(),
          score,
          feedback: grade.feedback || '',
          strengths: grade.strengths || [],
          areasToImprove: grade.areas_to_improve || [],
        });
      }
    }

    const avgScore = grades.length > 0
      ? Math.round(grades.reduce((s, g) => s + g.score, 0) / grades.length)
      : 0;

    track('edudash.ai.grading.batch_completed', {
      assignmentId: input.assignmentId,
      gradedCount: grades.length,
      avgScore,
    });

    return {
      graded: grades.length,
      totalSubmissions: submissions.length,
      grades,
      classSummary: {
        averageScore: parsed.class_summary?.average_score || avgScore,
        commonMistakes: parsed.class_summary?.common_mistakes || [],
        recommendations: parsed.class_summary?.recommendations || [],
      },
    };
  }

  /**
   * Publish a teacher-reviewed grade (for scores that needed review).
   * Persists final grade and sends parent notification.
   */
  static async publishReviewedGrade(
    submissionId: string,
    score: number,
    feedback: string,
    teacherId: string,
    parentUserId?: string,
    assignmentTitle?: string,
    studentName?: string,
  ): Promise<void> {
    const supabase = assertSupabase();
    await supabase
      .from('homework_submissions')
      .update({
        score: Math.round(score),
        feedback,
        graded_at: new Date().toISOString(),
        graded_by: teacherId,
        status: 'reviewed',
      })
      .eq('id', submissionId);

    if (parentUserId) {
      await this.notifyParent(
        { submissionContent: '', assignmentTitle: assignmentTitle || 'Homework', gradeLevel: '', parentUserId },
        { score, feedback, strengths: [], areasForImprovement: [], suggestions: [], confidence: 1, requiresReview: false, letterGrade: toLetterGrade(score) },
        studentName,
      );
    }

    track('edudash.ai.grading.teacher_published', { submissionId, score });
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private static async persistGrade(submissionId: string, result: GradingResult): Promise<void> {
    try {
      await assertSupabase()
        .from('homework_submissions')
        .update({
          grade: result.score,
          feedback: result.feedback,
          graded_at: new Date().toISOString(),
          graded_by: 'ai',
          status: result.requiresReview ? 'needs_review' : 'reviewed',
        })
        .eq('id', submissionId);
    } catch (e) {
      logger.error('[GradingEngine] persistGrade failed', { submissionId, error: e });
    }
  }

  private static async notifyParent(
    input: Pick<GradingInput, 'assignmentTitle' | 'parentUserId' | 'submissionContent' | 'gradeLevel'>,
    result: GradingResult,
    studentName?: string,
  ): Promise<void> {
    if (!input.parentUserId || result.score === null) return;
    try {
      const nameStr = studentName ? `${studentName}: ` : '';
      const title = `Grade posted: ${input.assignmentTitle}`;
      const body = `${nameStr}${result.score}% (${result.letterGrade}) — ${result.feedback.slice(0, 120)}`;

      await assertSupabase().from('in_app_notifications').insert({
        user_id: input.parentUserId,
        type: 'grade',
        title,
        body,
        data: {
          score: result.score,
          letter_grade: result.letterGrade,
          assignment_title: input.assignmentTitle,
          confidence: result.confidence,
        },
      });
    } catch (e) {
      logger.warn('[GradingEngine] notifyParent failed (non-critical)', { error: e });
    }
  }
}
