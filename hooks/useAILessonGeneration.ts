/**
 * useAILessonGeneration - Custom hook for AI lesson generation logic
 * @module hooks/useAILessonGeneration
 */

import { useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';

import { assertSupabase } from '@/lib/supabase';
import { getFeatureFlagsSync } from '@/lib/featureFlags';
import { track } from '@/lib/analytics';
import { getCombinedUsage, incrementUsage, logUsageEvent, getUsage } from '@/lib/ai/usage';
import { canUseFeature, getQuotaStatus } from '@/lib/ai/limits';
import { toast } from '@/components/ui/ToastProvider';

interface GeneratedLesson {
  title: string;
  description: string;
  content: { sections: unknown[] };
  activities: unknown[];
}

interface UsageState {
  lesson_generation: number;
  grading_assistance: number;
  homework_help: number;
}

interface QuotaState {
  used: number;
  limit: number;
  remaining: number;
}

interface LessonParams {
  topic: string;
  subject: string;
  gradeLevel: string;
  duration: string;
  objectives: string;
  language: string;
  selectedModel: string | null;
}

interface UseAILessonGenerationReturn {
  generated: GeneratedLesson | null;
  setGenerated: React.Dispatch<React.SetStateAction<GeneratedLesson | null>>;
  pending: boolean;
  progress: number;
  progressMessage: string;
  errorMsg: string | null;
  lastPayload: Record<string, unknown> | null;
  usage: UsageState;
  quotaStatus: QuotaState | null;
  isQuotaExhausted: boolean;
  onGenerate: (params: LessonParams, payloadOverride?: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
  refreshUsage: () => Promise<void>;
}

export function useAILessonGeneration(): UseAILessonGenerationReturn {
  const [generated, setGenerated] = useState<GeneratedLesson | null>(null);
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastPayload, setLastPayload] = useState<Record<string, unknown> | null>(null);
  const [usage, setUsage] = useState<UsageState>({ lesson_generation: 0, grading_assistance: 0, homework_help: 0 });
  const [quotaStatus, setQuotaStatus] = useState<QuotaState | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [progressInterval, setProgressInterval] = useState<ReturnType<typeof setInterval> | null>(null);

  const flags = getFeatureFlagsSync();
  const AI_ENABLED = process.env.EXPO_PUBLIC_AI_ENABLED === 'true' || process.env.EXPO_PUBLIC_ENABLE_AI_FEATURES === 'true';
  const isQuotaExhausted = Boolean(quotaStatus && quotaStatus.limit !== -1 && quotaStatus.used >= quotaStatus.limit);

  // Load initial usage
  useEffect(() => {
    (async () => {
      setUsage(await getCombinedUsage());
      try {
        const s = await getQuotaStatus('lesson_generation');
        setQuotaStatus(s);
      } catch (err) {
        console.warn('[useAILessonGeneration] Failed to load quota:', err);
      }
    })();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortController) abortController.abort();
      if (progressInterval) clearInterval(progressInterval);
    };
  }, [abortController, progressInterval]);

  const refreshUsage = useCallback(async () => {
    setUsage(await getCombinedUsage());
    try {
      const s = await getQuotaStatus('lesson_generation');
      setQuotaStatus(s);
    } catch { /* non-fatal */ }
  }, []);

  const onCancel = useCallback(() => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
    if (progressInterval) {
      clearInterval(progressInterval);
      setProgressInterval(null);
    }
    setPending(false);
    setProgress(0);
    setProgressMessage('');
    setErrorMsg(null);
    toast.info('Generation cancelled');
    track('edudash.ai.lesson.generate_cancelled', {});
  }, [abortController, progressInterval]);

  const invokeWithTimeout = useCallback(async <T,>(p: Promise<T>, ms = 30000): Promise<T> => {
    return await Promise.race([
      p,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Request timed out after ${ms / 1000}s`)), ms)
      ),
    ]);
  }, []);

  const onGenerate = useCallback(async (params: LessonParams, payloadOverride?: Record<string, unknown>) => {
    const { topic, subject, gradeLevel, duration, objectives, language, selectedModel } = params;

    try {
      const controller = new AbortController();
      setAbortController(controller);
      setPending(true);
      setProgress(0);
      setProgressMessage('Initializing...');

      if (progressInterval) clearInterval(progressInterval);
      const earlyInterval = setInterval(() => {
        setProgress(prev => {
          if (prev < 90) {
            const next = Math.min(prev + (Math.random() * 6 + 2), 90);
            if (next < 30) setProgressMessage('Preparing...');
            else if (next < 50) setProgressMessage('Checking quota...');
            else if (next < 70) setProgressMessage('Generating structure...');
            else if (next < 85) setProgressMessage('Creating activities...');
            else setProgressMessage('Finalizing...');
            return next;
          }
          return prev;
        });
      }, 600);
      setProgressInterval(earlyInterval);

      if (!AI_ENABLED || flags.ai_lesson_generation === false) {
        toast.warn('AI Lesson Generator is disabled.');
        return;
      }

      setProgress(10);
      setProgressMessage('Checking quota...');
      setErrorMsg(null);

      let gate: { allowed: boolean } | null = null;
      try {
        gate = await invokeWithTimeout(canUseFeature('lesson_generation', 1), 10000);
      } catch {
        toast.info('Network is slow; proceeding.');
        gate = { allowed: true };
      }

      if (!gate?.allowed) {
        const status = await getQuotaStatus('lesson_generation');
        Alert.alert('Monthly limit reached', `You have used ${status.used} of ${status.limit} generations.`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'See plans', onPress: () => router.push('/pricing') },
        ]);
        return;
      }

      setProgress(20);
      setProgressMessage('Preparing request...');
      track('edudash.ai.lesson.generate_started', {});

      const payload = payloadOverride || {
        action: 'lesson_generation',
        topic: topic || 'Lesson Topic',
        subject: subject || 'General Studies',
        gradeLevel: Number(gradeLevel) || 3,
        duration: Number(duration) || 45,
        objectives: (objectives || '').split(';').map(s => s.trim()).filter(Boolean),
        language: language || 'en',
        model: selectedModel || process.env.EXPO_PUBLIC_ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
      };
      setLastPayload(payload);

      setProgress(30);
      setProgressMessage('Connecting to AI...');

      if (progressInterval) clearInterval(progressInterval);
      const interval = setInterval(() => {
        setProgress(prev => (prev < 90 ? Math.min(prev + (Math.random() * 8 + 4), 90) : prev));
      }, 500);
      setProgressInterval(interval);

      if (controller.signal.aborted) throw new Error('Generation cancelled');

      const invokePromise = assertSupabase().functions.invoke('ai-gateway', { body: payload });
      const { data, error } = await invokeWithTimeout(invokePromise, 30000);

      clearInterval(interval);
      setProgressInterval(null);
      setProgress(95);
      setProgressMessage('Processing results...');

      if (error) throw error;

      const lessonText = data?.content || '';
      setProgress(100);
      setProgressMessage('Complete!');

      setGenerated({
        title: `${subject}: ${topic}`,
        description: lessonText || 'No lesson content returned.',
        content: { sections: [] },
        activities: [],
      });

      try {
        await incrementUsage('lesson_generation', 1);
        await logUsageEvent({
          feature: 'lesson_generation',
          model: String(payload.model),
          tokensIn: data?.usage?.input_tokens || 0,
          tokensOut: data?.usage?.output_tokens || 0,
          estCostCents: data?.cost || 0,
          timestamp: new Date().toISOString(),
        });
      } catch (usageError) {
        console.error('[useAILessonGeneration] Failed to track usage:', usageError);
      }

      await refreshUsage();

      lessonText ? toast.success('Lesson generated!') : toast.warn('No content returned.');
      track('edudash.ai.lesson.generate_completed', {});
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Please try again';
      track('edudash.ai.lesson.generate_failed', { error: message });
      setErrorMsg(message);
      toast.error(`Generation failed: ${message}`);
    } finally {
      setAbortController(null);
      if (progressInterval) {
        try { clearInterval(progressInterval); } catch { /* non-fatal */ }
        setProgressInterval(null);
      }
      setPending(false);
      setProgress(0);
      setProgressMessage('');
    }
  }, [AI_ENABLED, flags, invokeWithTimeout, progressInterval, refreshUsage]);

  return {
    generated,
    setGenerated,
    pending,
    progress,
    progressMessage,
    errorMsg,
    lastPayload,
    usage,
    quotaStatus,
    isQuotaExhausted,
    onGenerate,
    onCancel,
    refreshUsage,
  };
}

export default useAILessonGeneration;
