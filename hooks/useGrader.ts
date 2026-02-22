import { useCallback, useRef, useState } from 'react';
import { assertSupabase } from '@/lib/supabase';
import { isAIEnabled } from '@/lib/ai/aiConfig';
import { getDefaultModelIdForTier } from '@/lib/ai/modelForTier';
import { getCurrentLanguage } from '@/lib/i18n';
import { useSubscription } from '@/contexts/SubscriptionContext';

export type GraderOptions = {
  submissionText: string;
  assignmentTitle?: string;
  rubric?: string[];
  gradeLevel?: number | string;
  language?: string;
};

export type GraderCallOptions = {
  model?: string;
  streaming?: boolean;
  onDelta?: (chunk: string) => void;
  onFinal?: (summary: { score?: number; feedback: string; suggestions?: string[]; strengths?: string[]; areasForImprovement?: string[] }) => void;
};

export function useGrader() {
  const { tier } = useSubscription();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const defaultModel = getDefaultModelIdForTier(tier ?? 'free');

  /** Cancel any in-flight grading request */
  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const grade = useCallback(async (opts: GraderOptions, callOpts?: GraderCallOptions) => {
    // Cancel previous request if still in-flight
    cancel();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setResult(null);
    try {
      if (!isAIEnabled()) {
        const fallback = { score: 75, feedback: 'AI grading is currently disabled. Please enable AI features to use this tool.' };
        setResult(fallback);
        callOpts?.onFinal?.(fallback);
        return fallback.feedback;
      }

      // Build a proper grading prompt so the AI knows exactly what to do
      const rubricList = (opts.rubric && opts.rubric.length > 0)
        ? opts.rubric.join(', ')
        : 'accuracy, completeness, effort, understanding';
      const gradeLevelStr = opts.gradeLevel ? String(opts.gradeLevel) : 'not specified';
      const assignmentStr = opts.assignmentTitle || 'homework submission';
      const lang = opts.language || getCurrentLanguage() || 'en';

      const gradingPrompt = [
        'You are an experienced South African teacher. Grade this student submission.',
        `Assignment: ${assignmentStr}`,
        `Grade level: ${gradeLevelStr}`,
        `Rubric criteria: ${rubricList}`,
        `Respond in language: ${lang}`,
        '',
        'Student submission:',
        opts.submissionText,
        '',
        'Respond with ONLY valid JSON (no markdown fences):',
        '{',
        '  "score": <number 0-100>,',
        '  "feedback": "<constructive age-appropriate feedback>",',
        '  "strengths": ["<what the learner did well>"],',
        '  "areasForImprovement": ["<areas to work on>"],',
        '  "suggestions": ["<actionable next steps>"]',
        '}',
      ].join('\n');

      if (callOpts?.streaming) {
        // Streaming via direct fetch to ai-proxy
        const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
        const url = `${SUPABASE_URL}/functions/v1/ai-proxy`;
        const { data: { session } } = await assertSupabase().auth.getSession();
        const token = session?.access_token || '';
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'Accept': 'text/event-stream',
          },
          body: JSON.stringify({
            scope: 'teacher',
            service_type: 'grading_assistance',
            stream: true,
            payload: {
              prompt: gradingPrompt,
              model: callOpts?.model || defaultModel,
            },
            metadata: {
              assignment_title: assignmentStr,
              grade_level: gradeLevelStr,
              locale: lang,
            },
          }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Streaming request failed: ${res.status}`);
        // If streaming not supported in this environment, fall back to non-stream
        if (!res.body || !(res.body as any).getReader) {
          const { data, error } = await assertSupabase().functions.invoke('ai-proxy', {
            body: {
              scope: 'teacher',
              service_type: 'grading_assistance',
              payload: { prompt: gradingPrompt, model: callOpts?.model || defaultModel },
              metadata: { assignment_title: assignmentStr, grade_level: gradeLevelStr },
            } as any,
          });
          if (error) throw error;
          const text: string = (data && data.content) || '';
          setResult({ text, __fallbackUsed: !!(data && (data as any).provider_error) });
          callOpts?.onFinal?.({ feedback: text });
          return text;
        }
        const reader = (res.body as any).getReader();
        const decoder = new TextDecoder('utf-8');
        let done = false; let buffer = '';
        let accumulatedContent = '';
        while (!done) {
          if (controller.signal.aborted) break;
          const chunk = await reader.read();
          done = chunk.done;
          if (chunk.value) {
            const text = decoder.decode(chunk.value, { stream: true });
            buffer += text;
            // naive SSE parse: split on two newlines
            const parts = buffer.split('\n\n');
            buffer = parts.pop() || '';
            for (const p of parts) {
              const line = p.trim();
              if (line.startsWith('data:')) {
                const payload = line.slice(5).trim();
                if (payload === '[DONE]') {
                  // Parse accumulated content for final structured result
                  let finalResult: any = { feedback: accumulatedContent };
                  try {
                    const parsed = JSON.parse(accumulatedContent);
                    finalResult = {
                      score: typeof parsed.score === 'number' ? parsed.score : undefined,
                      feedback: parsed.feedback || accumulatedContent,
                      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : undefined,
                      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : undefined,
                      areasForImprovement: Array.isArray(parsed.areasForImprovement) ? parsed.areasForImprovement : undefined,
                    };
                  } catch {
                    // Content wasn't JSON — use as plain text feedback
                  }
                  setResult(finalResult);
                  callOpts?.onFinal?.(finalResult);
                } else {
                  accumulatedContent += payload;
                  callOpts?.onDelta?.(payload);
                }
              }
            }
          }
        }
        return accumulatedContent;
      } else {
        const { data, error } = await assertSupabase().functions.invoke('ai-proxy', {
          body: {
            scope: 'teacher',
            service_type: 'grading_assistance',
            payload: { prompt: gradingPrompt, model: callOpts?.model || defaultModel },
            metadata: { assignment_title: assignmentStr, grade_level: gradeLevelStr },
          } as any,
        });
        if (error) throw error;
        // ai-proxy returns { content, ... } or { result: { ... } }
        const raw: any = data?.result || data || {};
        let text: string;
        let finalResult: any;
        if (typeof raw === 'string') {
          text = raw;
          try {
            const p = JSON.parse(raw);
            finalResult = { score: p.score, feedback: p.feedback, suggestions: p.suggestions, strengths: p.strengths, areasForImprovement: p.areasForImprovement };
          } catch {
            finalResult = { feedback: raw };
          }
        } else if (typeof raw.content === 'string') {
          text = raw.content;
          try {
            const p = JSON.parse(raw.content);
            finalResult = { score: p.score, feedback: p.feedback, suggestions: p.suggestions, strengths: p.strengths, areasForImprovement: p.areasForImprovement };
          } catch {
            finalResult = { feedback: raw.content };
          }
        } else if (typeof raw.score === 'number') {
          finalResult = raw;
          text = JSON.stringify(raw);
        } else {
          text = JSON.stringify(raw);
          finalResult = { feedback: text };
        }
        setResult({ ...finalResult, __fallbackUsed: !!(data && (data as any).provider_error) });
        callOpts?.onFinal?.(finalResult);
        return text;
      }
      } catch (e: any) {
      if (e?.name === 'AbortError') {
        setError('Grading cancelled');
        return '';
      }
      setError(e?.message || 'Failed to grade submission');
      throw e;
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }, [cancel, defaultModel]);

  return { loading, error, result, grade, cancel } as const;
}
