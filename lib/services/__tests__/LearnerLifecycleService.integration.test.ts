const mockRpc = jest.fn();
const mockInvoke = jest.fn();

jest.mock('@/lib/supabase', () => ({
  assertSupabase: () => ({
    rpc: mockRpc,
    functions: {
      invoke: mockInvoke,
    },
  }),
}));

import LearnerLifecycleService from '../LearnerLifecycleService';

describe('LearnerLifecycleService integration flows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('runMonitorNow sends manual run payload for a specific school', async () => {
    mockInvoke.mockResolvedValueOnce({ data: { processed: 12 }, error: null });

    const result = await LearnerLifecycleService.runMonitorNow('school-abc');

    expect(result).toEqual({ success: true, data: { processed: 12 } });
    expect(mockInvoke).toHaveBeenCalledWith('student-activity-monitor', {
      body: {
        preschool_id: 'school-abc',
        source: 'manual',
        run_now: true,
      },
    });
  });

  it('returns success=false with error message when monitor invoke fails', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: { message: 'Function unavailable' },
    });

    const result = await LearnerLifecycleService.runMonitorNow('school-abc');

    expect(result).toEqual({ success: false, error: 'Function unavailable' });
  });

  it('applyAction proxies case action to RPC and maps returned case', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        id: 'case-1',
        preschool_id: 'school-1',
        student_id: 'student-1',
        case_state: 'at_risk',
        trigger_absence_days: 5,
        trigger_absence_streak: 5,
        principal_action: 'none',
        parent_response: 'none',
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      error: null,
    });

    const result = await LearnerLifecycleService.applyAction('case-1', 'contacted', {
      notes: 'Called parent',
      extendDays: 2,
    });

    expect(mockRpc).toHaveBeenCalledWith('apply_student_inactivity_action', {
      p_case_id: 'case-1',
      p_action: 'contacted',
      p_notes: 'Called parent',
      p_extend_days: 2,
    });
    expect(result.id).toBe('case-1');
    expect(result.case_state).toBe('at_risk');
  });
});
