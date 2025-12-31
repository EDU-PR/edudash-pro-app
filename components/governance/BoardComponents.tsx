/**
 * Governance Board Tab Components
 * Board members display and appointment functionality
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export interface BoardMember {
  id: string;
  name: string;
  role: string;
  since: string;
  photo?: string;
}

interface BoardMemberCardProps {
  member: BoardMember;
  theme: any;
  accentColor?: string;
  onAppoint?: (member: BoardMember) => void;
}

export function BoardMemberCard({ member, theme, accentColor, onAppoint }: BoardMemberCardProps) {
  const isVacant = member.name.includes('Vacant');
  const color = accentColor || theme.primary;
  
  return (
    <View style={[styles.boardCard, { backgroundColor: theme.card }]}>
      <View style={[styles.boardAvatar, { backgroundColor: isVacant ? theme.border : color + '20' }]}>
        {isVacant ? (
          <Ionicons name="person-add-outline" size={24} color={theme.textSecondary} />
        ) : (
          <Text style={[styles.boardAvatarText, { color }]}>
            {member.name.split(' ').map(n => n[0]).join('')}
          </Text>
        )}
      </View>
      <View style={styles.boardInfo}>
        <Text style={[styles.boardName, { color: isVacant ? theme.textSecondary : theme.text }]}>
          {member.name}
        </Text>
        <Text style={[styles.boardRole, { color: theme.textSecondary }]}>{member.role}</Text>
        {!isVacant && (
          <Text style={[styles.boardSince, { color: theme.textSecondary }]}>Since {member.since}</Text>
        )}
      </View>
      {isVacant && onAppoint && (
        <TouchableOpacity 
          style={[styles.appointButton, { borderColor: color }]}
          onPress={() => onAppoint(member)}
        >
          <Text style={[styles.appointButtonText, { color }]}>Appoint</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

interface BoardSectionProps {
  title: string;
  members: BoardMember[];
  theme: any;
  accentColor?: string;
  onAppoint?: (member: BoardMember) => void;
}

export function BoardSection({ title, members, theme, accentColor, onAppoint }: BoardSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      {members.map((member) => (
        <BoardMemberCard
          key={member.id}
          member={member}
          theme={theme}
          accentColor={accentColor}
          onAppoint={onAppoint}
        />
      ))}
    </View>
  );
}

// Alias for Youth Wing section (uses purple accent)
interface YouthBoardSectionProps {
  members: BoardMember[];
  theme: any;
  onAppoint?: (member: BoardMember) => void;
}

export function YouthBoardSection({ members, theme, onAppoint }: YouthBoardSectionProps) {
  return (
    <BoardSection
      title="Youth Wing Leadership"
      members={members}
      theme={theme}
      accentColor="#8B5CF6"
      onAppoint={onAppoint}
    />
  );
}

interface ComplianceCardProps {
  score: number;
  status: string;
  stats: {
    boardFilled: string;
    activePolicies: number;
    upcomingMeetings: number;
  };
}

export function ComplianceCard({ score, status, stats }: ComplianceCardProps) {
  return (
    <LinearGradient
      colors={['#06B6D4', '#0891B2']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.complianceCard}
    >
      <View style={styles.complianceHeader}>
        <Ionicons name="shield-checkmark" size={32} color="#FFFFFF" />
        <Text style={styles.complianceTitle}>Governance Score</Text>
      </View>
      <Text style={styles.complianceScore}>{score}%</Text>
      <Text style={styles.complianceSubtitle}>{status}</Text>
      <View style={styles.complianceStats}>
        <View style={styles.complianceStat}>
          <Text style={styles.complianceStatValue}>{stats.boardFilled}</Text>
          <Text style={styles.complianceStatLabel}>Board Filled</Text>
        </View>
        <View style={styles.complianceStat}>
          <Text style={styles.complianceStatValue}>{stats.activePolicies}</Text>
          <Text style={styles.complianceStatLabel}>Active Policies</Text>
        </View>
        <View style={styles.complianceStat}>
          <Text style={styles.complianceStatValue}>{stats.upcomingMeetings}</Text>
          <Text style={styles.complianceStatLabel}>Upcoming Meetings</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

// Main Board positions
export const BOARD_MEMBERS: BoardMember[] = [
  { id: '1', name: 'King Bongani Ramontja', role: 'President & Chairperson', since: '2020' },
  { id: '2', name: 'Position Vacant', role: 'Vice Chairperson', since: '-' },
  { id: '3', name: 'Position Vacant', role: 'Secretary', since: '-' },
  { id: '4', name: 'Position Vacant', role: 'Treasurer', since: '-' },
  { id: '5', name: 'Position Vacant', role: 'Board Member', since: '-' },
];

// Youth Wing Board positions
export const YOUTH_BOARD_MEMBERS: BoardMember[] = [
  { id: 'y1', name: 'Position Vacant', role: 'Youth President', since: '-' },
  { id: 'y2', name: 'Position Vacant', role: 'Youth Deputy President', since: '-' },
  { id: 'y3', name: 'Position Vacant', role: 'Youth Secretary', since: '-' },
  { id: 'y4', name: 'Position Vacant', role: 'Youth Treasurer', since: '-' },
  { id: 'y5', name: 'Position Vacant', role: 'Youth Coordinator', since: '-' },
];

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  boardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  boardAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  boardAvatarText: {
    fontSize: 16,
    fontWeight: '700',
  },
  boardInfo: {
    flex: 1,
  },
  boardName: {
    fontSize: 15,
    fontWeight: '600',
  },
  boardRole: {
    fontSize: 13,
    marginTop: 2,
  },
  boardSince: {
    fontSize: 11,
    marginTop: 2,
  },
  appointButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  appointButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  complianceCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    alignItems: 'center',
  },
  complianceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  complianceTitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
  },
  complianceScore: {
    fontSize: 56,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  complianceSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 20,
  },
  complianceStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  complianceStat: {
    alignItems: 'center',
  },
  complianceStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  complianceStatLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
});
