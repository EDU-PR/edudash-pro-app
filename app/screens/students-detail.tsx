/**
 * Students Directory Detail Screen
 * 
 * Complete students management with hierarchical access control:
 * - Principals see all school students with full management capabilities
 * - Teachers see their assigned students with limited management
 * - Parents see only their children with read-only access
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, TextInput, RefreshControl, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { router } from 'expo-router';
import { CacheIndicator } from '@/components/ui/CacheIndicator';
import { EmptyStudentsState } from '@/components/ui/EmptyState';
import { AlertModal, type AlertButton } from '@/components/ui/AlertModal';
import { derivePreschoolId, isPrincipalOrAbove } from '@/lib/roleUtils';
import { logger } from '@/lib/logger';
import {
  type Student, type FilterOptions, type AlertState,
  DEFAULT_FILTERS, calculateAge, getStatusColor, getPaymentStatusColor,
} from '@/lib/screen-data/students-detail.types';
import { loadStudentsData, softDeleteStudent, permanentDeleteStudent } from '@/lib/screen-data/students-detail.helpers';
import { FilterModal } from '@/components/students-detail/FilterModal';
import { StudentDetailModal } from '@/components/students-detail/StudentDetailModal';

const TAG = 'StudentsDetailScreen';
const STUDENT_DELETE_RETENTION_DAYS = 30;

export default function StudentsDetailScreen() {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const { theme, isDark } = useTheme();
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isLoadingFromCache, setIsLoadingFromCache] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [filters, setFilters] = useState<FilterOptions>(DEFAULT_FILTERS);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Alert modal state
  const [alertState, setAlertState] = useState<AlertState>({
    visible: false, title: '', message: '', type: 'info', buttons: [],
  });

  const showAlert = (title: string, message: string, type: AlertState['type'] = 'info', buttons: AlertButton[] = [{ text: 'OK', style: 'default' }]) => {
    setAlertState({ visible: true, title, message, type, buttons });
  };

  const hideAlert = () => setAlertState(prev => ({ ...prev, visible: false }));

  const getPreschoolId = useCallback((): string | null => {
    const profileOrgId = derivePreschoolId(profile as any);
    if (profileOrgId) return profileOrgId;
    return (user?.user_metadata as any)?.organization_id || (user?.user_metadata as any)?.preschool_id || null;
  }, [profile, user]);

  // ---------- Data Loading ----------
  const loadStudents = async (forceRefresh = false) => {
    const preschoolId = getPreschoolId();
    if (!preschoolId) {
      logger.warn(TAG, 'No preschool ID available');
      setLoading(false);
      return;
    }

    try {
      setLoading(!forceRefresh);
      if (forceRefresh) setRefreshing(true);

      const userRole = profile?.role || 'parent';
      if (!forceRefresh && user?.id) setIsLoadingFromCache(true);

      const result = await loadStudentsData({
        preschoolId,
        userId: user?.id || '',
        userEmail: user?.email || undefined,
        userRole,
        includeInactive,
        forceRefresh,
      });

      setIsLoadingFromCache(false);
      setStudents(result.students);

      // If data came from cache, background-refresh
      if (result.fromCache) {
        setTimeout(() => loadStudents(true), 100);
      }
    } catch (error: any) {
      logger.error(TAG, 'Failed to load students:', error);
      showAlert('Error', error.message || 'Failed to load students directory', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setIsLoadingFromCache(false);
    }
  };

  // ---------- Effects ----------
  useEffect(() => { loadStudents(); }, []);

  useEffect(() => {
    const shouldIncludeInactive = filters.status.includes('inactive');
    if (shouldIncludeInactive !== includeInactive) setIncludeInactive(shouldIncludeInactive);
  }, [filters.status]);

  useEffect(() => {
    if (students.length > 0) loadStudents(true);
  }, [includeInactive]);

  useEffect(() => { applyFilters(); }, [students, filters]);

  // ---------- Filtering ----------
  const applyFilters = () => {
    let filtered = students;

    if (filters.grade.length > 0) {
      filtered = filtered.filter(s => filters.grade.includes(s.grade));
    }
    if (filters.status.length > 0) {
      filtered = filtered.filter(s => filters.status.includes(s.status));
    }
    if (filters.paymentStatus.length > 0) {
      filtered = filtered.filter(s => filters.paymentStatus.includes(s.fees.paymentStatus));
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      filtered = filtered.filter(s =>
        s.firstName.toLowerCase().includes(q) ||
        s.lastName.toLowerCase().includes(q) ||
        s.studentId.toLowerCase().includes(q) ||
        s.guardianName.toLowerCase().includes(q)
      );
    }
    filtered.sort((a, b) => a.lastName.localeCompare(b.lastName));
    setFilteredStudents(filtered);
  };

  // ---------- Permissions ----------
  const canManageStudent = (): boolean => isPrincipalOrAbove(profile?.role);

  const canEditStudent = (_student: Student): boolean => {
    const role = profile?.role || 'parent';
    return isPrincipalOrAbove(role) || role === 'teacher';
  };

  // ---------- Handlers ----------
  const handleEditStudent = (student: Student) => {
    if (!canEditStudent(student)) {
      showAlert('Access Denied', 'You do not have permission to edit student information.', 'error');
      return;
    }
    setSelectedStudent(student);
    setShowStudentModal(true);
  };

  const handleDeleteStudent = async (studentId: string, studentName: string) => {
    if (!canManageStudent()) {
      showAlert('Access Denied', 'Only principals can delete students.', 'error');
      return;
    }
    showAlert(
      'Remove Student',
      `Are you sure you want to remove ${studentName} from the school?\n\nThis will:\n\u2022 Mark the student as inactive\n\u2022 Keep records for ${STUDENT_DELETE_RETENTION_DAYS} days before permanent deletion\n\u2022 Allow restoration during the retention window\n\u2022 Notify the parent (if applicable)`,
      'warning',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove Student',
          style: 'destructive',
          onPress: async () => {
            try {
              hideAlert();
              setActionMessage(`Removing ${studentName}...`);
              const preschoolId = getPreschoolId();
              const { permanentDeleteAfter } = await softDeleteStudent(
                studentId,
                user?.id || '',
                preschoolId || '',
                profile?.role || 'parent',
              );
              const deleteOn = new Date(permanentDeleteAfter).toLocaleDateString('en-ZA', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              });
              setStudents(prev => prev.filter(s => s.id !== studentId));
              showAlert(
                'Student Removed',
                `${studentName} is now inactive and can be restored before ${deleteOn}. Permanent deletion is scheduled after ${STUDENT_DELETE_RETENTION_DAYS} days.`,
                'success',
              );
            } catch (error: any) {
              logger.error(TAG, 'Error soft-deleting student:', error);
              showAlert('Error', error.message || 'Failed to remove student. Please try again.', 'error');
            } finally {
              setActionMessage(null);
            }
          },
        },
      ]
    );
  };

  const handlePermanentDelete = async (studentId: string, studentName: string) => {
    if (!canManageStudent()) {
      showAlert('Access Denied', 'Only principals can permanently delete students.', 'error');
      return;
    }
    showAlert(
      '\u26A0\uFE0F Permanent Delete',
      `This will PERMANENTLY delete ${studentName} and all associated records.\n\nThis action CANNOT be undone!\n\nAre you absolutely sure?`,
      'error',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            try {
              hideAlert();
              setActionMessage(`Permanently deleting ${studentName}...`);
              const preschoolId = getPreschoolId();
              await permanentDeleteStudent(studentId, user?.id || '', preschoolId || '', profile?.role || 'parent');
              setStudents(prev => prev.filter(s => s.id !== studentId));
              showAlert('Deleted', `${studentName} has been permanently deleted.`, 'success');
            } catch (error: any) {
              logger.error(TAG, 'Error permanently deleting student:', error);
              showAlert('Error', error.message || 'Failed to delete student. Please try again.', 'error');
            } finally {
              setActionMessage(null);
            }
          },
        },
      ]
    );
  };

  const toggleStudentStatus = (studentId: string, currentStatus: string) => {
    if (!canManageStudent()) {
      showAlert('Access Denied', 'Only principals can change student status.', 'error');
      return;
    }
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    setStudents(prev => prev.map(s =>
      s.id === studentId ? { ...s, status: newStatus as any } : s
    ));
  };

  // ---------- Render Helpers ----------
  const renderStudentCard = ({ item }: { item: Student }) => {
    const age = calculateAge(item.dateOfBirth);
    const busy = Boolean(actionMessage);
    return (
      <TouchableOpacity style={styles.studentCard} onPress={() => handleEditStudent(item)}>
        <View style={styles.studentHeader}>
          <View style={styles.studentPhotoContainer}>
            {item.profilePhoto ? (
              <Image source={{ uri: item.profilePhoto }} style={styles.studentPhoto} />
            ) : (
              <View style={styles.studentPhotoPlaceholder}>
                <Ionicons name="person" size={24} color={theme.colors.text} />
              </View>
            )}
          </View>

          <View style={styles.studentInfo}>
            <View style={styles.studentNameRow}>
              <Text style={styles.studentName}>{item.firstName} {item.lastName}</Text>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>{item.status}</Text>
              </View>
            </View>
            <Text style={styles.studentDetails}>{item.studentId} {'\u2022'} {item.grade} {'\u2022'} Age {age}</Text>
            <Text style={styles.studentDetails}>Guardian: {item.guardianName}</Text>
            <View style={styles.studentMetrics}>
              <View style={styles.metricItem}>
                <Ionicons name="checkmark-circle" size={16} color="#059669" />
                <Text style={styles.metricText}>{item.attendanceRate}%</Text>
              </View>
              <View style={styles.metricItem}>
                <Ionicons name="card" size={16} color={getPaymentStatusColor(item.fees.paymentStatus)} />
                <Text style={[styles.metricText, { color: getPaymentStatusColor(item.fees.paymentStatus) }]}>
                  {item.fees.paymentStatus}
                </Text>
              </View>
              {item.fees.outstanding > 0 && (
                <Text style={styles.outstandingFees}>R{item.fees.outstanding.toLocaleString()} outstanding</Text>
              )}
            </View>
          </View>

          {canManageStudent() && (
            <View style={styles.studentActions}>
              <TouchableOpacity
                style={[styles.actionButton, busy && styles.disabledAction]}
                onPress={() => toggleStudentStatus(item.id, item.status)}
                disabled={busy}
              >
                <Ionicons name={item.status === 'active' ? 'pause' : 'play'} size={16} color={theme.colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, busy && styles.disabledAction]}
                onPress={() => handleDeleteStudent(item.id, `${item.firstName} ${item.lastName}`)}
                disabled={busy}
              >
                <Ionicons name="trash-outline" size={16} color="#DC2626" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const getActiveFiltersCount = (): number =>
    filters.grade.length + filters.status.length + filters.paymentStatus.length + (filters.search ? 1 : 0);

  // Create dynamic styles with theme
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Students Directory</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.viewToggle} onPress={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}>
            <Ionicons name={viewMode === 'list' ? 'grid' : 'list'} size={20} color={theme.colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterButton} onPress={() => setShowFilters(true)}>
            <Ionicons name="filter" size={20} color={theme.colors.primary} />
            {getActiveFiltersCount() > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{getActiveFiltersCount()}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Cache Indicator */}
      <CacheIndicator isLoadingFromCache={isLoadingFromCache} onRefresh={() => loadStudents(true)} compact />

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={theme.colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search students..."
          value={filters.search}
          onChangeText={(text) => setFilters(prev => ({ ...prev, search: text }))}
          placeholderTextColor={theme.colors.textSecondary}
        />
      </View>

      {/* Students Summary */}
      <View style={styles.summaryContainer}>
        <Text style={styles.summaryText}>{filteredStudents.length} of {students.length} students</Text>
        {canManageStudent() && (
          <TouchableOpacity style={styles.addButton}>
            <Ionicons name="person-add" size={16} color={theme.colors.primary} />
            <Text style={styles.addButtonText}>Add Student</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Students List */}
      <FlashList
        data={filteredStudents}
        renderItem={renderStudentCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadStudents(true)} />}
        ListEmptyComponent={() => (loading ? null : <EmptyStudentsState />)}
        showsVerticalScrollIndicator={false}
        estimatedItemSize={100}
      />

      {/* Filter Modal */}
      <FilterModal
        visible={showFilters}
        filters={filters}
        onFiltersChange={setFilters}
        onClose={() => setShowFilters(false)}
        theme={theme}
      />

      {/* Student Detail Modal */}
      <StudentDetailModal
        visible={showStudentModal}
        student={selectedStudent}
        canManage={canManageStudent()}
        onClose={() => { setShowStudentModal(false); setSelectedStudent(null); }}
        onToggleStatus={toggleStudentStatus}
        onDelete={handleDeleteStudent}
        onPermanentDelete={handlePermanentDelete}
        theme={theme}
      />

      {actionMessage && (
        <View style={styles.operationOverlay} pointerEvents="auto">
          <View style={styles.operationCard}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.operationText}>{actionMessage}</Text>
          </View>
        </View>
      )}

      {/* Alert Modal */}
      <AlertModal
        visible={alertState.visible}
        title={alertState.title}
        message={alertState.message}
        type={alertState.type}
        buttons={alertState.buttons}
        onClose={hideAlert}
      />
    </SafeAreaView>
  );
}

// Create styles function that takes theme parameter
const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 60,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewToggle: {
    padding: 8,
  },
  filterButton: {
    padding: 8,
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#DC2626',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: theme.colors.text,
  },
  summaryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  summaryText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: theme.colors.primary + '20',
  },
  addButtonText: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  studentCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  studentHeader: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'flex-start',
  },
  studentPhotoContainer: {
    marginRight: 12,
  },
  studentPhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  studentPhotoPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentInfo: {
    flex: 1,
  },
  studentNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  studentDetails: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 2,
  },
  studentMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    flexWrap: 'wrap',
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 2,
  },
  metricText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginLeft: 4,
  },
  outstandingFees: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
  },
  studentActions: {
    flexDirection: 'column',
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },
  disabledAction: {
    opacity: 0.5,
  },
  operationOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  operationCard: {
    minWidth: 240,
    backgroundColor: theme.colors.surface || 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border || '#e2e8f0',
    paddingHorizontal: 20,
    paddingVertical: 18,
    alignItems: 'center',
  },
  operationText: {
    marginTop: 12,
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
  },
  filterSection: {
    padding: 20,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 12,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterOptionSelected: {
    backgroundColor: theme.colors.primary + '20',
    borderColor: theme.colors.primary,
  },
  filterOptionText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  filterOptionTextSelected: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  clearFiltersButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.textSecondary,
    alignItems: 'center',
  },
  clearFiltersText: {
    color: theme.colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  applyFiltersButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
  },
  applyFiltersText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  // Student Detail Modal styles
  studentDetailModal: {
    maxHeight: '90%',
  },
  studentDetailContent: {
    padding: 20,
  },
  studentDetailHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  studentPhotoLarge: {
    marginBottom: 12,
  },
  studentPhotoLargeImg: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  studentPhotoLargePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentDetailName: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 8,
  },
  studentDetailSection: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  studentDetailSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 12,
  },
  studentDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  studentDetailLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  studentDetailValue: {
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  studentDetailActions: {
    gap: 12,
    marginTop: 8,
  },
  studentDetailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  studentDetailButtonPrimary: {
    backgroundColor: '#059669',
  },
  studentDetailButtonWarning: {
    backgroundColor: '#EA580C',
  },
  studentDetailButtonDanger: {
    backgroundColor: '#DC2626',
  },
  studentDetailButtonTextWhite: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
