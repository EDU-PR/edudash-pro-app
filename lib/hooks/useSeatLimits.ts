/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * Custom hook for managing school staff seat limits
 * 
 * Uses TanStack Query for caching and background updates
 * Provides real-time seat limit information for UI components
 */

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SeatService } from '@/lib/services/seatService';
import { 
  SeatLimits, 
  SeatUsageDisplay, 
  SeatManagementError,
  AssignSeatParams,
  RevokeSeatParams
} from '@/lib/types/seats';
import { useAlert } from '@/components/ui/StyledAlert';

// Query keys for cache management
export const SEAT_QUERY_KEYS = {
  limits: ['seat-limits'] as const,
  seats: ['teacher-seats'] as const,
} as const;

/**
 * Hook for fetching and managing seat limits
 */
export function useSeatLimits() {
  const queryClient = useQueryClient();
  const alert = useAlert();

  // Fetch current seat limits
  const limitsQuery = useQuery({
    queryKey: SEAT_QUERY_KEYS.limits,
    queryFn: SeatService.getSeatLimits,
    staleTime: 30 * 1000, // Consider data stale after 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    retry: (failureCount, error) => {
      // Don't retry permission errors
      if (error instanceof Error && 'code' in error) {
        const seatError = error as SeatManagementError;
        if (seatError.code === 'PERMISSION_DENIED') {
          return false;
        }
      }
      return failureCount < 2;
    },
  });

  // Assign staff seat mutation
  const assignSeatMutation = useMutation({
    mutationFn: SeatService.assignTeacherSeat,
    onSuccess: (data, variables) => {
      // Invalidate and refetch seat limits
      queryClient.invalidateQueries({ queryKey: SEAT_QUERY_KEYS.limits });
      queryClient.invalidateQueries({ queryKey: SEAT_QUERY_KEYS.seats });
      
      if (data.status === 'assigned') {
        alert.showSuccess('Success', 'Staff seat assigned successfully!');
      } else if (data.status === 'already_assigned') {
        alert.show('Info', 'Staff member already has an active seat.', [{ text: 'OK' }], { type: 'info' });
      }
    },
    onError: (error: SeatManagementError) => {
      let title = 'Assignment Failed';
      let message = 'Failed to assign staff seat.';
      
      switch (error.code) {
        case 'LIMIT_EXCEEDED':
          title = 'Seat Limit Reached';
          message = 'No staff seats available for your current plan. Consider upgrading your subscription.';
          break;
        case 'PERMISSION_DENIED':
          title = 'Permission Denied';
          message = 'Only principals can assign staff seats.';
          break;
        case 'USER_NOT_FOUND':
          title = 'Invalid Staff Member';
          message = 'The selected user must be school staff in your school.';
          break;
        case 'ALREADY_ASSIGNED':
          title = 'Already Assigned';
          message = 'This staff member already has an active seat.';
          break;
        default:
          message = error.message || 'An unexpected error occurred.';
      }
      
      alert.showError(title, message);
      console.error('Seat assignment error:', error);
    },
  });

  // Revoke staff seat mutation
  const revokeSeatMutation = useMutation({
    mutationFn: SeatService.revokeTeacherSeat,
    onSuccess: (data, variables) => {
      // Invalidate and refetch seat limits
      queryClient.invalidateQueries({ queryKey: SEAT_QUERY_KEYS.limits });
      queryClient.invalidateQueries({ queryKey: SEAT_QUERY_KEYS.seats });
      
      if (data.status === 'revoked') {
        alert.showSuccess('Success', 'Staff seat revoked successfully!');
      } else if (data.status === 'no_active_seat') {
        alert.show('Info', 'Staff member does not have an active seat.', [{ text: 'OK' }], { type: 'info' });
      }
    },
    onError: (error: SeatManagementError) => {
      let title = 'Revocation Failed';
      let message = 'Failed to revoke staff seat.';
      
      switch (error.code) {
        case 'PERMISSION_DENIED':
          title = 'Permission Denied';
          message = 'Only principals can revoke staff seats.';
          break;
        case 'NO_ACTIVE_SEAT':
          title = 'No Active Seat';
          message = 'This staff member does not have an active seat to revoke.';
          break;
        default:
          message = error.message || 'An unexpected error occurred.';
      }
      
      alert.showError(title, message);
      console.error('Seat revocation error:', error);
    },
  });

  // Generate UI-friendly display data
  const seatUsageDisplay: SeatUsageDisplay | null = limitsQuery.data 
    ? SeatService.formatSeatUsage(limitsQuery.data)
    : null;

  // Check if assignment should be disabled
  const shouldDisableAssignment = limitsQuery.data 
    ? SeatService.shouldDisableAssignment(limitsQuery.data)
    : false; // Avoid silently disabling actions while limits are loading/refreshing

  return {
    // Data
    limits: limitsQuery.data,
    seatUsageDisplay,
    shouldDisableAssignment,
    
    // Loading states
    isLoading: limitsQuery.isLoading,
    isError: limitsQuery.isError,
    error: limitsQuery.error,
    
    // Mutations
    assignSeat: assignSeatMutation.mutate,
    assignSeatAsync: assignSeatMutation.mutateAsync,
    revokeSeat: revokeSeatMutation.mutate,
    revokeSeatAsync: revokeSeatMutation.mutateAsync,
    isAssigning: assignSeatMutation.isPending,
    isRevoking: revokeSeatMutation.isPending,
    
    // Actions
    refetch: limitsQuery.refetch,
  };
}

/**
 * Hook for listing staff seats in the school
 */
export function useTeacherSeats() {
  const seatsQuery = useQuery({
    queryKey: SEAT_QUERY_KEYS.seats,
    queryFn: SeatService.listTeacherSeats,
    staleTime: 60 * 1000, // Consider data stale after 1 minute
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    retry: (failureCount, error) => {
      // Don't retry permission errors
      if (error instanceof Error && 'code' in error) {
        const seatError = error as SeatManagementError;
        if (seatError.code === 'PERMISSION_DENIED') {
          return false;
        }
      }
      return failureCount < 2;
    },
  });

  return {
    seats: seatsQuery.data || [],
    isLoading: seatsQuery.isLoading,
    isError: seatsQuery.isError,
    error: seatsQuery.error,
    refetch: seatsQuery.refetch,
  };
}

/**
 * Helper function to check if a specific staff member has an active seat
 */
export function useTeacherHasSeat(teacherUserId: string) {
  const { seats } = useTeacherSeats();
  
  // Debug logging
  React.useEffect(() => {
    const show = true; // Force enable debug for troubleshooting
    if (show && teacherUserId) {
      console.log('[useTeacherHasSeat debug]', {
        teacherUserId,
        seats: seats.map(seat => ({
          user_id: seat.user_id,
          assigned_at: seat.assigned_at,
          revoked_at: seat.revoked_at,
        })),
        hasActiveSeat: seats.some(seat => 
          seat.user_id === teacherUserId && 
          seat.revoked_at === null
        ),
      });
    }
  }, [seats, teacherUserId]);
  
  return seats.some(seat => 
    seat.user_id === teacherUserId && 
    seat.revoked_at === null
  );
}
