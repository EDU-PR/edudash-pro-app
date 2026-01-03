/**
 * useJoinRequests Hook
 *
 * React Query hook for managing join requests.
 * Provides data fetching and mutations for the join request system.
 *
 * @module hooks/useJoinRequests
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { InviteService, JoinRequest, JoinRequestType } from '@/services/InviteService';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { Alert } from 'react-native';

// Query keys for cache management
export const joinRequestKeys = {
  all: ['joinRequests'] as const,
  pending: (orgId: string) => [...joinRequestKeys.all, 'pending', orgId] as const,
  myRequests: (userId: string) => [...joinRequestKeys.all, 'my', userId] as const,
  byOrg: (orgId: string, status?: string) => [...joinRequestKeys.all, 'org', orgId, status] as const,
};

/**
 * Hook for fetching pending join requests (for admins)
 */
export function usePendingJoinRequests(organizationId?: string) {
  return useQuery({
    queryKey: joinRequestKeys.pending(organizationId || ''),
    queryFn: async () => {
      if (!organizationId) return [];
      const result = await InviteService.getPendingRequests(organizationId);
      if (!result.success) throw new Error(result.error);
      return result.requests || [];
    },
    enabled: !!organizationId,
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Hook for fetching user's own join requests
 */
export function useMyJoinRequests() {
  const { user } = useAuth();

  return useQuery({
    queryKey: joinRequestKeys.myRequests(user?.id || ''),
    queryFn: async () => {
      const result = await InviteService.getMyRequests();
      if (!result.success) throw new Error(result.error);
      return result.requests || [];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Hook for fetching join requests with profile data (for admin views)
 */
export function useJoinRequestsWithProfiles(
  organizationId?: string,
  status?: 'pending' | 'approved' | 'rejected' | 'all'
) {
  return useQuery({
    queryKey: joinRequestKeys.byOrg(organizationId || '', status),
    queryFn: async () => {
      if (!organizationId) return [];

      const supabase = assertSupabase();
      
      let query = supabase
        .from('join_requests')
        .select(`
          *,
          requester_profile:profiles!join_requests_requester_id_fkey(
            first_name,
            last_name,
            avatar_url,
            email
          )
        `)
        .or(`organization_id.eq.${organizationId},preschool_id.eq.${organizationId}`);

      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Hook for creating a join request
 */
export function useCreateJoinRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      type: JoinRequestType;
      organizationId: string;
      preschoolId?: string;
      message?: string;
      relationship?: string;
      targetStudentId?: string;
      requestedRole?: string;
    }) => {
      const result = await InviteService.createJoinRequest(params);
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: joinRequestKeys.all });
    },
  });
}

/**
 * Hook for approving a join request
 */
export function useApproveJoinRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId, notes }: { requestId: string; notes?: string }) => {
      const result = await InviteService.approveRequest(requestId, notes);
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: joinRequestKeys.all });
    },
  });
}

/**
 * Hook for rejecting a join request
 */
export function useRejectJoinRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId, notes }: { requestId: string; notes?: string }) => {
      const result = await InviteService.rejectRequest(requestId, notes);
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: joinRequestKeys.all });
    },
  });
}

/**
 * Hook for cancelling own join request
 */
export function useCancelJoinRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (requestId: string) => {
      const result = await InviteService.cancelRequest(requestId);
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: joinRequestKeys.all });
    },
  });
}

/**
 * Hook for validating an invite code
 */
export function useValidateInviteCode() {
  return useMutation({
    mutationFn: async (code: string) => {
      const result = await InviteService.validateInviteCode(code);
      if (!result.valid) throw new Error(result.error);
      return result;
    },
  });
}

/**
 * Hook for accepting an invitation
 */
export function useAcceptInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (token: string) => {
      const result = await InviteService.acceptInvite(token);
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: joinRequestKeys.all });
    },
  });
}

/**
 * Combined hook for join request actions with alerts
 */
export function useJoinRequestActions(organizationId?: string) {
  const queryClient = useQueryClient();
  const approveRequest = useApproveJoinRequest();
  const rejectRequest = useRejectJoinRequest();

  const handleApprove = async (requestId: string, notes?: string) => {
    try {
      await approveRequest.mutateAsync({ requestId, notes });
      Alert.alert('Success', 'Request approved successfully');
    } catch (error) {
      Alert.alert('Error', (error as Error).message || 'Failed to approve request');
    }
  };

  const handleReject = async (requestId: string, notes: string) => {
    try {
      await rejectRequest.mutateAsync({ requestId, notes });
      Alert.alert('Success', 'Request rejected');
    } catch (error) {
      Alert.alert('Error', (error as Error).message || 'Failed to reject request');
    }
  };

  const refresh = () => {
    if (organizationId) {
      queryClient.invalidateQueries({ queryKey: joinRequestKeys.byOrg(organizationId) });
    }
  };

  return {
    handleApprove,
    handleReject,
    refresh,
    isApproving: approveRequest.isPending,
    isRejecting: rejectRequest.isPending,
  };
}
