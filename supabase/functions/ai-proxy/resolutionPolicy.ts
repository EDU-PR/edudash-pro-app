export type ResolutionStatus = 'resolved' | 'needs_clarification' | 'escalated';
export type ResolutionMetaSource =
  | 'ocr_threshold'
  | 'request_metadata_override'
  | 'pending_tool_calls_default';

export type ResolutionMeta = {
  source: ResolutionMetaSource;
  ocr_confidence?: number;
  thresholds?: {
    low: number;
    high: number;
  };
  pending_tool_calls: number;
};

export const OCR_CONFIDENCE_LOW_THRESHOLD = 0.55;
export const OCR_CONFIDENCE_HIGH_THRESHOLD = 0.75;

export function normalizeResolutionStatus(value: unknown): ResolutionStatus | null {
  const raw = String(value || '').toLowerCase().trim();
  if (raw === 'resolved' || raw === 'needs_clarification' || raw === 'escalated') {
    return raw;
  }
  return null;
}

export function clampConfidence(value: unknown): number | null {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseFloat(value)
        : Number.NaN;
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(1, parsed));
}

export function deriveResolutionFromOCRConfidence(confidence: number): {
  status: ResolutionStatus;
  escalationOffer: boolean;
} {
  if (confidence < OCR_CONFIDENCE_LOW_THRESHOLD) {
    return {
      status: 'escalated',
      escalationOffer: true,
    };
  }
  if (confidence <= OCR_CONFIDENCE_HIGH_THRESHOLD) {
    return {
      status: 'needs_clarification',
      escalationOffer: true,
    };
  }
  return {
    status: 'resolved',
    escalationOffer: false,
  };
}

export function deriveResolutionMetadata(
  requestMetadata: Record<string, unknown> | undefined,
  pendingToolCallCount: number,
  options?: {
    requestedOCRMode?: boolean;
    ocrConfidence?: number | null;
  }
): {
  resolution_status: ResolutionStatus;
  confidence_score: number;
  escalation_offer: boolean;
  resolution_meta: ResolutionMeta;
} {
  const fromRequest = requestMetadata || {};
  const explicitStatus = normalizeResolutionStatus(fromRequest.resolution_status);
  const explicitConfidence = clampConfidence(fromRequest.confidence_score);
  const explicitEscalationOffer = typeof fromRequest.escalation_offer === 'boolean'
    ? fromRequest.escalation_offer
    : null;
  const requestedOCRMode = options?.requestedOCRMode === true;
  const normalizedOCRConfidence = clampConfidence(options?.ocrConfidence);

  if (requestedOCRMode && normalizedOCRConfidence !== null) {
    const derived = deriveResolutionFromOCRConfidence(normalizedOCRConfidence);
    return {
      resolution_status: derived.status,
      confidence_score: Number(normalizedOCRConfidence.toFixed(2)),
      escalation_offer: derived.escalationOffer,
      resolution_meta: {
        source: 'ocr_threshold',
        ocr_confidence: Number(normalizedOCRConfidence.toFixed(2)),
        thresholds: {
          low: OCR_CONFIDENCE_LOW_THRESHOLD,
          high: OCR_CONFIDENCE_HIGH_THRESHOLD,
        },
        pending_tool_calls: pendingToolCallCount,
      },
    };
  }

  if (explicitStatus || explicitConfidence !== null || explicitEscalationOffer !== null) {
    const status = explicitStatus || (pendingToolCallCount > 0 ? 'needs_clarification' : 'resolved');
    const confidence =
      explicitConfidence ??
      (status === 'escalated' ? 0.42 : status === 'needs_clarification' ? 0.58 : 0.82);
    const escalationOffer =
      explicitEscalationOffer ??
      (status === 'escalated' || status === 'needs_clarification');
    return {
      resolution_status: status,
      confidence_score: Number(confidence.toFixed(2)),
      escalation_offer: escalationOffer,
      resolution_meta: {
        source: 'request_metadata_override',
        pending_tool_calls: pendingToolCallCount,
      },
    };
  }

  const defaultStatus: ResolutionStatus = pendingToolCallCount > 0 ? 'needs_clarification' : 'resolved';
  const confidence = defaultStatus === 'needs_clarification' ? 0.58 : 0.82;
  const escalationOffer = defaultStatus === 'needs_clarification';

  return {
    resolution_status: defaultStatus,
    confidence_score: Number(confidence.toFixed(2)),
    escalation_offer: escalationOffer,
    resolution_meta: {
      source: 'pending_tool_calls_default',
      pending_tool_calls: pendingToolCallCount,
    },
  };
}
