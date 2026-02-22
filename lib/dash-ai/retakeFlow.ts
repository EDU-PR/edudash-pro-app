import type { DashAttachment, DashMessage } from '@/services/dash-ai/types';

const SCANNER_SOURCES = new Set(['scanner', 'homework_scanner']);

const getTurnId = (message: DashMessage): string => {
  const metadata = (message.metadata || {}) as Record<string, unknown>;
  const turnId = metadata.turn_id;
  return typeof turnId === 'string' ? turnId.trim() : '';
};

export function isScannerAttachment(attachment?: DashAttachment | null): boolean {
  if (!attachment || attachment.kind !== 'image') return false;
  const source = String(attachment.meta?.source || '').trim().toLowerCase();
  return SCANNER_SOURCES.has(source);
}

export function countScannerAttachments(attachments: DashAttachment[] = []): number {
  return attachments.reduce((count, attachment) => count + (isScannerAttachment(attachment) ? 1 : 0), 0);
}

export function isSuccessfulOCRResponse(
  message?: Pick<DashMessage, 'content' | 'metadata'> | null
): boolean {
  if (!message) return false;
  const metadata = (message.metadata || {}) as Record<string, unknown>;
  const hasOCRPayload = typeof metadata.ocr === 'object' && metadata.ocr !== null;
  const ocrMode = metadata.ocr_mode === true || hasOCRPayload;
  if (!ocrMode) return false;
  return String(message.content || '').trim().length > 0;
}

export function deriveRetakePrompt(
  messages: DashMessage[],
  assistantMessageId: string,
  fallback: string = 'Please analyze this clearer scan and continue.'
): string {
  const safeFallback = String(fallback || '').trim() || 'Please analyze this clearer scan and continue.';
  const assistantIndex = messages.findIndex(
    (message) => message.id === assistantMessageId && message.type === 'assistant'
  );
  if (assistantIndex < 0) return safeFallback;

  const assistantMessage = messages[assistantIndex];
  const assistantTurnId = getTurnId(assistantMessage);

  if (assistantTurnId) {
    for (let index = assistantIndex - 1; index >= 0; index -= 1) {
      const candidate = messages[index];
      if (candidate.type !== 'user') continue;
      if (getTurnId(candidate) !== assistantTurnId) continue;
      const trimmed = String(candidate.content || '').trim();
      if (trimmed) return trimmed;
    }
  }

  for (let index = assistantIndex - 1; index >= 0; index -= 1) {
    const candidate = messages[index];
    if (candidate.type !== 'user') continue;
    const trimmed = String(candidate.content || '').trim();
    if (trimmed) return trimmed;
  }

  return safeFallback;
}
