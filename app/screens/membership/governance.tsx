/**
 * Governance Screen
 * Organizational governance, policies, and compliance
 */
import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { DashboardWallpaperBackground } from '@/components/membership/dashboard';

interface BoardMember {
  id: string;
  name: string;
  role: string;
  since: string;
  photo?: string;
}

interface Policy {
  id: string;
  title: string;
  category: string;
  lastUpdated: string;
  status: 'active' | 'under-review' | 'draft';
}

interface Meeting {
  id: string;
  title: string;
  type: 'board' | 'agm' | 'committee';
  date: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  attendees: number;
}

const BOARD_MEMBERS: BoardMember[] = [
  { id: '1', name: 'King Bongani Ramontja', role: 'CEO & Chairperson', since: '2020' },
  { id: '2', name: 'Position Vacant', role: 'Vice Chairperson', since: '-' },
  { id: '3', name: 'Position Vacant', role: 'Secretary', since: '-' },
  { id: '4', name: 'Position Vacant', role: 'Treasurer', since: '-' },
  { id: '5', name: 'Position Vacant', role: 'Board Member', since: '-' },
];

const POLICIES: Policy[] = [
  { id: '1', title: 'Constitution', category: 'Foundational', lastUpdated: '2024-06-15', status: 'active' },
  { id: '2', title: 'Membership Policy', category: 'Membership', lastUpdated: '2024-08-20', status: 'active' },
  { id: '3', title: 'Financial Policy', category: 'Finance', lastUpdated: '2024-09-10', status: 'active' },
  { id: '4', title: 'Code of Conduct', category: 'Ethics', lastUpdated: '2024-07-05', status: 'active' },
  { id: '5', title: 'Data Protection Policy', category: 'Privacy', lastUpdated: '2024-10-01', status: 'under-review' },
  { id: '6', title: 'Conflict of Interest Policy', category: 'Ethics', lastUpdated: '2024-05-20', status: 'active' },
];

const UPCOMING_MEETINGS: Meeting[] = [
  { id: '1', title: 'Q1 Board Meeting', type: 'board', date: '2025-01-15', status: 'scheduled', attendees: 5 },
  { id: '2', title: 'Finance Committee', type: 'committee', date: '2025-01-08', status: 'scheduled', attendees: 3 },
  { id: '3', title: 'Annual General Meeting', type: 'agm', date: '2025-03-20', status: 'scheduled', attendees: 50 },
];

export default function GovernanceScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'board' | 'policies' | 'meetings'>('board');

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const getMeetingTypeColor = (type: string) => {
    switch (type) {
      case 'board': return '#3B82F6';
      case 'agm': return '#8B5CF6';
      case 'committee': return '#10B981';
      default: return '#6B7280';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#10B981';
      case 'under-review': return '#F59E0B';
      case 'draft': return '#6B7280';
      default: return '#6B7280';
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <DashboardWallpaperBackground>
      {/* Custom Header */}
      <View style={[styles.customHeader, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Governance</Text>
        </View>
        <TouchableOpacity style={styles.headerButton}>
          <Ionicons name="document-text-outline" size={24} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {/* Tab Bar */}
      <View style={[styles.tabBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'board' && { backgroundColor: theme.primary + '20' }]}
          onPress={() => setActiveTab('board')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'board' ? theme.primary : theme.textSecondary }]}>
            Board
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'policies' && { backgroundColor: theme.primary + '20' }]}
          onPress={() => setActiveTab('policies')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'policies' ? theme.primary : theme.textSecondary }]}>
            Policies
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'meetings' && { backgroundColor: theme.primary + '20' }]}
          onPress={() => setActiveTab('meetings')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'meetings' ? theme.primary : theme.textSecondary }]}>
            Meetings
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        {activeTab === 'board' && (
          <>
            {/* Compliance Summary */}
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
              <Text style={styles.complianceScore}>72%</Text>
              <Text style={styles.complianceSubtitle}>Good Standing</Text>
              <View style={styles.complianceStats}>
                <View style={styles.complianceStat}>
                  <Text style={styles.complianceStatValue}>1/5</Text>
                  <Text style={styles.complianceStatLabel}>Board Filled</Text>
                </View>
                <View style={styles.complianceStat}>
                  <Text style={styles.complianceStatValue}>6</Text>
                  <Text style={styles.complianceStatLabel}>Active Policies</Text>
                </View>
                <View style={styles.complianceStat}>
                  <Text style={styles.complianceStatValue}>3</Text>
                  <Text style={styles.complianceStatLabel}>Upcoming Meetings</Text>
                </View>
              </View>
            </LinearGradient>

            {/* Board Members */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Board of Directors</Text>
              {BOARD_MEMBERS.map((member) => (
                <View key={member.id} style={[styles.boardCard, { backgroundColor: theme.card }]}>
                  <View style={[styles.boardAvatar, { backgroundColor: member.name.includes('Vacant') ? theme.border : theme.primary + '20' }]}>
                    {member.name.includes('Vacant') ? (
                      <Ionicons name="person-add-outline" size={24} color={theme.textSecondary} />
                    ) : (
                      <Text style={[styles.boardAvatarText, { color: theme.primary }]}>
                        {member.name.split(' ').map(n => n[0]).join('')}
                      </Text>
                    )}
                  </View>
                  <View style={styles.boardInfo}>
                    <Text style={[styles.boardName, { color: member.name.includes('Vacant') ? theme.textSecondary : theme.text }]}>
                      {member.name}
                    </Text>
                    <Text style={[styles.boardRole, { color: theme.textSecondary }]}>{member.role}</Text>
                    {!member.name.includes('Vacant') && (
                      <Text style={[styles.boardSince, { color: theme.textSecondary }]}>Since {member.since}</Text>
                    )}
                  </View>
                  {member.name.includes('Vacant') && (
                    <TouchableOpacity style={[styles.appointButton, { borderColor: theme.primary }]}>
                      <Text style={[styles.appointButtonText, { color: theme.primary }]}>Appoint</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          </>
        )}

        {activeTab === 'policies' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Policies & Documents</Text>
              <TouchableOpacity>
                <Ionicons name="add-circle" size={24} color={theme.primary} />
              </TouchableOpacity>
            </View>
            {POLICIES.map((policy) => (
              <TouchableOpacity key={policy.id} style={[styles.policyCard, { backgroundColor: theme.card }]}>
                <View style={styles.policyIcon}>
                  <Ionicons name="document-text-outline" size={24} color={theme.primary} />
                </View>
                <View style={styles.policyInfo}>
                  <Text style={[styles.policyTitle, { color: theme.text }]}>{policy.title}</Text>
                  <Text style={[styles.policyMeta, { color: theme.textSecondary }]}>
                    {policy.category} • Updated {new Date(policy.lastUpdated).toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' })}
                  </Text>
                </View>
                <View style={[styles.policyStatus, { backgroundColor: getStatusColor(policy.status) + '20' }]}>
                  <Text style={[styles.policyStatusText, { color: getStatusColor(policy.status) }]}>
                    {policy.status === 'under-review' ? 'Review' : policy.status}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {activeTab === 'meetings' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Upcoming Meetings</Text>
              <TouchableOpacity>
                <Ionicons name="add-circle" size={24} color={theme.primary} />
              </TouchableOpacity>
            </View>
            {UPCOMING_MEETINGS.map((meeting) => (
              <TouchableOpacity key={meeting.id} style={[styles.meetingCard, { backgroundColor: theme.card }]}>
                <View style={[styles.meetingType, { backgroundColor: getMeetingTypeColor(meeting.type) }]}>
                  <Ionicons 
                    name={meeting.type === 'board' ? 'people' : meeting.type === 'agm' ? 'megaphone' : 'chatbubbles'} 
                    size={20} 
                    color="#FFFFFF" 
                  />
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
            ))}
          </View>
        )}
      </ScrollView>
      </DashboardWallpaperBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Custom Header
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerCenter: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerButton: {
    padding: 4,
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    padding: 16,
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
  policyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  policyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  policyInfo: {
    flex: 1,
  },
  policyTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  policyMeta: {
    fontSize: 12,
    marginTop: 4,
  },
  policyStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  policyStatusText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
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
