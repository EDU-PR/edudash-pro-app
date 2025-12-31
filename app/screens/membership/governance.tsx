/**
 * Governance Screen
 * Organizational governance, policies, and compliance
 * Refactored to comply with WARP.md (< 500 lines)
 */
import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  RefreshControl,
  Alert,
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
  BOARD_MEMBERS,
  YOUTH_BOARD_MEMBERS,
} from '@/components/governance/BoardComponents';
import { 
  PoliciesSection, 
  POLICIES,
} from '@/components/governance/PolicyComponents';
import { 
  MeetingsSection,
  UPCOMING_MEETINGS,
} from '@/components/governance/MeetingComponents';
import { DocumentUploadModal } from '@/components/governance/useDocumentUpload';

export default function GovernanceScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'board' | 'policies' | 'meetings'>('board');
  const [showUploadModal, setShowUploadModal] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
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
    onRefresh();
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
                score={72}
                status="Good Standing"
                stats={{
                  boardFilled: '1/5',
                  activePolicies: 6,
                  upcomingMeetings: 3,
                }}
              />

              {/* Board Members */}
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Board of Directors</Text>
                {BOARD_MEMBERS.map((member) => (
                  <BoardMemberCard
                    key={member.id}
                    member={member}
                    theme={theme}
                    onAppoint={() => Alert.alert('Appoint', `Appoint member to ${member.role}`)}
                  />
                ))}
              </View>

              {/* Youth Wing Board */}
              <YouthBoardSection
                members={YOUTH_BOARD_MEMBERS}
                theme={theme}
                onAppoint={(member) => Alert.alert('Appoint', `Appoint youth member to ${member.role}`)}
              />
            </>
          )}

          {activeTab === 'policies' && (
            <PoliciesSection
              policies={POLICIES}
              theme={theme}
              onPolicyPress={handlePolicyPress}
              onAddPress={handleAddDocument}
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
});
