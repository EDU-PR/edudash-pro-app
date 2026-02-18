import { isAIEnabled } from '@/lib/ai/aiConfig';
import { getDefaultModelIdForTier } from '@/lib/ai/modelForTier';
import { assertSupabase } from '../supabase'
import { track } from '../analytics'
import { getCurrentLanguage } from '../i18n'
import { GradingEngine } from './GradingEngine'

const AI_ENABLED = isAIEnabled();

/**
 * Convert app language code to proper locale for AI services
 * Prioritizes South African locales for supported SA languages
 */
function getAILocale(): string {
  const lang = getCurrentLanguage();
  
  // South African languages - use ZA locale
  const saLanguages: Record<string, string> = {
    'en': 'en-ZA',
    'af': 'af-ZA',
    'zu': 'zu-ZA',
    'xh': 'xh-ZA',
    'st': 'st-ZA',
    'tn': 'tn-ZA',
    'ss': 'ss-ZA',
    'nr': 'nr-ZA',
    've': 've-ZA',
    'ts': 'ts-ZA',
  };
  
  // Return SA locale if available, otherwise use generic language code
  return saLanguages[lang] || lang;
}

export class HomeworkService {
  static async gradeHomework(submissionId: string, submissionContent: string, assignmentTitle: string, gradeLevel: string, parentUserId?: string) {
    // Delegate to unified GradingEngine (handles AI call, DB persist, notification, analytics)
    const result = await GradingEngine.grade({
      submissionId,
      submissionContent,
      assignmentTitle,
      gradeLevel,
      parentUserId,
    })

    return {
      score: result.score,
      feedback: result.feedback,
      suggestions: result.suggestions,
      strengths: result.strengths,
      areasForImprovement: result.areasForImprovement,
      requiresManualReview: result.requiresReview,
      confidence: result.confidence,
      letterGrade: result.letterGrade,
    }
  }

  static async streamGradeHomework(
    submissionId: string,
    submissionContent: string,
    assignmentTitle: string,
    gradeLevel: string,
    handlers: {
      onDelta?: (chunk: string) => void
      onFinal?: (payload: { score: number; feedback: string; suggestions: string[]; strengths: string[]; areasForImprovement: string[] }) => void
      onError?: (err: { message: string; code?: string }) => void
    },
    options?: { model?: string; tier?: string }
  ): Promise<void> {
    try {
      if (!AI_ENABLED) {
        handlers.onError?.({ message: 'AI grading is not available. Please grade manually.', code: 'ai_disabled' })
        return
      }

      // Attempt secure server-side grading via Edge Function
      try {
        track('edudash.ai.grading.started', {})
        const { data, error } = await assertSupabase().functions.invoke('ai-proxy', {
          body: {
            scope: 'teacher',
            service_type: 'grading_assistance', // Valid service_type per DB constraint
            payload: {
              prompt: `Grade this homework submission.\n\nAssignment: ${assignmentTitle}\nGrade Level: ${gradeLevel}\n\nSubmission:\n${submissionContent}`,
              model: options?.model || getDefaultModelIdForTier(options?.tier ?? 'free'),
            },
            metadata: {
              assignment_title: assignmentTitle,
              grade_level: gradeLevel,
              locale: getAILocale(), // Dynamic locale based on user's language preference
              language: getCurrentLanguage(), // Raw language code for additional context
            }
          }
        })
        if (error) throw error

        const payload: any = data?.result || data || {}
        if (typeof payload.score !== 'number' || !payload.feedback) {
          throw new Error('AI grading returned incomplete result — retrying via fallback')
        }
        const score = payload.score
        const feedback = payload.feedback
        const strengths: string[] = Array.isArray(payload.strengths) ? payload.strengths : []
        const areasForImprovement: string[] = Array.isArray(payload.areasForImprovement) ? payload.areasForImprovement : []
        const suggestions: string[] = Array.isArray(payload.suggestions) ? payload.suggestions : []

        handlers.onFinal?.({ score, feedback, suggestions, strengths, areasForImprovement })
        track('edudash.ai.grading.completed', { score })

        try {
          await assertSupabase()
            .from('homework_submissions')
            .update({
              grade: Number(score),
              feedback: feedback,
              graded_at: new Date().toISOString(),
              graded_by: 'ai',
              status: 'reviewed'
            })
            .eq('id', submissionId)
        } catch (e) { if (__DEV__) console.debug('homework_submissions update failed', e); }
        return
      } catch (invokeError: any) {
        const msg = String(invokeError?.message || '')
        if (msg.toLowerCase().includes('rate') && (msg.includes('429') || msg.toLowerCase().includes('limit'))) {
          handlers.onError?.({ message: 'Rate limit reached. Please try again later.', code: 'rate_limited' })
          track('edudash.ai.grading.rate_limited', {})
          return
        }
        // Fallback to simulated streaming when server grading fails
      }

      // Fallback: retry via ai-gateway (different edge function) when ai-proxy fails
      try {
        track('edudash.ai.grading.fallback_started', {})
        const { data: fallbackData, error: fallbackError } = await assertSupabase().functions.invoke('ai-gateway', {
          body: {
            action: 'grading_assistance',
            submission: submissionContent,
            assignment_title: assignmentTitle,
            grade_level: gradeLevel,
            language: getCurrentLanguage(),
          }
        })
        if (fallbackError) throw fallbackError
        const fbPayload: any = fallbackData?.result || fallbackData || {}
        const score = typeof fbPayload.score === 'number' ? fbPayload.score : 70
        const feedback = fbPayload.feedback || 'Submission reviewed. See feedback below.'
        const strengths: string[] = Array.isArray(fbPayload.strengths) ? fbPayload.strengths : []
        const areasForImprovement: string[] = Array.isArray(fbPayload.areasForImprovement) ? fbPayload.areasForImprovement : []
        const suggestions: string[] = Array.isArray(fbPayload.suggestions) ? fbPayload.suggestions : []

        handlers.onFinal?.({ score, feedback, suggestions, strengths, areasForImprovement })
        track('edudash.ai.grading.completed_fallback', { score })

        try {
          await assertSupabase()
            .from('homework_submissions')
            .update({
              grade: Number(score),
              feedback: feedback,
              graded_at: new Date().toISOString(),
              graded_by: 'ai',
              status: 'reviewed'
            })
            .eq('id', submissionId)
        } catch { /* noop */ void 0; }
      } catch (e: any) {
        handlers.onError?.({ message: e?.message || 'Grading failed. Please try again or grade manually.' })
      }
    } catch (outerErr: unknown) {
      handlers.onError?.({ message: String(outerErr) || 'Unexpected grading error.' })
    }
  }
}
