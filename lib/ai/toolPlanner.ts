import { resolveAIProxyScopeFromRole } from './aiProxyScope';

export type ToolPlannerCandidate = {
  name: string;
  description: string;
  parameters?: any;
};

export type ToolPlanResult = {
  tool: string | null;
  parameters?: Record<string, any>;
  reason?: string;
};

const KEYWORD_HINTS = [
  // Curriculum & education
  'caps', 'curriculum', 'syllabus', 'lesson', 'subject', 'grade',
  // Assignments & homework
  'assignment', 'assignments', 'homework', 'worksheet', 'activity',
  // Schedule & events
  'schedule', 'timetable', 'event', 'events', 'due', 'calendar',
  // Students & classes
  'attendance', 'progress', 'student', 'learner', 'class', 'classes',
  // Analytics & reports
  'stats', 'statistics', 'report', 'analytics', 'performance',
  // Documents & export
  'export', 'pdf', 'document', 'open', 'link',
  // Communication
  'message', 'email', 'compose', 'send', 'notify',
  // Support
  'help', 'support', 'ticket', 'issue',
  // Members
  'teacher', 'parent', 'member', 'list',
];

export function shouldAttemptToolPlan(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  if (normalized.length < 6) return false;
  return KEYWORD_HINTS.some((keyword) => normalized.includes(keyword));
}

const buildPlannerPrompt = (message: string, tools: ToolPlannerCandidate[]) => {
  const toolList = tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }));

  return [
    'You are a tool planner for the Dash app.',
    'Decide if a single tool should be called to answer the user.',
    'Only select a tool if it clearly helps answer the request.',
    'If no tool is needed, respond with {"tool": null}.',
    'Return JSON only. No markdown, no explanations.',
    '',
    `User message: """${message}"""`,
    '',
    'Allowed tools:',
    JSON.stringify(toolList, null, 2),
    '',
    'Return JSON in this format:',
    '{"tool": "tool_name_or_null", "parameters": { "param": "value" }, "reason": "short reason"}',
  ].join('\n');
};

const extractJsonBlock = (text: string): string | null => {
  if (!text) return null;
  const trimmed = text.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return trimmed.slice(start, end + 1);
};

export async function planToolCall(options: {
  supabaseClient: any;
  role: string;
  message: string;
  tools: ToolPlannerCandidate[];
}): Promise<ToolPlanResult | null> {
  const { supabaseClient, role, message, tools } = options;
  if (!supabaseClient || tools.length === 0) return null;

  const prompt = buildPlannerPrompt(message, tools);
  const scope = resolveAIProxyScopeFromRole(role);

  const { data, error } = await supabaseClient.functions.invoke('ai-proxy', {
    body: {
      scope,
      service_type: 'chat_message',
      payload: {
        prompt,
      },
      stream: false,
      enable_tools: false,
      prefer_openai: true,
      metadata: {
        source: 'dash_tool_planner',
      },
    },
  });

  if (error) {
    return null;
  }

  const content = typeof data?.content === 'string' ? data.content : '';
  const jsonBlock = extractJsonBlock(content);
  if (!jsonBlock) return null;

  try {
    const parsed = JSON.parse(jsonBlock);
    const toolName = parsed.tool || parsed.tool_name || parsed.name || null;
    const normalizedTool = typeof toolName === 'string' ? toolName.trim() : null;
    if (!normalizedTool || normalizedTool === 'none') {
      return { tool: null };
    }
    const allowed = tools.some((tool) => tool.name === normalizedTool);
    if (!allowed) return null;

    return {
      tool: normalizedTool,
      parameters: parsed.parameters || {},
      reason: parsed.reason,
    };
  } catch {
    return null;
  }
}
