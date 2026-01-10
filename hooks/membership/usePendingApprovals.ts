/**
 * usePendingApprovals Hook - React Query for Approval Requests
 * Handles fetching and processing approval requests for Youth President
 * 
 * Data Sources:
 * - join_requests table (membership approvals)
 * - organization_budgets table (budget approvals)
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface ApprovalRequest {
  id: string;
  title: string;
  description: string;
  type: 'budget' | 'event' | 'membership' | 'report';
  requestedBy: string;
  requestedAt: Date;
  amount?: number;
  isUrgent: boolean;
  status: 'pending' | 'approved' | 'rejected';
  processedAt?: Date;
  processedBy?: string;
  // Internal tracking
  sourceTable?: 'join_requests' | 'organization_budgets';
  sourceId?: string;
}

export function usePendingApprovals(tab: 'pending' | 'history' = 'pending') {
  const { profile, user } = useAuth();
  const organizationId = profile?.organization_id;

  return useQuery({
    queryKey: ['approvals', tab, organizationId, user?.id],
    queryFn: async (): Promise<ApprovalRequest[]> => {
      if (!organizationId) return [];
      
      const supabase = assertSupabase();
      const requests: ApprovalRequest[] = [];

      // 1. Fetch membership approvals from join_requests
      // CRITICAL: Exclude requests from the current user (president shouldn't see their own requests)
      const membershipStatuses = tab === 'pending' ? ['pending'] : ['approved', 'rejected'];
      let membershipQuery = supabase
        .from('join_requests')
        .select(`
          id,
          request_type,
          status,
          requester_id,
          requester_email,
          message,
          requested_role,
          reviewed_by,
          reviewed_at,
          review_notes,
          created_at,
          expires_at
        `)
        .eq('organization_id', organizationId)
        .in('status', membershipStatuses);
      
      // Exclude current user's own requests
      if (user?.id) {
        membershipQuery = membershipQuery.neq('requester_id', user.id);
      }
      
      const { data: membershipRequests, error: membershipError } = await membershipQuery
        .order('created_at', { ascending: false })
        .limit(50);

      if (!membershipError && membershipRequests) {
        // Get requester names separately
        const requesterIds = membershipRequests
          .filter(r => r.requester_id)
          .map(r => r.requester_id);
        
        let requesterNames: Record<string, string> = {};
        if (requesterIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', requesterIds);
          
          if (profiles) {
            requesterNames = profiles.reduce((acc, p) => {
              acc[p.id] = p.full_name || p.email || 'Unknown';
              return acc;
            }, {} as Record<string, string>);
          }
        }

        for (const req of membershipRequests) {
          const requesterName = req.requester_id 
            ? (requesterNames[req.requester_id] || 'Unknown')
            : (req.requester_email || 'Unknown Requester');
          
          // Check if urgent (pending > 3 days or expires soon)
          const createdAt = new Date(req.created_at);
          const daysPending = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
          const expiresAt = req.expires_at ? new Date(req.expires_at) : null;
          const expiresSoon = expiresAt && (expiresAt.getTime() - Date.now()) < (2 * 24 * 60 * 60 * 1000);
          const isUrgent = (tab === 'pending' && daysPending > 3) || expiresSoon;

          requests.push({
            id: req.id,
            title: getRequestTypeTitle(req.request_type, req.requested_role),
            description: req.message || `${requesterName} is requesting to join as ${req.requested_role || 'member'}`,
            type: 'membership',
            requestedBy: requesterName,
            requestedAt: createdAt,
            isUrgent: isUrgent || false,
            status: mapJoinStatus(req.status),
            processedAt: req.reviewed_at ? new Date(req.reviewed_at) : undefined,
            processedBy: req.reviewed_by ? 'Admin' : undefined,
            sourceTable: 'join_requests',
            sourceId: req.id,
          });
        }
      }

      // 2. Fetch budget approvals from organization_budgets
      const budgetStatuses = tab === 'pending' ? ['proposed', 'draft'] : ['approved', 'active', 'closed'];
      const { data: budgetRequests, error: budgetError } = await supabase
        .from('organization_budgets')
        .select(`
          id,
          category,
          department,
          budgeted_amount,
          status,
          notes,
          created_at,
          approved_by,
          approved_at,
          created_by
        `)
        .eq('organization_id', organizationId)
        .in('status', budgetStatuses)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!budgetError && budgetRequests) {
        // Get creator names
        const creatorIds = budgetRequests
          .filter(b => b.created_by)
          .map(b => b.created_by);
        
        let creatorNames: Record<string, string> = {};
        if (creatorIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', creatorIds);
          
          if (profiles) {
            creatorNames = profiles.reduce((acc, p) => {
              acc[p.id] = p.full_name || p.email || 'Unknown';
              return acc;
            }, {} as Record<string, string>);
          }
        }

        for (const budget of budgetRequests) {
          const creatorName = budget.created_by 
            ? (creatorNames[budget.created_by] || 'Finance Team')
            : 'Finance Team';
          
          // Budget requests over R10,000 are urgent
          const isUrgent = tab === 'pending' && budget.budgeted_amount > 10000;

          requests.push({
            id: budget.id,
            title: `Budget: ${budget.category}${budget.department ? ` - ${budget.department}` : ''}`,
            description: budget.notes || `Budget allocation request for ${budget.category}`,
            type: 'budget',
            requestedBy: creatorName,
            requestedAt: new Date(budget.created_at),
            amount: Number(budget.budgeted_amount),
            isUrgent,
            status: mapBudgetStatus(budget.status),
            processedAt: budget.approved_at ? new Date(budget.approved_at) : undefined,
            processedBy: budget.approved_by ? 'Approver' : undefined,
            sourceTable: 'organization_budgets',
            sourceId: budget.id,
          });
        }
      }

      // Sort all requests by date (newest first)
      requests.sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());

      return requests;
    },
    enabled: !!organizationId,
    staleTime: 30000,
  });
}

export function useApprovalStats() {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id;

  return useQuery({
    queryKey: ['approval-stats', organizationId],
    queryFn: async () => {
      if (!organizationId) {
        return { pending: 0, urgent: 0, processed: 0 };
      }
      
      const supabase = assertSupabase();
      
      // Count pending join requests
      const { count: pendingJoinCount } = await supabase
        .from('join_requests')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('status', 'pending');

      // Count pending budget requests
      const { count: pendingBudgetCount } = await supabase
        .from('organization_budgets')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .in('status', ['proposed', 'draft']);

      // Count processed (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      
      const { count: processedJoinCount } = await supabase
        .from('join_requests')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .in('status', ['approved', 'rejected'])
        .gte('reviewed_at', thirtyDaysAgo);

      const { count: processedBudgetCount } = await supabase
        .from('organization_budgets')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .in('status', ['approved', 'active', 'closed'])
        .gte('approved_at', thirtyDaysAgo);

      // Urgent: pending > 3 days or high value budgets
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      
      const { count: urgentJoinCount } = await supabase
        .from('join_requests')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('status', 'pending')
        .lte('created_at', threeDaysAgo);

      const { count: urgentBudgetCount } = await supabase
        .from('organization_budgets')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .in('status', ['proposed', 'draft'])
        .gte('budgeted_amount', 10000);

      return {
        pending: (pendingJoinCount || 0) + (pendingBudgetCount || 0),
        urgent: (urgentJoinCount || 0) + (urgentBudgetCount || 0),
        processed: (processedJoinCount || 0) + (processedBudgetCount || 0),
      };
    },
    enabled: !!organizationId,
    staleTime: 30000,
  });
}

export function useProcessApproval() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ 
      id, 
      action,
      sourceTable = 'join_requests',
      notes 
    }: { 
      id: string; 
      action: 'approve' | 'reject';
      sourceTable?: 'join_requests' | 'organization_budgets';
      notes?: string;
    }) => {
      const supabase = assertSupabase();
      
      if (sourceTable === 'join_requests') {
        const newStatus = action === 'approve' ? 'approved' : 'rejected';
        const { error } = await supabase
          .from('join_requests')
          .update({
            status: newStatus,
            reviewed_by: user?.id,
            reviewed_at: new Date().toISOString(),
            review_notes: notes,
          })
          .eq('id', id);
        
        if (error) throw error;
        
        // If approved membership, create organization_member record
        if (action === 'approve') {
          const { data: request } = await supabase
            .from('join_requests')
            .select('requester_id, organization_id, requested_role')
            .eq('id', id)
            .single();
          
          if (request?.requester_id && request?.organization_id) {
            await supabase.from('organization_members').upsert({
              user_id: request.requester_id,
              organization_id: request.organization_id,
              member_type: request.requested_role || 'youth_member', // Use member_type, not role
              membership_status: 'active',
              joined_via: 'approval',
            }, {
              onConflict: 'user_id,organization_id',
            });
          }
        }
      } else if (sourceTable === 'organization_budgets') {
        const newStatus = action === 'approve' ? 'approved' : 'closed';
        const { error } = await supabase
          .from('organization_budgets')
          .update({
            status: newStatus,
            approved_by: user?.id,
            approved_at: new Date().toISOString(),
            notes: notes ? `${notes}` : undefined,
          })
          .eq('id', id);
        
        if (error) throw error;
      }

      return { id, status: action === 'approve' ? 'approved' : 'rejected' };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['approval-stats'] });
    },
  });
}

// Helper functions
function getRequestTypeTitle(requestType: string, role?: string | null): string {
  // Map role to friendly display name
  const roleName = role ? getRoleFriendlyName(role) : '';
  
  switch (requestType) {
    case 'member_join':
      return `New Member Registration${roleName ? ` - ${roleName}` : ''}`;
    case 'parent_join':
      return 'Parent Join Request';
    case 'teacher_invite':
      return 'Teacher Application';
    case 'guardian_claim':
      return 'Guardian Claim Request';
    case 'staff_invite':
      return 'Staff Application';
    case 'learner_enroll':
      return 'Learner Enrollment';
    default:
      return 'Membership Request';
  }
}

function getRoleFriendlyName(role: string): string {
  const roleMap: Record<string, string> = {
    'youth_member': 'Youth Member',
    'youth': 'Youth Member',
    'member': 'Member',
    'parent': 'Parent',
    'teacher': 'Teacher',
    'learner': 'Learner',
    'youth_president': 'Youth President',
    'youth_deputy': 'Youth Deputy',
    'youth_secretary': 'Youth Secretary',
    'youth_treasurer': 'Youth Treasurer',
    'youth_coordinator': 'Youth Coordinator',
    'youth_prg': 'Youth PRO/PRG',
    'regional_coordinator': 'Regional Coordinator',
    'national_coordinator': 'National Coordinator',
    'principal': 'Principal',
    'admin': 'Admin',
  };
  return roleMap[role] || role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function mapJoinStatus(status: string): 'pending' | 'approved' | 'rejected' {
  if (status === 'pending' || status === 'expired' || status === 'cancelled') {
    return 'pending';
  }
  if (status === 'approved') return 'approved';
  return 'rejected';
}

function mapBudgetStatus(status: string): 'pending' | 'approved' | 'rejected' {
  if (status === 'draft' || status === 'proposed' || status === 'frozen') {
    return 'pending';
  }
  if (status === 'approved' || status === 'active') return 'approved';
  return 'rejected';
}

export const APPROVAL_TYPE_CONFIG = {
  budget: { icon: 'wallet-outline', color: '#10B981', label: 'Budget Request' },
  event: { icon: 'calendar-outline', color: '#6366F1', label: 'Event Proposal' },
  membership: { icon: 'people-outline', color: '#F59E0B', label: 'Membership' },
  report: { icon: 'document-text-outline', color: '#8B5CF6', label: 'Report' },
} as const;
