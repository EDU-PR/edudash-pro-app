/**
 * AI Analytics Tracking
 *
 * Centralized tracking events for the Dash AI teaching system.
 * Wraps lib/analytics.track() with typed AI-specific events.
 *
 * ≤200 lines per WARP.md
 */

import { track } from '@/lib/analytics';

// ─── Event helpers ───────────────────────────────────────────────────────────

/** Track tutor pipeline phase transitions */
export function trackTutorPhase(
  phase: string,
  subject?: string,
  topic?: string,
  grade?: string,
) {
  track('edudash.ai.tutor.phase_changed' as any, {
    phase,
    subject: subject || 'unknown',
    topic: topic || 'unknown',
    grade: grade || 'unknown',
    timestamp: Date.now(),
  });
}

/** Track quiz answer submissions */
export function trackQuizAnswer(
  correct: boolean,
  subject?: string,
  difficulty?: string,
  questionType?: string,
) {
  track('edudash.ai.quiz.answer_submitted' as any, {
    correct,
    subject: subject || 'unknown',
    difficulty: difficulty || 'unknown',
    question_type: questionType || 'multiple_choice',
  });
}

/** Track tutor session completion */
export function trackTutorSession(
  masteryPercent: number,
  totalQuestions: number,
  correctAnswers: number,
  durationMs: number,
  subject?: string,
) {
  track('edudash.ai.tutor.session_completed' as any, {
    mastery_percent: masteryPercent,
    total_questions: totalQuestions,
    correct_answers: correctAnswers,
    duration_ms: durationMs,
    subject: subject || 'unknown',
  });
}

/** Track tool execution */
export function trackToolExecution(
  toolName: string,
  success: boolean,
  durationMs: number,
) {
  track('edudash.ai.tool.executed' as any, {
    tool_name: toolName,
    success,
    duration_ms: durationMs,
  });
}

/** Track homework generation */
export function trackHomeworkGenerated(
  subject: string,
  grade: string,
  numQuestions: number,
  saved: boolean,
) {
  track('edudash.ai.homework.generated' as any, {
    subject,
    grade,
    num_questions: numQuestions,
    saved_to_db: saved,
  });
}

/** Track rewarded ad unlock */
export function trackRewardedUnlock(
  tag: string,
  success: boolean,
) {
  track('edudash.ai.reward.unlock' as any, {
    tag,
    success,
  });
}

/** Track teaching strategy generation */
export function trackStrategyGenerated(
  subject: string,
  grade: string,
  topic: string,
) {
  track('edudash.ai.strategy.generated' as any, {
    subject,
    grade,
    topic,
  });
}

/** Track batch grading */
export function trackBatchGrading(
  assignmentId: string,
  gradedCount: number,
  avgScore: number,
) {
  track('edudash.ai.grading.batch_completed' as any, {
    assignment_id: assignmentId,
    graded_count: gradedCount,
    avg_score: avgScore,
  });
}

/** Track single AI grade with confidence routing */
export function trackGradeCompleted(
  submissionId: string | undefined,
  score: number | null,
  confidence: number,
  requiresReview: boolean,
  letterGrade: string,
  durationMs: number,
) {
  track('edudash.ai.grading.engine_completed' as any, {
    submission_id: submissionId,
    score,
    confidence,
    requires_review: requiresReview,
    letter_grade: letterGrade,
    duration_ms: durationMs,
    auto_published: !requiresReview && confidence >= 0.85,
  });
}

/** Track teacher grade publish (after review) */
export function trackTeacherPublish(
  submissionId: string,
  score: number,
) {
  track('edudash.ai.grading.teacher_published' as any, {
    submission_id: submissionId,
    score,
  });
}

/** Track AI deep analysis */
export function trackDeepAnalysis(
  studentId: string,
  patternsFound: number,
) {
  track('edudash.ai.analysis.deep_completed' as any, {
    student_id: studentId,
    patterns_found: patternsFound,
  });
}
