// Meeting Card Component

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import type { Meeting, MeetingStatus } from './types';
import { getMeetingTypeInfo, formatMeetingDate, formatMeetingTime, STATUS_COLORS } from './types';

interface MeetingCardProps {
  meeting: Meeting;
  onPress: (meeting: Meeting) => void;
  onEdit?: (meeting: Meeting) => void;
  onStatusChange: (meeting: Meeting, status: MeetingStatus) => void;
  onDelete: (meeting: Meeting) => void;
}

export const MeetingCard: React.FC<MeetingCardProps> = ({
  meeting,
  onPress,
  onEdit,
  onStatusChange,
  onDelete,
}) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const typeInfo = getMeetingTypeInfo(meeting.meeting_type);
  
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(meeting)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.typeIcon, { backgroundColor: typeInfo.color + '20' }]}>
          <Ionicons name={typeInfo.icon as any} size={24} color={typeInfo.color} />
        </View>
        <View style={styles.cardTitleContainer}>
          <Text style={styles.meetingTitle} numberOfLines={1}>{meeting.title}</Text>
          <Text style={styles.meetingType}>{typeInfo.label}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[meeting.status] }]}>
          <Text style={styles.statusText}>{meeting.status.replace('_', ' ')}</Text>
        </View>
      </View>
      
      <View style={styles.cardDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={16} color={theme.textSecondary} />
          <Text style={styles.detailText}>{formatMeetingDate(meeting.meeting_date)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={16} color={theme.textSecondary} />
          <Text style={styles.detailText}>
            {formatMeetingTime(meeting.start_time)}
            {meeting.end_time && ` - ${formatMeetingTime(meeting.end_time)}`}
          </Text>
        </View>
        {meeting.location && (
          <View style={styles.detailRow}>
            <Ionicons 
              name={meeting.is_virtual ? 'videocam-outline' : 'location-outline'} 
              size={16} 
              color={theme.textSecondary} 
            />
            <Text style={styles.detailText}>{meeting.location}</Text>
          </View>
        )}
      </View>
      
      {meeting.agenda_items?.length > 0 && (
        <View style={styles.agendaPreview}>
          <Text style={styles.agendaLabel}>Agenda ({meeting.agenda_items.length} items)</Text>
          <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
        </View>
      )}
      
      <View style={styles.cardActions}>
        {/* View Details - primary action */}
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.primary + '20', flex: 1 }]}
          onPress={() => onPress(meeting)}
        >
          <Ionicons name="eye-outline" size={14} color={theme.primary} style={{ marginRight: 4 }} />
          <Text style={[styles.actionButtonText, { color: theme.primary }]}>View</Text>
        </TouchableOpacity>
        
        {/* Edit button */}
        {onEdit && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#6366f120' }]}
            onPress={() => onEdit(meeting)}
          >
            <Ionicons name="pencil-outline" size={14} color="#6366f1" style={{ marginRight: 4 }} />
            <Text style={[styles.actionButtonText, { color: '#6366f1' }]}>Edit</Text>
          </TouchableOpacity>
        )}
        
        {meeting.status === 'scheduled' && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#f59e0b20' }]}
            onPress={() => onStatusChange(meeting, 'in_progress')}
          >
            <Text style={[styles.actionButtonText, { color: '#f59e0b' }]}>Start</Text>
          </TouchableOpacity>
        )}
        {meeting.status === 'in_progress' && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#10b98120' }]}
            onPress={() => onStatusChange(meeting, 'completed')}
          >
            <Text style={[styles.actionButtonText, { color: '#10b981' }]}>Complete</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#ef444420' }]}
          onPress={() => onDelete(meeting)}
        >
          <Text style={[styles.actionButtonText, { color: '#ef4444' }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  card: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  typeIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardTitleContainer: {
    flex: 1,
  },
  meetingTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
  },
  meetingType: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  cardDetails: {
    gap: 6,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  agendaPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.background,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  agendaLabel: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default MeetingCard;
