/**
 * Governance Meetings Tab Components
 * Meeting list and scheduling
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface Meeting {
  id: string;
  title: string;
  type: 'board' | 'agm' | 'committee';
  date: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  attendees: number;
}

export const UPCOMING_MEETINGS: Meeting[] = [
  { id: '1', title: 'Q1 Board Meeting', type: 'board', date: '2025-01-15', status: 'scheduled', attendees: 5 },
  { id: '2', title: 'Finance Committee', type: 'committee', date: '2025-01-08', status: 'scheduled', attendees: 3 },
  { id: '3', title: 'Annual General Meeting', type: 'agm', date: '2025-03-20', status: 'scheduled', attendees: 50 },
];

export function getMeetingTypeColor(type: string): string {
  switch (type) {
    case 'board': return '#3B82F6';
    case 'agm': return '#8B5CF6';
    case 'committee': return '#10B981';
    default: return '#6B7280';
  }
}

export function getMeetingIcon(type: string): string {
  switch (type) {
    case 'board': return 'people';
    case 'agm': return 'megaphone';
    case 'committee': return 'chatbubbles';
    default: return 'calendar';
  }
}

interface MeetingCardProps {
  meeting: Meeting;
  theme: any;
  onPress?: (meeting: Meeting) => void;
}

export function MeetingCard({ meeting, theme, onPress }: MeetingCardProps) {
  const typeColor = getMeetingTypeColor(meeting.type);
  const icon = getMeetingIcon(meeting.type);
  
  return (
    <TouchableOpacity 
      style={[styles.meetingCard, { backgroundColor: theme.card }]}
      onPress={() => onPress?.(meeting)}
      activeOpacity={0.7}
    >
      <View style={[styles.meetingType, { backgroundColor: typeColor }]}>
        <Ionicons name={icon as any} size={20} color="#FFFFFF" />
      </View>
      <View style={styles.meetingInfo}>
        <Text style={[styles.meetingTitle, { color: theme.text }]}>{meeting.title}</Text>
        <View style={styles.meetingMeta}>
          <Ionicons name="calendar-outline" size={14} color={theme.textSecondary} />
          <Text style={[styles.meetingMetaText, { color: theme.textSecondary }]}>
            {new Date(meeting.date).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })}
          </Text>
          <Ionicons name="people-outline" size={14} color={theme.textSecondary} style={{ marginLeft: 12 }} />
          <Text style={[styles.meetingMetaText, { color: theme.textSecondary }]}>
            {meeting.attendees} expected
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
    </TouchableOpacity>
  );
}

interface MeetingsSectionProps {
  meetings: Meeting[];
  theme: any;
  onMeetingPress?: (meeting: Meeting) => void;
  onAddPress?: () => void;
}

export function MeetingsSection({ meetings, theme, onMeetingPress, onAddPress }: MeetingsSectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Upcoming Meetings</Text>
        {onAddPress && (
          <TouchableOpacity onPress={onAddPress}>
            <Ionicons name="add-circle" size={24} color={theme.primary} />
          </TouchableOpacity>
        )}
      </View>
      {meetings.map((meeting) => (
        <MeetingCard
          key={meeting.id}
          meeting={meeting}
          theme={theme}
          onPress={onMeetingPress}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  meetingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  meetingType: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  meetingInfo: {
    flex: 1,
  },
  meetingTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  meetingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  meetingMetaText: {
    fontSize: 12,
  },
});
