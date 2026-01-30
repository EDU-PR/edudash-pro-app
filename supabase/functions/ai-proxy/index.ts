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
    })
    .default({}),
  stream: z.boolean().optional(),
  enable_tools: z.boolean().optional().default(false),
  prefer_openai: z.boolean().optional().default(false),
  metadata: z.record(z.unknown()).optional(),
});

function normalizeServiceType(serviceType?: string): string {
  if (!serviceType) return 'chat_message';
  if (serviceType === 'dash_conversation' || serviceType === 'dash_ai' || serviceType === 'homework_help') {
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

function getEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function buildSystemPrompt(extraContext?: string): string {
  if (!extraContext) return DEFAULT_SYSTEM_PROMPT;
  return `${DEFAULT_SYSTEM_PROMPT}\n\nCONTEXT:\n${extraContext}`;
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

  return messages;
}

async function callOpenAI(messages: Array<JsonRecord>, enableTools: boolean): Promise<ProviderResponse> {
  const apiKey = getEnv('OPENAI_API_KEY');
  const model = Deno.env.get('OPENAI_MODEL') || 'gpt-4o-mini';
  const tools = buildOpenAITools(enableTools);

  const body: JsonRecord = {
    model,
    messages,
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
    throw new Error(`OpenAI error: ${response.status} ${errText}`);
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
        messages,
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

async function callAnthropic(messages: Array<JsonRecord>, enableTools: boolean): Promise<ProviderResponse> {
  const apiKey = getEnv('ANTHROPIC_API_KEY');
  const model = Deno.env.get('ANTHROPIC_MODEL') || 'claude-3-5-sonnet-20241022';
  const tools = buildAnthropicTools(enableTools);

  const body: JsonRecord = {
    model,
    max_tokens: 1024,
    temperature: 0.4,
    messages: messages.filter((m) => m.role !== 'system'),
    system: messages.find((m) => m.role === 'system')?.content || DEFAULT_SYSTEM_PROMPT,
  };

  if (tools) body.tools = tools;

  let response = await fetch('https://api.anthropic.com/v1/messages', {
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
    throw new Error(`Anthropic error: ${response.status} ${errText}`);
  }

  const result = (await response.json()) as JsonRecord;
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
      const followUpBody: JsonRecord = {
        model,
        max_tokens: 1024,
        temperature: 0.4,
        messages: messages.filter((m) => m.role !== 'system'),
        system: messages.find((m) => m.role === 'system')?.content || DEFAULT_SYSTEM_PROMPT,
      };

      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(followUpBody),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Anthropic tool follow-up error: ${response.status} ${errText}`);
      }

      const followUpResult = (await response.json()) as JsonRecord;
      const followUpBlocks = Array.isArray(followUpResult.content) ? followUpResult.content : [];
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
          tokens_in: typeof followUpResult.usage === 'object' && followUpResult.usage
            ? (followUpResult.usage as JsonRecord).input_tokens as number | undefined
            : undefined,
          tokens_out: typeof followUpResult.usage === 'object' && followUpResult.usage
            ? (followUpResult.usage as JsonRecord).output_tokens as number | undefined
            : undefined,
        },
        model,
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
    model,
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

    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: 'Invalid request payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = parsed.data;
    const authHeader = req.headers.get('Authorization') || '';

    const supabaseUrl = getEnv('SUPABASE_URL');
    const supabaseAnonKey = getEnv('SUPABASE_ANON_KEY');

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

    const quota = await supabase.rpc('check_ai_usage_limit', {
      p_user_id: userData.user.id,
      p_request_type: normalizeServiceType(payload.service_type),
    });

    const quotaData = quota.data as JsonRecord | null;
    if (quotaData && typeof quotaData.allowed === 'boolean' && !quotaData.allowed) {
      return new Response(JSON.stringify({
        error: 'quota_exceeded',
        details: quotaData,
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (payload.stream) {
      return new Response(JSON.stringify({
        error: 'streaming_not_supported',
        message: 'Streaming is not enabled in ai-proxy yet.',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = buildSystemPrompt(payload.payload.context);
    const messages = normalizeMessages(payload.payload, systemPrompt);

    const preferOpenAI = payload.prefer_openai ?? false;
    const enableTools = payload.enable_tools ?? false;

    const providerResponse = preferOpenAI
      ? await callOpenAI(messages, enableTools)
      : await callAnthropic(messages, enableTools);

    await supabase.rpc('record_ai_usage', {
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
