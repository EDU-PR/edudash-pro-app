const mockInvoke = jest.fn();

jest.mock('@/lib/supabase', () => ({
  assertSupabase: () => ({
    functions: {
      invoke: mockInvoke,
    },
  }),
}));

import {
  DashImageGenerationError,
  generateDashImage,
} from '../dashImageService';

describe('dashImageService.generateDashImage', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('passes cost mode and provider preference to ai-proxy', async () => {
    mockInvoke.mockResolvedValueOnce({
      error: null,
      data: {
        content: 'Image generated successfully.',
        model: 'gpt-image-1',
        provider: 'openai',
        fallback_used: false,
        generated_images: [
          {
            id: 'img-1',
            bucket: 'dash-generated-images',
            path: 'u1/2026/02/img-1.png',
            signed_url: 'https://example.com/signed',
            mime_type: 'image/png',
            prompt: 'farm poster',
            width: 1024,
            height: 1024,
            provider: 'openai',
            model: 'gpt-image-1',
            expires_at: '2026-02-09T10:00:00.000Z',
          },
        ],
      },
    });

    const result = await generateDashImage({
      prompt: 'farm poster',
      costMode: 'eco',
      providerPreference: 'imagen',
      scope: 'parent',
    });

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    const [, invokeParams] = mockInvoke.mock.calls[0];
    expect(invokeParams?.body?.payload?.image_options?.cost_mode).toBe('eco');
    expect(invokeParams?.body?.payload?.image_options?.provider_preference).toBe('imagen');
    expect(result.provider).toBe('openai');
    expect(result.generatedImages).toHaveLength(1);
  });

  it('throws invalid_prompt when prompt is empty', async () => {
    await expect(
      generateDashImage({ prompt: '   ' }),
    ).rejects.toMatchObject({
      code: 'invalid_prompt',
    });
  });

  it('maps quota_exceeded invoke errors into DashImageGenerationError', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: {
        message: 'Function returned an error',
        context: {
          status: 429,
          json: async () => ({
            error: 'quota_exceeded',
            message: 'AI usage quota exceeded for this billing period',
            details: { limit: 3, remaining: 0 },
          }),
        },
      },
    });

    let thrown: unknown;
    try {
      await generateDashImage({ prompt: 'poster' });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(DashImageGenerationError);
    expect((thrown as DashImageGenerationError).code).toBe('quota_exceeded');
    expect((thrown as DashImageGenerationError).status).toBe(429);
  });
});
