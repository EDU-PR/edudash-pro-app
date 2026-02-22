import type { DashAttachment, DashMessage } from '@/services/dash-ai/types';
import {
  countScannerAttachments,
  deriveRetakePrompt,
  isScannerAttachment,
  isSuccessfulOCRResponse,
} from '@/lib/dash-ai/retakeFlow';

const buildMessage = (overrides: Partial<DashMessage>): DashMessage => ({
  id: overrides.id || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  type: overrides.type || 'assistant',
  content: overrides.content || '',
  timestamp: overrides.timestamp || Date.now(),
  ...(overrides.attachments ? { attachments: overrides.attachments } : {}),
  ...(overrides.metadata ? { metadata: overrides.metadata } : {}),
});

describe('retakeFlow', () => {
  describe('isScannerAttachment', () => {
    it('returns true for scanner-origin images', () => {
      const attachment: DashAttachment = {
        id: 'a1',
        name: 'scan.jpg',
        mimeType: 'image/jpeg',
        size: 1200,
        bucket: 'attachments',
        storagePath: 'x',
        kind: 'image',
        status: 'pending',
        meta: { source: 'scanner' },
      };
      expect(isScannerAttachment(attachment)).toBe(true);
    });

    it('returns false for non-scanner or non-image attachments', () => {
      const galleryImage: DashAttachment = {
        id: 'a2',
        name: 'gallery.jpg',
        mimeType: 'image/jpeg',
        size: 1400,
        bucket: 'attachments',
        storagePath: 'x',
        kind: 'image',
        status: 'pending',
        meta: { source: 'library' },
      };
      const document: DashAttachment = {
        id: 'a3',
        name: 'doc.pdf',
        mimeType: 'application/pdf',
        size: 2100,
        bucket: 'attachments',
        storagePath: 'x',
        kind: 'pdf',
        status: 'pending',
      };
      expect(isScannerAttachment(galleryImage)).toBe(false);
      expect(isScannerAttachment(document)).toBe(false);
    });
  });

  describe('countScannerAttachments', () => {
    it('counts scanner attachments only', () => {
      const attachments: DashAttachment[] = [
        {
          id: 'a1',
          name: 'scan_1.jpg',
          mimeType: 'image/jpeg',
          size: 1000,
          bucket: 'attachments',
          storagePath: 'a',
          kind: 'image',
          status: 'pending',
          meta: { source: 'scanner' },
        },
        {
          id: 'a2',
          name: 'scan_2.jpg',
          mimeType: 'image/jpeg',
          size: 1100,
          bucket: 'attachments',
          storagePath: 'b',
          kind: 'image',
          status: 'pending',
          meta: { source: 'homework_scanner' },
        },
        {
          id: 'a3',
          name: 'gallery.jpg',
          mimeType: 'image/jpeg',
          size: 1200,
          bucket: 'attachments',
          storagePath: 'c',
          kind: 'image',
          status: 'pending',
          meta: { source: 'library' },
        },
      ];
      expect(countScannerAttachments(attachments)).toBe(2);
    });
  });

  describe('isSuccessfulOCRResponse', () => {
    it('detects successful OCR metadata', () => {
      const message = buildMessage({
        type: 'assistant',
        content: 'I analyzed your worksheet.',
        metadata: { ocr_mode: true, confidence_score: 0.81 },
      });
      expect(isSuccessfulOCRResponse(message)).toBe(true);
    });

    it('returns false when OCR metadata is absent', () => {
      const message = buildMessage({
        type: 'assistant',
        content: 'General answer',
        metadata: { response_mode: 'explain_direct' },
      });
      expect(isSuccessfulOCRResponse(message)).toBe(false);
    });
  });

  describe('deriveRetakePrompt', () => {
    it('prefers user prompt from the same turn', () => {
      const messages: DashMessage[] = [
        buildMessage({
          id: 'u1',
          type: 'user',
          content: 'Old question',
          metadata: { turn_id: 'turn_old' },
        }),
        buildMessage({
          id: 'u2',
          type: 'user',
          content: 'Please check question 4 from this scan.',
          metadata: { turn_id: 'turn_42' },
        }),
        buildMessage({
          id: 'a2',
          type: 'assistant',
          content: 'Unclear scan, please retake.',
          metadata: { turn_id: 'turn_42', ocr_mode: true, confidence_score: 0.51 },
        }),
      ];
      expect(deriveRetakePrompt(messages, 'a2')).toBe('Please check question 4 from this scan.');
    });

    it('falls back to nearest prior user prompt when turn id is unavailable', () => {
      const messages: DashMessage[] = [
        buildMessage({ id: 'u1', type: 'user', content: 'Help me with this.' }),
        buildMessage({ id: 'a1', type: 'assistant', content: 'Need a clearer image.', metadata: { ocr_mode: true } }),
      ];
      expect(deriveRetakePrompt(messages, 'a1')).toBe('Help me with this.');
    });

    it('uses fallback prompt when no prior user prompt exists', () => {
      const messages: DashMessage[] = [
        buildMessage({ id: 'a1', type: 'assistant', content: 'Need a clearer image.', metadata: { ocr_mode: true } }),
      ];
      expect(deriveRetakePrompt(messages, 'a1')).toBe('Please analyze this clearer scan and continue.');
    });
  });
});
