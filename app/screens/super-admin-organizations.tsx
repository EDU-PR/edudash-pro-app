import React from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, TextInput, Modal, Dimensions, Switch } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Stack, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomInset } from '@/hooks/useBottomInset';
import ThemedStatusBar from '@/components/ui/ThemedStatusBar';
import { AlertModal, useAlertModal } from '@/components/ui/AlertModal';
import { Ionicons } from '@expo/vector-icons';

import EduDashSpinner from '@/components/ui/EduDashSpinner';
import { useSuperAdminOrganizations } from '@/hooks/super-admin-organizations';

import { assertSupabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import type {
  OrganizationType,
  OrganizationStatus,
  Organization,
} from '@/lib/screen-styles/super-admin-organizations.styles';
import {
  theme,
  statusColors,
  typeColors,
  formatTierLabel,
  formatStatusLabel,
  getEntityMeta,
  createStyles,
} from '@/lib/screen-styles/super-admin-organizations.styles';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const styles = createStyles(theme);
const TEACHER_ROLES = ['teacher', 'assistant_teacher', 'head_teacher', 'educator'];

interface OrgEditDraft {
  name: string;
  contact_email: string;
  contact_phone: string;
  address: string;
  city: string;
  province: string;
  country: string;
  is_active: boolean;
  is_verified: boolean;
}

interface OrgMemberRow {
  id: string;
  name: string;
  secondary: string;
  status: string;
  isActive: boolean;
}

export default function SuperAdminOrganizations() {
  const { showAlert, alertProps } = useAlertModal();
  const bottomInset = useBottomInset();

  const {
    filteredOrgs,
    stats,
    loading,
    refreshing,
    updatingSubscription,
    searchQuery,
    setSearchQuery,
    selectedType,
    setSelectedType,
    selectedStatus,
    setSelectedStatus,
    selectedOrg,
    setSelectedOrg,
    showDetailModal,
    setShowDetailModal,
    showActionsModal,
    setShowActionsModal,
    onRefresh,
    handleOrgPress,
    handleOrgAction,
    openTierPicker,
    openStatusPicker,
  } = useSuperAdminOrganizations({ showAlert });

  const [showEditModal, setShowEditModal] = React.useState(false);
  const [editDraft, setEditDraft] = React.useState<OrgEditDraft | null>(null);
  const [savingEdit, setSavingEdit] = React.useState(false);

  const [showMembersModal, setShowMembersModal] = React.useState(false);
  const [membersLoading, setMembersLoading] = React.useState(false);
  const [membersMode, setMembersMode] = React.useState<'students' | 'teachers'>('students');
  const [memberRows, setMemberRows] = React.useState<OrgMemberRow[]>([]);

  const hydrateEditDraft = (org: Organization): OrgEditDraft => ({
    name: org.name || '',
    contact_email: org.contact_email || '',
    contact_phone: org.contact_phone || '',
    address: org.address || '',
    city: org.city || '',
    province: org.province || '',
    country: org.country || 'South Africa',
    is_active: org.status === 'active',
    is_verified: !!org.is_verified,
  });

  const openEditModal = (org?: Organization) => {
    const target = org || selectedOrg;
    if (!target) return;
    setSelectedOrg(target);
    setShowActionsModal(false);
    setShowDetailModal(false);
    setEditDraft(hydrateEditDraft(target));
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditDraft(null);
  };

  const saveOrganizationProfile = async () => {
    if (!selectedOrg || !editDraft || savingEdit) return;
    const trimmedName = editDraft.name.trim();
    if (!trimmedName) {
      showAlert({ title: 'Validation Error', message: 'Organization name is required.' });
      return;
    }

    const payload = {
      p_entity_type: getEntityMeta(selectedOrg).entityType,
      p_entity_id: getEntityMeta(selectedOrg).actualId,
      p_name: trimmedName,
      p_contact_email: editDraft.contact_email.trim() || null,
      p_contact_phone: editDraft.contact_phone.trim() || null,
      p_address: editDraft.address.trim() || null,
      p_city: editDraft.city.trim() || null,
      p_province: editDraft.province.trim() || null,
      p_country: editDraft.country.trim() || null,
      p_is_active: editDraft.is_active,
      p_is_verified: editDraft.is_verified,
      p_sync_duplicates: true,
    };

    setSavingEdit(true);
    try {
      const { data, error } = await assertSupabase().rpc('superadmin_update_entity_profile', payload);
      if (error) throw error;
      if (data?.success === false) {
        throw new Error(data?.message || 'Profile update was rejected.');
      }

      track('superadmin_org_profile_updated', {
        org_id: payload.p_entity_id,
        entity_type: payload.p_entity_type,
      });

      showAlert({ title: 'Saved', message: `${trimmedName} was updated successfully.` });
      closeEditModal();
      await onRefresh();
    } catch (error: any) {
      showAlert({ title: 'Update Failed', message: error?.message || 'Could not save organization changes.' });
    } finally {
      setSavingEdit(false);
    }
  };

  const loadOrgMembers = async (mode: 'students' | 'teachers') => {
    if (!selectedOrg) return;
    const { actualId } = getEntityMeta(selectedOrg);
    const filter = `organization_id.eq.${actualId},preschool_id.eq.${actualId}`;
    setMembersMode(mode);
    setMemberRows([]);
    setMembersLoading(true);
    setShowMembersModal(true);

    try {
      if (mode === 'students') {
        const { data, error } = await assertSupabase()
          .from('students')
          .select('id, first_name, last_name, guardian_name, status, is_active, preschool_id, organization_id')
          .or(filter)
          .order('first_name');
        if (error) throw error;

        const rows: OrgMemberRow[] = (data || []).map((student: any) => {
          const fullName = [student.first_name, student.last_name].filter(Boolean).join(' ').trim();
          const status = String(student.status || (student.is_active === false ? 'inactive' : 'active'));
          return {
            id: student.id,
            name: fullName || `Student ${student.id.slice(0, 6)}`,
            secondary: student.guardian_name ? `Guardian: ${student.guardian_name}` : 'Learner profile',
            status,
            isActive: student.is_active !== false && status !== 'inactive',
          };
        });
        setMemberRows(rows);
      } else {
        const { data, error } = await assertSupabase()
          .from('profiles')
          .select('id, auth_user_id, first_name, last_name, email, role, is_active, preschool_id, organization_id')
          .in('role', TEACHER_ROLES)
          .or(filter)
          .order('first_name');
        if (error) throw error;

        const rows: OrgMemberRow[] = (data || []).map((teacher: any) => {
          const fullName = [teacher.first_name, teacher.last_name].filter(Boolean).join(' ').trim();
          return {
            id: teacher.id,
            name: fullName || teacher.email || `Teacher ${teacher.id.slice(0, 6)}`,
            secondary: teacher.email || 'Staff profile',
            status: teacher.role || 'teacher',
            isActive: teacher.is_active !== false,
          };
        });
        setMemberRows(rows);
      }
    } catch (error: any) {
      showAlert({
        title: 'Member Load Failed',
        message: error?.message || `Unable to load ${mode}.`,
      });
      setMemberRows([]);
    } finally {
      setMembersLoading(false);
    }
  };

  const jumpToUserManager = (mode: 'students' | 'teachers') => {
    if (!selectedOrg) return;
    const { actualId } = getEntityMeta(selectedOrg);
    router.push({
      pathname: '/screens/super-admin-users',
      params: {
        scopeOrgId: actualId,
        scopeRole: mode === 'teachers' ? 'teacher' : 'student',
        scopeLabel: selectedOrg.name,
      },
    });
  };

  const renderStatCell = (bg: string, value: number, label: string) => (
    <View style={[styles.statCard, { backgroundColor: bg + '20' }]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  const renderStatsCard = () => {
    if (!stats) return null;
    return (
      <View style={styles.statsContainer}>
        <View style={styles.statsRow}>
          {renderStatCell(theme.primary, stats.total, 'Total')}
          {renderStatCell('#8b5cf6', stats.preschools, 'Preschools')}
          {renderStatCell('#3b82f6', stats.k12_schools, 'K-12')}
          {renderStatCell('#10b981', stats.other_orgs, 'Organizations')}
        </View>
        <View style={styles.statsRow}>
          {renderStatCell(theme.success, stats.active, 'Active')}
          {renderStatCell(theme.warning, stats.pending, 'Pending')}
          {renderStatCell(theme.info, stats.verified, 'Verified')}
          {renderStatCell('#f59e0b', stats.with_subscription, 'Subscribed')}
        </View>
      </View>
    );
  };

  const typeLabel = (t: OrganizationType) =>
    t === 'all' ? 'All Types' : t === 'k12' ? 'K-12' : t.charAt(0).toUpperCase() + t.slice(1);

  const renderFilters = () => (
    <View style={styles.filtersContainer}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={theme.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search organizations..."
          placeholderTextColor={theme.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        {(['all', 'preschool', 'k12', 'skills', 'org'] as OrganizationType[]).map(type => (
          <TouchableOpacity
            key={type}
            style={[styles.filterChip, selectedType === type && styles.filterChipActive]}
            onPress={() => setSelectedType(type)}
          >
            <Text style={[styles.filterChipText, selectedType === type && styles.filterChipTextActive]}>
              {typeLabel(type)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        {(['all', 'active', 'pending', 'suspended', 'inactive'] as OrganizationStatus[]).map(status => (
          <TouchableOpacity
            key={status}
            style={[
              styles.filterChip,
              selectedStatus === status && styles.filterChipActive,
              selectedStatus === status && { backgroundColor: statusColors[status] || theme.primary },
            ]}
            onPress={() => setSelectedStatus(status)}
          >
            <Text style={[styles.filterChipText, selectedStatus === status && styles.filterChipTextActive]}>
              {status === 'all' ? 'All Status' : status.charAt(0).toUpperCase() + status.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderOrganizationCard = ({ item }: { item: Organization }) => (
    <TouchableOpacity
      style={styles.orgCard}
      onPress={() => handleOrgPress(item)}
      onLongPress={() => {
        setSelectedOrg(item);
        setShowActionsModal(true);
      }}
    >
      <View style={styles.orgHeader}>
        <View style={styles.orgTitleRow}>
          <View style={[styles.typeBadge, { backgroundColor: typeColors[item.type] + '30' }]}>
            <Text style={[styles.typeBadgeText, { color: typeColors[item.type] }]}>
              {item.type === 'k12' ? 'K-12' : item.type.toUpperCase()}
            </Text>
          </View>
          {item.is_verified && (
            <Ionicons name="checkmark-circle" size={18} color={theme.success} />
          )}
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColors[item.status] + '20' }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColors[item.status] }]} />
          <Text style={[styles.statusText, { color: statusColors[item.status] }]}>
            {item.status}
          </Text>
        </View>
      </View>

      <Text style={styles.orgName} numberOfLines={1}>{item.name}</Text>
      
      <View style={styles.orgDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="mail-outline" size={14} color={theme.textSecondary} />
          <Text style={styles.detailText} numberOfLines={1}>{item.contact_email || 'No email'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="people-outline" size={14} color={theme.textSecondary} />
          <Text style={styles.detailText}>
            {item.active_student_count ?? item.student_count} active students • {item.active_teacher_count ?? item.teacher_count} active teachers
          </Text>
        </View>
        {item.city && (
          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={14} color={theme.textSecondary} />
            <Text style={styles.detailText}>{item.city}{item.province ? `, ${item.province}` : ''}</Text>
          </View>
        )}
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={14} color={theme.textSecondary} />
          <Text style={styles.detailText}>
            Joined {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>
      </View>

      <View style={styles.orgFooter}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => {
            setSelectedOrg(item);
            setShowActionsModal(true);
          }}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderDetailModal = () => {
    if (!selectedOrg) return null;

    return (
      <Modal
        visible={showDetailModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedOrg.name}</Text>
              <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.modalSection}>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Type</Text>
                  <View style={[styles.typeBadge, { backgroundColor: typeColors[selectedOrg.type] + '30' }]}>
                    <Text style={[styles.typeBadgeText, { color: typeColors[selectedOrg.type] }]}>
                      {selectedOrg.type === 'k12' ? 'K-12 School' : 
                       selectedOrg.type.charAt(0).toUpperCase() + selectedOrg.type.slice(1)}
                    </Text>
                  </View>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Underlying Type</Text>
                  <Text style={styles.modalValue}>{selectedOrg.organization_type_raw || '-'}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Status</Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusColors[selectedOrg.status] + '20' }]}>
                    <View style={[styles.statusDot, { backgroundColor: statusColors[selectedOrg.status] }]} />
                    <Text style={[styles.statusText, { color: statusColors[selectedOrg.status] }]}>
                      {selectedOrg.status}
                    </Text>
                  </View>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Verified</Text>
                  <Text style={styles.modalValue}>
                    {selectedOrg.is_verified ? '✅ Yes' : '❌ No'}
                  </Text>
                </View>
              </View>
              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>People</Text>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Students</Text>
                  <View style={styles.modalInlineActions}>
                    <Text style={styles.modalValueCompact}>
                      {selectedOrg.active_student_count ?? selectedOrg.student_count} active / {selectedOrg.student_count} total
                    </Text>
                    <TouchableOpacity
                      style={styles.modalLinkButton}
                      onPress={() => loadOrgMembers('students')}
                    >
                      <Text style={styles.modalLinkText}>View</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Teachers</Text>
                  <View style={styles.modalInlineActions}>
                    <Text style={styles.modalValueCompact}>
                      {selectedOrg.active_teacher_count ?? selectedOrg.teacher_count} active / {selectedOrg.teacher_count} total
                    </Text>
                    <TouchableOpacity
                      style={styles.modalLinkButton}
                      onPress={() => loadOrgMembers('teachers')}
                    >
                      <Text style={styles.modalLinkText}>View</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>Contact Information</Text>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Email</Text>
                  <Text style={styles.modalValue}>{selectedOrg.contact_email || '-'}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Phone</Text>
                  <Text style={styles.modalValue}>{selectedOrg.contact_phone || '-'}</Text>
                </View>
              </View>
              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>Location</Text>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Address</Text>
                  <Text style={styles.modalValue}>{selectedOrg.address || '-'}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>City</Text>
                  <Text style={styles.modalValue}>{selectedOrg.city || '-'}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Province</Text>
                  <Text style={styles.modalValue}>{selectedOrg.province || '-'}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Country</Text>
                  <Text style={styles.modalValue}>{selectedOrg.country || '-'}</Text>
                </View>
              </View>
              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>Activity</Text>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Created</Text>
                  <Text style={styles.modalValue}>
                    {new Date(selectedOrg.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Last Active</Text>
                  <Text style={styles.modalValue}>
                    {selectedOrg.last_active_at 
                      ? new Date(selectedOrg.last_active_at).toLocaleDateString()
                      : '-'}
                  </Text>
                </View>
              </View>
              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>Subscription</Text>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Tier</Text>
                  <Text style={styles.modalValue}>
                    {formatTierLabel(selectedOrg.subscription_tier)}
                  </Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Status</Text>
                  <Text style={styles.modalValue}>
                    {formatStatusLabel(selectedOrg.subscription_status)}
                  </Text>
                </View>
                <View style={styles.modalButtonRow}>
                  <TouchableOpacity
                    style={[styles.modalActionBtn, { backgroundColor: theme.info }]}
                    onPress={() => openTierPicker(selectedOrg)}
                    disabled={updatingSubscription}
                  >
                    <Ionicons name="cash-outline" size={20} color="#fff" />
                    <Text style={styles.modalActionText}>Change Tier</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalActionBtn, { backgroundColor: theme.primary }]}
                    onPress={() => openStatusPicker(selectedOrg)}
                    disabled={updatingSubscription}
                  >
                    <Ionicons name="flag-outline" size={20} color="#fff" />
                    <Text style={styles.modalActionText}>Change Status</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.modalButtonRow}>
                  <TouchableOpacity
                    style={[styles.modalActionBtn, { backgroundColor: '#6d28d9' }]}
                    onPress={() => handleOrgAction('change_type')}
                  >
                    <Ionicons name="swap-horizontal-outline" size={20} color="#fff" />
                    <Text style={styles.modalActionText}>Change Type</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={[styles.modalActions, { marginBottom: bottomInset + 16 }]}>
                <TouchableOpacity
                  style={[styles.modalActionBtn, { backgroundColor: theme.primary }]}
                  onPress={() => openEditModal(selectedOrg)}
                >
                  <Ionicons name="create-outline" size={20} color="#fff" />
                  <Text style={styles.modalActionText}>Edit</Text>
                </TouchableOpacity>
                {!selectedOrg.is_verified && (
                  <TouchableOpacity
                    style={[styles.modalActionBtn, { backgroundColor: theme.success }]}
                    onPress={() => handleOrgAction('verify')}
                  >
                    <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                    <Text style={styles.modalActionText}>Verify</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.modalActionBtn, { backgroundColor: theme.warning }]}
                  onPress={() => handleOrgAction('suspend')}
                >
                  <Ionicons name="pause-circle-outline" size={20} color="#fff" />
                  <Text style={styles.modalActionText}>Suspend</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  const renderActionsModal = () => {
    if (!selectedOrg) return null;

    const actions = [
      { id: 'view', label: 'View Details', icon: 'eye-outline', color: theme.primary },
      { id: 'edit', label: 'Edit Organization', icon: 'create-outline', color: theme.info },
      { id: 'change_type', label: 'Change Type', icon: 'swap-horizontal-outline', color: '#a78bfa' },
      { id: 'verify', label: 'Verify Organization', icon: 'checkmark-circle-outline', color: theme.success },
      { id: 'suspend', label: 'Suspend Organization', icon: 'pause-circle-outline', color: theme.warning },
      { id: 'delete', label: 'Delete Organization', icon: 'trash-outline', color: theme.error },
    ];

    return (
      <Modal
        visible={showActionsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowActionsModal(false)}
      >
        <TouchableOpacity
          style={styles.actionsOverlay}
          activeOpacity={1}
          onPress={() => setShowActionsModal(false)}
        >
          <View style={styles.actionsContent}>
            <Text style={styles.actionsTitle}>{selectedOrg.name}</Text>
            <Text style={styles.actionsSubtitle}>Quick Actions</Text>

            {actions.map(action => (
              <TouchableOpacity
                key={action.id}
                style={styles.actionItem}
                onPress={() => {
                  if (action.id === 'edit') {
                    openEditModal(selectedOrg);
                    return;
                  }
                  handleOrgAction(action.id);
                }}
              >
                <Ionicons name={action.icon as any} size={22} color={action.color} />
                <Text style={[styles.actionItemText, { color: action.color }]}>
                  {action.label}
                </Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowActionsModal(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  const renderEditModal = () => {
    if (!selectedOrg || !editDraft) return null;

    return (
      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={closeEditModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Organization</Text>
              <TouchableOpacity onPress={closeEditModal}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>Profile</Text>
                <Text style={styles.editLabel}>Name</Text>
                <TextInput
                  style={styles.editInput}
                  value={editDraft.name}
                  onChangeText={(name) => setEditDraft(prev => prev ? { ...prev, name } : prev)}
                  placeholder="Organization name"
                  placeholderTextColor={theme.textMuted}
                />
                <Text style={styles.editLabel}>Email</Text>
                <TextInput
                  style={styles.editInput}
                  value={editDraft.contact_email}
                  onChangeText={(contact_email) => setEditDraft(prev => prev ? { ...prev, contact_email } : prev)}
                  placeholder="Contact email"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <Text style={styles.editLabel}>Phone</Text>
                <TextInput
                  style={styles.editInput}
                  value={editDraft.contact_phone}
                  onChangeText={(contact_phone) => setEditDraft(prev => prev ? { ...prev, contact_phone } : prev)}
                  placeholder="Contact phone"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>Location</Text>
                <Text style={styles.editLabel}>Address</Text>
                <TextInput
                  style={styles.editInput}
                  value={editDraft.address}
                  onChangeText={(address) => setEditDraft(prev => prev ? { ...prev, address } : prev)}
                  placeholder="Street address"
                  placeholderTextColor={theme.textMuted}
                />
                <Text style={styles.editLabel}>City</Text>
                <TextInput
                  style={styles.editInput}
                  value={editDraft.city}
                  onChangeText={(city) => setEditDraft(prev => prev ? { ...prev, city } : prev)}
                  placeholder="City"
                  placeholderTextColor={theme.textMuted}
                />
                <Text style={styles.editLabel}>Province</Text>
                <TextInput
                  style={styles.editInput}
                  value={editDraft.province}
                  onChangeText={(province) => setEditDraft(prev => prev ? { ...prev, province } : prev)}
                  placeholder="Province"
                  placeholderTextColor={theme.textMuted}
                />
                <Text style={styles.editLabel}>Country</Text>
                <TextInput
                  style={styles.editInput}
                  value={editDraft.country}
                  onChangeText={(country) => setEditDraft(prev => prev ? { ...prev, country } : prev)}
                  placeholder="Country"
                  placeholderTextColor={theme.textMuted}
                />
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>State</Text>
                <View style={styles.toggleRow}>
                  <Text style={styles.modalLabel}>Active</Text>
                  <Switch
                    value={editDraft.is_active}
                    onValueChange={(is_active) => setEditDraft(prev => prev ? { ...prev, is_active } : prev)}
                    trackColor={{ false: '#4b5563', true: theme.success }}
                    thumbColor="#ffffff"
                  />
                </View>
                <View style={styles.toggleRow}>
                  <Text style={styles.modalLabel}>Verified</Text>
                  <Switch
                    value={editDraft.is_verified}
                    onValueChange={(is_verified) => setEditDraft(prev => prev ? { ...prev, is_verified } : prev)}
                    trackColor={{ false: '#4b5563', true: theme.primary }}
                    thumbColor="#ffffff"
                  />
                </View>
              </View>
            </ScrollView>

            <View style={[styles.editFooter, { paddingBottom: bottomInset + 12 }]}>
              <TouchableOpacity style={styles.editCancelBtn} onPress={closeEditModal} disabled={savingEdit}>
                <Text style={styles.editCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editSaveBtn, savingEdit && styles.editSaveBtnDisabled]}
                onPress={saveOrganizationProfile}
                disabled={savingEdit}
              >
                <Text style={styles.editSaveText}>{savingEdit ? 'Saving...' : 'Save Changes'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const renderMembersModal = () => {
    if (!selectedOrg) return null;

    return (
      <Modal
        visible={showMembersModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMembersModal(false)}
      >
        <View style={styles.actionsOverlay}>
          <View style={styles.memberModalContent}>
            <View style={styles.memberModalHeader}>
              <View>
                <Text style={styles.actionsTitle}>
                  {membersMode === 'students' ? 'Students' : 'Teachers'}
                </Text>
                <Text style={styles.actionsSubtitle}>{selectedOrg.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowMembersModal(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            {membersLoading ? (
              <View style={styles.membersLoading}>
                <EduDashSpinner size="small" color={theme.primary} />
                <Text style={styles.loadingText}>Loading members...</Text>
              </View>
            ) : (
              <ScrollView style={styles.membersList}>
                {memberRows.map((row) => (
                  <View key={row.id} style={styles.memberRow}>
                    <View style={styles.memberTextWrap}>
                      <Text style={styles.memberName}>{row.name}</Text>
                      <Text style={styles.memberSecondary}>{row.secondary}</Text>
                    </View>
                    <View style={[styles.memberStatusPill, { backgroundColor: (row.isActive ? theme.success : theme.error) + '22' }]}>
                      <Text style={[styles.memberStatusText, { color: row.isActive ? theme.success : theme.error }]}>
                        {row.status}
                      </Text>
                    </View>
                  </View>
                ))}
                {memberRows.length === 0 && (
                  <View style={styles.emptyMembers}>
                    <Text style={styles.emptyText}>
                      No {membersMode} found for this organization.
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}

            <View style={styles.memberActions}>
              <TouchableOpacity
                style={styles.memberSecondaryBtn}
                onPress={() => jumpToUserManager(membersMode)}
              >
                <Text style={styles.memberSecondaryBtnText}>Open User Manager</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.memberPrimaryBtn} onPress={() => setShowMembersModal(false)}>
                <Text style={styles.memberPrimaryBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        <ThemedStatusBar />
        <View style={styles.loadingContainer}>
          <EduDashSpinner size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Loading organizations...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <ThemedStatusBar />
      <Stack.Screen
        options={{
          title: 'Organizations',
          headerShown: false,
        }}
      />

      {/* Custom Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Organizations</Text>
        <TouchableOpacity
          onPress={() => router.push('/screens/super-admin/school-onboarding-wizard')}
          style={styles.headerButton}
        >
          <Ionicons name="add-circle" size={28} color={theme.primary} />
        </TouchableOpacity>
      </View>

      <FlashList
        data={filteredOrgs}
        keyExtractor={item => item.id}
        renderItem={renderOrganizationCard}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
        ListHeaderComponent={
          <>
            {renderStatsCard()}
            {renderFilters()}
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsCount}>
                {filteredOrgs.length} organization{filteredOrgs.length !== 1 ? 's' : ''}
              </Text>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="business-outline" size={64} color={theme.textMuted} />
            <Text style={styles.emptyTitle}>No Organizations Found</Text>
            <Text style={styles.emptyText}>
              {searchQuery || selectedType !== 'all' || selectedStatus !== 'all'
                ? 'Try adjusting your filters'
                : 'Start by onboarding your first organization'}
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => router.push('/screens/super-admin/school-onboarding-wizard')}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.emptyButtonText}>Onboard Organization</Text>
            </TouchableOpacity>
          </View>
        }
        contentContainerStyle={styles.listContent}
        numColumns={SCREEN_WIDTH > 600 ? 2 : 1}
        key={SCREEN_WIDTH > 600 ? 'two-columns' : 'one-column'}
        estimatedItemSize={160}
      />

      {renderDetailModal()}
      {renderActionsModal()}
      {renderEditModal()}
      {renderMembersModal()}
      <AlertModal {...alertProps} />
    </SafeAreaView>
  );
}
