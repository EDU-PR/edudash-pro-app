/**
 * TeacherCard Component
 * 
 * Displays a teacher with seat management actions and a cleaner UI.
 * Extracted from app/screens/teacher-management.tsx per WARP.md standards.
 */

import React, { useState } from 'react';
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
  onInvite?: (teacher: Teacher) => void;
  onCopyInviteLink?: (teacher: Teacher) => void;
  onDeleteInvite?: (inviteId: string, email: string) => void;
  onDeleteTeacher?: (teacher: Teacher) => void;
  onSetRole?: (teacher: Teacher, role: 'teacher' | 'admin') => void;
  inviteStatus?: string | null;
  inviteToken?: string | null;
  inviteId?: string | null;
  isAssigning: boolean;
  isRevoking: boolean;
  isUpdatingRole?: boolean;
  updatingRoleTeacherId?: string | null;
  shouldDisableAssignment: boolean;
  theme?: ThemeColors;
}

export function TeacherCard({
  teacher,
  onPress,
  onAssignSeat,
  onRevokeSeat,
  onInvite,
  onCopyInviteLink,
  onDeleteInvite,
  onDeleteTeacher,
  onSetRole,
  inviteStatus,
  inviteToken,
  inviteId,
  isAssigning,
  isRevoking,
  isUpdatingRole,
  updatingRoleTeacherId,
  shouldDisableAssignment,
  theme,
}: TeacherCardProps) {
  const seatLookupId = teacher.teacherUserId || '__missing__';
  const teacherHasSeat = useTeacherHasSeat(seatLookupId);
  const hasSeatUser = Boolean(teacher.teacherUserId);
  const normalizedInviteStatus = (inviteStatus || '').toLowerCase();
  const invitePending = normalizedInviteStatus === 'pending';
  const inviteAccepted = normalizedInviteStatus === 'accepted';
  const inviteRevoked = normalizedInviteStatus === 'revoked';
  const inviteExpired = normalizedInviteStatus === 'expired';
  const fullName = `${teacher.firstName} ${teacher.lastName}`.trim() || teacher.email;
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const [showActions, setShowActions] = useState(false);
  const teacherRole = teacher.schoolRole || 'teacher';
  const isAdminRole = teacherRole === 'admin' || teacherRole === 'principal_admin';
  const canUpdateRole = Boolean(onSetRole && teacher.profileId);
  const isRoleUpdating = Boolean(isUpdatingRole && updatingRoleTeacherId === teacher.id);
  const initials = [teacher.firstName, teacher.lastName]
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
    .slice(0, 2) || '?';

  // Status info
  const statusColor = getStatusColor(teacher.status);
  const seatColor = !hasSeatUser
    ? invitePending ? '#6366f1' : '#f59e0b'
    : teacherHasSeat ? '#059669' : '#6b7280';
  const seatIcon = !hasSeatUser
    ? invitePending ? 'paper-plane' : 'time-outline'
    : teacherHasSeat ? 'checkmark-circle' : 'ellipse-outline';
  const seatLabel = !hasSeatUser
    ? invitePending ? 'Invite sent' : inviteAccepted ? 'Accepted' : 'Invite needed'
    : teacherHasSeat ? 'Seated' : 'No seat';

  return (
    <View style={styles.cardContainer}>
      {/* Main Card - Tappable */}
      <TouchableOpacity
        style={styles.teacherCard}
        onPress={() => onPress(teacher)}
        activeOpacity={0.7}
      >
        {/* Top Row: Avatar + Info + Quick Status */}
        <View style={styles.topRow}>
          <View style={[styles.avatar, { backgroundColor: statusColor }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>

          <View style={styles.infoSection}>
            <View style={styles.nameRow}>
              <Text style={styles.teacherName} numberOfLines={1}>{fullName}</Text>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            </View>
            <Text style={styles.teacherEmail} numberOfLines={1}>{teacher.email}</Text>

            {/* Meta Chips Row */}
            <View style={styles.chipRow}>
              {/* Seat Status Chip */}
              <View style={[styles.chip, { borderColor: seatColor }]}>
                <Ionicons name={seatIcon as any} size={11} color={seatColor} />
                <Text style={[styles.chipText, { color: seatColor }]}>{seatLabel}</Text>
              </View>

              {/* School Role Chip */}
              <View
                style={[
                  styles.chip,
                  isAdminRole && styles.roleChipAdmin,
                ]}
              >
                <Ionicons
                  name={isAdminRole ? 'shield-checkmark-outline' : 'person-outline'}
                  size={11}
                  color={isAdminRole ? '#0ea5e9' : (theme?.textSecondary || '#6b7280')}
                />
                <Text style={[styles.chipText, isAdminRole && styles.roleChipTextAdmin]}>
                  {isAdminRole ? 'Admin' : 'Teacher'}
                </Text>
              </View>

              {/* Classes Chip */}
              <View style={styles.chip}>
                <Ionicons name="school-outline" size={11} color={theme?.textSecondary || '#6b7280'} />
                <Text style={styles.chipText}>
                  {teacher.classes.length > 0 ? `${teacher.classes.length} class${teacher.classes.length > 1 ? 'es' : ''}` : 'No classes'}
                </Text>
              </View>

              {/* Student Count Chip */}
              {(teacher.studentCount || 0) > 0 && (
                <View style={styles.chip}>
                  <Ionicons name="people-outline" size={11} color={theme?.textSecondary || '#6b7280'} />
                  <Text style={styles.chipText}>{teacher.studentCount}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Expand Actions Button */}
          <TouchableOpacity
            style={styles.moreButton}
            onPress={(e) => {
              e.stopPropagation();
              setShowActions(!showActions);
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={showActions ? 'chevron-up' : 'ellipsis-vertical'}
              size={20}
              color={theme?.textSecondary || '#6b7280'}
            />
          </TouchableOpacity>
        </View>

        {/* Expanded Actions Panel */}
        {showActions && (
          <View style={styles.actionsPanel}>
            <View style={styles.actionsDivider} />

            {/* Primary Actions Row */}
            <View style={styles.actionsGrid}>
              {/* View Profile */}
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnProfile]}
                onPress={(e) => {
                  e.stopPropagation();
                  onPress(teacher);
                }}
              >
                <Ionicons name="person-outline" size={16} color="#6366f1" />
                <Text style={[styles.actionBtnText, { color: '#6366f1' }]}>Profile</Text>
              </TouchableOpacity>

              {/* Role Management */}
              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  isAdminRole ? styles.actionBtnRoleDemote : styles.actionBtnRolePromote,
                  (!canUpdateRole || isRoleUpdating) && styles.actionBtnDisabled,
                ]}
                onPress={(e) => {
                  e.stopPropagation();
                  if (!onSetRole || !canUpdateRole || isRoleUpdating) return;
                  onSetRole(teacher, isAdminRole ? 'teacher' : 'admin');
                }}
                disabled={!canUpdateRole || isRoleUpdating}
              >
                <Ionicons
                  name={isAdminRole ? 'person-circle-outline' : 'shield-outline'}
                  size={16}
                  color={
                    !canUpdateRole || isRoleUpdating
                      ? '#9ca3af'
                      : isAdminRole
                        ? '#f59e0b'
                        : '#0ea5e9'
                  }
                />
                <Text
                  style={[
                    styles.actionBtnText,
                    {
                      color:
                        !canUpdateRole || isRoleUpdating
                          ? '#9ca3af'
                          : isAdminRole
                            ? '#f59e0b'
                            : '#0ea5e9',
                    },
                  ]}
                >
                  {isRoleUpdating ? 'Updating role...' : isAdminRole ? 'Set Teacher' : 'Make Admin'}
                </Text>
              </TouchableOpacity>

              {/* Seat Management */}
              {!hasSeatUser ? (
                <>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnInvite]}
                    onPress={(e) => {
                      e.stopPropagation();
                      onInvite?.(teacher);
                    }}
                    disabled={!onInvite}
                  >
                    <Ionicons name="paper-plane-outline" size={16} color="#6366f1" />
                    <Text style={[styles.actionBtnText, { color: '#6366f1' }]}>
                      {invitePending ? 'Resend' : 'Invite'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnCopy]}
                    onPress={(e) => {
                      e.stopPropagation();
                      onCopyInviteLink?.(teacher);
                    }}
                    disabled={!onCopyInviteLink}
                  >
                    <Ionicons name="link-outline" size={16} color="#0ea5e9" />
                    <Text style={[styles.actionBtnText, { color: '#0ea5e9' }]}>Link</Text>
                  </TouchableOpacity>
                </>
              ) : teacherHasSeat ? (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnRevoke]}
                  onPress={(e) => {
                    e.stopPropagation();
                    onRevokeSeat(teacher.teacherUserId, fullName);
                  }}
                  disabled={isRevoking || !hasSeatUser}
                >
                  <Ionicons name="remove-circle-outline" size={16} color="#f59e0b" />
                  <Text style={[styles.actionBtnText, { color: '#f59e0b' }]}>
                    {isRevoking ? 'Revoking...' : 'Revoke Seat'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    styles.actionBtnAssign,
                    (shouldDisableAssignment || !hasSeatUser) && styles.actionBtnDisabled,
                  ]}
                  onPress={(e) => {
                    e.stopPropagation();
                    onAssignSeat(teacher.teacherUserId, fullName);
                  }}
                  disabled={isAssigning || !hasSeatUser}
                >
                  <Ionicons
                    name="add-circle-outline"
                    size={16}
                    color={shouldDisableAssignment || !hasSeatUser ? '#9ca3af' : '#059669'}
                  />
                  <Text style={[styles.actionBtnText, {
                    color: shouldDisableAssignment || !hasSeatUser ? '#9ca3af' : '#059669'
                  }]}>
                    {isAssigning ? 'Assigning...' : 'Assign Seat'}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Delete Invite (if pending) */}
              {invitePending && inviteId && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnDeleteInvite]}
                  onPress={(e) => {
                    e.stopPropagation();
                    onDeleteInvite?.(inviteId, teacher.email);
                  }}
                  disabled={!onDeleteInvite}
                >
                  <Ionicons name="close-circle-outline" size={16} color="#ef4444" />
                  <Text style={[styles.actionBtnText, { color: '#ef4444' }]}>Cancel Invite</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Danger Zone - Remove Teacher */}
            {onDeleteTeacher && (
              <TouchableOpacity
                style={styles.removeTeacherBtn}
                onPress={(e) => {
                  e.stopPropagation();
                  onDeleteTeacher(teacher);
                }}
              >
                <Ionicons name="trash-outline" size={16} color="#dc2626" />
                <Text style={styles.removeTeacherText}>Remove Teacher from School</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (theme?: ThemeColors) => StyleSheet.create({
  cardContainer: {
    marginBottom: 10,
  },
  teacherCard: {
    backgroundColor: theme?.card || '#1a1a2e',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: theme?.border || '#1f2937',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  infoSection: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  teacherName: {
    fontSize: 15,
    fontWeight: '700',
    color: theme?.text || '#f1f5f9',
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  teacherEmail: {
    fontSize: 12,
    color: theme?.textSecondary || '#64748b',
    marginTop: 1,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: theme?.surface || '#111827',
    borderWidth: 1,
    borderColor: theme?.border || '#1f2937',
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme?.textSecondary || '#64748b',
  },
  roleChipAdmin: {
    borderColor: '#0ea5e966',
    backgroundColor: 'rgba(14, 165, 233, 0.12)',
  },
  roleChipTextAdmin: {
    color: '#0ea5e9',
  },
  moreButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: theme?.surface || '#111827',
  },
  // ── Expanded Actions Panel ──
  actionsPanel: {
    marginTop: 10,
  },
  actionsDivider: {
    height: 1,
    backgroundColor: theme?.border || '#1f2937',
    marginBottom: 10,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  actionBtnProfile: {
    borderColor: '#6366f1',
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
  },
  actionBtnInvite: {
    borderColor: '#6366f1',
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
  },
  actionBtnCopy: {
    borderColor: '#0ea5e9',
    backgroundColor: 'rgba(14, 165, 233, 0.08)',
  },
  actionBtnRevoke: {
    borderColor: '#f59e0b',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
  },
  actionBtnAssign: {
    borderColor: '#059669',
    backgroundColor: 'rgba(5, 150, 105, 0.08)',
  },
  actionBtnRolePromote: {
    borderColor: '#0ea5e9',
    backgroundColor: 'rgba(14, 165, 233, 0.08)',
  },
  actionBtnRoleDemote: {
    borderColor: '#f59e0b',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
  },
  actionBtnDeleteInvite: {
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  actionBtnDisabled: {
    opacity: 0.4,
    borderColor: '#6b7280',
    backgroundColor: 'transparent',
  },
  // Remove Teacher Button
  removeTeacherBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dc2626',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(220, 38, 38, 0.06)',
  },
  removeTeacherText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#dc2626',
  },
});

export default TeacherCard;
