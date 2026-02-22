jest.mock('@/lib/sessionManager', () => ({
  getCurrentProfile: jest.fn(async () => ({
    id: 'user-1',
    role: 'teacher',
    organization_id: 'org-1',
  })),
}));

jest.mock('@/lib/supabase', () => ({
  assertSupabase: jest.fn(() => {
    const query: any = {
      data: null,
      error: { message: 'column assignments.subject does not exist' },
      select: jest.fn(),
      is: jest.fn(),
      order: jest.fn(),
      limit: jest.fn(),
      eq: jest.fn(),
    };

    query.select.mockReturnValue(query);
    query.is.mockReturnValue(query);
    query.order.mockReturnValue(query);
    query.limit.mockReturnValue(query);
    query.eq.mockReturnValue(query);

    return {
      from: jest.fn(() => query),
    };
  }),
}));

import { unifiedToolRegistry } from '@/services/tools/UnifiedToolRegistry';

describe('UnifiedToolRegistry get_assignments failure handling', () => {
  it('marks execution as failed when module result.success is false', async () => {
    const result = await unifiedToolRegistry.execute(
      'get_assignments',
      { status: 'pending', days_ahead: 14 },
      {
        userId: 'user-1',
        role: 'teacher',
        tier: 'starter',
        organizationId: 'org-1',
        hasOrganization: true,
        isGuest: false,
      }
    );

    expect(result.success).toBe(false);
    expect(String(result.error || '')).toContain('column assignments.subject does not exist');
    expect((result.result as any)?.success).toBe(false);
  });
});
