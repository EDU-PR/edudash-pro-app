import { unifiedToolRegistry } from '../UnifiedToolRegistry';

describe('UnifiedToolRegistry support tools', () => {
  it('exposes support tools for teacher role', () => {
    const tools = unifiedToolRegistry.list('teacher', 'starter').map((tool) => tool.name);

    expect(tools).toContain('support_check_user_context');
    expect(tools).toContain('support_create_ticket');
  });

  it('executes support_check_user_context and returns open ticket context', async () => {
    const selectChain: any = {
      eq: jest.fn(),
      in: jest.fn(),
      order: jest.fn(),
      limit: jest.fn(),
    };
    selectChain.eq.mockReturnValue(selectChain);
    selectChain.in.mockReturnValue(selectChain);
    selectChain.order.mockReturnValue(selectChain);
    selectChain.limit.mockResolvedValue({
      data: [
        {
          id: 'ticket-1',
          subject: 'Issue A',
          status: 'open',
          priority: 'medium',
          created_at: '2026-02-08T08:00:00.000Z',
        },
      ],
    });

    const tableApi = {
      select: jest.fn(() => selectChain),
      insert: jest.fn(),
    };
    const supabaseMock = {
      from: jest.fn(() => tableApi),
    };

    const result = await unifiedToolRegistry.execute(
      'support_check_user_context',
      { include_open_tickets: true },
      {
        userId: 'teacher-1',
        role: 'teacher',
        tier: 'starter',
        organizationId: 'org-1',
        hasOrganization: true,
        isGuest: false,
        supabaseClient: supabaseMock,
      }
    );

    expect(result.success).toBe(true);
    expect((result.result as any)?.user_context?.open_ticket_count).toBe(1);
    expect(supabaseMock.from).toHaveBeenCalledWith('support_tickets');
  });

  it('creates a support ticket when unresolved', async () => {
    const dedupeChain: any = {
      eq: jest.fn(),
      order: jest.fn(),
      limit: jest.fn(),
    };
    dedupeChain.eq.mockReturnValue(dedupeChain);
    dedupeChain.order.mockReturnValue(dedupeChain);
    dedupeChain.limit.mockResolvedValue({ data: [] });

    const insertSingle = jest.fn().mockResolvedValue({
      data: {
        id: 'ticket-42',
        subject: 'Dash escalation: login failure',
        status: 'open',
        priority: 'high',
        created_at: '2026-02-08T09:00:00.000Z',
      },
      error: null,
    });
    const insertChain = {
      select: jest.fn(() => ({ single: insertSingle })),
    };

    const tableApi = {
      select: jest.fn(() => dedupeChain),
      insert: jest.fn(() => insertChain),
    };
    const supabaseMock = {
      from: jest.fn(() => tableApi),
    };

    const result = await unifiedToolRegistry.execute(
      'support_create_ticket',
      {
        subject: 'Dash escalation: login failure',
        description: 'User cannot recover session after retries.',
        priority: 'high',
      },
      {
        userId: 'teacher-1',
        role: 'teacher',
        tier: 'starter',
        organizationId: 'org-1',
        hasOrganization: true,
        isGuest: false,
        supabaseClient: supabaseMock,
      }
    );

    expect(result.success).toBe(true);
    expect((result.result as any)?.reference_id).toBe('ticket-42');
    expect(tableApi.insert).toHaveBeenCalledTimes(1);
  });
});
