/**
 * Dashboard Types
 * Shared types for regional and CEO dashboard components
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
  manager: string;
}

export interface RegionalAction {
  id: string;
  icon: string;
  label: string;
  count?: number;
  route: string;
  color: string;
}

export interface ExecutiveStats {
  totalMembers: number;
  membershipGrowth: number;
  totalRevenue: number;
  revenueGrowth: number;
  activeRegions: number;
  regionalManagers: number;
  pendingApprovals: number;
  strategicInitiatives: number;
  organizationHealth: number;
  memberRetention: number;
}

export interface RegionalPerformance {
  region: string;
  manager: string;
  members: number;
  revenue: number;
  growth: number;
  satisfaction: number;
}

export interface StrategicPriority {
  id: string;
  title: string;
  priority: 'high' | 'medium' | 'low';
  status: string;
  progress: number;
}

export interface ExecutiveAction {
  id: string;
  icon: string;
  label: string;
  route: string;
  color: string;
}

export interface DashboardSettings {
  wallpaper_url?: string;
  wallpaper_opacity?: number;
  primary_color?: string;
  show_member_count?: boolean;
  show_revenue?: boolean;
  custom_greeting?: string;
}

// Mock data
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
  { id: '1', name: 'Johannesburg Central', members: 234, status: 'active', manager: 'Sarah Molefe' },
  { id: '2', name: 'Pretoria East', members: 189, status: 'active', manager: 'John Sithole' },
  { id: '3', name: 'Soweto', members: 156, status: 'active', manager: 'Grace Dlamini' },
  { id: '4', name: 'Centurion', members: 143, status: 'active', manager: 'Thabo Khumalo' },
  { id: '5', name: 'Sandton', members: 128, status: 'active', manager: 'Nomvula Nkosi' },
];

export const MOCK_REGIONAL_ACTIONS: RegionalAction[] = [
  { id: 'approve', icon: 'checkmark-circle', label: 'Approve Members', count: 7, route: '/screens/membership/approvals', color: '#EF4444' },
  { id: 'id-cards', icon: 'card', label: 'Issue ID Cards', count: 12, route: '/screens/membership/id-cards', color: '#3B82F6' },
  { id: 'branches', icon: 'business', label: 'Manage Branches', route: '/screens/membership/branches', color: '#10B981' },
  { id: 'events', icon: 'calendar', label: 'Regional Events', count: 3, route: '/screens/membership/events', color: '#F59E0B' },
];

export const MOCK_EXECUTIVE_STATS: ExecutiveStats = {
  totalMembers: 2847,
  membershipGrowth: 12.5,
  totalRevenue: 2547800,
  revenueGrowth: 18.3,
  activeRegions: 9,
  regionalManagers: 8,
  pendingApprovals: 23,
  strategicInitiatives: 12,
  organizationHealth: 87,
  memberRetention: 94.5,
};

export const MOCK_REGIONAL_PERFORMANCE: RegionalPerformance[] = [
  { region: 'Gauteng', manager: 'Hloriso Dipatse', members: 892, revenue: 892000, growth: 12.5, satisfaction: 92 },
  { region: 'Western Cape', manager: 'Vacant', members: 567, revenue: 567000, growth: 8.3, satisfaction: 88 },
  { region: 'KwaZulu-Natal', manager: 'Vacant', members: 445, revenue: 445000, growth: 15.2, satisfaction: 90 },
  { region: 'Eastern Cape', manager: 'Vacant', members: 312, revenue: 312000, growth: 6.7, satisfaction: 85 },
  { region: 'Mpumalanga', manager: 'Vacant', members: 234, revenue: 234000, growth: 9.1, satisfaction: 87 },
];

export const MOCK_STRATEGIC_PRIORITIES: StrategicPriority[] = [
  { id: '1', title: 'Regional Manager Recruitment', priority: 'high', status: 'in-progress', progress: 62 },
  { id: '2', title: 'Membership Drive - Q1 2026', priority: 'high', status: 'planning', progress: 25 },
  { id: '3', title: 'Digital Platform Upgrade', priority: 'medium', status: 'in-progress', progress: 78 },
  { id: '4', title: 'Training Program Rollout', priority: 'medium', status: 'pending', progress: 15 },
];

export const MOCK_EXECUTIVE_ACTIONS: ExecutiveAction[] = [
  { id: 'broadcast', icon: 'megaphone', label: 'Broadcast', route: '/screens/membership/broadcast', color: '#EF4444' },
  { id: 'documents', icon: 'folder-open', label: 'Document Vault', route: '/screens/membership/documents', color: '#6366F1' },
  { id: 'regional', icon: 'people', label: 'Regional Managers', route: '/screens/membership/regional-managers', color: '#3B82F6' },
  { id: 'strategy', icon: 'bulb', label: 'Strategic Plan', route: '/screens/membership/strategy', color: '#8B5CF6' },
  { id: 'finance', icon: 'trending-up', label: 'Financial Reports', route: '/screens/membership/finance', color: '#10B981' },
  { id: 'governance', icon: 'shield-checkmark', label: 'Governance', route: '/screens/membership/governance', color: '#06B6D4' },
  { id: 'performance', icon: 'bar-chart', label: 'Performance', route: '/screens/membership/performance', color: '#F59E0B' },
  { id: 'analytics', icon: 'analytics', label: 'Analytics', route: '/screens/membership/analytics', color: '#EC4899' },
];
