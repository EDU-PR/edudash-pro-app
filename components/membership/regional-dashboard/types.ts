/**
 * Regional Dashboard Types & Constants
 */

// Province color mapping
export const PROVINCE_COLORS: Record<string, { primary: string; name: string; code: string }> = {
  'Gauteng': { primary: '#3B82F6', name: 'Gauteng', code: 'GP' },
  'Western Cape': { primary: '#10B981', name: 'Western Cape', code: 'WC' },
  'KwaZulu-Natal': { primary: '#F59E0B', name: 'KwaZulu-Natal', code: 'KZN' },
  'Eastern Cape': { primary: '#EF4444', name: 'Eastern Cape', code: 'EC' },
  'Mpumalanga': { primary: '#8B5CF6', name: 'Mpumalanga', code: 'MP' },
  'Limpopo': { primary: '#EC4899', name: 'Limpopo', code: 'LP' },
  'Free State': { primary: '#06B6D4', name: 'Free State', code: 'FS' },
  'North West': { primary: '#84CC16', name: 'North West', code: 'NW' },
  'Northern Cape': { primary: '#F97316', name: 'Northern Cape', code: 'NC' },
};

export interface RegionalStats {
  regionMembers: number;
  activeBranches: number;
  newMembersThisMonth: number;
  pendingApplications: number;
  regionRevenue: number;
  regionGrowth: number;
  idCardsIssued: number;
  upcomingEvents: number;
}

export interface Branch {
  id: string;
  name: string;
  members: number;
  status: string;
  manager?: string;
  leader: string;
  collections: number;
  pending: number;
  growth: number;
}

export interface RegionalAction {
  id: string;
  icon: string;
  label: string;
  count?: number;
  route: string;
  color: string;
}

export interface TaskItem {
  task: string;
  icon: string;
  color: string;
  urgent: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  dueDate: string;
  assignee?: string;
}

export interface ActivityItem {
  id: string;
  type: 'member_joined' | 'payment_received' | 'branch_created' | 'card_issued' | 'approval_pending';
  title: string;
  description: string;
  time: string;
}

export interface LegacyActivityItem {
  icon: string;
  color: string;
  title: string;
  subtitle: string;
  time: string;
}

// Mock Data
export const MOCK_REGIONAL_STATS: RegionalStats = {
  regionMembers: 892,
  activeBranches: 12,
  newMembersThisMonth: 24,
  pendingApplications: 7,
  regionRevenue: 892000,
  regionGrowth: 12.5,
  idCardsIssued: 845,
  upcomingEvents: 3,
};

export const MOCK_BRANCHES: Branch[] = [
  { id: '1', name: 'Johannesburg Central', members: 234, status: 'active', leader: 'Sarah Molefe', collections: 45000, pending: 5, growth: 12 },
  { id: '2', name: 'Pretoria East', members: 189, status: 'active', leader: 'John Sithole', collections: 38500, pending: 3, growth: 8 },
  { id: '3', name: 'Soweto', members: 156, status: 'active', leader: 'Grace Dlamini', collections: 32000, pending: 8, growth: 15 },
  { id: '4', name: 'Centurion', members: 143, status: 'active', leader: 'Thabo Khumalo', collections: 28000, pending: 2, growth: -3 },
  { id: '5', name: 'Sandton', members: 128, status: 'active', leader: 'Nomvula Nkosi', collections: 52000, pending: 4, growth: 22 },
];

export const REGIONAL_ACTIONS: RegionalAction[] = [
  { id: 'approve', icon: 'checkmark-circle', label: 'Approve Members', count: 7, route: '/screens/membership/approvals', color: '#EF4444' },
  { id: 'id-cards', icon: 'card', label: 'Issue ID Cards', count: 12, route: '/screens/membership/id-cards', color: '#3B82F6' },
  { id: 'branches', icon: 'business', label: 'Manage Branches', route: '/screens/membership/branches', color: '#10B981' },
  { id: 'events', icon: 'calendar', label: 'Regional Events', count: 3, route: '/screens/membership/events', color: '#F59E0B' },
];

export const MOCK_TASKS: Task[] = [
  { id: '1', title: 'Review membership applications', description: '7 applications awaiting regional approval', priority: 'high', dueDate: 'Today', assignee: 'You' },
  { id: '2', title: 'Print ID cards for collection', description: '12 cards ready for printing and distribution', priority: 'high', dueDate: 'Tomorrow', assignee: 'You' },
  { id: '3', title: 'Schedule branch manager meeting', description: 'Monthly coordination meeting with all branch managers', priority: 'medium', dueDate: 'This Week', assignee: 'You' },
  { id: '4', title: 'Submit monthly report', description: 'Regional performance report for national office', priority: 'low', dueDate: 'End of Month' },
];

export const MOCK_ACTIVITY: ActivityItem[] = [
  { id: '1', type: 'member_joined', title: 'New member approved', description: 'Thabo Mokoena - Johannesburg Central', time: '10 min ago' },
  { id: '2', type: 'card_issued', title: 'ID card printed', description: 'Sarah Nkosi - Pretoria East', time: '25 min ago' },
  { id: '3', type: 'payment_received', title: 'Payment received', description: 'R250 - Grace Dlamini', time: '1 hour ago' },
  { id: '4', type: 'approval_pending', title: 'Approval pending', description: 'Branch creation request - Midrand', time: '2 hours ago' },
];
