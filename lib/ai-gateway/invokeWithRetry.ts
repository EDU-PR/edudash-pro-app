import { assertSupabase } from '@/lib/supabase';

type GatewayInvokeOptions = {
  retries?: number;
  retryDelayMs?: number;
};

const DEFAULT_RETRIES = 1;
const DEFAULT_RETRY_DELAY_MS = Number(process.env.EXPO_PUBLIC_AI_GATEWAY_429_RETRY_MS || 1200);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isAIGatewayRateLimitError(error: unknown): boolean {
  const err = error as any;
  const status = Number(err?.status || err?.context?.status || 0);
  const message = String(err?.message || '').toLowerCase();
  const details = String(err?.details || '').toLowerCase();

  return (
    status === 429 ||
    message.includes('429') ||
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('quota_exceeded') ||
    details.includes('quota_exceeded')
  );
}

export function formatAIGatewayErrorMessage(
  error: unknown,
  fallbackMessage = 'AI request failed. Please try again.'
): string {
  const err = error as any;
  const rawMessage = String(err?.message || '');
  const lower = rawMessage.toLowerCase();

  if (isAIGatewayRateLimitError(error)) {
    if (lower.includes('quota_exceeded')) {
      return 'AI usage quota reached for this billing period. Please upgrade or try again after reset.';
    }
    return 'AI service is busy right now. Please wait about a minute and try again.';
  }

  if (rawMessage.includes('Edge Function returned a non-2xx')) {
    return 'AI service returned an error. Please retry in a moment.';
  }

  return rawMessage || fallbackMessage;
}

export async function invokeAIGatewayWithRetry<T = any>(
  payload: Record<string, unknown>,
  options: GatewayInvokeOptions = {}
): Promise<{ data: T | null; error: any | null }> {
  const retries = options.retries ?? DEFAULT_RETRIES;
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;

  const invoke = async () => assertSupabase().functions.invoke('ai-gateway', { body: payload });

  let attempt = 0;
  let response = await invoke();

  while (response.error && isAIGatewayRateLimitError(response.error) && attempt < retries) {
    attempt += 1;
    const delay = retryDelayMs * attempt;
    await sleep(delay);
    response = await invoke();
  }

  return response;
}

