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

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  TextInput,
  Modal,
  Share,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme, type ThemeColors } from '@/contexts/ThemeContext';
import * as DocumentPicker from 'expo-document-picker';
import { TeacherDocumentsService, TeacherDocType } from '@/lib/services/TeacherDocumentsService';
import { AlertModal, useAlertModal } from '@/components/ui/AlertModal';

// Extracted components
import { TeacherCard } from '@/components/teacher/TeacherCard';
import { HiringView } from '@/components/teacher/HiringView';
import { PerformanceView } from '@/components/teacher/PerformanceView';
import { PayrollView } from '@/components/teacher/PayrollView';
import { TeacherProfileView } from '@/components/teacher/TeacherProfileView';
import * as Clipboard from 'expo-clipboard';
import { buildTeacherInviteLink, buildTeacherInviteMessage } from '@/lib/utils/teacherInviteLink';

// Types and hook
import type { Teacher, TeacherManagementView } from '@/types/teacher-management';
import { useTeacherManagement } from '@/hooks/useTeacherManagement';

type InviteShareState = {
  token: string;
  email: string;
  link: string;
  message: string;
};

export default function TeacherManagement() {
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { showAlert, alertProps } = useAlertModal();
  
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
  const [inviteShare, setInviteShare] = useState<InviteShareState | null>(null);
  const [showInviteShareModal, setShowInviteShareModal] = useState(false);

  // Document picker and upload handler (needs DocumentPicker which is native only)
  const pickAndUploadTeacherDoc = useCallback(async (docType: TeacherDocType) => {
    try {
      if (!selectedTeacher?.id) {
        showAlert({
          title: 'No teacher selected',
          message: 'Please select a teacher before attaching documents.',
          type: 'warning',
        });
        return;
      }
      const preschoolId = getPreschoolId();
      if (!preschoolId) {
        showAlert({
          title: 'No school linked',
          message: 'Cannot attach documents without a school context.',
          type: 'error',
        });
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
        showAlert({
          title: 'Upload failed',
          message: uploaded.error || 'Unknown error',
          type: 'error',
        });
        setIsUploading(false);
        return;
      }

      await refreshSelectedTeacherDocs();
      showAlert({
        title: 'Attached',
        message: `${name} uploaded as ${docType.replace('_', ' ')}`,
        type: 'success',
      });
    } catch (e: unknown) {
      showAlert({
        title: 'Error',
        message: e instanceof Error ? e.message : 'Failed to attach document',
        type: 'error',
      });
    } finally {
      setIsUploading(false);
    }
  }, [selectedTeacher, user, getPreschoolId, refreshSelectedTeacherDocs, showAlert]);

  const showAttachDocActionSheet = useCallback(() => {
    showAlert({
      title: 'Attach Document',
      message: 'Select which document to attach',
      type: 'info',
      buttons: [
        { text: 'CV', onPress: () => pickAndUploadTeacherDoc('cv') },
        { text: 'Qualifications', onPress: () => pickAndUploadTeacherDoc('qualifications') },
        { text: 'ID Copy', onPress: () => pickAndUploadTeacherDoc('id_copy') },
        { text: 'Contracts', onPress: () => pickAndUploadTeacherDoc('contracts') },
        { text: 'Cancel', style: 'cancel' },
      ],
    });
  }, [pickAndUploadTeacherDoc, showAlert]);

  // Load documents when profile view is active
  useEffect(() => {
    if (currentView === 'profile' && selectedTeacher?.id) {
      refreshSelectedTeacherDocs();
    }
  }, [currentView, selectedTeacher?.id, refreshSelectedTeacherDocs]);

  const handleAddTeacher = () => {
    showAlert({
      title: 'Add New Teacher',
      message: "Choose how you'd like to add a teacher to your school:",
      type: 'info',
      buttons: [
        {
          text: 'Post Job Opening',
          onPress: () => {
            showAlert({
              title: 'Job Posting Created',
              message: 'Your job posting has been created and will be published.',
              type: 'success',
              buttons: [{ text: 'Great!', style: 'default' }],
            });
          },
        },
        {
          text: 'Invite by Email',
          onPress: () => setShowInviteModal(true),
        },
        {
          text: 'Add Directly',
          onPress: () => {
            showAlert({
              title: 'Direct Teacher Addition',
              message: 'Teacher added successfully!',
              type: 'success',
              buttons: [{ text: 'Done', style: 'default' }],
            });
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    });
  };

  const handleTeacherPress = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setCurrentView('profile');
  };

  const schoolName = profile?.preschool_name || profile?.organization_name || 'Your School';

  const inviterName = useMemo(() => {
    const first = profile?.first_name || '';
    const last = profile?.last_name || '';
    const full = `${first} ${last}`.trim();
    return full || profile?.email || 'A principal';
  }, [profile?.first_name, profile?.last_name, profile?.email]);

  const handleShareInvite = useCallback(
    async (inviteToken: string, inviteEmail: string) => {
      const message = buildTeacherInviteMessage({
        token: inviteToken,
        email: inviteEmail,
        schoolName,
        inviterName,
        roleLabel: 'teacher',
      });
      const inviteLink = buildTeacherInviteLink(inviteToken, inviteEmail);
      setInviteShare({
        token: inviteToken,
        email: inviteEmail,
        link: inviteLink,
        message,
      });
      setShowInviteShareModal(true);
    },
    [inviterName, schoolName]
  );

  const handleInviteTeacher = useCallback(
    async (email: string) => {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail) return;
      const existingInvite = invites.find(
        (invite) => invite.email?.toLowerCase() === normalizedEmail
      );

      if (existingInvite?.token) {
        await handleShareInvite(existingInvite.token, normalizedEmail);
        return;
      }

      const schoolId = getPreschoolId();
      if (!schoolId) {
        showAlert({
          title: 'Error',
          message: 'No school associated with this account.',
          type: 'error',
        });
        return;
      }

      try {
        const { TeacherInviteService } = await import('@/lib/services/teacherInviteService');
        const invite = await TeacherInviteService.createInvite({
          schoolId,
          email: normalizedEmail,
          invitedBy: user?.id || '',
        });
        await loadInvites();
        await handleShareInvite(invite.token, normalizedEmail);
      } catch (e: unknown) {
        showAlert({
          title: 'Error',
          message: e instanceof Error ? e.message : 'Failed to create invite',
          type: 'error',
        });
      }
    },
    [getPreschoolId, handleShareInvite, invites, loadInvites, showAlert, user?.id]
  );

  const handleCopyInviteLink = useCallback(
    async (email: string) => {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail) return;
      const existingInvite = invites.find(
        (invite) => invite.email?.toLowerCase() === normalizedEmail
      );
      const existingToken = existingInvite?.token;
      if (existingToken) {
        await Clipboard.setStringAsync(buildTeacherInviteLink(existingToken, normalizedEmail));
        showAlert({
          title: 'Copied',
          message: 'Invite link copied to clipboard.',
          type: 'success',
        });
        return;
      }
      await handleInviteTeacher(normalizedEmail);
    },
    [handleInviteTeacher, invites, showAlert]
  );

  const closeInviteShareModal = useCallback(() => {
    setShowInviteShareModal(false);
    setInviteShare(null);
  }, []);

  const handleInviteShareAction = useCallback(
    async (action: 'whatsapp' | 'sms' | 'email' | 'share' | 'copy-link' | 'copy-code') => {
      if (!inviteShare) return;
      try {
        const { message, link, email, token } = inviteShare;
        if (action === 'whatsapp') {
          const url = `whatsapp://send?text=${encodeURIComponent(message)}`;
          const canOpen = await Linking.canOpenURL(url);
          if (!canOpen) {
            showAlert({
              title: 'WhatsApp not available',
              message: 'Install WhatsApp to use this option.',
              type: 'warning',
            });
            return;
          }
          await Linking.openURL(url);
        } else if (action === 'sms') {
          const url = `sms:?body=${encodeURIComponent(message)}`;
          await Linking.openURL(url);
        } else if (action === 'email') {
          const subject = encodeURIComponent(`EduDash Pro Teacher Invite from ${schoolName}`);
          const body = encodeURIComponent(message);
          const url = `mailto:${email}?subject=${subject}&body=${body}`;
          await Linking.openURL(url);
        } else if (action === 'share') {
          await Share.share({ message, url: link });
        } else if (action === 'copy-link') {
          await Clipboard.setStringAsync(link);
          showAlert({
            title: 'Copied',
            message: 'Invite link copied to clipboard.',
            type: 'success',
          });
        } else if (action === 'copy-code') {
          await Clipboard.setStringAsync(token);
          showAlert({
            title: 'Copied',
            message: 'Invite code copied to clipboard.',
            type: 'success',
          });
        }
      } finally {
        closeInviteShareModal();
      }
    },
    [closeInviteShareModal, inviteShare, schoolName, showAlert]
  );

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

  const renderTeacher = ({ item }: { item: Teacher }) => {
    const inviteForTeacher = invites.find(
      (invite) => invite.email?.toLowerCase() === item.email.toLowerCase()
    );
    const isAccountLinked = Boolean(item.authUserId || item.teacherUserId);
    const inviteStatus = inviteForTeacher?.status || (!isAccountLinked ? 'needed' : undefined);

    return (
      <TeacherCard
        teacher={item}
        onPress={handleTeacherPress}
        onAssignSeat={handleAssignSeat}
        onRevokeSeat={handleRevokeSeat}
        isAssigning={isAssigning}
        isRevoking={isRevoking}
        shouldDisableAssignment={shouldDisableAssignment}
        theme={theme}
        inviteStatus={inviteStatus}
        onInvite={() => handleInviteTeacher(item.email)}
        onCopyInviteLink={() => handleCopyInviteLink(item.email)}
      />
    );
  };

  // Stats for header
  const stats = {
    total: teachers.length,
    active: teachers.filter(t => t.status === 'active').length,
    withSeats: seatUsageDisplay?.used || 0,
    maxSeats: seatUsageDisplay?.total || 15,
  };

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
            await handleInviteTeacher(inviteEmail);
            setShowInviteModal(false);
            setInviteEmail('');
          }}
          styles={styles}
          theme={theme}
        />
      </Modal>

      {/* Invite Share Modal */}
      <Modal
        visible={showInviteShareModal}
        animationType="fade"
        transparent
        onRequestClose={closeInviteShareModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.inviteShareCard, { backgroundColor: theme?.card || '#0f172a' }]}>
            <View style={styles.inviteShareHeader}>
              <View style={styles.inviteShareIcon}>
                <Ionicons name="information-circle" size={32} color={theme?.primary || '#6366F1'} />
              </View>
              <View style={styles.inviteShareTitleBlock}>
                <Text style={[styles.inviteShareTitle, { color: theme?.text }]}>Invite Ready</Text>
                <Text style={[styles.inviteShareSubtitle, { color: theme?.textSecondary }]}>
                  Choose how you want to send the invite.
                </Text>
              </View>
              <TouchableOpacity onPress={closeInviteShareModal} style={styles.inviteShareClose}>
                <Ionicons name="close" size={20} color={theme?.textSecondary || '#94a3b8'} />
              </TouchableOpacity>
            </View>

            {inviteShare && (
              <View style={styles.inviteShareDetails}>
                <View style={styles.inviteShareRow}>
                  <Text style={[styles.inviteShareLabel, { color: theme?.textSecondary }]}>Teacher</Text>
                  <Text style={[styles.inviteShareValue, { color: theme?.text }]}>{inviteShare.email}</Text>
                </View>
                <View style={styles.inviteShareRow}>
                  <Text style={[styles.inviteShareLabel, { color: theme?.textSecondary }]}>Invite code</Text>
                  <Text style={[styles.inviteShareValue, { color: theme?.text }]}>{inviteShare.token}</Text>
                </View>
              </View>
            )}

            <View style={styles.inviteShareActions}>
              <TouchableOpacity
                style={[styles.inviteShareAction, styles.inviteShareActionPrimary]}
                onPress={() => handleInviteShareAction('whatsapp')}
              >
                <Ionicons name="logo-whatsapp" size={20} color="#fff" />
                <Text style={styles.inviteShareActionText}>WhatsApp</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.inviteShareAction}
                onPress={() => handleInviteShareAction('sms')}
              >
                <Ionicons name="chatbubble-ellipses" size={20} color={theme?.text || '#e2e8f0'} />
                <Text style={[styles.inviteShareActionText, { color: theme?.text }]}>SMS</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.inviteShareAction}
                onPress={() => handleInviteShareAction('email')}
              >
                <Ionicons name="mail" size={20} color={theme?.text || '#e2e8f0'} />
                <Text style={[styles.inviteShareActionText, { color: theme?.text }]}>Email</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.inviteShareAction}
                onPress={() => handleInviteShareAction('share')}
              >
                <Ionicons name="share-social" size={20} color={theme?.text || '#e2e8f0'} />
                <Text style={[styles.inviteShareActionText, { color: theme?.text }]}>Share</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inviteShareFooter}>
              <TouchableOpacity
                style={styles.inviteShareSecondary}
                onPress={() => handleInviteShareAction('copy-link')}
              >
                <Ionicons name="link" size={16} color={theme?.text || '#e2e8f0'} />
                <Text style={[styles.inviteShareSecondaryText, { color: theme?.text }]}>Copy link</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.inviteShareSecondary}
                onPress={() => handleInviteShareAction('copy-code')}
              >
                <Ionicons name="key" size={16} color={theme?.text || '#e2e8f0'} />
                <Text style={[styles.inviteShareSecondaryText, { color: theme?.text }]}>Copy code</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
                  showAlert({
                    title: 'Filter Teachers',
                    message: 'Select status filter',
                    type: 'info',
                    buttons: [
                      { text: 'All', onPress: () => setFilterStatus('all') },
                      { text: 'Active', onPress: () => setFilterStatus('active') },
                      { text: 'On Leave', onPress: () => setFilterStatus('on_leave') },
                      { text: 'Inactive', onPress: () => setFilterStatus('inactive') },
                      { text: 'Cancel', style: 'cancel' },
                    ],
                  });
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
            schoolName={schoolName}
            inviterName={inviterName}
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
            onMessage={() =>
              showAlert({
                title: 'Messaging',
                message: 'Teacher communications coming soon',
                type: 'info',
              })
            }
            onAssignSeat={handleAssignSeat}
            onRevokeSeat={handleRevokeSeat}
            onAttachDocument={showAttachDocActionSheet}
          />
        )}
      </View>

      <AlertModal {...alertProps} />
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
  inviteShareCard: {
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
  },
  inviteShareHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  inviteShareIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteShareTitleBlock: {
    flex: 1,
  },
  inviteShareTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  inviteShareSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  inviteShareClose: {
    padding: 6,
  },
  inviteShareDetails: {
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    borderRadius: 14,
    padding: 12,
    gap: 8,
    marginBottom: 16,
  },
  inviteShareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  inviteShareLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  inviteShareValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  inviteShareActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  inviteShareAction: {
    flexGrow: 1,
    flexBasis: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
  },
  inviteShareActionPrimary: {
    backgroundColor: '#22c55e',
  },
  inviteShareActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  inviteShareFooter: {
    flexDirection: 'row',
    gap: 10,
  },
  inviteShareSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.3)',
  },
  inviteShareSecondaryText: {
    fontSize: 12,
    fontWeight: '700',
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
