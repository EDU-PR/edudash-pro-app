jest.mock('@/lib/dash-ai/imageCompression', () => ({
  compressImageForAI: jest.fn(async () => ({
    uri: 'mock://compressed.jpg',
    base64: 'compressed-base64',
    width: 512,
    height: 512,
    size: 1024,
  })),
  MAX_IMAGE_BASE64_LEN: 4_000_000,
}));

import { buildImagePayloadsFromAttachments } from '@/lib/dash-ai/imagePayloadBuilder';

describe('imagePayloadBuilder', () => {
  it('prefers inline image payloads when provided', async () => {
    const payloads = await buildImagePayloadsFromAttachments({
      images: [
        { data: 'abc123', media_type: 'image/png' },
      ],
      attachments: [
        {
          id: 'ignored',
          kind: 'image',
          meta: { image_base64: 'zzz' },
        },
      ],
    });

    expect(payloads).toEqual([{ data: 'abc123', media_type: 'image/png' }]);
  });

  it('builds payloads from attachment metadata', async () => {
    const payloads = await buildImagePayloadsFromAttachments({
      attachments: [
        {
          id: 'img-1',
          kind: 'image',
          mimeType: 'image/jpeg',
          meta: { image_base64: 'base64-1' },
        },
        {
          id: 'img-2',
          kind: 'image',
          meta: { base64: 'base64-2', image_media_type: 'image/png' },
        },
      ],
    });

    expect(payloads).toEqual([
      { data: 'base64-1', media_type: 'image/jpeg' },
      { data: 'base64-2', media_type: 'image/png' },
    ]);
  });

  it('enforces per-request image count and payload size constraints', async () => {
    const payloads = await buildImagePayloadsFromAttachments({
      maxImages: 1,
      maxBase64Length: 5,
      attachments: [
        {
          id: 'img-too-big',
          kind: 'image',
          mimeType: 'image/jpeg',
          meta: { image_base64: '123456789' },
        },
        {
          id: 'img-ok',
          kind: 'image',
          mimeType: 'image/jpeg',
          meta: { image_base64: '1234' },
        },
      ],
    });

    expect(payloads).toEqual([{ data: '1234', media_type: 'image/jpeg' }]);
  });
});
