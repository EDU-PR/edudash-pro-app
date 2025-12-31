/**
 * Governance Screen
 * Organizational governance, policies, and compliance
 * Refactored to comply with WARP.md (< 500 lines)
 */
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardWallpaperBackground } from '@/components/membership/dashboard';

// Extracted components
import { 
  BoardMemberCard, 
  YouthBoardSection,
  ComplianceCard,
  EmptyBoardState,
  DEFAULT_BOARD_POSITIONS,
  DEFAULT_YOUTH_POSITIONS,
} from '@/components/governance/BoardComponents';
import { 
  PoliciesSection, 
} from '@/components/governance/PolicyComponents';
import { 
  MeetingsSection,
  UPCOMING_MEETINGS,
} from '@/components/governance/MeetingComponents';
import { DocumentUploadModal } from '@/components/governance/useDocumentUpload';
import { BoardAppointmentModal } from '@/components/governance/BoardAppointmentModal';
import { useBoardPositions, positionsToLegacyFormat } from '@/hooks/membership/useBoardPositions';
import { useOrganizationDocuments } from '@/hooks/membership/useOrganizationDocuments';

export default function GovernanceScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'board' | 'policies' | 'meetings'>('board');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<{ id: string; title: string } | null>(null);

  // Board positions hook
  const {
    positions,
    loading: boardLoading,
    error: boardError,
    refetch: refetchBoard,
    appointMember,
    appointableMembers,
    loadingMembers,
    fetchAppointableMembers,
    initializePositions,
  } = useBoardPositions();

  // Documents hook
  const {
    documents: policies,
    loading: policiesLoading,
    error: policiesError,
    refetch: refetchPolicies,
  } = useOrganizationDocuments();

  // Convert positions to legacy format for BoardMemberCard
  const boardMembers = positionsToLegacyFormat(positions);

  // Calculate governance stats
  const filledPositions = positions.filter(p => p.member_id).length;
  const totalPositions = positions.length || DEFAULT_BOARD_POSITIONS.length;
  const governanceScore = totalPositions > 0 
    ? Math.round((filledPositions / totalPositions) * 100) 
    : 0;

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchBoard(), refetchPolicies()]);
    setRefreshing(false);
  };

  const handlePolicyPress = (policy: { id: string; title: string; category: string }) => {
    router.push({
      pathname: '/screens/membership/document-viewer',
      params: {
        documentId: policy.id,
        title: policy.title,
        category: policy.category,
      },
    });
  };

  const handleAddDocument = () => {
    setShowUploadModal(true);
  };

  const handleUploadSuccess = () => {
    setShowUploadModal(false);
    refetchPolicies();
  };

  const handleAppoint = (member: { id: string; role: string; positionId?: string }) => {
    // Find the position ID for this board member
    const position = positions.find(p => p.id === member.id);
    if (position) {
      setSelectedPosition({ id: position.id, title: position.position_title });
      fetchAppointableMembers();
      setShowAppointmentModal(true);
    } else {
      // For vacant positions from default list, we need to initialize first
      Alert.alert(
        'Initialize Board',
        'Board positions need to be set up first. Would you like to initialize the default positions?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Initialize', 
            onPress: async () => {
              const success = await initializePositions();
              if (success) {
                Alert.alert('Success', 'Board positions have been initialized. You can now appoint members.');
              }
            }
          },
        ]
      );
    }
  };

  const handleAppointMember = async (memberId: string) => {
    if (!selectedPosition) return;
    const success = await appointMember(selectedPosition.id, memberId);
    if (success) {
      setShowAppointmentModal(false);
      setSelectedPosition(null);
      Alert.alert('Success', 'Member has been appointed successfully.');
    } else {
      Alert.alert('Error', 'Failed to appoint member. Please try again.');
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
              <ComplianceCard 
                score={governanceScore}
                status={governanceScore >= 80 ? 'Excellent' : governanceScore >= 50 ? 'Good Standing' : 'Needs Attention'}
                stats={{
                  boardFilled: `${filledPositions}/${totalPositions}`,
                  activePolicies: policies.length,
                  upcomingMeetings: UPCOMING_MEETINGS.length,
                }}
              />

              {/* Board Members */}
              {boardLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={theme.primary} />
                  <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
                    Loading board positions...
                  </Text>
                </View>
              ) : positions.length === 0 ? (
                <EmptyBoardState 
                  theme={theme} 
                  onInitialize={initializePositions}
                  loading={boardLoading}
                />
              ) : (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Board of Directors</Text>
                  {boardMembers.map((member) => (
                    <BoardMemberCard
                      key={member.id}
                      member={member}
                      theme={theme}
                      onAppoint={() => handleAppoint(member)}
                    />
                  ))}
                </View>
              )}

              {/* Youth Wing Board - placeholder until wing leadership is set up */}
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Youth Wing Leadership</Text>
                <View style={[styles.emptySection, { backgroundColor: theme.card }]}>
                  <Ionicons name="people-outline" size={32} color={theme.textSecondary} />
                  <Text style={[styles.emptySectionText, { color: theme.textSecondary }]}>
                    Youth wing positions not yet configured
                  </Text>
                </View>
              </View>
            </>
          )}

          {activeTab === 'policies' && (
            <PoliciesSection
              policies={policies}
              theme={theme}
              onPolicyPress={handlePolicyPress}
              onAddPress={handleAddDocument}
              loading={policiesLoading}
            />
          )}

          {activeTab === 'meetings' && (
            <MeetingsSection
              meetings={UPCOMING_MEETINGS}
              theme={theme}
              onMeetingPress={(meeting) => Alert.alert('Meeting', meeting.title)}
              onAddPress={() => Alert.alert('Add Meeting', 'Meeting scheduling coming soon')}
            />
          )}
        </ScrollView>
      </DashboardWallpaperBackground>

      {/* Upload Document Modal */}
      <DocumentUploadModal
        visible={showUploadModal}
        theme={theme}
        onClose={() => setShowUploadModal(false)}
        onSuccess={handleUploadSuccess}
      />

      {/* Board Appointment Modal */}
      <BoardAppointmentModal
        visible={showAppointmentModal}
        theme={theme}
        positionTitle={selectedPosition?.title || ''}
        members={appointableMembers}
        loading={loadingMembers}
        onClose={() => {
          setShowAppointmentModal(false);
          setSelectedPosition(null);
        }}
        onAppoint={handleAppointMember}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  emptySection: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 12,
    gap: 8,
  },
  emptySectionText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
