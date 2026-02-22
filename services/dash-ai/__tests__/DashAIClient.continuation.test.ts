const executeMock = jest.fn();
const toClientToolDefsMock = jest.fn();
const listMock = jest.fn();

jest.mock('@/services/tools/UnifiedToolRegistry', () => ({
  unifiedToolRegistry: {
    execute: (...args: any[]) => executeMock(...args),
    toClientToolDefs: (...args: any[]) => toClientToolDefsMock(...args),
    list: (...args: any[]) => listMock(...args),
  },
}));

import { DashAIClient } from '../DashAIClient';

describe('DashAIClient continuation loop', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    toClientToolDefsMock.mockReturnValue([
      {
        name: 'support_check_user_context',
        description: 'Check support context',
        input_schema: { type: 'object', properties: {} },
      },
      {
        name: 'support_create_ticket',
        description: 'Create support ticket',
        input_schema: { type: 'object', properties: {} },
      },
    ]);
    listMock.mockReturnValue([
      { name: 'support_check_user_context' },
      { name: 'support_create_ticket' },
    ]);
  });

  it('runs bounded two-pass continuation and resolves pending tools', async () => {
    const invokeMock = jest
      .fn()
      .mockResolvedValueOnce({
        data: {
          success: true,
          content: 'I will check that for you.',
          tool_results: [],
          pending_tool_calls: [{ id: 'tool-1', name: 'support_check_user_context', input: {} }],
          resolution_status: 'needs_clarification',
          confidence_score: 0.62,
          escalation_offer: false,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          success: true,
          content: 'I need one more support action.',
          tool_results: [],
          pending_tool_calls: [
            {
              id: 'tool-2',
              name: 'support_create_ticket',
              input: {
                subject: 'Dash escalation',
                description: 'Issue unresolved',
              },
            },
          ],
          resolution_status: 'needs_clarification',
          confidence_score: 0.56,
          escalation_offer: true,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          success: true,
          content: 'Done. Ticket reference is ticket-99.',
          usage: { tokens_in: 100, tokens_out: 80 },
          tool_results: [],
          pending_tool_calls: [],
          resolution_status: 'escalated',
          confidence_score: 0.74,
          escalation_offer: true,
        },
        error: null,
      });

    executeMock
      .mockResolvedValueOnce({
        success: true,
        result: { user_context: { open_ticket_count: 0 } },
        trace_id: 'trace-1',
      })
      .mockResolvedValueOnce({
        success: true,
        result: { reference_id: 'ticket-99' },
        trace_id: 'trace-1',
      });

    const client = new DashAIClient({
      supabaseClient: { functions: { invoke: invokeMock } },
      getUserProfile: () =>
        ({
          id: 'teacher-1',
          role: 'teacher',
          tier: 'starter',
          organization_id: 'org-1',
        } as any),
    });

    const result = await client.callAIService({
      messages: [{ role: 'user', content: 'I need support for login issues' }],
      serviceType: 'chat_message',
    });

    expect(result.content).toContain('ticket-99');
    expect(result.metadata?.continuation_limit_reached).toBe(false);
    expect(result.metadata?.resolution_status).toBe('escalated');
    expect(executeMock).toHaveBeenCalledTimes(2);
    expect(invokeMock).toHaveBeenCalledTimes(3);

    const firstContinuationBody = invokeMock.mock.calls[1][1]?.body;
    expect(firstContinuationBody.enable_tools).toBe(true);
    expect(firstContinuationBody.metadata.orchestration_mode).toBeDefined();
    expect(firstContinuationBody.metadata.loop_budget).toBeDefined();
    expect(firstContinuationBody.metadata.confidence_threshold).toBeDefined();
  });

  it('stops after two passes and marks continuation budget reached', async () => {
    const invokeMock = jest
      .fn()
      .mockResolvedValueOnce({
        data: {
          success: true,
          content: 'Starting support workflow.',
          tool_results: [],
          pending_tool_calls: [{ id: 'tool-1', name: 'support_check_user_context', input: {} }],
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          success: true,
          content: 'Still gathering details.',
          tool_results: [],
          pending_tool_calls: [{ id: 'tool-2', name: 'support_check_user_context', input: {} }],
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          success: true,
          content: 'One more tool is required.',
          tool_results: [],
          pending_tool_calls: [{ id: 'tool-3', name: 'support_check_user_context', input: {} }],
        },
        error: null,
      });

    executeMock.mockResolvedValue({
      success: true,
      result: { ok: true },
      trace_id: 'trace-2',
    });

    const client = new DashAIClient({
      supabaseClient: { functions: { invoke: invokeMock } },
      getUserProfile: () =>
        ({
          id: 'teacher-1',
          role: 'teacher',
          tier: 'starter',
          organization_id: 'org-1',
        } as any),
    });

    const result = await client.callAIService({
      messages: [{ role: 'user', content: 'Please keep trying tools' }],
      serviceType: 'chat_message',
    });

    expect(invokeMock).toHaveBeenCalledTimes(3);
    expect(result.metadata?.continuation_limit_reached).toBe(true);
    expect(result.metadata?.resolution_status).toBe('needs_clarification');
    expect(result.metadata?.escalation_offer).toBe(true);
  });

  it('treats stream pending tool calls as expected fallback and preserves successful output', async () => {
    const invokeMock = jest.fn().mockResolvedValueOnce({
      data: {
        success: true,
        content: 'Your PDF is ready. Tap Preview PDF to open it.',
        tool_results: [{ name: 'export_pdf', success: true, output: { linkType: 'signed' } }],
        pending_tool_calls: [],
      },
      error: null,
    });

    const client = new DashAIClient({
      supabaseClient: { functions: { invoke: invokeMock } },
      getUserProfile: () =>
        ({
          id: 'teacher-1',
          role: 'teacher',
          tier: 'starter',
          organization_id: 'org-1',
        } as any),
    });

    (client as any).callAIServiceStreaming = jest.fn().mockRejectedValue(
      Object.assign(new Error('Streaming requires continuation for tool calls: export_pdf'), {
        code: 'stream_requires_continuation',
      }),
    );

    const result = await client.callAIService({
      messages: [{ role: 'user', content: 'Please export this as PDF' }],
      serviceType: 'chat_message',
      stream: true,
      onChunk: jest.fn(),
    });

    expect(result.content).toContain('PDF is ready');
    expect(result.content.toLowerCase()).not.toContain('unavailable');
    expect((result.metadata?.resolution_meta as any)?.stream_fallback_reason).toBe('stream_pending_tool_calls');
    expect((result.metadata?.resolution_meta as any)?.stream_fallback_outcome).toBe('fallback_completed');
    expect(invokeMock).toHaveBeenCalledTimes(1);
  });

  it('replaces dangling pre-tool narration when continuation follow-up fails', async () => {
    toClientToolDefsMock.mockReturnValue([
      {
        name: 'search_caps_curriculum',
        description: 'Search CAPS curriculum',
        input_schema: { type: 'object', properties: {} },
      },
    ]);
    listMock.mockReturnValue([{ name: 'search_caps_curriculum' }]);

    const invokeMock = jest
      .fn()
      .mockResolvedValueOnce({
        data: {
          success: true,
          content: 'Let me search from the South African CAPS curriculum now.',
          tool_results: [],
          pending_tool_calls: [{ id: 'tool-1', name: 'search_caps_curriculum', input: { query: 'grade 4 multiplication' } }],
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'continuation request failed' },
      });

    executeMock.mockResolvedValueOnce({
      success: true,
      result: {
        count: 3,
        results: [{ id: 'doc-1' }, { id: 'doc-2' }, { id: 'doc-3' }],
      },
      trace_id: 'trace-caps',
    });

    const client = new DashAIClient({
      supabaseClient: { functions: { invoke: invokeMock } },
      getUserProfile: () =>
        ({
          id: 'principal-1',
          role: 'principal_admin',
          tier: 'starter',
          organization_id: 'org-1',
        } as any),
    });

    const result = await client.callAIService({
      messages: [{ role: 'user', content: 'Search CAPS for grade 4 multiplication guidance.' }],
      serviceType: 'chat_message',
    });

    expect(result.content).toContain('searched CAPS and found 3');
    expect(result.content.toLowerCase()).not.toContain('let me search from the south');
    expect((result.metadata?.resolution_meta as any)?.continuation_pass_outcome).toBe('failed');
  });
});
