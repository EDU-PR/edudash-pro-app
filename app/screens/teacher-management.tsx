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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme, type ThemeColors } from '@/contexts/ThemeContext';
import { RoleBasedHeader } from '@/components/RoleBasedHeader';
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
import { getViewIcon } from '@/types/teacher-management';
import { useTeacherManagement } from '@/hooks/useTeacherManagement';

export default function TeacherManagement() {
  const { user } = useAuth();
  const { theme } = useTheme();
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

  const renderNavigationTabs = () => (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      style={styles.tabsContainer}
      contentContainerStyle={styles.tabsContent}
    >
      {(['overview', 'hiring', 'performance', 'payroll'] as TeacherManagementView[]).map((view) => (
        <TouchableOpacity
          key={view}
          style={[styles.tab, currentView === view && styles.activeTab]}
          onPress={() => setCurrentView(view)}
        >
          <Ionicons 
            name={getViewIcon(view) as keyof typeof Ionicons.glyphMap} 
            size={18} 
            color={currentView === view ? 'white' : (theme?.textSecondary || '#666')}
          />
          <Text style={[styles.tabText, currentView === view && styles.activeTabText]}>
            {view.charAt(0).toUpperCase() + view.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

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

  return (
    <View style={styles.container}>
      {/* Invite Teacher Modal */}
      {showInviteModal && (
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
        />
      )}

      {/* Header */}
      <RoleBasedHeader 
        title="Teacher Management" 
        showBackButton={true}
        onBackPress={() => navigateBack('/')}
      />
      
      {/* Floating Action Button */}
      <TouchableOpacity style={styles.fab} onPress={handleAddTeacher} activeOpacity={0.8}>
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>

      {/* Navigation Tabs */}
      {renderNavigationTabs()}

      {/* Content */}
      <View style={styles.contentContainer}>
        {currentView === 'overview' && (
          <View style={styles.overviewContainer}>
            {/* Seat Usage Display Header */}
            {seatUsageDisplay && (
              <View style={styles.seatUsageHeader}>
                <View style={styles.seatUsageInfo}>
                  <Ionicons name="people" size={20} color={theme?.primary || '#007AFF'} />
                  <Text style={styles.seatUsageText}>{seatUsageDisplay.displayText}</Text>
                  {seatUsageDisplay.isOverLimit && (
                    <View style={styles.overLimitBadge}>
                      <Ionicons name="warning" size={14} color="#dc2626" />
                      <Text style={styles.overLimitText}>Over Limit</Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity 
                  style={styles.refreshButton}
                  onPress={() => {
                    refetchSeatLimits();
                    fetchTeachers();
                  }}
                  disabled={seatLimitsLoading}
                >
                  <Ionicons name="refresh" size={18} color={theme?.textSecondary || '#6b7280'} />
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
                <RefreshControl refreshing={loading} onRefresh={fetchTeachers} />
              }
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="people-outline" size={64} color={theme?.textSecondary || '#666'} />
                  <Text style={styles.emptyTitle}>No Teachers Yet</Text>
                  <Text style={styles.emptyText}>
                    Start building your teaching team by adding your first teacher.
                  </Text>
                  <TouchableOpacity style={styles.emptyButton} onPress={handleAddTeacher}>
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
}

function InviteModal({ inviteEmail, setInviteEmail, onClose, onInvite, styles }: InviteModalProps) {
  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Invite Teacher</Text>
        <TextInput
          style={styles.modalInput}
          placeholder="teacher@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          value={inviteEmail}
          onChangeText={setInviteEmail}
        />
        <View style={styles.modalButtons}>
          <TouchableOpacity style={[styles.btn, styles.btnDanger]} onPress={onClose}>
            <Text style={styles.btnDangerText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={onInvite}>
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
    backgroundColor: theme?.background || '#f8fafc',
  },
  contentContainer: {
    flex: 1,
  },
  tabsContainer: {
    backgroundColor: theme?.surface || 'white',
    borderBottomWidth: 1,
    borderBottomColor: theme?.border || '#e5e7eb',
    paddingVertical: 8,
  },
  tabsContent: {
    paddingHorizontal: 20,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: theme?.surfaceVariant || '#f9fafb',
  },
  activeTab: {
    backgroundColor: theme?.primary || '#2563eb',
  },
  tabText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '600',
    color: theme?.textSecondary || '#6b7280',
  },
  activeTabText: {
    color: 'white',
  },
  overviewContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 100,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme?.text || '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: theme?.textSecondary || '#666',
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 20,
  },
  emptyButton: {
    backgroundColor: theme?.primary || '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
  },
  emptyButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme?.primary || '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme?.shadow || '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
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
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 50,
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
  },
  modalTitle: {
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  btn: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    flex: 1,
  },
  btnPrimary: {
    backgroundColor: theme?.primary || '#007AFF',
  },
  btnPrimaryText: {
    color: 'white',
    fontWeight: '800',
  },
  btnDanger: {
    backgroundColor: '#fee2e2',
  },
  btnDangerText: {
    color: '#dc2626',
    fontWeight: '800',
  },
});
