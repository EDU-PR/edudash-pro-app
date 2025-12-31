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

// Empty Board Positions Component (shown when no positions exist)
interface EmptyBoardStateProps {
  theme: any;
  onInitialize?: () => void;
  loading?: boolean;
}

export function EmptyBoardState({ theme, onInitialize, loading }: EmptyBoardStateProps) {
  return (
    <View style={[styles.emptyBoardContainer, { backgroundColor: theme.card }]}>
      <Ionicons name="people-outline" size={48} color={theme.textSecondary} />
      <Text style={[styles.emptyBoardTitle, { color: theme.text }]}>
        No Board Positions Set Up
      </Text>
      <Text style={[styles.emptyBoardSubtitle, { color: theme.textSecondary }]}>
        Board positions have not been configured for this organization yet.
      </Text>
      {onInitialize && (
        <TouchableOpacity
          style={[styles.initializeButton, { backgroundColor: theme.primary }]}
          onPress={onInitialize}
          disabled={loading}
        >
          <Text style={styles.initializeButtonText}>
            {loading ? 'Setting up...' : 'Initialize Board Positions'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// Default position templates (used for display when no DB data)
export const DEFAULT_BOARD_POSITIONS = [
  { position_code: 'president', position_title: 'President & Chairperson', position_order: 1 },
  { position_code: 'vice_chairperson', position_title: 'Vice Chairperson', position_order: 2 },
  { position_code: 'secretary', position_title: 'Secretary', position_order: 3 },
  { position_code: 'treasurer', position_title: 'Treasurer', position_order: 4 },
  { position_code: 'board_member', position_title: 'Board Member', position_order: 5 },
];

export const DEFAULT_YOUTH_POSITIONS = [
  { position_code: 'youth_president', position_title: 'Youth President', position_order: 1 },
  { position_code: 'youth_deputy', position_title: 'Youth Deputy President', position_order: 2 },
  { position_code: 'youth_secretary', position_title: 'Youth Secretary', position_order: 3 },
  { position_code: 'youth_treasurer', position_title: 'Youth Treasurer', position_order: 4 },
  { position_code: 'youth_coordinator', position_title: 'Youth Coordinator', position_order: 5 },
];

// DEPRECATED: Static mock data - use useBoardPositions hook instead
// Keeping for backward compatibility during transition
export const BOARD_MEMBERS: BoardMember[] = [];
export const YOUTH_BOARD_MEMBERS: BoardMember[] = [];

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
  // Empty state styles
  emptyBoardContainer: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 16,
    marginBottom: 24,
  },
  emptyBoardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyBoardSubtitle: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  initializeButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  initializeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
