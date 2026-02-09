import { resolveAdminTaskPack, normalizeAdminOrgType } from '@/lib/dashboard/admin/taskPackResolver';

describe('taskPackResolver', () => {
  it('normalizes supported org type aliases', () => {
    expect(normalizeAdminOrgType('preschool')).toBe('preschool');
    expect(normalizeAdminOrgType('nursery')).toBe('preschool');
    expect(normalizeAdminOrgType('k12')).toBe('k12_school');
    expect(normalizeAdminOrgType('combined')).toBe('k12_school');
    expect(normalizeAdminOrgType('unknown')).toBeNull();
  });

  it('returns default preschool pack without overrides', () => {
    const result = resolveAdminTaskPack({
      organizationType: 'preschool',
      settings: null,
    });

    expect(result.supported).toBe(true);
    expect(result.overridesApplied).toBe(false);
    expect(result.source).toBe('default');
    expect(result.pack?.orgType).toBe('preschool');
    expect(result.pack?.tasks.length).toBeGreaterThan(0);
  });

  it('applies organization overrides and task pack version', () => {
    const result = resolveAdminTaskPack({
      organizationType: 'k12_school',
      settings: {
        admin_dashboard: {
          task_pack_version: 'v1-custom',
          overrides: {
            hiddenTaskIds: ['report_policy_comms'],
            taskOrder: ['fee_pop_exceptions', 'staff_screening_phase'],
            customTaskLabels: {
              staff_screening_phase: 'Staff Coverage Control',
            },
            customTaskRoutes: {
              fee_pop_exceptions: '/screens/admin/fee-management?focus=exceptions',
            },
            laneRouteOverrides: {
              admissions: '/screens/admin/manage-join-requests?lane=admissions',
            },
          },
        },
      },
    });

    expect(result.supported).toBe(true);
    expect(result.overridesApplied).toBe(true);
    expect(result.source).toBe('organization_override');
    expect(result.pack?.version).toBe('v1-custom');
    expect(result.pack?.laneRoutes.admissions).toBe('/screens/admin/manage-join-requests?lane=admissions');

    const taskIds = (result.pack?.tasks || []).map((task) => task.id);
    expect(taskIds.includes('report_policy_comms')).toBe(false);
    expect(taskIds[0]).toBe('fee_pop_exceptions');
    expect(taskIds[1]).toBe('staff_screening_phase');

    const renamed = result.pack?.tasks.find((task) => task.id === 'staff_screening_phase');
    expect(renamed?.title).toBe('Staff Coverage Control');

    const rerouted = result.pack?.tasks.find((task) => task.id === 'fee_pop_exceptions');
    expect(rerouted?.route).toBe('/screens/admin/fee-management?focus=exceptions');
  });

  it('returns unsupported for unknown org type', () => {
    const result = resolveAdminTaskPack({
      organizationType: 'tertiary',
      settings: {},
    });

    expect(result.supported).toBe(false);
    expect(result.orgType).toBeNull();
    expect(result.pack).toBeNull();
  });
});
