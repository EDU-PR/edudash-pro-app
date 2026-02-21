export function extractGeneratedPdfStoragePathFromUrl(rawUrl: string): string | null {
  const value = String(rawUrl || '').trim();
  if (!value) return null;

  let pathname = value;
  try {
    const parsed = new URL(value);
    pathname = parsed.pathname || value;
  } catch {
    pathname = value.split('?')[0].split('#')[0];
  }

  const match = pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/generated-pdfs\/(.+)$/i);
  if (!match?.[1]) return null;

  const decoded = decodeURIComponent(match[1]).replace(/^\/+/, '').trim();
  return decoded || null;
}

export function isGeneratedPdfPublicUrl(rawUrl: string): boolean {
  const value = String(rawUrl || '').trim();
  if (!value) return false;
  return /\/storage\/v1\/object\/public\/generated-pdfs\//i.test(value);
}

export function isSupportedPdfContentType(contentType: unknown): boolean {
  const normalized = String(contentType || '').toLowerCase();
  if (!normalized) return true;
  return normalized.includes('application/pdf') || normalized.includes('octet-stream');
}
