/**
 * TeacherCard Component
 * 
 * Displays a teacher with seat management actions.
 * Extracted from app/screens/teacher-management.tsx per WARP.md standards.
 */

import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTeacherHasSeat } from '@/lib/hooks/useSeatLimits';
import type { Teacher } from '@/types/teacher-management';
import { getStatusColor } from '@/types/teacher-management';
import type { ThemeColors } from '@/contexts/ThemeContext';

interface TeacherCardProps {
  teacher: Teacher;
  onPress: (teacher: Teacher) => void;
  onAssignSeat: (teacherUserId: string, teacherName: string) => void;
  onRevokeSeat: (teacherUserId: string, teacherName: string) => void;
  isAssigning: boolean;
  isRevoking: boolean;
  shouldDisableAssignment: boolean;
  theme?: ThemeColors;
  inviteStatus?: string;
  onInvite?: () => void;
  onCopyInviteLink?: () => void;
}

export function TeacherCard({
  teacher,
  onPress,
  onAssignSeat,
  onRevokeSeat,
  isAssigning,
  isRevoking,
  shouldDisableAssignment,
  theme,
  inviteStatus,
  onInvite,
  onCopyInviteLink,
}: TeacherCardProps) {
  const teacherHasSeat = useTeacherHasSeat(teacher.teacherUserId);
  const fullName = `${teacher.firstName} ${teacher.lastName}`;
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const isInvitePending = inviteStatus && inviteStatus !== 'accepted' && inviteStatus !== 'active';
  const inviteLabel = inviteStatus === 'pending'
    ? 'Invite pending'
    : inviteStatus === 'accepted'
      ? 'Invite accepted'
      : inviteStatus === 'revoked'
        ? 'Invite revoked'
        : inviteStatus === 'expired'
          ? 'Invite expired'
          : inviteStatus === 'needed'
            ? 'Invite needed'
            : inviteStatus || '';
  const inviteActionLabel = inviteStatus === 'pending' ? 'Resend Invite' : 'Send Invite';
  const showInviteActions = Boolean(onInvite) && !teacher.authUserId;
  const showInviteStatus = Boolean(inviteLabel);

  // Debug logging for teacher card
  useEffect(() => {
    console.log('[TeacherCard DEBUG]', {
      teacherName: fullName,
      teacherEmail: teacher.email,
      teacherUserId: teacher.teacherUserId,
      teacherHasSeat,
      teacherData: {
        id: teacher.id,
        employeeId: teacher.employeeId,
        status: teacher.status,
      }
    });
  }, [teacher, teacherHasSeat, fullName]);

  const getInviteStatusColor = () => {
    if (inviteStatus === 'accepted' || inviteStatus === 'active') return '#16a34a';
    if (inviteStatus === 'pending') return '#f59e0b';
    if (inviteStatus === 'revoked' || inviteStatus === 'expired') return '#ef4444';
    if (inviteStatus === 'needed') return '#f97316';
    return '#6b7280';
  };

  return (
    <TouchableOpacity
      style={styles.teacherCard}
      onPress={() => onPress(teacher)}
    >
      <View style={styles.teacherTopRow}>
        <View style={styles.teacherAvatar}>
          <Text style={styles.avatarText}>
            {teacher.firstName.charAt(0)}{teacher.lastName.charAt(0)}
          </Text>
        </View>
        <View style={styles.teacherInfo}>
          <Text style={styles.teacherName}>{fullName}</Text>
          <Text style={styles.teacherEmail}>{teacher.email}</Text>
          <Text style={styles.teacherClasses}>
            {teacher.classes.length > 0 ? `Classes: ${teacher.classes.join(', ')}` : 'No classes assigned'}
          </Text>
          <Text style={styles.teacherStudentCount}>
            Students: {teacher.studentCount || 0}
          </Text>
          <View style={styles.seatStatusContainer}>
            <Ionicons 
              name={teacherHasSeat ? 'checkmark-circle' : 'ellipse-outline'} 
              size={14} 
              color={teacherHasSeat ? '#059669' : '#6b7280'} 
            />
            <Text style={[styles.seatStatusText, { color: teacherHasSeat ? '#059669' : '#6b7280' }]}>
              {teacherHasSeat ? 'Has teacher seat' : 'No teacher seat'}
            </Text>
          </View>
          {showInviteStatus && (
            <View style={styles.inviteStatusContainer}>
              <Ionicons
                name={inviteStatus === 'accepted' ? 'checkmark-circle' : 'time'}
                size={14}
                color={getInviteStatusColor()}
              />
              <Text style={[styles.inviteStatusText, { color: getInviteStatusColor() }]}>
                {inviteLabel}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.teacherActionsColumn}>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(teacher.status) }]}> 
          <Text style={styles.statusText}>{teacher.status}</Text>
        </View>

        <View style={styles.seatActionButtons}>
          {teacherHasSeat ? (
            <TouchableOpacity
              style={[styles.seatActionButton, styles.revokeButton]}
              onPress={(e) => {
                e.stopPropagation();
                console.log('[TeacherCard] Revoking seat from:', { 
                  teacherId: teacher.id, 
                  teacherName: fullName, 
                  teacherUserId: teacher.teacherUserId 
                });
                onRevokeSeat(teacher.teacherUserId, fullName);
              }}
              disabled={isRevoking}
            >
              <Ionicons name="remove-circle" size={16} color="#fca5a5" />
              <Text style={styles.seatActionText}>Revoke Seat</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.seatActionButton,
                styles.assignButton,
                shouldDisableAssignment && styles.disabledButton
              ]}
              onPress={(e) => {
                e.stopPropagation();
                console.log('[TeacherCard] Assigning seat to:', { 
                  teacherId: teacher.id, 
                  teacherName: fullName, 
                  teacherUserId: teacher.teacherUserId 
                });
                onAssignSeat(teacher.teacherUserId, fullName);
              }}
              disabled={isAssigning || shouldDisableAssignment}
            >
              <Ionicons
                name="add-circle"
                size={16}
                color={shouldDisableAssignment ? '#9ca3af' : '#34d399'}
              />
              <Text style={styles.seatActionText}>Assign Seat</Text>
            </TouchableOpacity>
          )}

          {showInviteActions && (
            <>
              <TouchableOpacity
                style={[
                  styles.seatActionButton,
                  styles.inviteButton,
                  isInvitePending && styles.invitePendingButton,
                ]}
                onPress={(e) => {
                  e.stopPropagation();
                  onInvite?.();
                }}
              >
                <Ionicons name="paper-plane" size={16} color="#fff" />
                <Text style={styles.seatActionText}>{inviteActionLabel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.seatActionButton, styles.copyInviteButton]}
                onPress={(e) => {
                  e.stopPropagation();
                  onCopyInviteLink?.();
                }}
              >
                <Ionicons name="link" size={16} color="#e2e8f0" />
                <Text style={styles.seatActionText}>Copy Link</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            style={[styles.seatActionButton, styles.messageQuickAction]}
            onPress={() => onPress(teacher)}
          >
            <Ionicons name="eye" size={16} color="#e2e8f0" />
            <Text style={styles.seatActionText}>View Profile</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (theme?: ThemeColors) => StyleSheet.create({
  teacherCard: {
    backgroundColor: theme?.cardBackground || 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: theme?.shadow || '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: theme?.border || '#f3f4f6',
  },
  teacherTopRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  teacherAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme?.primary || '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  teacherInfo: {
    flex: 1,
  },
  teacherName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme?.text || '#111827',
    marginBottom: 2,
  },
  teacherEmail: {
    fontSize: 13,
    color: theme?.textSecondary || '#6b7280',
    marginBottom: 4,
  },
  teacherClasses: {
    fontSize: 12,
    color: theme?.textSecondary || '#6b7280',
    marginBottom: 2,
  },
  teacherStudentCount: {
    fontSize: 12,
    color: theme?.textSecondary || '#6b7280',
    marginBottom: 4,
  },
  seatStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  seatStatusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  inviteStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  inviteStatusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  teacherActionsColumn: {
    gap: 8,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  statusText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  seatActionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 'auto',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  seatActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 95,
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
  },
  assignButton: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  revokeButton: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  disabledButton: {
    backgroundColor: '#e5e7eb',
    borderColor: '#e5e7eb',
    opacity: 0.6,
  },
  inviteButton: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  invitePendingButton: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  copyInviteButton: {
    backgroundColor: '#334155',
    borderColor: '#475569',
  },
  seatActionText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'white',
  },
  messageQuickAction: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
});

export default TeacherCard;
