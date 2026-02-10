import { serve } from 'https://deno.land/std@0.214.0/http/server.ts';
import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.1';
import { getCorsHeaders, handleCorsOptions } from '../_shared/cors.ts';
import { callImagenImageGeneration, isImagenConfigured } from './providers/imagen.ts';

type JsonRecord = Record<string, unknown>;

type ToolResult = {
  name: string;
  input: JsonRecord;
  output: JsonRecord;
  success: boolean;
};

type GeneratedImage = {
  id: string;
  bucket: string;
  path: string;
  signed_url: string;
  mime_type: string;
  prompt: string;
  width: number;
  height: number;
  provider: 'openai' | 'google';
  model: string;
  expires_at: string;
};

type ProviderResponse = {
  content: string;
  usage?: {
    tokens_in?: number;
    tokens_out?: number;
    cost?: number;
  };
  model?: string;
  tool_results?: ToolResult[];
  generated_images?: GeneratedImage[];
  provider?: 'openai' | 'google';
  fallback_used?: boolean;
  fallback_reason?: string;
  /** Client-side tool calls that the AI requested but the server cannot execute */
  pending_tool_calls?: Array<{ id: string; name: string; input: Record<string, unknown> }>;
};

type ResolutionStatus = 'resolved' | 'needs_clarification' | 'escalated';

const DEFAULT_OPENAI_ALLOWED_MODELS = ['gpt-4o-mini', 'gpt-4o'];
const DEFAULT_ANTHROPIC_ALLOWED_MODELS = [
  'claude-sonnet-4-20250514',
  'claude-sonnet-4-5-20250514',
  'claude-opus-4-20250514',
  'claude-3-7-sonnet-20250219',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
  'claude-3-sonnet-20240229',
  'claude-3-opus-20240229',
  'claude-3-haiku-20240307',
];
const DEFAULT_SUPERADMIN_ALLOWED_MODELS = [
  'claude-sonnet-4-20250514',
  'claude-sonnet-4-5-20250514',
];

const ImageSchema = z.object({
  data: z.string(),
  media_type: z.string(),
});

const ImageOptionsSchema = z.object({
  size: z.enum(['1024x1024', '1536x1024', '1024x1536']).optional(),
  quality: z.enum(['low', 'medium', 'high']).optional(),
  style: z.enum(['natural', 'vivid']).optional(),
  background: z.enum(['auto', 'transparent', 'opaque']).optional(),
  moderation: z.enum(['auto', 'low']).optional(),
  cost_mode: z.enum(['eco', 'balanced', 'premium']).optional(),
  provider_preference: z.enum(['auto', 'openai', 'imagen']).optional(),
});

const ConversationMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.union([
    z.string(),
    z.array(
      z.object({
        type: z.string(),
        text: z.string().optional(),
        source: z
          .object({
            type: z.string(),
            media_type: z.string(),
            data: z.string(),
          })
          .optional(),
      })
    ),
  ]),
  tool_call_id: z.string().optional(),
  name: z.string().optional(),
});

const RequestSchema = z.object({
  scope: z.enum(['teacher', 'principal', 'parent', 'student', 'admin', 'guest']).optional(),
  service_type: z.string().optional().default('chat_message'),
  payload: z
    .object({
      prompt: z.string().optional(),
      context: z.string().optional(),
      conversationHistory: z.array(ConversationMessageSchema).optional(),
      messages: z.array(ConversationMessageSchema).optional(),
      images: z.array(ImageSchema).optional(),
      image_options: ImageOptionsSchema.optional(),
      image_context: z.record(z.unknown()).optional(),
      voice_data: z.record(z.unknown()).optional(),
      ocr_mode: z.boolean().optional(),
      ocr_task: z.enum(['homework', 'document', 'handwriting']).optional(),
      ocr_response_format: z.enum(['json', 'text']).optional(),
      model: z.string().optional(),
    })
    .default({}),
  stream: z.boolean().optional(),
  enable_tools: z.boolean().optional().default(false),
  prefer_openai: z.boolean().optional().default(false),
  client_tools: z.array(z.object({
    name: z.string(),
    description: z.string(),
    input_schema: z.record(z.unknown()),
  })).optional(),
  metadata: z.record(z.unknown()).optional(),
});

function normalizeResolutionStatus(value: unknown): ResolutionStatus | null {
  const raw = String(value || '').toLowerCase().trim();
  if (raw === 'resolved' || raw === 'needs_clarification' || raw === 'escalated') {
    return raw;
  }
  return null;
}

function clampConfidence(value: unknown): number | null {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseFloat(value)
        : Number.NaN;
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(1, parsed));
}

function deriveResolutionMetadata(
  requestMetadata: Record<string, unknown> | undefined,
  pendingToolCallCount: number
): {
  resolution_status: ResolutionStatus;
  confidence_score: number;
  escalation_offer: boolean;
} {
  const fromRequest = requestMetadata || {};
  const explicitStatus = normalizeResolutionStatus(fromRequest.resolution_status);
  const explicitConfidence = clampConfidence(fromRequest.confidence_score);
  const explicitEscalationOffer = typeof fromRequest.escalation_offer === 'boolean'
    ? fromRequest.escalation_offer
    : null;

  const defaultStatus: ResolutionStatus = pendingToolCallCount > 0 ? 'needs_clarification' : 'resolved';
  const status = explicitStatus || defaultStatus;
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
  };
}

function normalizeServiceType(serviceType?: string): string {
  if (!serviceType) return 'chat_message';
  if (serviceType === 'dash_conversation' || serviceType === 'dash_ai') {
    return 'chat_message';
  }
  return serviceType;
}

// ── MAX TOKENS BY SERVICE TYPE ──────────────────────────────────────
// Different service types need different token budgets
const MAX_TOKENS_BY_SERVICE: Record<string, number> = {
  chat_message: 2048,
  lesson_generation: 4096,
  homework_generation: 4096,
  grading: 2048,
  exam_generation: 4096,
  agent_plan: 1024,
  agent_reflection: 256,
  web_search: 1024,
  image_analysis: 2048,
  image_generation: 512,
};
const DEFAULT_MAX_TOKENS = 2048;

function getMaxTokensForService(serviceType: string): number {
  return MAX_TOKENS_BY_SERVICE[serviceType] || DEFAULT_MAX_TOKENS;
}

const WebSearchArgsSchema = z.object({
  query: z.string().min(2),
  recency: z.string().optional(),
  domains: z.array(z.string()).optional(),
});

const DEFAULT_SYSTEM_PROMPT = `You are Dash, an AI tutor for parents and students.\n\nCORE BEHAVIOR:\n- Always teach step-by-step, ask one short question at a time, and wait for the learner’s response.\n- Never assume age, grade, language, or background knowledge. Ask for them if missing.\n- Never refuse to help or say you can’t help. If info is missing, ask. If tools are needed, use them.\n- Keep responses short and interactive.\n\nTUTOR FLOW:\nDiagnose → Teach → Practice → Check.\n\nWEB SEARCH TOOL:\nIf the user asks about information not in the curriculum/context, call the web_search tool to retrieve trustworthy sources.\n\nLANGUAGE:\nIf the user’s preferred language is unknown, ask which language they prefer (English, Afrikaans, isiZulu).`;

const SHARED_PHONICS_PROMPT_BLOCK = [
  'PHONICS MODE:',
  '- Teach letter sounds, not letter names.',
  '- Use sustained sound text: "sss", "mmm", "fff".',
  '- Never write spaced repetition like "s s s" or "m m m".',
  '- For blending, format as "c-a-t becomes cat".',
  '- For segmenting, split words like "dog is d-o-g".',
  '- Keep phonics examples short, playful, and concrete.',
].join('\n');

const OCR_PROMPT_BY_TASK: Record<'homework' | 'document' | 'handwriting', string> = {
  homework: [
    'OCR HOMEWORK SCAN:',
    '- Read all visible handwritten and printed text.',
    '- Identify subject, topic, and likely grade.',
    '- If answers are present, evaluate briefly and suggest next practice.',
    '- Mark uncertain words with [?].',
  ].join('\n'),
  document: [
    'OCR DOCUMENT SCAN:',
    '- Extract all visible text from the image.',
    '- Preserve structure where possible (titles, bullets, steps).',
    '- Mark uncertain words with [?].',
  ].join('\n'),
  handwriting: [
    'OCR HANDWRITING REVIEW:',
    '- Read handwritten text line by line.',
    '- Mark uncertain words with [?].',
    '- Give short handwriting improvement tips for young learners.',
  ].join('\n'),
};

// CORS headers are now managed by _shared/cors.ts — computed per-request in serve()
// The `corsHeaders` variable is set once per request at the top of serve().

// ── PII FILTERING ─────────────────────────────────────────────────────
// Redact sensitive personal information before sending to AI providers
const PII_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: '[EMAIL]' },
  { pattern: /\b(?:\+27|0)[0-9]{9,10}\b/g, replacement: '[PHONE]' },
  { pattern: /\b\d{2}[01]\d[0-3]\d\d{4}[01]\d{2}\b/g, replacement: '[SA_ID]' },
  { pattern: /\b\d{13}\b/g, replacement: '[ID_NUMBER]' },
  { pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b/g, replacement: '[CARD_NUMBER]' },
];

function redactPII(text: string): string {
  if (!text || typeof text !== 'string') return text;
  let redacted = text;
  for (const { pattern, replacement } of PII_PATTERNS) {
    redacted = redacted.replace(pattern, replacement);
  }
  return redacted;
}

function redactMessagesForProvider(messages: Array<JsonRecord>): Array<JsonRecord> {
  return messages.map((msg) => {
    const content = msg.content;
    if (typeof content === 'string') {
      return { ...msg, content: redactPII(content) };
    }
    if (Array.isArray(content)) {
      return {
        ...msg,
        content: content.map((part: any) => {
          if (part?.type === 'text' && typeof part.text === 'string') {
            return { ...part, text: redactPII(part.text) };
          }
          return part;
        }),
      };
    }
    return msg;
  });
}

function getEnv(name: string): string | null {
  const value = Deno.env.get(name);
  return value && value.length > 0 ? value : null;
}

function getAnthropicApiKey(): string | null {
  return (
    getEnv('ANTHROPIC_API_KEY') ||
    getEnv('SERVER_ANTHROPIC_API_KEY') ||
    getEnv('ANTHROPIC_API_KEY_2') ||
    getEnv('ANTHROPIC_API_KEY_SECONDARY')
  );
}

function getOpenAIApiKey(): string | null {
  return (
    getEnv('OPENAI_API_KEY') ||
    getEnv('SERVER_OPENAI_API_KEY') ||
    getEnv('OPENAI_API_KEY_2')
  );
}

const IMAGE_BUCKET = 'dash-generated-images';
const IMAGE_SIGNED_URL_TTL_SECONDS = 60 * 60 * 24; // 24 hours

type ImageProvider = 'openai' | 'google';
type ImageOptions = z.infer<typeof ImageOptionsSchema>;
type ImageProviderErrorCode =
  | 'config_missing'
  | 'network_error'
  | 'provider_error'
  | 'rate_limited'
  | 'content_policy_violation'
  | 'invalid_request'
  | 'storage_error';

type ImageProviderError = Error & {
  provider: ImageProvider;
  code: ImageProviderErrorCode;
  status?: number;
  retryable: boolean;
  details?: JsonRecord;
};

function parseImageSize(size?: string): { width: number; height: number } {
  if (!size) return { width: 1024, height: 1024 };
  const [wRaw, hRaw] = size.split('x');
  const width = Number.parseInt(wRaw || '1024', 10);
  const height = Number.parseInt(hRaw || '1024', 10);
  return {
    width: Number.isFinite(width) ? width : 1024,
    height: Number.isFinite(height) ? height : 1024,
  };
}

function toPngBytes(base64Image: string): Uint8Array {
  const binary = atob(base64Image);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function createImageProviderError(params: {
  provider: ImageProvider;
  code: ImageProviderErrorCode;
  message: string;
  status?: number;
  retryable?: boolean;
  details?: JsonRecord;
}): ImageProviderError {
  const error = new Error(params.message) as ImageProviderError;
  error.provider = params.provider;
  error.code = params.code;
  if (typeof params.status === 'number') {
    error.status = params.status;
  }
  error.retryable = params.retryable === true;
  if (params.details) {
    error.details = params.details;
  }
  return error;
}

function isImageProviderError(value: unknown): value is ImageProviderError {
  if (!value || typeof value !== 'object') return false;
  const maybe = value as Partial<ImageProviderError>;
  return (
    (maybe.provider === 'openai' || maybe.provider === 'google') &&
    typeof maybe.code === 'string' &&
    typeof maybe.retryable === 'boolean'
  );
}

function hasContentPolicySignal(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('moderation') ||
    lower.includes('policy') ||
    lower.includes('safety') ||
    lower.includes('content')
  );
}

function inferStatusFromText(message: string): number | undefined {
  const match = message.match(/\b(4\d\d|5\d\d)\b/);
  if (!match) return undefined;
  const status = Number.parseInt(match[1], 10);
  return Number.isFinite(status) ? status : undefined;
}

function normalizeImageProviderError(error: unknown, provider: ImageProvider): ImageProviderError {
  if (isImageProviderError(error)) {
    return error;
  }
  const message = error instanceof Error ? error.message : String(error);
  const status = inferStatusFromText(message);
  const lower = message.toLowerCase();
  if (hasContentPolicySignal(message)) {
    return createImageProviderError({
      provider,
      code: 'content_policy_violation',
      message,
      status: status || 400,
      retryable: false,
    });
  }
  const retryable = status === 429 || (typeof status === 'number' && status >= 500) ||
    lower.includes('timeout') || lower.includes('network') || lower.includes('temporarily');
  return createImageProviderError({
    provider,
    code: retryable ? (status === 429 ? 'rate_limited' : 'provider_error') : 'invalid_request',
    message,
    status,
    retryable,
  });
}

function normalizeTierName(input: unknown): string {
  return String(input || 'free').trim().toLowerCase();
}

function isFreeOrTrialTier(tier: string): boolean {
  return tier === 'free' || tier === 'trial' || tier.includes('free') || tier.includes('trial');
}

function isStarterTier(tier: string): boolean {
  return tier.includes('starter');
}

function isPremiumTier(tier: string): boolean {
  return (
    tier.includes('plus') ||
    tier.includes('pro') ||
    tier.includes('premium') ||
    tier.includes('enterprise')
  );
}

function coerceImageOptionsForTier(options?: ImageOptions, tierRaw?: string | null): Required<ImageOptions> {
  const tier = normalizeTierName(tierRaw);
  const normalized: Required<ImageOptions> = {
    size: options?.size || '1024x1024',
    quality: options?.quality || 'medium',
    style: options?.style || 'vivid',
    background: options?.background || 'auto',
    moderation: options?.moderation || 'auto',
    cost_mode: options?.cost_mode || 'balanced',
    provider_preference: options?.provider_preference || 'auto',
  };

  if (isFreeOrTrialTier(tier) || isStarterTier(tier)) {
    normalized.size = '1024x1024';
  }

  if (normalized.quality === 'high' && (isFreeOrTrialTier(tier) || isStarterTier(tier))) {
    normalized.quality = 'medium';
  }

  if (normalized.cost_mode === 'eco') {
    normalized.quality = normalized.quality === 'high' ? 'medium' : normalized.quality;
    if (!options?.quality) {
      normalized.quality = 'low';
    }
  }

  if (normalized.cost_mode === 'premium' && !options?.quality && isPremiumTier(tier)) {
    normalized.quality = 'high';
  }

  return normalized;
}

function isImageFallbackEnabled(): boolean {
  const value = (
    getEnv('ENABLE_IMAGE_PROVIDER_FALLBACK') ||
    getEnv('EXPO_PUBLIC_ENABLE_IMAGE_PROVIDER_FALLBACK') ||
    'false'
  ).toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

function buildImageProviderChain(params: {
  options: Required<ImageOptions>;
  hasOpenAI: boolean;
  hasImagen: boolean;
  fallbackEnabled: boolean;
}): ImageProvider[] {
  const { options, hasOpenAI, hasImagen, fallbackEnabled } = params;
  if (!hasOpenAI && !hasImagen) return [];

  let primary: ImageProvider = 'openai';
  if (options.provider_preference === 'openai') {
    primary = 'openai';
  } else if (options.provider_preference === 'imagen') {
    primary = 'google';
  } else if (options.cost_mode === 'eco') {
    primary = 'google';
  } else {
    primary = 'openai';
  }

  if (primary === 'openai' && !hasOpenAI) {
    primary = 'google';
  } else if (primary === 'google' && !hasImagen) {
    primary = 'openai';
  }

  const chain: ImageProvider[] = [primary];
  if (!fallbackEnabled) return chain;

  const secondary: ImageProvider = primary === 'openai' ? 'google' : 'openai';
  if ((secondary === 'openai' && hasOpenAI) || (secondary === 'google' && hasImagen)) {
    chain.push(secondary);
  }
  return chain;
}

function estimateImageCostUsd(params: {
  provider: ImageProvider;
  size: string;
  quality: 'low' | 'medium' | 'high';
  imageCount: number;
  model?: string;
}): number {
  const dims = parseImageSize(params.size);
  const areaScale = (dims.width * dims.height) / (1024 * 1024);
  const providerBase = params.provider === 'google'
    ? (String(params.model || '').toLowerCase().includes('fast') ? 0.02 : 0.04)
    : params.quality === 'high'
      ? 0.08
      : params.quality === 'low'
        ? 0.02
        : 0.04;

  const images = Math.max(1, params.imageCount || 1);
  return Number((providerBase * areaScale * images).toFixed(4));
}

async function moderateImagePrompt(apiKey: string, prompt: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'omni-moderation-latest',
        input: prompt,
      }),
    });
  } catch (error) {
    throw createImageProviderError({
      provider: 'openai',
      code: 'network_error',
      message: `OpenAI moderation request failed: ${error instanceof Error ? error.message : String(error)}`,
      retryable: true,
    });
  }

  if (!response.ok) {
    const text = await response.text();
    throw createImageProviderError({
      provider: 'openai',
      code: response.status === 429 ? 'rate_limited' : 'provider_error',
      message: `OpenAI moderation error: ${response.status} ${text}`,
      status: response.status,
      retryable: response.status === 429 || response.status >= 500,
      details: { raw_error: text },
    });
  }

  const data = (await response.json()) as JsonRecord;
  const result = Array.isArray(data.results) ? data.results[0] : null;
  const flagged = !!(result && typeof result === 'object' && (result as JsonRecord).flagged);
  if (flagged) {
    throw createImageProviderError({
      provider: 'openai',
      code: 'content_policy_violation',
      message: 'Image prompt blocked by moderation policy',
      status: 400,
      retryable: false,
    });
  }
}

async function callOpenAIImageGeneration(params: {
  supabase: ReturnType<typeof createClient>;
  userId: string;
  prompt: string;
  options?: z.infer<typeof ImageOptionsSchema>;
  requestedModel?: string | null;
}): Promise<ProviderResponse> {
  const { supabase, userId, prompt, options, requestedModel } = params;
  const apiKey = getOpenAIApiKey();
  if (!apiKey) {
    throw createImageProviderError({
      provider: 'openai',
      code: 'config_missing',
      message: 'OPENAI_API_KEY is not configured.',
      status: 503,
      retryable: true,
    });
  }

  const model = requestedModel || getEnv('OPENAI_IMAGE_MODEL') || 'gpt-image-1';
  await moderateImagePrompt(apiKey, prompt);

  const size = options?.size || '1024x1024';
  const quality = options?.quality || 'medium';
  const preferredParams: Record<string, unknown> = {
    size,
    quality,
    style: options?.style || 'vivid',
    background: options?.background || 'auto',
    moderation: options?.moderation || 'auto',
    output_format: 'png',
  };

  const omittedParams = new Set<string>();
  let response: Response | null = null;
  let lastErrorText = '';
  let lastStatus = 500;

  // OpenAI image APIs can reject model-specific fields.
  // Retry by removing only unsupported parameters so generation still succeeds.
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const body: Record<string, unknown> = { model, prompt };
    for (const [key, value] of Object.entries(preferredParams)) {
      if (value === undefined || omittedParams.has(key)) continue;
      body[key] = value;
    }

    try {
      response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      throw createImageProviderError({
        provider: 'openai',
        code: 'network_error',
        message: `OpenAI image generation request failed: ${error instanceof Error ? error.message : String(error)}`,
        retryable: true,
      });
    }

    if (response.ok) break;

    const errorText = await response.text();
    lastErrorText = errorText;
    lastStatus = response.status;
    const unknownParam = errorText.match(/Unknown parameter:\s*'([^']+)'/i)?.[1];
    if (unknownParam) {
      omittedParams.add(unknownParam);
      continue;
    }

    if (response.status === 400 && hasContentPolicySignal(errorText)) {
      throw createImageProviderError({
        provider: 'openai',
        code: 'content_policy_violation',
        message: `OpenAI image generation blocked by policy: ${errorText}`,
        status: 400,
        retryable: false,
      });
    }

    throw createImageProviderError({
      provider: 'openai',
      code: response.status === 429 ? 'rate_limited' : response.status >= 500 ? 'provider_error' : 'invalid_request',
      message: `OpenAI image generation error: ${response.status} ${errorText}`,
      status: response.status,
      retryable: response.status === 429 || response.status >= 500,
      details: { raw_error: errorText },
    });
  }

  if (!response || !response.ok) {
    throw createImageProviderError({
      provider: 'openai',
      code: lastStatus === 429 ? 'rate_limited' : lastStatus >= 500 ? 'provider_error' : 'invalid_request',
      message: `OpenAI image generation error: ${lastStatus} ${lastErrorText}`,
      status: lastStatus,
      retryable: lastStatus === 429 || lastStatus >= 500,
      details: { raw_error: lastErrorText },
    });
  }

  const result = (await response.json()) as JsonRecord;
  const imageRows = Array.isArray(result.data) ? result.data : [];
  if (imageRows.length === 0) {
    throw createImageProviderError({
      provider: 'openai',
      code: 'provider_error',
      message: 'OpenAI image generation returned no data',
      retryable: true,
    });
  }

  const dims = parseImageSize(size);
  const now = new Date();
  const generatedImages: GeneratedImage[] = [];
  for (let i = 0; i < imageRows.length; i += 1) {
    const item = imageRows[i] as JsonRecord;
    const b64 = typeof item.b64_json === 'string' ? item.b64_json : null;
    if (!b64) continue;

    const bytes = toPngBytes(b64);
    const imageId = crypto.randomUUID();
    const path = `${userId}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${imageId}.png`;

    const upload = await supabase.storage.from(IMAGE_BUCKET).upload(path, bytes, {
      upsert: false,
      contentType: 'image/png',
      cacheControl: '3600',
    });
    if (upload.error) {
      throw createImageProviderError({
        provider: 'openai',
        code: 'storage_error',
        message: `Failed to store generated image: ${upload.error.message}`,
        retryable: false,
      });
    }

    const signed = await supabase.storage.from(IMAGE_BUCKET).createSignedUrl(path, IMAGE_SIGNED_URL_TTL_SECONDS);
    if (signed.error || !signed.data?.signedUrl) {
      throw createImageProviderError({
        provider: 'openai',
        code: 'storage_error',
        message: `Failed to sign generated image URL: ${signed.error?.message || 'Unknown error'}`,
        retryable: false,
      });
    }

    generatedImages.push({
      id: imageId,
      bucket: IMAGE_BUCKET,
      path,
      signed_url: signed.data.signedUrl,
      mime_type: 'image/png',
      prompt,
      width: dims.width,
      height: dims.height,
      provider: 'openai',
      model,
      expires_at: new Date(Date.now() + IMAGE_SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
    });
  }

  if (generatedImages.length === 0) {
    throw createImageProviderError({
      provider: 'openai',
      code: 'provider_error',
      message: 'Generated image payload was empty after processing',
      retryable: true,
    });
  }

  return {
    content: 'Image generated successfully.',
    model,
    generated_images: generatedImages,
    provider: 'openai',
  };
}

const RETRYABLE_PROVIDER_STATUSES = new Set([429, 503, 529]);

function buildSystemPrompt(extraContext?: string): string {
  if (!extraContext) return DEFAULT_SYSTEM_PROMPT;
  
  // Check if extra context contains image/attachment directives (high priority)
  const hasImageDirective = extraContext.includes('IMAGE PROCESSING') || 
                            extraContext.includes('IMAGE ANALYSIS') ||
                            extraContext.includes('VISION PROCESSING');
  
  if (hasImageDirective) {
    // Put image directives FIRST (higher priority than default prompt)
    return `${extraContext}\n\n${DEFAULT_SYSTEM_PROMPT}`;
  }
  
  // Normal context appended after default prompt
  return `${DEFAULT_SYSTEM_PROMPT}\n\nCONTEXT:\n${extraContext}`;
}

function getOCRPrompt(task: 'homework' | 'document' | 'handwriting'): string {
  return OCR_PROMPT_BY_TASK[task] || OCR_PROMPT_BY_TASK.document;
}

function detectPhonicsMode(
  requestPayload: z.infer<typeof RequestSchema>['payload'],
  metadata?: Record<string, unknown>
): boolean {
  const context = [
    requestPayload.prompt,
    requestPayload.context,
    Array.isArray(requestPayload.messages)
      ? requestPayload.messages
          .map((msg) => (typeof msg.content === 'string' ? msg.content : ''))
          .join('\n')
      : '',
  ]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();

  const role = String(metadata?.role || '').toLowerCase();
  const orgType = String(metadata?.org_type || metadata?.organization_type || '').toLowerCase();
  const ageYears = Number(metadata?.age_years ?? metadata?.learner_age_years ?? Number.NaN);
  const grade = String(metadata?.grade || metadata?.grade_level || '').toLowerCase();

  const explicitPhonics = /\bphonics\b|\bletter\s+sound|\bblend(?:ing)?\b|\bsegment(?:ing)?\b|\brhyme\b|\/[a-z]\//i.test(context);
  const preschoolSignals = (
    orgType.includes('preschool') ||
    orgType.includes('ecd') ||
    role === 'parent' ||
    role === 'student' ||
    (Number.isFinite(ageYears) && ageYears <= 6) ||
    grade === 'grade r' ||
    grade === 'pre-r' ||
    grade === 'pre r' ||
    grade === 'grade 1'
  );

  return explicitPhonics || (preschoolSignals && /\b(letter|sound|alphabet|reading)\b/i.test(context));
}

function extractJsonObjectCandidate(content: string): Record<string, unknown> | null {
  const text = String(content || '').trim();
  if (!text) return null;
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenceMatch?.[1] || text).trim();
  try {
    const parsed = JSON.parse(candidate) as Record<string, unknown>;
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {
    // Ignore and fall through
  }
  const loose = text.match(/\{[\s\S]*\}/);
  if (!loose) return null;
  try {
    const parsed = JSON.parse(loose[0]) as Record<string, unknown>;
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {
    // Ignore
  }
  return null;
}

function normalizeOCRResponse(params: {
  content: string;
  task: 'homework' | 'document' | 'handwriting';
}): {
  extracted_text: string;
  confidence: number;
  document_type: 'homework' | 'document' | 'handwriting';
  analysis: string;
} {
  const parsed = extractJsonObjectCandidate(params.content);
  const extractedText = typeof parsed?.extracted_text === 'string'
    ? parsed.extracted_text
    : typeof parsed?.text === 'string'
      ? parsed.text
      : String(params.content || '').trim();
  const analysis = typeof parsed?.analysis === 'string'
    ? parsed.analysis
    : String(params.content || '').trim();
  const confidenceRaw = typeof parsed?.confidence === 'number'
    ? parsed.confidence
    : typeof parsed?.confidence === 'string'
      ? Number.parseFloat(parsed.confidence)
      : 0.72;
  const confidence = Number.isFinite(confidenceRaw)
    ? Math.min(1, Math.max(0, confidenceRaw))
    : 0.72;
  const documentType = (
    parsed?.document_type === 'homework' ||
    parsed?.document_type === 'document' ||
    parsed?.document_type === 'handwriting'
  )
    ? parsed.document_type
    : params.task;

  return {
    extracted_text: extractedText,
    confidence: Number(confidence.toFixed(2)),
    document_type: documentType,
    analysis,
  };
}

function parseAllowedModels(envKey: string, defaults: string[]): string[] {
  const raw = Deno.env.get(envKey);
  if (!raw) return defaults;
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function pickAllowedModel(
  requested: string | null | undefined,
  allowed: string[],
  fallback: string
): { model: string; usedFallback: boolean; reason?: string } {
  const candidate = (requested || fallback).trim();
  if (allowed.includes(candidate)) {
    return { model: candidate, usedFallback: false };
  }
  if (allowed.includes(fallback)) {
    return { model: fallback, usedFallback: true, reason: `Requested model "${candidate}" not allowed` };
  }
  const safe = allowed[0] || fallback;
  return { model: safe, usedFallback: true, reason: `No allowed models configured, using "${safe}"` };
}

function normalizeRequestedModel(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const key = trimmed.toLowerCase();
  const sonnet4 = getEnv('ANTHROPIC_SONNET_4_MODEL') || 'claude-sonnet-4-20250514';
  const sonnet45 = getEnv('ANTHROPIC_SONNET_4_5_MODEL') || 'claude-sonnet-4-5-20250514';
  const aliases: Record<string, string> = {
    'claude-3-haiku': 'claude-3-haiku-20240307',
    'claude-3-haiku-latest': 'claude-3-haiku-20240307',
    'claude-3-opus': 'claude-3-opus-20240229',
    'claude-3-opus-latest': 'claude-3-opus-20240229',
    'claude-3-sonnet': 'claude-3-sonnet-20240229',
    'claude-3-sonnet-latest': 'claude-3-sonnet-20240229',
    'claude-3-5-haiku': 'claude-3-5-haiku-20241022',
    'claude-3-5-haiku-latest': 'claude-3-5-haiku-20241022',
    'claude-3-5-sonnet': 'claude-3-5-sonnet-20241022',
    'claude-3-5-sonnet-latest': 'claude-3-5-sonnet-20241022',
    'claude-3-7-sonnet': 'claude-3-7-sonnet-20250219',
    'claude-3-7-sonnet-latest': 'claude-3-7-sonnet-20250219',
    'claude-sonnet-4': sonnet4,
    'claude-sonnet-4-latest': sonnet4,
    'claude-sonnet-4.5': sonnet45,
    'claude-sonnet-4-5': sonnet45,
    'claude-sonnet-4-5-latest': sonnet45,
  };

  return aliases[key] || trimmed;
}

async function webSearchTool(args: z.infer<typeof WebSearchArgsSchema>): Promise<JsonRecord> {
  // Try Brave Search API first (much better quality than DuckDuckGo Instant Answers)
  const braveApiKey = getEnv('BRAVE_SEARCH_API_KEY');
  if (braveApiKey) {
    return braveSearch(args, braveApiKey);
  }

  // Fallback to DuckDuckGo Instant Answer API (no key required, lower quality)
  return duckDuckGoSearch(args);
}

async function braveSearch(
  args: z.infer<typeof WebSearchArgsSchema>,
  apiKey: string,
): Promise<JsonRecord> {
  try {
    const params = new URLSearchParams({
      q: args.query,
      count: '5',
      text_decorations: 'false',
      search_lang: 'en',
    });
    if (args.recency === 'day') params.set('freshness', 'pd');
    else if (args.recency === 'week') params.set('freshness', 'pw');
    else if (args.recency === 'month') params.set('freshness', 'pm');

    const response = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey,
      },
    });

    if (!response.ok) {
      console.error(`[webSearch] Brave API error: ${response.status}`);
      return duckDuckGoSearch(args);
    }

    const data = (await response.json()) as JsonRecord;
    const webResults = Array.isArray((data as any).web?.results) ? (data as any).web.results : [];

    const results: Array<JsonRecord> = webResults.slice(0, 5).map((r: any) => ({
      title: r.title || '',
      url: r.url || '',
      snippet: r.description || r.title || '',
      source: 'brave',
    }));

    // Apply domain filter if specified
    const filtered = args.domains && args.domains.length > 0
      ? results.filter((r) => {
          const urlStr = typeof r.url === 'string' ? r.url : '';
          return args.domains!.some((domain) => urlStr.includes(domain));
        })
      : results;

    const infobox = (data as any).infobox?.results?.[0];
    const abstract = infobox?.long_desc || infobox?.description || undefined;

    return { query: args.query, results: filtered, abstract, provider: 'brave' };
  } catch (err) {
    console.error('[webSearch] Brave search failed, falling back to DuckDuckGo:', err);
    return duckDuckGoSearch(args);
  }
}

async function duckDuckGoSearch(args: z.infer<typeof WebSearchArgsSchema>): Promise<JsonRecord> {
  const query = encodeURIComponent(args.query);
  const url = `https://api.duckduckgo.com/?q=${query}&format=json&no_html=1&no_redirect=1`;
  const response = await fetch(url);
  const data = (await response.json()) as JsonRecord;

  const results: Array<JsonRecord> = [];
  const related = Array.isArray(data.RelatedTopics) ? data.RelatedTopics : [];

  for (const item of related) {
    if (item && typeof item === 'object') {
      const entry = item as JsonRecord;
      if (typeof entry.Text === 'string' && typeof entry.FirstURL === 'string') {
        results.push({
          title: entry.Text,
          url: entry.FirstURL,
          snippet: entry.Text,
          source: 'duckduckgo',
        });
      }
      if (Array.isArray(entry.Topics)) {
        for (const sub of entry.Topics) {
          if (sub && typeof sub === 'object') {
            const subEntry = sub as JsonRecord;
            if (typeof subEntry.Text === 'string' && typeof subEntry.FirstURL === 'string') {
              results.push({
                title: subEntry.Text,
                url: subEntry.FirstURL,
                snippet: subEntry.Text,
                source: 'duckduckgo',
              });
            }
          }
        }
      }
    }
  }

  const filtered = args.domains && args.domains.length > 0
    ? results.filter((r) => {
        const urlStr = typeof r.url === 'string' ? r.url : '';
        return args.domains!.some((domain) => urlStr.includes(domain));
      })
    : results;

  return {
    query: args.query,
    results: filtered.slice(0, 5),
    abstract: typeof data.AbstractText === 'string' ? data.AbstractText : undefined,
    provider: 'duckduckgo',
  };
}

function buildOpenAITools(enableTools: boolean, clientTools?: Array<{ name: string; description: string; input_schema: Record<string, unknown> }>) {
  if (!enableTools) return undefined;
  const serverTools = [
    {
      type: 'function',
      function: {
        name: 'web_search',
        description: 'Search the web for up-to-date or external information.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            recency: { type: 'string', description: 'Optional recency filter like "day" or "week"' },
            domains: { type: 'array', items: { type: 'string' } },
          },
          required: ['query'],
        },
      },
    },
  ];
  // Merge client-side tools into OpenAI format
  if (clientTools && clientTools.length > 0) {
    for (const ct of clientTools) {
      serverTools.push({
        type: 'function',
        function: {
          name: ct.name,
          description: ct.description,
          parameters: ct.input_schema as any,
        },
      });
    }
  }
  return serverTools;
}

function buildAnthropicTools(enableTools: boolean, clientTools?: Array<{ name: string; description: string; input_schema: Record<string, unknown> }>) {
  if (!enableTools) return undefined;
  const tools: Array<{ name: string; description: string; input_schema: Record<string, unknown> }> = [
    {
      name: 'web_search',
      description: 'Search the web for up-to-date or external information.',
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          recency: { type: 'string', description: 'Optional recency filter like "day" or "week"' },
          domains: { type: 'array', items: { type: 'string' } },
        },
        required: ['query'],
      },
    },
  ];
  // Merge client-side tools
  if (clientTools && clientTools.length > 0) {
    for (const ct of clientTools) {
      tools.push({
        name: ct.name,
        description: ct.description,
        input_schema: ct.input_schema,
      });
    }
  }
  return tools;
}

function normalizeMessages(payload: z.infer<typeof RequestSchema>['payload'], systemPrompt: string) {
  const baseMessages = payload.conversationHistory || payload.messages;
  const messages: Array<JsonRecord> = [];

  messages.push({ role: 'system', content: systemPrompt });

  if (Array.isArray(baseMessages) && baseMessages.length > 0) {
    for (const msg of baseMessages) {
      messages.push(msg as JsonRecord);
    }
  } else if (payload.prompt) {
    messages.push({ role: 'user', content: payload.prompt });
  }

  const images = Array.isArray(payload.images) ? payload.images : [];
  if (images.length > 0) {
    const imageBlocks = images.map((img) => ({
      type: 'image',
      source: {
        type: 'base64',
        media_type: img.media_type,
        data: img.data,
      },
    }));
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        const existing = messages[i].content;
        if (Array.isArray(existing)) {
          messages[i] = { ...messages[i], content: [...existing, ...imageBlocks] };
        } else {
          messages[i] = {
            ...messages[i],
            content: [
              { type: 'text', text: typeof existing === 'string' ? existing : '' },
              ...imageBlocks,
            ],
          };
        }
        return messages;
      }
    }
    messages.push({
      role: 'user',
      content: [{ type: 'text', text: 'Attached image for review.' }, ...imageBlocks],
    });
  }

  return messages;
}

function mapOpenAIContent(content: unknown) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return String(content ?? '');
  const mapped = content.map((part: any) => {
    if (part?.type === 'text') {
      return { type: 'text', text: part.text || '' };
    }
    if (part?.type === 'image' && part?.source?.data) {
      const mediaType = part.source.media_type || 'image/jpeg';
      const url = `data:${mediaType};base64,${part.source.data}`;
      return { type: 'image_url', image_url: { url } };
    }
    if (part?.type === 'tool_use' || part?.type === 'tool_result') {
      return { type: 'text', text: JSON.stringify(part) };
    }
    if (typeof part?.text === 'string') {
      return { type: 'text', text: part.text };
    }
    return { type: 'text', text: '' };
  });
  return mapped;
}

function normalizeOpenAIMessages(messages: Array<JsonRecord>) {
  return messages.map((msg) => {
    const content = mapOpenAIContent((msg as any).content);
    return { ...msg, content };
  });
}

function chunkText(text: string, maxLen = 120): string[] {
  const safe = (text || '').trim();
  if (!safe) return [];
  const words = safe.split(/\s+/);
  const chunks: string[] = [];
  let buffer = '';
  for (const word of words) {
    const next = buffer ? `${buffer} ${word}` : word;
    if (next.length > maxLen && buffer) {
      chunks.push(buffer);
      buffer = word;
    } else {
      buffer = next;
    }
  }
  if (buffer) chunks.push(buffer);
  return chunks;
}

function buildSseStream(content: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const chunks = chunkText(content, 120);
  return new ReadableStream({
    async start(controller) {
      if (chunks.length === 0) {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
        return;
      }
      for (const chunk of chunks) {
        const payload = {
          type: 'content_block_delta',
          delta: { text: `${chunk} ` },
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        await new Promise((resolve) => setTimeout(resolve, 12));
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
}

/**
 * Call Anthropic with native SSE streaming.
 * Returns a TransformStream that pipes Anthropic's SSE events to the client
 * in a normalised format, and also collects usage/content for post-call logging.
 */
function callAnthropicStreaming(
  messages: Array<JsonRecord>,
  requestedModel: string | null | undefined,
  allowedOverride: string[] | undefined,
  isSuperAdmin: boolean,
  maxTokens: number = DEFAULT_MAX_TOKENS,
  enableTools: boolean = false,
  clientTools?: Array<{ name: string; description: string; input_schema: Record<string, unknown> }>,
): { stream: ReadableStream<Uint8Array>; meta: Promise<ProviderResponse> } {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured.');

  const allowed = allowedOverride || parseAllowedModels('ANTHROPIC_ALLOWED_MODELS', DEFAULT_ANTHROPIC_ALLOWED_MODELS);
  const fallbackModel = DEFAULT_ANTHROPIC_ALLOWED_MODELS[0];
  const superAdminAllowed = parseAllowedModels('SUPERADMIN_ANTHROPIC_MODELS', DEFAULT_SUPERADMIN_ALLOWED_MODELS);
  const selectionAllowed = isSuperAdmin ? superAdminAllowed : allowed;
  const selection = pickAllowedModel(requestedModel || Deno.env.get('ANTHROPIC_MODEL'), selectionAllowed, selectionAllowed[0] || fallbackModel);
  if (selection.usedFallback) console.warn('[ai-proxy] Anthropic streaming model fallback:', selection.reason);
  const model = selection.model;

  const systemPrompt = messages.find((m) => m.role === 'system')?.content || DEFAULT_SYSTEM_PROMPT;
  const encoder = new TextEncoder();

  // Mutable collectors for post-call logging (resolved via metaPromise)
  let fullContent = '';
  let tokensIn = 0;
  let tokensOut = 0;
  let modelUsed = model;
  const pendingToolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];
  let currentToolInputJson = '';
  let resolveMetaPromise: (v: ProviderResponse) => void;
  let rejectMetaPromise: (e: Error) => void;
  const metaPromise = new Promise<ProviderResponse>((res, rej) => {
    resolveMetaPromise = res;
    rejectMetaPromise = rej;
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            temperature: 0.4,
            stream: true,
            messages: messages.filter((m) => m.role !== 'system'),
            system: systemPrompt,
            ...(enableTools ? { tools: buildAnthropicTools(true, clientTools) } : {}),
          }),
        });

        if (!response.ok || !response.body) {
          const errText = await response.text();
          // Send both an error event AND a content event with user-friendly message
          // so the client always has displayable text
          const userMessage = response.status === 529
            ? 'The AI service is temporarily overloaded. Please try again in a moment.'
            : response.status === 401 || response.status === 403
              ? 'AI service authentication error. Please contact support.'
              : `Sorry, the AI service returned an error (${response.status}). Please try again.`;
          const errEvent = { type: 'error', error: errText };
          const contentEvent = { type: 'content_block_delta', delta: { text: userMessage } };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errEvent)}\n\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(contentEvent)}\n\n`));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
          rejectMetaPromise!(new Error(`Anthropic streaming error: ${response.status} ${errText}`));
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE lines
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(':')) continue; // Skip comments & empty lines
            if (!trimmed.startsWith('data: ')) continue;

            const jsonStr = trimmed.slice(6);
            if (jsonStr === '[DONE]') continue;

            try {
              const event = JSON.parse(jsonStr) as JsonRecord;
              const eventType = event.type as string;

              if (eventType === 'message_start') {
                const msg = event.message as JsonRecord | undefined;
                modelUsed = (msg?.model as string) || model;
                const usage = msg?.usage as JsonRecord | undefined;
                tokensIn = (usage?.input_tokens as number) || 0;
              } else if (eventType === 'content_block_start') {
                // Track tool_use content blocks
                const contentBlock = event.content_block as JsonRecord | undefined;
                if (contentBlock?.type === 'tool_use') {
                  pendingToolCalls.push({
                    id: contentBlock.id as string,
                    name: contentBlock.name as string,
                    input: {},
                  });
                  currentToolInputJson = '';
                }
              } else if (eventType === 'content_block_delta') {
                const delta = event.delta as JsonRecord | undefined;
                const deltaType = delta?.type as string | undefined;
                if (deltaType === 'input_json_delta') {
                  // Accumulate tool input JSON fragments
                  currentToolInputJson += (delta?.partial_json as string) || '';
                } else {
                  const text = (delta?.text as string) || '';
                  if (text) {
                    fullContent += text;
                    // Forward to client
                    const clientEvent = {
                      type: 'content_block_delta',
                      delta: { text },
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(clientEvent)}\n\n`));
                  }
                }
              } else if (eventType === 'content_block_stop') {
                // Finalize tool input when block ends
                if (pendingToolCalls.length > 0 && currentToolInputJson) {
                  const lastTool = pendingToolCalls[pendingToolCalls.length - 1];
                  try {
                    lastTool.input = JSON.parse(currentToolInputJson);
                  } catch {
                    lastTool.input = { raw: currentToolInputJson };
                  }
                  currentToolInputJson = '';
                }
              } else if (eventType === 'message_delta') {
                const usage = (event as JsonRecord).usage as JsonRecord | undefined;
                tokensOut = (usage?.output_tokens as number) || 0;
              }
              // Skip ping events
            } catch {
              // Skip malformed JSON lines
            }
          }
        }

        // If Claude responded with tool_use blocks, send them as pending_tool_calls for client execution
        if (pendingToolCalls.length > 0) {
          // Separate server-side tools (web_search) from client-side tools
          const serverTools = pendingToolCalls.filter((t) => t.name === 'web_search');
          const clientPendingTools = pendingToolCalls.filter((t) => t.name !== 'web_search');

          // Execute web_search server-side if requested
          for (const toolCall of serverTools) {
            try {
              const query = (toolCall.input as Record<string, unknown>).query as string || '';
              const webResult = await performWebSearch(query);
              const toolResultText = typeof webResult === 'string' ? webResult : JSON.stringify(webResult);
              fullContent += `\n\n[Web Search: ${query}]\n${toolResultText}`;
              const searchEvent = { type: 'content_block_delta', delta: { text: `\n\n${toolResultText}` } };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(searchEvent)}\n\n`));
            } catch {
              // Web search failed, continue
            }
          }

          // Send client-side pending tool calls
          if (clientPendingTools.length > 0) {
            const toolCallsEvent = { type: 'pending_tool_calls', tool_calls: clientPendingTools };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(toolCallsEvent)}\n\n`));
          }
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
        resolveMetaPromise!({
          content: fullContent,
          model: modelUsed,
          usage: { tokens_in: tokensIn, tokens_out: tokensOut },
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        try {
          const userMessage = 'Sorry, something went wrong while processing your request. Please try again.';
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: errMsg })}\n\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content_block_delta', delta: { text: userMessage } })}\n\n`));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch { /* controller already closed */ }
        rejectMetaPromise!(err instanceof Error ? err : new Error(errMsg));
      }
    },
  });

  return { stream, meta: metaPromise };
}

async function callOpenAI(
  messages: Array<JsonRecord>,
  enableTools: boolean,
  requestedModel?: string | null,
  maxTokens: number = DEFAULT_MAX_TOKENS,
  clientTools?: Array<{ name: string; description: string; input_schema: Record<string, unknown> }>,
): Promise<ProviderResponse> {
  const apiKey = getOpenAIApiKey();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured.');
  }
  const allowed = parseAllowedModels('OPENAI_ALLOWED_MODELS', DEFAULT_OPENAI_ALLOWED_MODELS);
  const fallbackModel = DEFAULT_OPENAI_ALLOWED_MODELS[0];
  const selection = pickAllowedModel(requestedModel || Deno.env.get('OPENAI_MODEL'), allowed, fallbackModel);
  if (selection.usedFallback) {
    console.warn('[ai-proxy] OpenAI model fallback:', selection.reason);
  }
  const model = selection.model;
  const tools = buildOpenAITools(enableTools, clientTools);

  const body: JsonRecord = {
    model,
    messages: normalizeOpenAIMessages(messages),
    temperature: 0.4,
    max_tokens: maxTokens,
  };

  if (tools) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }

  let response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    if (RETRYABLE_PROVIDER_STATUSES.has(response.status)) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const retryText = await response.text();
        throw new Error(`OpenAI error: ${response.status} ${retryText}`);
      }
    } else {
      throw new Error(`OpenAI error: ${response.status} ${errText}`);
    }
  }

  const result = (await response.json()) as JsonRecord;
  const choice = (result.choices as Array<JsonRecord> | undefined)?.[0];
  const message = choice?.message as JsonRecord | undefined;
  const content = typeof message?.content === 'string' ? message.content : '';

  const toolCalls = Array.isArray(message?.tool_calls) ? message?.tool_calls : [];
  const toolResults: ToolResult[] = [];

  if (enableTools && toolCalls.length > 0) {
    for (const call of toolCalls) {
      const toolCall = call as JsonRecord;
      const functionCall = toolCall.function as JsonRecord | undefined;
      if (!functionCall || functionCall.name !== 'web_search') continue;

      let parsedArgs: JsonRecord = {};
      if (typeof functionCall.arguments === 'string') {
        try {
          parsedArgs = JSON.parse(functionCall.arguments) as JsonRecord;
        } catch {
          parsedArgs = {};
        }
      } else if (functionCall.arguments && typeof functionCall.arguments === 'object') {
        parsedArgs = functionCall.arguments as JsonRecord;
      }

      const args = parsedArgs;
      const parsed = WebSearchArgsSchema.safeParse(args);
      if (!parsed.success) continue;

      const output = await webSearchTool(parsed.data);
      toolResults.push({ name: 'web_search', input: parsed.data, output, success: true });

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(output),
      });
    }

    if (toolResults.length > 0) {
      const followUpBody: JsonRecord = {
        model,
        messages: normalizeOpenAIMessages(messages),
        temperature: 0.4,
      };

      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(followUpBody),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI tool follow-up error: ${response.status} ${errText}`);
      }

      const followUpResult = (await response.json()) as JsonRecord;
      const followUpChoice = (followUpResult.choices as Array<JsonRecord> | undefined)?.[0];
      const followUpMessage = followUpChoice?.message as JsonRecord | undefined;
      const followUpContent = typeof followUpMessage?.content === 'string' ? followUpMessage.content : '';

      return {
        content: followUpContent,
        usage: {
          tokens_in: typeof followUpResult.usage === 'object' && followUpResult.usage
            ? (followUpResult.usage as JsonRecord).prompt_tokens as number | undefined
            : undefined,
          tokens_out: typeof followUpResult.usage === 'object' && followUpResult.usage
            ? (followUpResult.usage as JsonRecord).completion_tokens as number | undefined
            : undefined,
        },
        model,
        tool_results: toolResults,
      };
    }
  }

  return {
    content,
    usage: {
      tokens_in: typeof result.usage === 'object' && result.usage
        ? (result.usage as JsonRecord).prompt_tokens as number | undefined
        : undefined,
      tokens_out: typeof result.usage === 'object' && result.usage
        ? (result.usage as JsonRecord).completion_tokens as number | undefined
        : undefined,
    },
    model,
    tool_results: toolResults,
  };
}

async function callAnthropic(
  messages: Array<JsonRecord>,
  enableTools: boolean,
  requestedModel?: string | null,
  allowedOverride?: string[],
  maxTokens: number = DEFAULT_MAX_TOKENS,
  clientTools?: Array<{ name: string; description: string; input_schema: Record<string, unknown> }>,
): Promise<ProviderResponse> {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured.');
  }
  const allowed = allowedOverride || parseAllowedModels('ANTHROPIC_ALLOWED_MODELS', DEFAULT_ANTHROPIC_ALLOWED_MODELS);
  const fallbackModel = DEFAULT_ANTHROPIC_ALLOWED_MODELS[0];
  const selection = pickAllowedModel(requestedModel || Deno.env.get('ANTHROPIC_MODEL'), allowed, fallbackModel);
  if (selection.usedFallback) {
    console.warn('[ai-proxy] Anthropic model fallback:', selection.reason);
  }
  const preferredModel = selection.model;
  const tools = buildAnthropicTools(enableTools, clientTools);
  const systemPrompt = messages.find((m) => m.role === 'system')?.content || DEFAULT_SYSTEM_PROMPT;

  const callAnthropicOnce = async (model: string) => {
    const body: JsonRecord = {
      model,
      max_tokens: maxTokens,
      temperature: 0.4,
      messages: messages.filter((m) => m.role !== 'system'),
      system: systemPrompt,
    };

    if (tools) body.tools = tools;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      return { ok: false, status: response.status, errText, data: null as JsonRecord | null };
    }

    const data = (await response.json()) as JsonRecord;
    return { ok: true, status: response.status, errText: null as string | null, data };
  };

  const isModelNotFound = (errText: string | null): boolean => {
    if (!errText) return false;
    try {
      const parsed = JSON.parse(errText) as JsonRecord;
      const errType = (parsed?.error as JsonRecord | undefined)?.type;
      return errType === 'not_found_error';
    } catch {
      return false;
    }
  };

  const callAnthropicWithFallbacks = async (models: string[]) => {
    let lastError: { ok: false; status: number; errText: string | null; data: JsonRecord | null } | null = null;
    for (const model of models) {
      let res = await callAnthropicOnce(model);
      if (!res.ok && RETRYABLE_PROVIDER_STATUSES.has(res.status)) {
        // Brief retry for transient errors
        await new Promise((resolve) => setTimeout(resolve, 500));
        res = await callAnthropicOnce(model);
      }
      if (res.ok) {
        return { response: res, model };
      }
      if (isModelNotFound(res.errText)) {
        console.warn(`[ai-proxy] Anthropic model not found: ${model}. Trying next...`);
        lastError = res;
        continue;
      }
      if (RETRYABLE_PROVIDER_STATUSES.has(res.status)) {
        lastError = res;
        continue;
      }
      return { response: res, model };
    }
    return { response: lastError as any, model: models[0] };
  };

  const candidates = [preferredModel, ...allowed.filter((m) => m !== preferredModel)];
  const initial = await callAnthropicWithFallbacks(candidates);
  let response = initial.response;
  let modelUsed = initial.model;

  if (!response.ok || !response.data) {
    throw new Error(`Anthropic error: ${response.status} ${response.errText || ''}`);
  }

  const result = response.data as JsonRecord;
  const contentBlocks = Array.isArray(result.content) ? result.content : [];
  const toolResults: ToolResult[] = [];

  let contentText = '';
  const toolUses: Array<JsonRecord> = [];

  for (const block of contentBlocks) {
    const entry = block as JsonRecord;
    if (entry.type === 'text' && typeof entry.text === 'string') {
      contentText += entry.text;
    }
    if (entry.type === 'tool_use') {
      toolUses.push(entry);
    }
  }

  if (enableTools && toolUses.length > 0) {
    // Separate server-side tools (web_search) from client-side tools
    const serverToolUses = toolUses.filter(tu => tu.name === 'web_search');
    const clientToolUses = toolUses.filter(tu => tu.name !== 'web_search');

    for (const toolUse of serverToolUses) {
      const parsed = WebSearchArgsSchema.safeParse(toolUse.input || {});
      if (!parsed.success) continue;

      const output = await webSearchTool(parsed.data);
      toolResults.push({ name: 'web_search', input: parsed.data, output, success: true });

      messages.push({
        role: 'assistant',
        content: [
          { type: 'tool_use', id: toolUse.id, name: 'web_search', input: parsed.data },
        ],
      });

      messages.push({
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(output) },
        ],
      });
    }

    if (toolResults.length > 0) {
      const followUpCandidates = [modelUsed, ...allowed.filter((m) => m !== modelUsed)];
      const followUpResult = await callAnthropicWithFallbacks(followUpCandidates);
      const followUpResponse = followUpResult.response;
      const followUpModel = followUpResult.model;

      if (!followUpResponse.ok || !followUpResponse.data) {
        throw new Error(`Anthropic tool follow-up error: ${followUpResponse.status} ${followUpResponse.errText || ''}`);
      }

      const followUpData = followUpResponse.data as JsonRecord;
      const followUpBlocks = Array.isArray(followUpData.content) ? followUpData.content : [];
      let followUpText = '';
      for (const block of followUpBlocks) {
        const entry = block as JsonRecord;
        if (entry.type === 'text' && typeof entry.text === 'string') {
          followUpText += entry.text;
        }
      }

      return {
        content: followUpText,
        usage: {
          tokens_in: typeof followUpData.usage === 'object' && followUpData.usage
            ? (followUpData.usage as JsonRecord).input_tokens as number | undefined
            : undefined,
          tokens_out: typeof followUpData.usage === 'object' && followUpData.usage
            ? (followUpData.usage as JsonRecord).output_tokens as number | undefined
            : undefined,
        },
        model: followUpModel,
        tool_results: toolResults,
      };
    }

    // If there are client-side tool calls that we can't execute server-side,
    // return them as pending_tool_calls for the client to handle
    if (clientToolUses.length > 0) {
      const pendingCalls = clientToolUses.map(tu => ({
        id: tu.id as string,
        name: tu.name as string,
        input: (tu.input || {}) as Record<string, unknown>,
      }));
      return {
        content: contentText,
        usage: {
          tokens_in: typeof result.usage === 'object' && result.usage
            ? (result.usage as JsonRecord).input_tokens as number | undefined
            : undefined,
          tokens_out: typeof result.usage === 'object' && result.usage
            ? (result.usage as JsonRecord).output_tokens as number | undefined
            : undefined,
        },
        model: modelUsed,
        tool_results: toolResults,
        pending_tool_calls: pendingCalls,
      };
    }
  }

  return {
    content: contentText,
    usage: {
      tokens_in: typeof result.usage === 'object' && result.usage
        ? (result.usage as JsonRecord).input_tokens as number | undefined
        : undefined,
      tokens_out: typeof result.usage === 'object' && result.usage
        ? (result.usage as JsonRecord).output_tokens as number | undefined
        : undefined,
    },
    model: modelUsed,
    tool_results: toolResults,
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  try {
    if (req.method === 'OPTIONS') {
      return handleCorsOptions(req);
    }
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({
        error: 'invalid_json',
        message: 'Invalid JSON body',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: 'Invalid request payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = parsed.data;
    const authHeader = req.headers.get('Authorization') || '';

    const supabaseUrl = getEnv('SUPABASE_URL') || getEnv('EXPO_PUBLIC_SUPABASE_URL');
    const supabaseAnonKey = getEnv('SUPABASE_ANON_KEY') || getEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY');
    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(JSON.stringify({
        error: 'config_missing',
        message: 'Supabase environment variables are missing (SUPABASE_URL / SUPABASE_ANON_KEY).',
      }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, organization_id, preschool_id')
      .eq('id', userData.user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: 'Organization membership required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if dev mode is enabled to bypass quota checks
    // SECURITY: Only allow bypass in explicit development environments, never in production
    const environment = Deno.env.get('ENVIRONMENT') || 'production';
    const devModeBypass = Deno.env.get('AI_QUOTA_BYPASS') === 'true' && 
                          (environment === 'development' || environment === 'local');
    
    if (devModeBypass) {
      console.warn('[ai-proxy] ⚠️ QUOTA BYPASS ACTIVE - Development mode only');
    }
    
    let quotaDataForRequest: JsonRecord | null = null;
    if (!devModeBypass) {
      const quota = await supabase.rpc('check_ai_usage_limit', {
        p_user_id: userData.user.id,
        p_request_type: normalizeServiceType(payload.service_type),
      });

      if (quota.error) {
        console.warn('[ai-proxy] check_ai_usage_limit failed, allowing request:', quota.error);
      } else {
        const quotaData = quota.data as JsonRecord | null;
        quotaDataForRequest = quotaData;
        if (quotaData && typeof quotaData.allowed === 'boolean' && !quotaData.allowed) {
          return new Response(JSON.stringify({
            error: 'quota_exceeded',
            message: 'AI usage quota exceeded for this billing period',
            details: quotaData,
          }), {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    } else {
      console.log('[ai-proxy] Dev mode: quota check bypassed (env:', environment, ')');
    }

    const wantsStream = payload.stream === true;
    const normalizedServiceType = normalizeServiceType(payload.service_type);
    const requestedOCRMode = payload.payload.ocr_mode === true || normalizedServiceType === 'image_analysis';
    const ocrTask = payload.payload.ocr_task || 'document';
    const ocrResponseFormat = payload.payload.ocr_response_format || 'text';
    const phonicsMode = detectPhonicsMode(payload.payload, payload.metadata as Record<string, unknown> | undefined);

    const contextParts = [
      payload.payload.context,
      phonicsMode ? SHARED_PHONICS_PROMPT_BLOCK : null,
      requestedOCRMode ? getOCRPrompt(ocrTask) : null,
    ].filter(Boolean);
    const mergedContext = contextParts.length > 0 ? contextParts.join('\n\n') : undefined;

    const systemPrompt = buildSystemPrompt(mergedContext);
    const rawMessages = normalizeMessages(payload.payload, systemPrompt);
    // Redact PII before sending to AI providers
    const messages = redactMessagesForProvider(rawMessages);
    const serviceType = normalizedServiceType;
    const maxTokens = getMaxTokensForService(requestedOCRMode ? 'image_analysis' : serviceType);

    const normalizedRequestedModel = normalizeRequestedModel(
      typeof payload.payload.model === 'string' ? payload.payload.model : null
    );
    const preferOpenAI = payload.prefer_openai ?? false;
    const enableTools = payload.enable_tools ?? false;
    const hasOpenAI = !!getOpenAIApiKey();
    const hasAnthropic = !!getAnthropicApiKey();
    const hasImagen = isImagenConfigured();

    if (serviceType !== 'image_generation' && !hasOpenAI && !hasAnthropic) {
      return new Response(JSON.stringify({
        error: 'provider_not_configured',
        message: 'No AI provider keys are configured (OPENAI_API_KEY / ANTHROPIC_API_KEY).',
      }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const profileRole = String(profile.role || '').toLowerCase();
    const isSuperAdmin = profileRole === 'superadmin' || profileRole === 'super_admin';
    const superAdminAllowed = parseAllowedModels('SUPERADMIN_ANTHROPIC_MODELS', DEFAULT_SUPERADMIN_ALLOWED_MODELS);
    const openaiAllowed = parseAllowedModels('OPENAI_ALLOWED_MODELS', DEFAULT_OPENAI_ALLOWED_MODELS);
    const anthropicAllowed = parseAllowedModels('ANTHROPIC_ALLOWED_MODELS', DEFAULT_ANTHROPIC_ALLOWED_MODELS);
    const requestedModel = normalizedRequestedModel;
    const requestedIsOpenAI = requestedModel ? openaiAllowed.includes(requestedModel) : false;
    const requestedIsAnthropic = requestedModel ? anthropicAllowed.includes(requestedModel) : false;
    const shouldPreferOpenAI = requestedIsOpenAI ? true : requestedIsAnthropic ? false : preferOpenAI;

    if (serviceType === 'image_generation') {
      const prompt = payload.payload.prompt?.trim();
      if (!prompt) {
        return new Response(JSON.stringify({
          error: 'invalid_prompt',
          message: 'Prompt is required for image generation',
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!hasOpenAI && !hasImagen) {
        return new Response(JSON.stringify({
          error: 'provider_not_configured',
          message: 'No image provider is configured (OPENAI_API_KEY or Imagen credentials).',
        }), {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const tierName = normalizeTierName(quotaDataForRequest?.current_tier);
      const imageOptions = coerceImageOptionsForTier(payload.payload.image_options, tierName);
      const imageFallbackEnabled = isImageFallbackEnabled();
      const hasImagenForRequest = hasImagen && imageFallbackEnabled;
      const providerChain = buildImageProviderChain({
        options: imageOptions,
        hasOpenAI,
        hasImagen: hasImagenForRequest,
        fallbackEnabled: imageFallbackEnabled,
      });

      if (providerChain.length === 0) {
        return new Response(JSON.stringify({
          error: 'provider_not_configured',
          message: 'No usable image provider is configured for this request.',
        }), {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let providerResponse: ProviderResponse | null = null;
      let providerUsed: ImageProvider | null = null;
      let fallbackUsed = false;
      let fallbackReason: string | undefined;
      let terminalError: ImageProviderError | null = null;
      const requestedLower = String(requestedModel || '').toLowerCase();
      const openAIRequestedModel = requestedLower.includes('gpt') ? requestedModel : null;
      const imagenRequestedModel = requestedLower.includes('imagen') ? requestedModel : null;

      for (let i = 0; i < providerChain.length; i += 1) {
        const provider = providerChain[i];
        try {
          providerResponse = provider === 'openai'
            ? await callOpenAIImageGeneration({
              supabase,
              userId: userData.user.id,
              prompt,
              options: imageOptions,
              requestedModel: provider === 'openai' ? openAIRequestedModel : null,
            })
            : await callImagenImageGeneration({
              supabase,
              userId: userData.user.id,
              prompt,
              options: imageOptions,
              requestedModel: provider === 'google' ? imagenRequestedModel : null,
            });
          providerUsed = provider;
          break;
        } catch (error) {
          const normalizedError = normalizeImageProviderError(error, provider);
          terminalError = normalizedError;
          const hasAnotherProvider = i < providerChain.length - 1;
          const shouldFallback = hasAnotherProvider && normalizedError.retryable;
          if (shouldFallback) {
            fallbackUsed = true;
            fallbackReason = `${provider}:${normalizedError.code}`;
            console.warn('[ai-proxy] Image provider failed, trying fallback:', {
              provider,
              code: normalizedError.code,
              status: normalizedError.status,
            });
            continue;
          }

          const status = normalizedError.code === 'content_policy_violation'
            ? 400
            : normalizedError.status && normalizedError.status >= 400 && normalizedError.status < 600
              ? normalizedError.status
              : 502;
          return new Response(JSON.stringify({
            error: normalizedError.code,
            message: normalizedError.message,
            details: {
              provider: normalizedError.provider,
              fallback_used: fallbackUsed,
              fallback_reason: fallbackReason || null,
              tier: tierName,
            },
          }), {
            status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      if (!providerResponse || !providerUsed) {
        const last = terminalError || createImageProviderError({
          provider: 'openai',
          code: 'provider_error',
          message: 'No image provider produced a response.',
          retryable: false,
        });
        return new Response(JSON.stringify({
          error: last.code,
          message: last.message,
          details: {
            provider: last.provider,
            fallback_used: fallbackUsed,
            fallback_reason: fallbackReason || null,
          },
        }), {
          status: last.status && last.status >= 400 ? last.status : 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const generatedImages = providerResponse.generated_images || [];
      const estimatedCostUsd = estimateImageCostUsd({
        provider: providerUsed,
        size: imageOptions.size,
        quality: imageOptions.quality,
        imageCount: generatedImages.length,
        model: providerResponse.model,
      });

      try {
        const usageResult = await supabase.rpc('record_ai_usage', {
          p_user_id: userData.user.id,
          p_feature_used: 'image_generation',
          p_model_used: providerResponse.model || (providerUsed === 'openai' ? 'gpt-image-1' : 'imagen'),
          p_tokens_used: 0,
          p_request_tokens: 0,
          p_response_tokens: 0,
          p_success: true,
          p_metadata: {
            scope: payload.scope,
            organization_id: profile.organization_id || profile.preschool_id || null,
            provider_used: providerUsed,
            fallback_used: fallbackUsed,
            fallback_reason: fallbackReason || null,
            fallback_feature_enabled: imageFallbackEnabled,
            estimated_cost_usd: estimatedCostUsd,
            size: imageOptions.size,
            quality: imageOptions.quality,
            generated_images: generatedImages.map((img) => ({
              id: img.id,
              bucket: img.bucket,
              path: img.path,
              provider: img.provider,
            })),
            request_metadata: payload.metadata || {},
            request_image_options: imageOptions,
            provider_chain: providerChain,
            current_tier: tierName,
          },
        });
        if (usageResult.error) {
          console.warn('[ai-proxy] record_ai_usage returned error (non-fatal):', usageResult.error);
        }
      } catch (usageError) {
        console.warn('[ai-proxy] record_ai_usage failed (non-fatal):', usageError);
      }

      return new Response(JSON.stringify({
        success: true,
        content: providerResponse.content,
        usage: providerResponse.usage,
        model: providerResponse.model,
        generated_images: generatedImages,
        provider: providerUsed,
        fallback_used: fallbackUsed,
        fallback_reason: fallbackReason,
        tool_results: [],
        pending_tool_calls: [],
        resolution_status: 'resolved',
        confidence_score: 0.95,
        escalation_offer: false,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── TRUE STREAMING (Anthropic, including tool calls) ──────────────
    // When the client wants streaming AND we're using Anthropic,
    // use native Anthropic SSE streaming for real-time token delivery.
    // Tool use blocks are handled inline during streaming.
    const canTrueStream = wantsStream && hasAnthropic && !shouldPreferOpenAI;
    if (canTrueStream) {
      try {
        const allowedOverride = isSuperAdmin ? superAdminAllowed : undefined;
        const clientToolDefs = enableTools && payload.client_tools?.length > 0
          ? payload.client_tools as Array<{ name: string; description: string; input_schema: Record<string, unknown> }>
          : undefined;
        const { stream, meta } = callAnthropicStreaming(
          messages,
          requestedModel,
          allowedOverride,
          isSuperAdmin,
          maxTokens,
          enableTools,
          clientToolDefs,
        );

        // Fire-and-forget: log usage after stream completes
        meta.then(async (providerResponse) => {
          try {
            await supabase.rpc('record_ai_usage', {
              p_user_id: userData.user.id,
              p_feature_used: normalizeServiceType(payload.service_type),
              p_model_used: providerResponse.model || 'anthropic',
              p_tokens_used: (providerResponse.usage?.tokens_in || 0) + (providerResponse.usage?.tokens_out || 0),
              p_request_tokens: providerResponse.usage?.tokens_in || 0,
              p_response_tokens: providerResponse.usage?.tokens_out || 0,
              p_success: true,
              p_metadata: {
                scope: payload.scope,
                organization_id: profile.organization_id || profile.preschool_id || null,
                streaming: true,
                request_metadata: payload.metadata || {},
              },
            });
          } catch (usageErr) {
            console.warn('[ai-proxy] Streaming usage recording failed (non-fatal):', usageErr);
          }
        }).catch((streamErr) => {
          console.warn('[ai-proxy] Streaming meta error (non-fatal):', streamErr);
        });

        return new Response(stream, {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        });
      } catch (streamError) {
        console.warn('[ai-proxy] True streaming failed, falling back to post-hoc:', streamError);
        // Fall through to non-streaming path below
      }
    }

    const clientTools = payload.client_tools || undefined;

    let providerResponse: ProviderResponse;
    const primaryProvider: 'anthropic' | 'openai' = isSuperAdmin
      ? 'anthropic'
      : shouldPreferOpenAI
        ? 'openai'
        : 'anthropic';

    const callProvider = async (provider: 'anthropic' | 'openai'): Promise<ProviderResponse> => {
      if (provider === 'anthropic') {
        if (!hasAnthropic) throw new Error('ANTHROPIC_API_KEY missing and Anthropic not configured.');
        const model = isSuperAdmin
          ? pickAllowedModel(requestedModel, superAdminAllowed, superAdminAllowed[0]).model
          : requestedModel;
        const allowedOverride = isSuperAdmin ? superAdminAllowed : undefined;
        return await callAnthropic(messages, enableTools, model, allowedOverride, maxTokens, clientTools);
      }
      if (!hasOpenAI) throw new Error('OPENAI_API_KEY missing and OpenAI not configured.');
      return await callOpenAI(messages, enableTools, requestedModel, maxTokens, clientTools);
    };

    try {
      providerResponse = await callProvider(primaryProvider);
    } catch (providerError) {
      const providerMessage = providerError instanceof Error ? providerError.message : String(providerError);
      // For non-superadmin, try alternate provider if available
      if (!isSuperAdmin && hasOpenAI && hasAnthropic) {
        const fallbackProvider = primaryProvider === 'anthropic' ? 'openai' : 'anthropic';
        console.warn('[ai-proxy] Primary provider failed, attempting fallback:', {
          primaryProvider,
          fallbackProvider,
          error: providerMessage,
        });
        try {
          providerResponse = await callProvider(fallbackProvider);
        } catch (fallbackError) {
          const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
          console.error('[ai-proxy] Provider error:', providerMessage, 'Fallback error:', fallbackMessage);
          return new Response(JSON.stringify({
            error: 'provider_error',
            message: providerMessage,
            fallback: fallbackMessage,
          }), {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } else {
        console.error('[ai-proxy] Provider error:', providerMessage);
        return new Response(JSON.stringify({
          error: 'provider_error',
          message: providerMessage,
        }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    try {
      const usageResult = await supabase.rpc('record_ai_usage', {
        p_user_id: userData.user.id,
        p_feature_used: normalizeServiceType(payload.service_type),
        p_model_used: providerResponse.model || (preferOpenAI ? 'openai' : 'anthropic'),
        p_tokens_used: (providerResponse.usage?.tokens_in || 0) + (providerResponse.usage?.tokens_out || 0),
        p_request_tokens: providerResponse.usage?.tokens_in || 0,
        p_response_tokens: providerResponse.usage?.tokens_out || 0,
        p_success: true,
        p_metadata: {
          scope: payload.scope,
          organization_id: profile.organization_id || profile.preschool_id || null,
          tool_results: providerResponse.tool_results || [],
          request_metadata: payload.metadata || {},
        },
      });
      if (usageResult.error) {
        console.warn('[ai-proxy] record_ai_usage returned error (non-fatal):', usageResult.error);
      }
    } catch (usageError) {
      console.warn('[ai-proxy] record_ai_usage failed (non-fatal):', usageError);
    }

    const normalizedOCR = requestedOCRMode
      ? normalizeOCRResponse({
          content: providerResponse.content || '',
          task: ocrTask,
        })
      : null;
    const responseContent = requestedOCRMode && ocrResponseFormat === 'json'
      ? JSON.stringify(normalizedOCR)
      : (providerResponse.content || normalizedOCR?.analysis || '');

    if (wantsStream) {
      return new Response(buildSseStream(responseContent), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    const requestMetadata = (payload.metadata || {}) as Record<string, unknown>;
    const resolutionMeta = deriveResolutionMetadata(
      requestMetadata,
      providerResponse.pending_tool_calls?.length || 0
    );

    return new Response(JSON.stringify({
      success: true,
      content: responseContent,
      usage: providerResponse.usage,
      model: providerResponse.model,
      generated_images: providerResponse.generated_images || [],
      tool_results: providerResponse.tool_results || [],
      pending_tool_calls: providerResponse.pending_tool_calls || [],
      ocr: normalizedOCR || undefined,
      resolution_status: resolutionMeta.resolution_status,
      confidence_score: resolutionMeta.confidence_score,
      escalation_offer: resolutionMeta.escalation_offer,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: 'ai_proxy_error', message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
