import {
  isGeneratedPdfsPublicUrl,
  resolvePdfPreviewTarget,
  sanitizeGeneratedPdfUrl,
} from '@/components/ai/dash-assistant/pdfPreviewUtils';

describe('pdfPreviewUtils', () => {
  it('prefers tool metadata for PDF tool operations', () => {
    const result = resolvePdfPreviewTarget({
      isPdfToolOperation: true,
      isToolOperation: true,
      toolDownloadUrl: 'https://example.com/storage/v1/object/sign/generated-pdfs/org/file.pdf?token=abc',
      toolStoragePath: 'org/file.pdf',
      extractedPdfUrl: 'https://example.com/storage/v1/object/public/generated-pdfs/org/bad.pdf',
      attachmentPdfUrl: 'https://cdn.example.com/attachment.pdf',
      assistantPdfUrl: 'https://cdn.example.com/assistant.pdf',
    });

    expect(result.url).toContain('/object/sign/generated-pdfs/');
    expect(result.storagePath).toBe('org/file.pdf');
  });

  it('keeps tool metadata as source of truth even when assistant text has another PDF link', () => {
    const result = resolvePdfPreviewTarget({
      isPdfToolOperation: true,
      isToolOperation: true,
      toolDownloadUrl: 'https://example.com/storage/v1/object/sign/generated-pdfs/org/file.pdf?token=tool',
      toolStoragePath: 'org/file.pdf',
      assistantPdfUrl: 'https://example.com/docs/assistant-file.pdf',
      extractedPdfUrl: 'https://example.com/docs/assistant-file.pdf',
    });

    expect(result.url).toBe('https://example.com/storage/v1/object/sign/generated-pdfs/org/file.pdf?token=tool');
    expect(result.storagePath).toBe('org/file.pdf');
  });

  it('rejects generated-pdfs public URLs', () => {
    const publicUrl = 'https://example.com/storage/v1/object/public/generated-pdfs/org/file.pdf';
    expect(isGeneratedPdfsPublicUrl(publicUrl)).toBe(true);
    expect(sanitizeGeneratedPdfUrl(publicUrl)).toBeNull();

    const result = resolvePdfPreviewTarget({
      isPdfToolOperation: false,
      isToolOperation: false,
      extractedPdfUrl: publicUrl,
      assistantPdfUrl: publicUrl,
    });
    expect(result.url).toBeNull();
  });

  it('keeps non-generated links unchanged', () => {
    const signed = 'https://example.com/storage/v1/object/sign/generated-pdfs/org/file.pdf?token=abc';
    const external = 'https://example.com/docs/file.pdf';

    expect(sanitizeGeneratedPdfUrl(signed)).toBe(signed);
    expect(sanitizeGeneratedPdfUrl(external)).toBe(external);
  });
});
