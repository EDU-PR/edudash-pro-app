import {
  OCR_CONFIDENCE_HIGH_THRESHOLD,
  OCR_CONFIDENCE_LOW_THRESHOLD,
  deriveResolutionMetadata,
} from '@/supabase/functions/ai-proxy/resolutionPolicy';

describe('ai-proxy resolution policy', () => {
  it('escalates when OCR confidence is below low threshold', () => {
    const result = deriveResolutionMetadata(undefined, 0, {
      requestedOCRMode: true,
      ocrConfidence: OCR_CONFIDENCE_LOW_THRESHOLD - 0.01,
    });

    expect(result.resolution_status).toBe('escalated');
    expect(result.escalation_offer).toBe(true);
    expect(result.resolution_meta.source).toBe('ocr_threshold');
  });

  it('needs clarification at threshold band (>= low and <= high)', () => {
    const lowEdge = deriveResolutionMetadata(undefined, 0, {
      requestedOCRMode: true,
      ocrConfidence: OCR_CONFIDENCE_LOW_THRESHOLD,
    });
    const highEdge = deriveResolutionMetadata(undefined, 0, {
      requestedOCRMode: true,
      ocrConfidence: OCR_CONFIDENCE_HIGH_THRESHOLD,
    });

    expect(lowEdge.resolution_status).toBe('needs_clarification');
    expect(highEdge.resolution_status).toBe('needs_clarification');
    expect(lowEdge.escalation_offer).toBe(true);
    expect(highEdge.escalation_offer).toBe(true);
  });

  it('resolves when OCR confidence is above high threshold', () => {
    const result = deriveResolutionMetadata(undefined, 0, {
      requestedOCRMode: true,
      ocrConfidence: OCR_CONFIDENCE_HIGH_THRESHOLD + 0.01,
    });

    expect(result.resolution_status).toBe('resolved');
    expect(result.escalation_offer).toBe(false);
    expect(result.resolution_meta.source).toBe('ocr_threshold');
  });

  it('respects explicit request metadata override', () => {
    const result = deriveResolutionMetadata(
      {
        resolution_status: 'resolved',
        confidence_score: 0.9,
        escalation_offer: false,
      },
      2,
      {
        requestedOCRMode: false,
      }
    );

    expect(result.resolution_status).toBe('resolved');
    expect(result.confidence_score).toBe(0.9);
    expect(result.escalation_offer).toBe(false);
    expect(result.resolution_meta.source).toBe('request_metadata_override');
    expect(result.resolution_meta.pending_tool_calls).toBe(2);
  });

  it('defaults to pending tool-call clarification when no overrides exist', () => {
    const result = deriveResolutionMetadata(undefined, 1, {
      requestedOCRMode: false,
    });

    expect(result.resolution_status).toBe('needs_clarification');
    expect(result.confidence_score).toBe(0.58);
    expect(result.escalation_offer).toBe(true);
    expect(result.resolution_meta.source).toBe('pending_tool_calls_default');
  });
});
