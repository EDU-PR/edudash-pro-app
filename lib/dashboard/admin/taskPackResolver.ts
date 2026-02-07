import { DEFAULT_ADMIN_TASK_PACKS } from './defaultTaskPacks';
import type {
  AdminOrgTypeV1,
  AdminTaskDefinition,
  AdminTaskPack,
  AdminTaskPackOverrides,
  AdminTaskPackResolution,
} from './types';

const K12_ALIASES = new Set(['k12', 'k12_school', 'combined', 'primary', 'secondary', 'community_school']);
const PRESCHOOL_ALIASES = new Set(['preschool', 'ecd', 'nursery']);

export function normalizeAdminOrgType(value?: string | null): AdminOrgTypeV1 | null {
  if (!value) return null;
  const normalized = String(value).trim().toLowerCase();
  if (K12_ALIASES.has(normalized)) return 'k12_school';
  if (PRESCHOOL_ALIASES.has(normalized)) return 'preschool';
  return null;
}

function cloneTaskPack(pack: AdminTaskPack): AdminTaskPack {
  return {
    ...pack,
    laneRoutes: { ...pack.laneRoutes },
    tasks: pack.tasks.map((task) => ({ ...task })),
  };
}

function applyTaskOrder(
  tasks: AdminTaskDefinition[],
  requestedOrder: string[] | undefined
): AdminTaskDefinition[] {
  if (!requestedOrder || requestedOrder.length === 0) return tasks;

  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const ordered: AdminTaskDefinition[] = [];
  const seen = new Set<string>();

  for (const taskId of requestedOrder) {
    const task = taskMap.get(taskId);
    if (task) {
      ordered.push(task);
      seen.add(taskId);
    }
  }

  for (const task of tasks) {
    if (!seen.has(task.id)) ordered.push(task);
  }

  return ordered;
}

function applyOverrides(basePack: AdminTaskPack, overrides: AdminTaskPackOverrides): AdminTaskPack {
  const hiddenTaskIds = new Set(overrides.hiddenTaskIds || []);
  const customLabels = overrides.customTaskLabels || {};
  const customRoutes = overrides.customTaskRoutes || {};

  let tasks = basePack.tasks
    .filter((task) => !hiddenTaskIds.has(task.id))
    .map((task) => ({
      ...task,
      title: customLabels[task.id] || task.title,
      route: customRoutes[task.id] || task.route,
    }));

  tasks = applyTaskOrder(tasks, overrides.taskOrder);

  return {
    ...basePack,
    tasks,
    laneRoutes: {
      ...basePack.laneRoutes,
      ...(overrides.laneRouteOverrides || {}),
    },
  };
}

export function resolveAdminTaskPack(params: {
  organizationType?: string | null;
  settings?: Record<string, unknown> | null;
}): AdminTaskPackResolution {
  const orgType = normalizeAdminOrgType(params.organizationType);
  if (!orgType) {
    return {
      source: 'default',
      orgType: null,
      supported: false,
      pack: null,
      overridesApplied: false,
    };
  }

  const defaultPack = cloneTaskPack(DEFAULT_ADMIN_TASK_PACKS[orgType]);
  if (!defaultPack) {
    return {
      source: 'default',
      orgType,
      supported: false,
      pack: null,
      overridesApplied: false,
    };
  }

  const adminSettings = (params.settings?.admin_dashboard || {}) as Record<string, unknown>;
  const overrides = (adminSettings.overrides || {}) as AdminTaskPackOverrides;
  const taskPackVersion = String(adminSettings.task_pack_version || defaultPack.version);

  const hasOverrides =
    !!overrides &&
    Object.keys(overrides).length > 0 &&
    (
      !!overrides.hiddenTaskIds?.length ||
      !!overrides.taskOrder?.length ||
      !!overrides.customTaskLabels ||
      !!overrides.customTaskRoutes ||
      !!overrides.laneRouteOverrides
    );

  const resolvedPack = hasOverrides ? applyOverrides(defaultPack, overrides) : defaultPack;
  resolvedPack.version = taskPackVersion || defaultPack.version;

  return {
    source: hasOverrides ? 'organization_override' : 'default',
    orgType,
    supported: true,
    pack: resolvedPack,
    overridesApplied: hasOverrides,
  };
}
