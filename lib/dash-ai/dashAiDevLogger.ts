/**
 * Development-only logger for Dash AI and voice flows.
 * Logs to console with tag [DashAI:dev] so you can grep logs (e.g. expo-dev.log)
 * to debug 400s and other AI/voice errors. No-op in production.
 */

declare const __DEV__: boolean | undefined;

const isDev =
  (typeof __DEV__ !== 'undefined' && __DEV__) ||
  (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development');

const TAG = '[DashAI:dev]';

export function dashAiDevLog(
  kind: 'ai_proxy_error' | 'voice_response_error' | 'voice_request',
  payload: {
    status?: number;
    code?: string;
    message?: string;
    details?: unknown;
    rawError?: unknown;
    responseBody?: string;
    responsePreview?: string;
    phase?: string;
    traceId?: string;
  }
): void {
  if (!isDev) return;
  try {
    const safePayload = {
      kind,
      status: payload.status,
      code: payload.code,
      message: payload.message,
      details: payload.details,
      phase: payload.phase,
      traceId: payload.traceId,
      responsePreview: payload.responsePreview,
      rawError: payload.rawError,
    };
    console.warn(TAG, JSON.stringify(safePayload, null, 2));
  } catch {
    console.warn(TAG, kind, payload.message, payload.status);
  }
}

export function dashAiDevLogVoiceResponse(
  status: number,
  responseText: string,
  extra?: { message?: string }
): void {
  if (!isDev) return;
  const preview =
    responseText.length > 500 ? responseText.slice(0, 500) + '...' : responseText;
  console.warn(TAG, '[voice_response]', {
    kind: 'voice_response_error',
    status,
    responsePreview: preview,
    ...extra,
  });
}
