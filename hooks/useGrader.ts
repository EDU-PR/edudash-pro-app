import { useCallback, useRef, useState } from 'react';
import { assertSupabase } from '@/lib/supabase';
import { isAIEnabled } from '@/lib/ai/aiConfig';

export type GraderOptions = {
  submissionText: string;
  rubric?: string[];
  gradeLevel?: number;
  language?: string;
};

export type GraderCallOptions = {
  model?: string;
  streaming?: boolean;
  onDelta?: (chunk: string) => void;
  onFinal?: (summary: { score?: number; feedback: string; suggestions?: string[]; strengths?: string[]; areasForImprovement?: string[] }) => void;
};

export function useGrader() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const abortRef = useRef<AbortController | null>(null);

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

      const basePayload: any = {
        submission: opts.submissionText,
        rubric: opts.rubric || [],
        gradeLevel: opts.gradeLevel || null,
        language: opts.language || 'en',
        model: callOpts?.model || 'claude-sonnet-4-20250514',
      };

      if (callOpts?.streaming) {
        // Streaming via direct fetch to Supabase function endpoint
        const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
        const url = `${SUPABASE_URL}/functions/v1/ai-gateway`;
        const { data: { session } } = await assertSupabase().auth.getSession();
        const token = session?.access_token || '';
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'Accept': 'text/event-stream',
          },
          body: JSON.stringify({ action: 'grading_assistance_stream', ...basePayload }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Streaming request failed: ${res.status}`);
        // If streaming not supported in this environment, fall back to non-stream
        if (!res.body || !(res.body as any).getReader) {
          const { data, error } = await assertSupabase().functions.invoke('ai-gateway', { body: { action: 'grading_assistance', ...basePayload } as any });
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
        const { data, error } = await assertSupabase().functions.invoke('ai-gateway', { body: { action: 'grading_assistance', ...basePayload } as any });
        if (error) throw error;
        const text: string = (data && data.content) || '';
        const parsed = { text, __fallbackUsed: !!(data && (data as any).provider_error) };
        setResult(parsed);
        callOpts?.onFinal?.({ feedback: text });
        return text;
      }
      } catch (e: any) {
      if (e?.name === 'AbortError') {
        setError('Grading cancelled');
        return '';
      }
      // Fallback to Dash assistant
      try {
        const { getAssistant } = await import('@/services/core/getAssistant');
        const dash = await getAssistant();
        await dash.initialize?.();
        if (!dash.getCurrentConversationId?.()) {
          await dash.startNewConversation?.('AI Grader');
        }
        const prompt = `Provide constructive feedback and a concise score (0-100) for the following student submission.\nGrade Level: ${opts.gradeLevel || 'N/A'}\nRubric: ${(opts.rubric || []).join(', ') || 'accuracy, completeness, clarity'}\nSubmission:\n${opts.submissionText}`;
        const response = await dash.sendMessage(prompt);
        const text = response.content || '';
        setResult({ text, __fallbackUsed: true });
        callOpts?.onFinal?.({ feedback: text });
        return text;
      } catch {
        setError(e?.message || 'Failed to grade submission');
        throw e;
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }, [cancel]);

  return { loading, error, result, grade, cancel } as const;
}
