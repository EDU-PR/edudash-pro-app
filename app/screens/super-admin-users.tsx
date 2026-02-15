import React from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, TextInput, Modal } from 'react-native';
import { Stack } from 'expo-router';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import ThemedStatusBar from '@/components/ui/ThemedStatusBar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import EduDashSpinner from '@/components/ui/EduDashSpinner';
import { AlertModal, useAlertModal } from '@/components/ui/AlertModal';
import { getRoleColor, formatLastSeen, formatTierLabel, createStyles } from '@/lib/screen-styles/super-admin-users.styles';
import { useSuperAdminUsers } from '@/hooks/useSuperAdminUsers';


export default function SuperAdminUsersScreen() {
  const params = useLocalSearchParams<{
    scopeRole?: string;
    scopeOrgId?: string;
    scopeLabel?: string;
  }>();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { showAlert, alertProps } = useAlertModal();

  const {
    hasAccess,
    filteredUsers,
    totalUsers,
    loading,
    refreshing,
    impersonating,
    creatingTempPassword,
    updatingTier,
    showFilters,
    setShowFilters,
    showUserModal,
    setShowUserModal,
    selectedUser,
    setSelectedUser,
    filters,
    setFilters,
    onRefresh,
    impersonateUser,
    suspendUser,
    requestUserDeletion,
    deleteUserNow,
    resetUserPassword,
    createTempPassword,
    openTierPicker,
    openRolePicker,
  } = useSuperAdminUsers(showAlert);

  React.useEffect(() => {
    const scopeRole = String(params.scopeRole || '').toLowerCase();
    const scopeOrgId = String(params.scopeOrgId || '');
    const scopeLabel = String(params.scopeLabel || '');
    if (!scopeRole && !scopeOrgId && !scopeLabel) return;

    setFilters((prev) => ({
      ...prev,
      role: ['principal', 'teacher', 'parent', 'student', 'superadmin'].includes(scopeRole)
        ? (scopeRole as typeof prev.role)
        : prev.role,
      schoolId: scopeOrgId || prev.schoolId,
      search: !prev.search && scopeLabel ? scopeLabel : prev.search,
    }));
  }, [params.scopeRole, params.scopeOrgId, params.scopeLabel, setFilters]);


  if (!hasAccess) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'User Management', headerShown: false }} />
        <ThemedStatusBar />
        <SafeAreaView style={styles.deniedContainer}>
          <Text style={styles.deniedText}>Access Denied - Super Admin Only</Text>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'User Management', headerShown: false }} />
      <ThemedStatusBar />
      
      {/* Header */}
      <SafeAreaView style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity 
            onPress={() => router.canGoBack() ? router.back() : router.push('/screens/super-admin-dashboard')} 
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#00f5ff" />
          </TouchableOpacity>
          <Text style={styles.title}>User Management</Text>
          <TouchableOpacity onPress={() => setShowFilters(!showFilters)} style={styles.filterButton}>
            <Ionicons name="filter" size={24} color="#00f5ff" />
          </TouchableOpacity>
        </View>
        
        {/* Stats */}
        <View style={styles.statsContainer}>
          <Text style={styles.statsText}>
            Showing {filteredUsers.length} of {totalUsers} users
          </Text>
          {!!filters.schoolId && (
            <TouchableOpacity
              style={styles.scopeBadge}
              onPress={() => setFilters(prev => ({ ...prev, schoolId: '', role: 'all' }))}
            >
              <Text style={styles.scopeBadgeText}>
                Scoped to org {String(params.scopeLabel || 'selection')} • Tap to clear
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>

      {/* Filters */}
      {showFilters && (
        <View style={styles.filtersContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search users..."
            placeholderTextColor="#9ca3af"
            value={filters.search}
            onChangeText={(text) => setFilters(prev => ({ ...prev, search: text }))}
          />
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterTabs}>
            {(['all', 'principal', 'teacher', 'parent', 'student', 'superadmin'] as const).map((role) => (
              <TouchableOpacity
                key={role}
                style={[styles.filterTab, filters.role === role && styles.filterTabActive]}
                onPress={() => setFilters(prev => ({ ...prev, role }))}
              >
                <Text style={[styles.filterTabText, filters.role === role && styles.filterTabTextActive]}>
                  {role === 'all' ? 'All Roles' : role.charAt(0).toUpperCase() + role.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterTabs}>
            {(['all', 'active', 'inactive'] as const).map((status) => (
              <TouchableOpacity
                key={status}
                style={[styles.filterTab, filters.status === status && styles.filterTabActive]}
                onPress={() => setFilters(prev => ({ ...prev, status }))}
              >
                <Text style={[styles.filterTabText, filters.status === status && styles.filterTabTextActive]}>
                  {status === 'all' ? 'All Status' : status.charAt(0).toUpperCase() + status.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <EduDashSpinner size="large" color={theme.primary} />
            <Text style={styles.loadingText}>Loading users...</Text>
          </View>
        ) : (
          <>
            {filteredUsers.map((user) => (
              <TouchableOpacity
                key={user.id}
                style={styles.userCard}
                onPress={() => {
                  setSelectedUser(user);
                  setShowUserModal(true);
                }}
              >
                <View style={styles.userHeader}>
                  <View style={styles.userInfo}>
                    <View style={styles.avatarContainer}>
                      {user.avatar_url ? (
                        <Text style={styles.avatarText}>{user.name?.charAt(0) || user.email.charAt(0)}</Text>
                      ) : (
                        <Ionicons name="person" size={20} color={theme.textTertiary} />
                      )}
                    </View>
                    <View style={styles.userDetails}>
                      <Text style={styles.userName}>{user.name || user.email}</Text>
                      <Text style={styles.userEmail}>{user.email}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.userMeta}>
                    <View style={[styles.roleBadge, { backgroundColor: getRoleColor(user.role) + '20', borderColor: getRoleColor(user.role) }]}>
                      <Text style={[styles.roleText, { color: getRoleColor(user.role) }]}>
                        {user.role.toUpperCase()}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, user.is_active ? styles.statusActive : styles.statusInactive]}>
                      <Text style={[styles.statusText, user.is_active ? styles.statusActiveText : styles.statusInactiveText]}>
                        {user.is_active ? 'Active' : 'Suspended'}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.userFooter}>
                  {user.school_name && (
                    <Text style={styles.schoolText}>
                      <Ionicons name="school" size={12} color={theme.textTertiary} />
                    </Text>
                  )}
                  <Text style={styles.lastSeenText}>
                    Last seen: {formatLastSeen(user.last_sign_in_at)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}

            {filteredUsers.length === 0 && (
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={48} color="#6b7280" />
                <Text style={styles.emptyText}>No users found</Text>
                <Text style={styles.emptySubText}>Try adjusting your search or filters</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* User Details Modal */}
      <Modal
        visible={showUserModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowUserModal(false)}
      >
        {selectedUser && (
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowUserModal(false)}>
                <Ionicons name="close" size={24} color="#00f5ff" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>User Details</Text>
              <View style={styles.placeholder} />
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.modalUserInfo}>
                <View style={styles.modalAvatar}>
                  {selectedUser.avatar_url ? (
                    <Text style={styles.modalAvatarText}>
                      {selectedUser.name?.charAt(0) || selectedUser.email.charAt(0)}
                    </Text>
                  ) : (
                    <Ionicons name="person" size={32} color="#6b7280" />
                  )}
                </View>
                <Text style={styles.modalUserName}>{selectedUser.name || selectedUser.email}</Text>
                <Text style={styles.modalUserEmail}>{selectedUser.email}</Text>
                
                <View style={styles.modalBadges}>
                  <View style={[styles.modalRoleBadge, { backgroundColor: getRoleColor(selectedUser.role) + '20', borderColor: getRoleColor(selectedUser.role) }]}>
                    <Text style={[styles.modalRoleText, { color: getRoleColor(selectedUser.role) }]}>
                      {selectedUser.role.toUpperCase()}
                    </Text>
                  </View>
                  <View style={[styles.modalStatusBadge, selectedUser.is_active ? styles.statusActive : styles.statusInactive]}>
                    <Text style={[styles.modalStatusText, selectedUser.is_active ? styles.statusActiveText : styles.statusInactiveText]}>
                      {selectedUser.is_active ? 'Active' : 'Suspended'}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Account Information</Text>
                <View style={styles.modalInfoItem}>
                  <Text style={styles.modalInfoLabel}>User ID</Text>
                  <Text style={styles.modalInfoValue}>{selectedUser.id}</Text>
                </View>
                <View style={styles.modalInfoItem}>
                  <Text style={styles.modalInfoLabel}>Created</Text>
                  <Text style={styles.modalInfoValue}>
                    {new Date(selectedUser.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.modalInfoItem}>
                  <Text style={styles.modalInfoLabel}>Last Sign In</Text>
                  <Text style={styles.modalInfoValue}>
                    {formatLastSeen(selectedUser.last_sign_in_at)}
                  </Text>
                </View>
                <View style={styles.modalInfoItem}>
                  <Text style={styles.modalInfoLabel}>Subscription Tier</Text>
                  <Text style={styles.modalInfoValue}>
                    {formatTierLabel(selectedUser.subscription_tier)}
                  </Text>
                </View>
                {selectedUser.school_name && (
                  <View style={styles.modalInfoItem}>
                    <Text style={styles.modalInfoLabel}>School</Text>
                    <Text style={styles.modalInfoValue}>{selectedUser.school_name}</Text>
                  </View>
                )}
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalActionButton}
                  onPress={() => impersonateUser(selectedUser)}
                  disabled={impersonating}
                >
                  {impersonating ? (
                    <EduDashSpinner size="small" color="#00f5ff" />
                  ) : (
                    <Ionicons name="person-circle" size={20} color="#00f5ff" />
                  )}
                  <Text style={styles.modalActionText}>Impersonate User</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalActionButton}
                  onPress={() => resetUserPassword(selectedUser)}
                >
                  <Ionicons name="key" size={20} color="#f59e0b" />
                  <Text style={[styles.modalActionText, { color: '#f59e0b' }]}>Reset Password</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalActionButton}
                  onPress={() => createTempPassword(selectedUser)}
                  disabled={creatingTempPassword}
                >
                  {creatingTempPassword ? (
                    <EduDashSpinner size="small" color="#14b8a6" />
                  ) : (
                    <Ionicons name="keypad" size={20} color="#14b8a6" />
                  )}
                  <Text style={[styles.modalActionText, { color: '#14b8a6' }]}>Create Temp Password</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalActionButton}
                  onPress={() => openTierPicker(selectedUser)}
                  disabled={updatingTier}
                >
                  {updatingTier ? (
                    <EduDashSpinner size="small" color="#3b82f6" />
                  ) : (
                    <Ionicons name="cash" size={20} color="#3b82f6" />
                  )}
                  <Text style={[styles.modalActionText, { color: '#3b82f6' }]}>Set Paid Tier</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalActionButton}
                  onPress={() => suspendUser(selectedUser)}
                >
                  <Ionicons 
                    name={selectedUser.is_active ? "ban" : "checkmark-circle"} 
                    size={20} 
                    color={selectedUser.is_active ? "#ef4444" : "#10b981"} 
                  />
                  <Text style={[styles.modalActionText, { color: selectedUser.is_active ? "#ef4444" : "#10b981" }]}>
                    {selectedUser.is_active ? 'Suspend User' : 'Reactivate User'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalActionButton}
                  onPress={() => openRolePicker(selectedUser)}
                >
                  <Ionicons name="person-add" size={20} color="#8b5cf6" />
                  <Text style={[styles.modalActionText, { color: '#8b5cf6' }]}>Update Role</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalActionButton}
                  onPress={() => requestUserDeletion(selectedUser)}
                >
                  <Ionicons name="trash" size={20} color="#dc2626" />
                  <Text style={[styles.modalActionText, { color: '#dc2626' }]}>Request Deletion</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalActionButton}
                  onPress={() => deleteUserNow(selectedUser)}
                >
                  <Ionicons name="skull" size={20} color="#991b1b" />
                  <Text style={[styles.modalActionText, { color: '#991b1b' }]}>Delete Now</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>
      <AlertModal {...alertProps} />
    </View>
  );
}
