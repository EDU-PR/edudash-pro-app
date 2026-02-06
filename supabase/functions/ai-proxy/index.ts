import { serve } from 'https://deno.land/std@0.214.0/http/server.ts';
import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.1';

type JsonRecord = Record<string, unknown>;

type ToolResult = {
  name: string;
  input: JsonRecord;
  output: JsonRecord;
  success: boolean;
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
};

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
      image_context: z.record(z.unknown()).optional(),
      voice_data: z.record(z.unknown()).optional(),
      model: z.string().optional(),
    })
    .default({}),
  stream: z.boolean().optional(),
  enable_tools: z.boolean().optional().default(false),
  prefer_openai: z.boolean().optional().default(false),
  metadata: z.record(z.unknown()).optional(),
});

function normalizeServiceType(serviceType?: string): string {
  if (!serviceType) return 'chat_message';
  if (serviceType === 'dash_conversation' || serviceType === 'dash_ai') {
    return 'chat_message';
  }
  return serviceType;
}

const WebSearchArgsSchema = z.object({
  query: z.string().min(2),
  recency: z.string().optional(),
  domains: z.array(z.string()).optional(),
});

const DEFAULT_SYSTEM_PROMPT = `You are Dash, an AI tutor for parents and students.\n\nCORE BEHAVIOR:\n- Always teach step-by-step, ask one short question at a time, and wait for the learner’s response.\n- Never assume age, grade, language, or background knowledge. Ask for them if missing.\n- Never refuse to help or say you can’t help. If info is missing, ask. If tools are needed, use them.\n- Keep responses short and interactive.\n\nTUTOR FLOW:\nDiagnose → Teach → Practice → Check.\n\nWEB SEARCH TOOL:\nIf the user asks about information not in the curriculum/context, call the web_search tool to retrieve trustworthy sources.\n\nLANGUAGE:\nIf the user’s preferred language is unknown, ask which language they prefer (English, Afrikaans, isiZulu).`;

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': Deno.env.get('CORS_ALLOW_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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
  };
}

function buildOpenAITools(enableTools: boolean) {
  if (!enableTools) return undefined;
  return [
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
}

function buildAnthropicTools(enableTools: boolean) {
  if (!enableTools) return undefined;
  return [
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
            max_tokens: 1024,
            temperature: 0.4,
            stream: true,
            messages: messages.filter((m) => m.role !== 'system'),
            system: systemPrompt,
          }),
        });

        if (!response.ok || !response.body) {
          const errText = await response.text();
          const errEvent = { type: 'error', error: errText };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errEvent)}\n\n`));
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
              } else if (eventType === 'content_block_delta') {
                const delta = event.delta as JsonRecord | undefined;
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
              } else if (eventType === 'message_delta') {
                const usage = (event as JsonRecord).usage as JsonRecord | undefined;
                tokensOut = (usage?.output_tokens as number) || 0;
              }
              // Skip ping, content_block_start, content_block_stop events
            } catch {
              // Skip malformed JSON lines
            }
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
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: errMsg })}\n\n`));
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
  requestedModel?: string | null
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
  const tools = buildOpenAITools(enableTools);

  const body: JsonRecord = {
    model,
    messages: normalizeOpenAIMessages(messages),
    temperature: 0.4,
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
  allowedOverride?: string[]
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
  const tools = buildAnthropicTools(enableTools);
  const systemPrompt = messages.find((m) => m.role === 'system')?.content || DEFAULT_SYSTEM_PROMPT;

  const callAnthropicOnce = async (model: string) => {
    const body: JsonRecord = {
      model,
      max_tokens: 1024,
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
    for (const toolUse of toolUses) {
      if (toolUse.name !== 'web_search') continue;
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
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
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
    const devModeBypass = Deno.env.get('AI_QUOTA_BYPASS') === 'true' || 
                          Deno.env.get('ENVIRONMENT') === 'development';
    
    if (!devModeBypass) {
      const quota = await supabase.rpc('check_ai_usage_limit', {
        p_user_id: userData.user.id,
        p_request_type: normalizeServiceType(payload.service_type),
      });

      if (quota.error) {
        console.warn('[ai-proxy] check_ai_usage_limit failed, allowing request:', quota.error);
      } else {
        const quotaData = quota.data as JsonRecord | null;
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
      console.log('[ai-proxy] Dev mode: quota check bypassed');
    }

    const wantsStream = payload.stream === true;

    const systemPrompt = buildSystemPrompt(payload.payload.context);
    const messages = normalizeMessages(payload.payload, systemPrompt);

    const normalizedRequestedModel = normalizeRequestedModel(
      typeof payload.payload.model === 'string' ? payload.payload.model : null
    );
    const preferOpenAI = payload.prefer_openai ?? false;
    const enableTools = payload.enable_tools ?? false;
    const hasOpenAI = !!getOpenAIApiKey();
    const hasAnthropic = !!getAnthropicApiKey();

    if (!hasOpenAI && !hasAnthropic) {
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

    // ── TRUE STREAMING (Anthropic only, non-tool calls) ──────────────
    // When the client wants streaming AND we're using Anthropic AND tools are disabled,
    // use native Anthropic SSE streaming for real-time token delivery.
    // Tool calls require the full response for follow-up, so they use the post-hoc path.
    const canTrueStream = wantsStream && hasAnthropic && !enableTools && !shouldPreferOpenAI;
    if (canTrueStream) {
      try {
        const allowedOverride = isSuperAdmin ? superAdminAllowed : undefined;
        const { stream, meta } = callAnthropicStreaming(
          messages,
          requestedModel,
          allowedOverride,
          isSuperAdmin,
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
        return await callAnthropic(messages, enableTools, model, allowedOverride);
      }
      if (!hasOpenAI) throw new Error('OPENAI_API_KEY missing and OpenAI not configured.');
      return await callOpenAI(messages, enableTools, requestedModel);
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

    if (wantsStream) {
      return new Response(buildSseStream(providerResponse.content || ''), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      content: providerResponse.content,
      usage: providerResponse.usage,
      model: providerResponse.model,
      tool_results: providerResponse.tool_results || [],
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
