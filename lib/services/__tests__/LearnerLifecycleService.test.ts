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

describe('LearnerLifecycleService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPolicy', () => {
    it('merges partial DB policy with defaults', async () => {
      mockRpc.mockResolvedValueOnce({
        data: {
          enabled: true,
          trigger_absent_days: 6,
          notify_channels: { email: true },
        },
        error: null,
      });

      const policy = await LearnerLifecycleService.getPolicy('school-1');

      expect(policy.enabled).toBe(true);
      expect(policy.trigger_absent_days).toBe(6);
      expect(policy.grace_days).toBe(7);
      expect(policy.notify_channels.email).toBe(true);
      expect(policy.notify_channels.push).toBe(true);
      expect(policy.notify_channels.sms).toBe(false);
      expect(policy.notify_channels.whatsapp).toBe(false);
    });
  });

  describe('updatePolicy', () => {
    it('preserves existing notify channels when patching one field', async () => {
      mockRpc
        .mockResolvedValueOnce({
          data: {
            enabled: true,
            trigger_absent_days: 5,
            grace_days: 7,
            require_principal_approval: false,
            billing_behavior: 'stop_new_fees_keep_debt',
            auto_unassign_class_on_inactive: true,
            notify_channels: {
              push: true,
              email: false,
              sms: false,
              whatsapp: false,
            },
          },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null });

      const updated = await LearnerLifecycleService.updatePolicy('school-1', {
        notify_channels: {
          email: true,
        } as any,
      });

      expect(updated.notify_channels).toEqual({
        push: true,
        email: true,
        sms: false,
        whatsapp: false,
      });

      const secondCall = mockRpc.mock.calls[1];
      expect(secondCall[0]).toBe('update_school_settings');
      expect(secondCall[1]).toMatchObject({
        p_preschool_id: 'school-1',
        p_patch: {
          attendanceLifecycle: {
            notify_channels: {
              push: true,
              email: true,
              sms: false,
              whatsapp: false,
            },
          },
        },
      });
    });
  });

  describe('notifyAtRiskParents', () => {
    it('deduplicates parent/guardian recipients before dispatch', async () => {
      mockInvoke.mockResolvedValueOnce({ data: { ok: true }, error: null });

      const result = await LearnerLifecycleService.notifyAtRiskParents('school-1', [
        {
          id: 'case-1',
          student: { parent_id: 'p-1', guardian_id: null },
        } as any,
        {
          id: 'case-2',
          student: { parent_id: 'p-1', guardian_id: 'g-1' },
        } as any,
        {
          id: 'case-3',
          student: { parent_id: null, guardian_id: 'g-1' },
        } as any,
      ]);

      expect(result).toEqual({ sentTo: 2 });
      expect(mockInvoke).toHaveBeenCalledTimes(1);
      expect(mockInvoke.mock.calls[0][0]).toBe('notifications-dispatcher');
      expect(mockInvoke.mock.calls[0][1]).toMatchObject({
        body: {
          event_type: 'student_inactivity_warning',
          preschool_id: 'school-1',
          user_ids: ['p-1', 'g-1'],
          send_immediately: true,
        },
      });
    });

    it('skips dispatcher call when no recipients are available', async () => {
      const result = await LearnerLifecycleService.notifyAtRiskParents('school-1', [
        { id: 'case-1', student: { parent_id: null, guardian_id: null } } as any,
      ]);

      expect(result).toEqual({ sentTo: 0 });
      expect(mockInvoke).not.toHaveBeenCalled();
    });
  });
});
