/**
 * Teacher Management Screen
 * 
 * Allows principals to view, add, and manage teaching staff.
 * 
 * Refactored per WARP.md standards:
 * - Types extracted to types/teacher-management.ts
 * - Hook extracted to hooks/useTeacherManagement.ts
 * - Components extracted to components/teacher/
 * - Styles extracted to styles/teacher-management.ts
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme, type ThemeColors } from '@/contexts/ThemeContext';
import { navigateBack } from '@/lib/navigation';
import * as DocumentPicker from 'expo-document-picker';
import { TeacherDocumentsService, TeacherDocType } from '@/lib/services/TeacherDocumentsService';

// Extracted components
import { TeacherCard } from '@/components/teacher/TeacherCard';
import { HiringView } from '@/components/teacher/HiringView';
import { PerformanceView } from '@/components/teacher/PerformanceView';
import { PayrollView } from '@/components/teacher/PayrollView';
import { TeacherProfileView } from '@/components/teacher/TeacherProfileView';

// Types and hook
import type { Teacher, TeacherManagementView } from '@/types/teacher-management';
import { useTeacherManagement } from '@/hooks/useTeacherManagement';

export default function TeacherManagement() {
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  
  // Use the extracted hook for all data management
  const {
    teachers,
    candidates,
    invites,
    availableTeachers,
    currentView,
    selectedTeacher,
    loading,
    searchQuery,
    filterStatus,
    hiringSearch,
    radiusKm,
    teacherDocsMap,
    isUploadingDoc,
    showInviteModal,
    inviteEmail,
    seatUsageDisplay,
    shouldDisableAssignment,
    isAssigning,
    isRevoking,
    seatLimitsLoading,
    selectedTeacherHasSeat,
    setCurrentView,
    setSelectedTeacher,
    setSearchQuery,
    setFilterStatus,
    setHiringSearch,
    setRadiusKm,
    setShowInviteModal,
    setInviteEmail,
    fetchTeachers,
    fetchAvailableCandidates,
    loadInvites,
    refetchSeatLimits,
    handleAssignSeat,
    handleRevokeSeat,
    refreshSelectedTeacherDocs,
    getPreschoolId,
  } = useTeacherManagement();

  // Local state for document upload
  const [isUploading, setIsUploading] = useState(false);

  // Document picker and upload handler (needs DocumentPicker which is native only)
  const pickAndUploadTeacherDoc = useCallback(async (docType: TeacherDocType) => {
    try {
      if (!selectedTeacher?.id) {
        Alert.alert('No teacher selected');
        return;
      }
      const preschoolId = getPreschoolId();
      if (!preschoolId) {
        Alert.alert('No school linked', 'Cannot attach documents without a school context.');
        return;
      }
      setIsUploading(true);

      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled) {
        setIsUploading(false);
        return;
      }
      const asset = result.assets?.[0] as DocumentPicker.DocumentPickerAsset;
      const uri = asset.uri as string;
      const name = (asset.name as string) || uri.split('/').pop() || `${docType}.dat`;
      const mime = (asset.mimeType as string) || 'application/octet-stream';

      const uploaded = await TeacherDocumentsService.uploadDocument({
        teacherUserId: selectedTeacher.id,
        preschoolId,
        uploadedBy: user?.id || '',
        localUri: uri,
        docType,
        originalFileName: name,
        mimeType: mime,
      });
      if (!uploaded.success) {
        Alert.alert('Upload failed', uploaded.error || 'Unknown error');
        setIsUploading(false);
        return;
      }

      await refreshSelectedTeacherDocs();
      Alert.alert('Attached', `${name} uploaded as ${docType.replace('_', ' ')}`);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to attach document');
    } finally {
      setIsUploading(false);
    }
  }, [selectedTeacher, user, getPreschoolId, refreshSelectedTeacherDocs]);

  const showAttachDocActionSheet = useCallback(() => {
    Alert.alert(
      'Attach Document',
      'Select which document to attach',
      [
        { text: 'CV', onPress: () => pickAndUploadTeacherDoc('cv') },
        { text: 'Qualifications', onPress: () => pickAndUploadTeacherDoc('qualifications') },
        { text: 'ID Copy', onPress: () => pickAndUploadTeacherDoc('id_copy') },
        { text: 'Contracts', onPress: () => pickAndUploadTeacherDoc('contracts') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }, [pickAndUploadTeacherDoc]);

  // Load documents when profile view is active
  useEffect(() => {
    if (currentView === 'profile' && selectedTeacher?.id) {
      refreshSelectedTeacherDocs();
    }
  }, [currentView, selectedTeacher?.id, refreshSelectedTeacherDocs]);

  const handleAddTeacher = () => {
    Alert.alert(
      '👨‍🏫 Add New Teacher',
      'Choose how you\'d like to add a teacher to your school:',
      [
        {
          text: 'Post Job Opening',
          onPress: () => {
            Alert.alert(
              '📝 Job Posting Created',
              'Your job posting has been created and will be published.',
              [{ text: 'Great!', style: 'default' }]
            );
          }
        },
        {
          text: 'Invite by Email',
          onPress: () => setShowInviteModal(true)
        },
        {
          text: 'Add Directly',
          onPress: () => {
            Alert.alert(
              '➕ Direct Teacher Addition',
              'Teacher added successfully!',
              [{ text: 'Done', style: 'default' }]
            );
          }
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const handleTeacherPress = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setCurrentView('profile');
  };

  const filteredTeachers = teachers.filter(teacher => {
    const matchesSearch = searchQuery === '' || 
      `${teacher.firstName} ${teacher.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      teacher.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === 'all' || teacher.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const renderNavigationTabs = () => {
    const tabs: { view: TeacherManagementView; label: string; icon: string }[] = [
      { view: 'overview', label: 'Overview', icon: 'grid-outline' },
      { view: 'hiring', label: 'Hiring', icon: 'person-add-outline' },
      { view: 'performance', label: 'Performance', icon: 'analytics-outline' },
      { view: 'payroll', label: 'Payroll', icon: 'card-outline' },
    ];

    return (
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.tabsContainer}
        contentContainerStyle={styles.tabsContent}
      >
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.view}
            style={[styles.tab, currentView === tab.view && styles.activeTab]}
            onPress={() => setCurrentView(tab.view)}
          >
            <Ionicons 
              name={tab.icon as keyof typeof Ionicons.glyphMap} 
              size={18} 
              color={currentView === tab.view ? 'white' : (theme?.textSecondary || '#666')}
            />
            <Text style={[styles.tabText, currentView === tab.view && styles.activeTabText]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  const renderTeacher = ({ item }: { item: Teacher }) => (
    <TeacherCard
      teacher={item}
      onPress={handleTeacherPress}
      onAssignSeat={handleAssignSeat}
      onRevokeSeat={handleRevokeSeat}
      isAssigning={isAssigning}
      isRevoking={isRevoking}
      shouldDisableAssignment={shouldDisableAssignment}
      theme={theme}
    />
  );

  // Stats for header
  const stats = {
    total: teachers.length,
    active: teachers.filter(t => t.status === 'active').length,
    withSeats: seatUsageDisplay?.used || 0,
    maxSeats: seatUsageDisplay?.total || 15,
  };

  // School name from profile
  const schoolName = profile?.preschool_name || profile?.organization_name || 'Your School';

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Enhanced Gradient Header */}
      <LinearGradient
        colors={['#6366F1', '#8B5CF6']}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Teacher Management</Text>
            <Text style={styles.headerSubtitle}>{schoolName}</Text>
          </View>
          <TouchableOpacity style={styles.settingsButton} onPress={() => router.push('/screens/school-settings')}>
            <Ionicons name="settings-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
        
        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.active}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.withSeats}/{stats.maxSeats}</Text>
            <Text style={styles.statLabel}>Seats</Text>
          </View>
          <View style={styles.statDivider} />
          <TouchableOpacity style={styles.statItem} onPress={() => {
            refetchSeatLimits();
            fetchTeachers();
          }}>
            <Ionicons name="refresh" size={20} color="#fff" />
            <Text style={styles.statLabel}>Refresh</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Navigation Tabs */}
      {renderNavigationTabs()}
      
      {/* Floating Action Button */}
      <TouchableOpacity style={styles.fab} onPress={handleAddTeacher} activeOpacity={0.8}>
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>

      {/* Invite Teacher Modal */}
      <Modal
        visible={showInviteModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowInviteModal(false)}
      >
        <InviteModal
          inviteEmail={inviteEmail}
          setInviteEmail={setInviteEmail}
          onClose={() => setShowInviteModal(false)}
          onInvite={async () => {
            try {
              const schoolId = getPreschoolId();
              if (!schoolId) { Alert.alert('Error', 'No school associated'); return; }
              const { TeacherInviteService } = await import('@/lib/services/teacherInviteService');
              const invite = await TeacherInviteService.createInvite({
                schoolId,
                email: inviteEmail.trim(),
                invitedBy: user?.id || '',
              });
              setShowInviteModal(false);
              setInviteEmail('');
              Alert.alert('Invite created', `Share this invite token with the teacher:\n\n${invite.token}`);
            } catch (e: unknown) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create invite');
            }
          }}
          styles={styles}
          theme={theme}
        />
      </Modal>

      {/* Content */}
      <View style={styles.contentContainer}>
        {currentView === 'overview' && (
          <View style={styles.overviewContainer}>
            {/* Search and Filter Bar */}
            <View style={styles.searchFilterBar}>
              <View style={styles.searchInputContainer}>
                <Ionicons name="search" size={18} color={theme?.textSecondary || '#6b7280'} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search teachers..."
                  placeholderTextColor={theme?.textSecondary || '#9ca3af'}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={18} color={theme?.textSecondary || '#6b7280'} />
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity 
                style={styles.filterButton}
                onPress={() => {
                  Alert.alert(
                    'Filter Teachers',
                    'Select status filter',
                    [
                      { text: 'All', onPress: () => setFilterStatus('all') },
                      { text: 'Active', onPress: () => setFilterStatus('active') },
                      { text: 'On Leave', onPress: () => setFilterStatus('on_leave') },
                      { text: 'Inactive', onPress: () => setFilterStatus('inactive') },
                      { text: 'Cancel', style: 'cancel' },
                    ]
                  );
                }}
              >
                <Ionicons name="filter" size={18} color={theme?.primary || '#6366F1'} />
                {filterStatus !== 'all' && (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>1</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Seat Warning Banner (only if over limit) */}
            {seatUsageDisplay?.isOverLimit && (
              <View style={styles.warningBanner}>
                <Ionicons name="warning" size={20} color="#dc2626" />
                <Text style={styles.warningText}>
                  You've exceeded your seat limit ({seatUsageDisplay.displayText}). Some teachers may not have full access.
                </Text>
                <TouchableOpacity onPress={() => router.push('/screens/principal-seat-management')}>
                  <Text style={styles.warningLink}>Manage Seats →</Text>
                </TouchableOpacity>
              </View>
            )}
            
            <FlatList
              data={filteredTeachers}
              renderItem={renderTeacher}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl 
                  refreshing={loading} 
                  onRefresh={fetchTeachers}
                  colors={['#6366F1']}
                  tintColor="#6366F1"
                />
              }
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <View style={styles.emptyIconContainer}>
                    <Ionicons name="people-outline" size={48} color="#6366F1" />
                  </View>
                  <Text style={styles.emptyTitle}>No Teachers Yet</Text>
                  <Text style={styles.emptyText}>
                    Start building your teaching team by adding your first teacher.
                  </Text>
                  <TouchableOpacity style={styles.emptyButton} onPress={handleAddTeacher}>
                    <Ionicons name="add-circle" size={20} color="white" />
                    <Text style={styles.emptyButtonText}>Add First Teacher</Text>
                  </TouchableOpacity>
                </View>
              }
            />
          </View>
        )}

        {currentView === 'hiring' && (
          <HiringView
            availableTeachers={availableTeachers}
            invites={invites}
            hiringSearch={hiringSearch}
            radiusKm={radiusKm}
            loading={loading}
            theme={theme}
            userId={user?.id}
            preschoolId={getPreschoolId()}
            onSearchChange={setHiringSearch}
            onRadiusChange={(km) => {
              setRadiusKm(km);
              fetchAvailableCandidates();
            }}
            onRefresh={fetchAvailableCandidates}
            onLoadInvites={loadInvites}
          />
        )}

        {currentView === 'performance' && (
          <PerformanceView teachers={filteredTeachers} theme={theme} />
        )}

        {currentView === 'payroll' && (
          <PayrollView teachers={filteredTeachers} theme={theme} />
        )}

        {currentView === 'profile' && selectedTeacher && (
          <TeacherProfileView
            teacher={selectedTeacher}
            teacherDocsMap={teacherDocsMap}
            isUploadingDoc={isUploading || isUploadingDoc}
            selectedTeacherHasSeat={selectedTeacherHasSeat}
            shouldDisableAssignment={shouldDisableAssignment}
            isAssigning={isAssigning}
            isRevoking={isRevoking}
            theme={theme}
            onBack={() => setCurrentView('overview')}
            onMessage={() => Alert.alert('Messaging', 'Teacher communications coming soon')}
            onAssignSeat={handleAssignSeat}
            onRevokeSeat={handleRevokeSeat}
            onAttachDocument={showAttachDocActionSheet}
          />
        )}
      </View>
    </View>
  );
}

// Inline component for invite modal
interface InviteModalProps {
  inviteEmail: string;
  setInviteEmail: (email: string) => void;
  onClose: () => void;
  onInvite: () => void;
  styles: ReturnType<typeof createStyles>;
  theme?: ThemeColors;
}

function InviteModal({ inviteEmail, setInviteEmail, onClose, onInvite, styles, theme }: InviteModalProps) {
  return (
    <View style={styles.modalOverlay}>
      <View style={[styles.modalContent, { backgroundColor: theme?.card || 'white' }]}>
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, { color: theme?.text }]}>Invite Teacher</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={theme?.textSecondary || '#6b7280'} />
          </TouchableOpacity>
        </View>
        <Text style={[styles.modalSubtitle, { color: theme?.textSecondary }]}>
          Enter the email address of the teacher you'd like to invite to your school.
        </Text>
        <TextInput
          style={[styles.modalInput, { 
            backgroundColor: theme?.surfaceVariant || '#f9fafb',
            color: theme?.text,
            borderColor: theme?.border || '#e5e7eb',
          }]}
          placeholder="teacher@example.com"
          placeholderTextColor={theme?.textSecondary || '#9ca3af'}
          keyboardType="email-address"
          autoCapitalize="none"
          value={inviteEmail}
          onChangeText={setInviteEmail}
        />
        <View style={styles.modalButtons}>
          <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={onClose}>
            <Text style={[styles.btnSecondaryText, { color: theme?.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.btn, styles.btnPrimary, !inviteEmail.includes('@') && styles.btnDisabled]} 
            onPress={onInvite}
            disabled={!inviteEmail.includes('@')}
          >
            <Ionicons name="send" size={16} color="white" />
            <Text style={styles.btnPrimaryText}>Send Invite</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme?.background || '#0a0a0f',
  },
  // Enhanced Header Styles
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 8,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  settingsButton: {
    padding: 8,
  },
  // Stats Row
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  // Content
  contentContainer: {
    flex: 1,
  },
  // Tabs
  tabsContainer: {
    marginTop: 16,
    maxHeight: 56,
  },
  tabsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: theme?.card || '#1a1a2e',
    marginRight: 8,
    gap: 8,
  },
  activeTab: {
    backgroundColor: '#6366F1',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme?.textSecondary || '#9ca3af',
  },
  activeTabText: {
    color: 'white',
  },
  // Search and Filter
  searchFilterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme?.card || '#1a1a2e',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: theme?.text || '#fff',
  },
  filterButton: {
    padding: 12,
    backgroundColor: theme?.card || '#1a1a2e',
    borderRadius: 12,
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'white',
  },
  // Warning Banner
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    gap: 10,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#dc2626',
  },
  warningLink: {
    fontSize: 13,
    fontWeight: '600',
    color: '#dc2626',
  },
  // Overview
  overviewContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 100,
  },
  // Empty State
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme?.text || '#fff',
    marginTop: 8,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: theme?.textSecondary || '#9ca3af',
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 20,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366F1',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
    gap: 8,
  },
  emptyButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },
  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 20,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontWeight: '700',
    fontSize: 20,
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    flex: 1,
    gap: 8,
  },
  btnPrimary: {
    backgroundColor: '#6366F1',
  },
  btnPrimaryText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 15,
  },
  btnSecondary: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  btnSecondaryText: {
    fontWeight: '600',
    fontSize: 15,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnDanger: {
    backgroundColor: '#fee2e2',
  },
  btnDangerText: {
    color: '#dc2626',
    fontWeight: '800',
  },
  // Legacy styles for compatibility
  seatUsageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme?.surface || 'white',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme?.border || '#f3f4f6',
    marginBottom: 8,
  },
  seatUsageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  seatUsageText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme?.text || '#333',
    marginLeft: 8,
  },
  overLimitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 12,
  },
  overLimitText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#dc2626',
    marginLeft: 4,
  },
  refreshButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: theme?.surfaceVariant || '#f9fafb',
  },
});
