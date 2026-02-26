import {
  extractGeneratedPdfStoragePathFromUrl,
  isGeneratedPdfPublicUrl,
  isSupportedPdfContentType,
} from '@/lib/pdf-viewer-utils';

describe('pdf-viewer utils', () => {
  it('extracts storage path from legacy generated-pdfs URLs', () => {
    const publicUrl =
      'https://example.supabase.co/storage/v1/object/public/generated-pdfs/org-1/submission.pdf';
    const signedUrl =
      'https://example.supabase.co/storage/v1/object/sign/generated-pdfs/org-1/submission.pdf?token=abc';

    expect(extractGeneratedPdfStoragePathFromUrl(publicUrl)).toBe('org-1/submission.pdf');
    expect(extractGeneratedPdfStoragePathFromUrl(signedUrl)).toBe('org-1/submission.pdf');
    expect(isGeneratedPdfPublicUrl(publicUrl)).toBe(true);
    expect(isGeneratedPdfPublicUrl(signedUrl)).toBe(false);
  });

  it('rejects non-PDF content types', () => {
    expect(isSupportedPdfContentType('application/pdf')).toBe(true);
    expect(isSupportedPdfContentType('application/octet-stream')).toBe(true);
    expect(isSupportedPdfContentType('text/html')).toBe(false);
    expect(isSupportedPdfContentType('application/json')).toBe(false);
  });
});
