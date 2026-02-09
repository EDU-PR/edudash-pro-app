/**
 * seatHandlers — assign / revoke teacher seat actions.
 *
 * Each handler performs validation, shows a confirmation alert,
 * then delegates to the seat-management hook returned from useSeatLimits.
 */

import type { AlertButton } from '@/components/ui/AlertModal';
import type { SafeAlert } from './types';

interface SeatContext {
  shouldDisableAssignment: boolean;
  seatUsageDisplay: { displayText: string } | null;
  assignSeat: (params: { teacherUserId: string }) => void;
  revokeSeat: (params: { teacherUserId: string }) => void;
  fetchTeachers: () => Promise<void>;
  safeAlert: SafeAlert;
}

export function createSeatHandlers(ctx: SeatContext) {
  const {
    shouldDisableAssignment,
    seatUsageDisplay,
    assignSeat,
    revokeSeat,
    fetchTeachers,
    safeAlert,
  } = ctx;

  function handleAssignSeat(teacherUserId: string, teacherName: string) {
    if (!teacherUserId) {
      safeAlert({
        title: 'Invite Needed',
        message: `${teacherName} does not have an account yet. Send them an invite before assigning a seat.`,
        type: 'warning',
      });
      return;
    }

    if (shouldDisableAssignment) {
      safeAlert({
        title: 'Seat Limit Reached',
        message: `Cannot assign more teacher seats. You have reached the limit for your current plan.${
          seatUsageDisplay ? `\n\nCurrent usage: ${seatUsageDisplay.displayText}` : ''
        }`,
        type: 'warning',
        buttons: [
          { text: 'OK', style: 'default' } as AlertButton,
          {
            text: 'Upgrade Plan',
            onPress: () => {
              safeAlert({
                title: 'Upgrade Plan',
                message: 'Plan upgrade feature coming soon!',
                type: 'info',
              });
            },
          } as AlertButton,
        ],
      });
      return;
    }

    safeAlert({
      title: 'Assign Teacher Seat',
      message: `Assign a teacher seat to ${teacherName}?\n\nThis will allow them to use the teacher portal and access student information.`,
      type: 'info',
      buttons: [
        { text: 'Cancel', style: 'cancel' } as AlertButton,
        {
          text: 'Assign Seat',
          onPress: async () => {
            try {
              await assignSeat({ teacherUserId });
              await fetchTeachers();
            } catch (_error) {
              safeAlert({
                title: 'Assignment Failed',
                message: _error instanceof Error ? _error.message : 'Unknown error occurred',
                type: 'error',
              });
            }
          },
        } as AlertButton,
      ],
    });
  }

  function handleRevokeSeat(teacherUserId: string, teacherName: string) {
    if (!teacherUserId) {
      safeAlert({
        title: 'No Account',
        message: `${teacherName} does not have an active account to revoke.`,
        type: 'warning',
      });
      return;
    }

    safeAlert({
      title: 'Revoke Teacher Seat',
      message: `Are you sure you want to revoke the teacher seat from ${teacherName}?\n\nThey will lose access to the teacher portal until a new seat is assigned.`,
      type: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' } as AlertButton,
        {
          text: 'Revoke Seat',
          style: 'destructive',
          onPress: async () => {
            try {
              await revokeSeat({ teacherUserId });
              await fetchTeachers();
              safeAlert({
                title: 'Success',
                message: `Seat revoked from ${teacherName} successfully!`,
                type: 'success',
              });
            } catch (_error) {
              safeAlert({
                title: 'Revocation Failed',
                message: _error instanceof Error ? _error.message : 'Unknown error occurred',
                type: 'error',
              });
            }
          },
        } as AlertButton,
      ],
    });
  }

  return { handleAssignSeat, handleRevokeSeat };
}
