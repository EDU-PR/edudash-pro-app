/**
 * JoinRequestCard Component
 *
 * Reusable card component for displaying join request information
 * with approve/reject actions for admins.
 *
 * @module components/organizations/JoinRequestCard
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { JoinRequestType, JoinRequestStatus } from '@/services/InviteService';

const REQUEST_TYPE_LABELS: Record<JoinRequestType, string> = {
  teacher_invite: 'Teacher Invite',
  parent_join: 'Parent Join',
  member_join: 'Member Request',
  guardian_claim: 'Guardian Claim',
  staff_invite: 'Staff Invite',
  learner_enroll: 'Learner Enrollment',
};

const STATUS_CONFIG: Record<JoinRequestStatus, { color: string; label: string }> = {
  pending: { color: '#f59e0b', label: 'Pending' },
  approved: { color: '#10b981', label: 'Approved' },
  rejected: { color: '#ef4444', label: 'Rejected' },
  expired: { color: '#6b7280', label: 'Expired' },
  cancelled: { color: '#6b7280', label: 'Cancelled' },
  revoked: { color: '#ef4444', label: 'Revoked' },
};

export interface JoinRequestCardData {
  id: string;
  request_type: JoinRequestType;
  status: JoinRequestStatus;
  requester_email?: string | null;
  requester_phone?: string | null;
  message?: string | null;
  relationship?: string | null;
  review_notes?: string | null;
  created_at: string;
  requester_profile?: {
    first_name?: string | null;
    last_name?: string | null;
    avatar_url?: string | null;
  } | null;
}

export interface JoinRequestCardProps {
  request: JoinRequestCardData;
  onApprove?: () => void;
  onReject?: () => void;
  onViewDetails?: () => void;
  isApproving?: boolean;
  isRejecting?: boolean;
  showActions?: boolean;
}

export function JoinRequestCard({
  request,
  onApprove,
  onReject,
  onViewDetails,
  isApproving,
  isRejecting,
  showActions = true,
}: JoinRequestCardProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const isPending = request.status === 'pending';
  const statusConfig = STATUS_CONFIG[request.status];

  const requesterName = useMemo(() => {
    const profile = request.requester_profile;
    if (profile?.first_name || profile?.last_name) {
      return `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
    }
    return request.requester_email || request.requester_phone || 'Unknown';
  }, [request]);

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const Container = onViewDetails ? TouchableOpacity : View;

  return (
    <Container
      style={styles.card}
      onPress={onViewDetails}
      activeOpacity={0.7}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.typeContainer}>
          <Text style={styles.requestType}>
            {REQUEST_TYPE_LABELS[request.request_type] || request.request_type}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '20' }]}>
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>
        </View>
        <Text style={styles.date}>{formatDate(request.created_at)}</Text>
      </View>

      {/* Body */}
      <View style={styles.body}>
        <Text style={styles.requesterName}>{requesterName}</Text>
        
        {request.requester_email && (
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={14} color={theme?.textSecondary} />
            <Text style={styles.infoText}>{request.requester_email}</Text>
          </View>
        )}
        
        {request.requester_phone && (
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={14} color={theme?.textSecondary} />
            <Text style={styles.infoText}>{request.requester_phone}</Text>
          </View>
        )}

        {request.message && (
          <View style={styles.messageContainer}>
            <Text style={styles.messageLabel}>Message:</Text>
            <Text style={styles.messageText} numberOfLines={3}>
              {request.message}
            </Text>
          </View>
        )}

        {request.relationship && (
          <Text style={styles.relationshipText}>
            Relationship: {request.relationship}
          </Text>
        )}
      </View>

      {/* Actions */}
      {showActions && isPending && (onApprove || onReject) && (
        <View style={styles.footer}>
          {onReject && (
            <TouchableOpacity
              style={styles.rejectButton}
              onPress={onReject}
              disabled={isApproving || isRejecting}
            >
              {isRejecting ? (
                <ActivityIndicator size="small" color={theme?.error || '#ef4444'} />
              ) : (
                <>
                  <Ionicons name="close-circle-outline" size={18} color={theme?.error || '#ef4444'} />
                  <Text style={[styles.actionText, { color: theme?.error || '#ef4444' }]}>
                    Reject
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
          {onApprove && (
            <TouchableOpacity
              style={[styles.approveButton, (isApproving || isRejecting) && styles.buttonDisabled]}
              onPress={onApprove}
              disabled={isApproving || isRejecting}
            >
              {isApproving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                  <Text style={styles.approveText}>Approve</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Review Notes */}
      {request.review_notes && (
        <View style={styles.reviewNotesContainer}>
          <Text style={styles.reviewNotesLabel}>Review Notes:</Text>
          <Text style={styles.reviewNotesText}>{request.review_notes}</Text>
        </View>
      )}
    </Container>
  );
}

function createStyles(theme: any) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme?.card || '#1a1a2e',
      borderRadius: 16,
      marginVertical: 8,
      borderWidth: 1,
      borderColor: theme?.border || '#2a2a4a',
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme?.border || '#2a2a4a',
    },
    typeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    requestType: {
      fontSize: 13,
      fontWeight: '600',
      color: theme?.primary || '#00f5ff',
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    statusText: {
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    date: {
      fontSize: 12,
      color: theme?.textSecondary || '#888',
    },
    body: {
      padding: 16,
    },
    requesterName: {
      fontSize: 16,
      fontWeight: '700',
      color: theme?.text || '#fff',
      marginBottom: 8,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    infoText: {
      fontSize: 13,
      color: theme?.textSecondary || '#888',
      marginLeft: 6,
    },
    messageContainer: {
      marginTop: 12,
      padding: 12,
      backgroundColor: theme?.background || '#0d0d1a',
      borderRadius: 8,
    },
    messageLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme?.textSecondary || '#888',
      marginBottom: 4,
    },
    messageText: {
      fontSize: 14,
      color: theme?.text || '#fff',
      lineHeight: 20,
    },
    relationshipText: {
      fontSize: 13,
      color: theme?.textSecondary || '#888',
      marginTop: 8,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 12,
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: theme?.border || '#2a2a4a',
    },
    rejectButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 6,
    },
    actionText: {
      fontSize: 14,
      fontWeight: '600',
    },
    approveButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme?.success || '#10b981',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 8,
      gap: 6,
    },
    approveText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '700',
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    reviewNotesContainer: {
      padding: 16,
      backgroundColor: theme?.background || '#0d0d1a',
    },
    reviewNotesLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme?.textSecondary || '#888',
      marginBottom: 4,
    },
    reviewNotesText: {
      fontSize: 13,
      color: theme?.text || '#fff',
    },
  });
}

export default JoinRequestCard;
