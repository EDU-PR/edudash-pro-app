/**
 * usePendingApprovals Hook - React Query for Approval Requests
 * Handles fetching and processing approval requests for Youth President
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

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
}

const MOCK_REQUESTS: ApprovalRequest[] = [
  {
    id: '1',
    title: 'Youth Conference Venue Deposit',
    description: 'Request for R15,000 deposit to secure the community hall for the annual youth conference in March.',
    type: 'budget',
    requestedBy: 'Events Coordinator',
    requestedAt: new Date(Date.now() - 86400000),
    amount: 15000,
    isUrgent: true,
    status: 'pending',
  },
  {
    id: '2',
    title: 'New Member Registration - Zone 5',
    description: '12 new member applications from Zone 5 community outreach program awaiting verification.',
    type: 'membership',
    requestedBy: 'Zone 5 Leader',
    requestedAt: new Date(Date.now() - 172800000),
    isUrgent: false,
    status: 'pending',
  },
  {
    id: '3',
    title: 'Sports Day Event Proposal',
    description: 'Proposal for inter-zone sports competition on February 15th with estimated budget of R8,500.',
    type: 'event',
    requestedBy: 'Sports Committee',
    requestedAt: new Date(Date.now() - 259200000),
    amount: 8500,
    isUrgent: false,
    status: 'pending',
  },
  {
    id: '4',
    title: 'Q4 Financial Report',
    description: 'Quarterly financial summary for October-December period ready for review and approval.',
    type: 'report',
    requestedBy: 'Treasurer',
    requestedAt: new Date(Date.now() - 432000000),
    isUrgent: false,
    status: 'approved',
    processedAt: new Date(Date.now() - 86400000),
    processedBy: 'Youth President',
  },
];

export function usePendingApprovals(tab: 'pending' | 'history' = 'pending') {
  return useQuery({
    queryKey: ['approvals', tab],
    queryFn: async (): Promise<ApprovalRequest[]> => {
      await new Promise(resolve => setTimeout(resolve, 300));
      return tab === 'pending' 
        ? MOCK_REQUESTS.filter(r => r.status === 'pending')
        : MOCK_REQUESTS.filter(r => r.status !== 'pending');
    },
    staleTime: 30000,
  });
}

export function useApprovalStats() {
  return useQuery({
    queryKey: ['approval-stats'],
    queryFn: async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
      const pending = MOCK_REQUESTS.filter(r => r.status === 'pending');
      return {
        pending: pending.length,
        urgent: pending.filter(r => r.isUrgent).length,
        processed: MOCK_REQUESTS.filter(r => r.status !== 'pending').length,
      };
    },
    staleTime: 30000,
  });
}

export function useProcessApproval() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'approve' | 'reject' }) => {
      await new Promise(resolve => setTimeout(resolve, 500));
      return { id, status: action === 'approve' ? 'approved' : 'rejected' };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['approval-stats'] });
    },
  });
}

export const APPROVAL_TYPE_CONFIG = {
  budget: { icon: 'wallet-outline', color: '#10B981', label: 'Budget Request' },
  event: { icon: 'calendar-outline', color: '#6366F1', label: 'Event Proposal' },
  membership: { icon: 'people-outline', color: '#F59E0B', label: 'Membership' },
  report: { icon: 'document-text-outline', color: '#8B5CF6', label: 'Report' },
} as const;
