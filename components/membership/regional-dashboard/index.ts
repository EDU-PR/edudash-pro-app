/**
 * Regional Dashboard Components
 * Barrel export for all regional dashboard components
 */

// Components
export { RegionalHero } from './RegionalHero';
export { ActionCardsGrid } from './ActionCardsGrid';
export { BranchPerformanceList } from './BranchPerformanceList';
export { BranchListItems } from './BranchListItems';
export { TasksList } from './TasksList';
export { TaskItemList } from './TaskItemList';
export { ActivityFeed } from './ActivityFeed';
export { LegacyActivityList } from './LegacyActivityList';
export { QuickStatsRow } from './QuickStatsRow';
export type { QuickStat } from './QuickStatsRow';

// Types & Constants
export {
  PROVINCE_COLORS,
  MOCK_REGIONAL_STATS,
  MOCK_BRANCHES,
  REGIONAL_ACTIONS,
  MOCK_TASKS,
  MOCK_ACTIVITY,
} from './types';

export type {
  RegionalStats,
  Branch,
  RegionalAction,
  Task,
  TaskItem,
  ActivityItem,
  LegacyActivityItem,
} from './types';
