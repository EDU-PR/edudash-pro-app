const { normalizeMetroRequestUrl } = require('../normalizeMetroUrl');

describe('normalizeMetroRequestUrl', () => {
  it('returns valid absolute URLs unchanged', () => {
    const url = 'http://127.0.0.1:8081/index.bundle?platform=android&dev=true';
    expect(normalizeMetroRequestUrl(url)).toBe(url);
  });

  it('normalizes protocol-relative URLs', () => {
    const url = '//127.0.0.1:8081/index.bundle?platform=ios';
    expect(normalizeMetroRequestUrl(url)).toBe(
      'http://127.0.0.1:8081/index.bundle?platform=ios'
    );
  });

  it('normalizes root-relative URLs using fallback origin', () => {
    const url = '/index.bundle?platform=android';
    expect(normalizeMetroRequestUrl(url)).toBe(
      'http://127.0.0.1:8081/index.bundle?platform=android'
    );
  });

  it('normalizes plain paths using fallback origin', () => {
    const url = 'index.bundle?platform=android&dev=true';
    expect(normalizeMetroRequestUrl(url)).toBe(
      'http://127.0.0.1:8081/index.bundle?platform=android&dev=true'
    );
  });

  it('uses custom fallback origin for malformed input', () => {
    const url = '::::::';
    expect(
      normalizeMetroRequestUrl(url, { fallbackOrigin: 'http://localhost:19000' })
    ).toBe('http://localhost:19000/::::::');
  });

  it('falls back to root url on empty input', () => {
    expect(normalizeMetroRequestUrl('')).toBe('http://127.0.0.1:8081/');
  });
});
