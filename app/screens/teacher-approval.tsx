/**
 * Teacher Approval Screen
 * 
 * Allows principals to review and approve teachers who have accepted invitations.
 * Integrates with seat management for proper teacher activation.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import {
  getPendingTeachers,
  approveTeacher,
  rejectTeacher,
  getApprovalStats,
  type PendingTeacher,
  type TeacherApprovalStats,
} from '@/lib/services/teacherApprovalService';

export default function TeacherApprovalScreen() {
  const { theme } = useTheme();
  const { user, profile } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  
  const [pendingTeachers, setPendingTeachers] = useState<PendingTeacher[]>([]);
  const [stats, setStats] = useState<TeacherApprovalStats>({ pending: 0, approved: 0, rejected: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [selectedTeacher, setSelectedTeacher] = useState<PendingTeacher | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  
  const organizationId = profile?.organization_id || profile?.preschool_id;
  
  const fetchData = useCallback(async () => {
    if (!organizationId) return;
    
    try {
      const [teachers, statsData] = await Promise.all([
        getPendingTeachers(organizationId),
        getApprovalStats(organizationId),
      ]);
      
      setPendingTeachers(teachers);
      setStats(statsData);
    } catch (err) {
      console.error('[TeacherApproval] Fetch error:', err);
      Alert.alert('Error', 'Failed to load pending teachers');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [organizationId]);
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);
  
  const handleApprove = async (teacher: PendingTeacher) => {
    if (!user?.id || !organizationId) return;
    
    Alert.alert(
      'Approve Teacher',
      `Approve ${teacher.first_name} ${teacher.last_name} as a teacher?\n\nThis will:\n• Assign a teacher seat\n• Grant teaching permissions\n• Send welcome notification`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            setProcessing(teacher.id);
            try {
              const result = await approveTeacher(
                teacher.user_id,
                organizationId,
                user.id,
                { assignSeat: true }
              );
              
              if (result.success) {
                Alert.alert('Success', result.message);
                fetchData();
              } else {
                Alert.alert('Error', result.message);
              }
            } catch (err) {
              console.error('[TeacherApproval] Approve error:', err);
              Alert.alert('Error', 'Failed to approve teacher');
            } finally {
              setProcessing(null);
            }
          },
        },
      ]
    );
  };
  
  const handleReject = async () => {
    if (!selectedTeacher || !user?.id || !organizationId) return;
    
    setProcessing(selectedTeacher.id);
    try {
      const result = await rejectTeacher(
        selectedTeacher.user_id,
        organizationId,
        user.id,
        rejectionReason || undefined
      );
      
      if (result.success) {
        Alert.alert('Rejected', 'Teacher application has been rejected');
        setShowRejectionModal(false);
        setSelectedTeacher(null);
        setRejectionReason('');
        fetchData();
      } else {
        Alert.alert('Error', result.message);
      }
    } catch (err) {
      console.error('[TeacherApproval] Reject error:', err);
      Alert.alert('Error', 'Failed to reject teacher');
    } finally {
      setProcessing(null);
    }
  };
  
  const openRejectionModal = (teacher: PendingTeacher) => {
    setSelectedTeacher(teacher);
    setRejectionReason('');
    setShowRejectionModal(true);
  };
  
  const renderTeacher = ({ item }: { item: PendingTeacher }) => {
    const initials = `${item.first_name?.[0] || ''}${item.last_name?.[0] || ''}`.toUpperCase();
    const isProcessing = processing === item.id;
    
    return (
      <View style={styles.teacherCard}>
        <View style={styles.cardHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials || '?'}</Text>
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.teacherName}>
              {item.first_name} {item.last_name}
            </Text>
            <Text style={styles.teacherEmail}>{item.email}</Text>
            {item.phone && (
              <Text style={styles.teacherPhone}>{item.phone}</Text>
            )}
          </View>
        </View>
        
        <View style={styles.cardMeta}>
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={14} color={theme.textSecondary} />
            <Text style={styles.metaText}>
              Applied: {new Date(item.requested_at).toLocaleDateString()}
            </Text>
          </View>
          {item.invite_accepted_at && (
            <View style={styles.metaRow}>
              <Ionicons name="checkmark-circle-outline" size={14} color="#10B981" />
              <Text style={styles.metaText}>
                Invite accepted: {new Date(item.invite_accepted_at).toLocaleDateString()}
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => openRejectionModal(item)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#EF4444" />
            ) : (
              <>
                <Ionicons name="close" size={18} color="#EF4444" />
                <Text style={[styles.actionButtonText, { color: '#EF4444' }]}>Reject</Text>
              </>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.approveButton]}
            onPress={() => handleApprove(item)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark" size={18} color="#fff" />
                <Text style={[styles.actionButtonText, { color: '#fff' }]}>Approve</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };
  
  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.loadingText}>Loading pending approvals...</Text>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header */}
      <LinearGradient
        colors={['#06B6D4', '#0891B2']}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Teacher Approvals</Text>
            <Text style={styles.headerSubtitle}>Review pending applications</Text>
          </View>
        </View>
        
        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.pending}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.approved}</Text>
            <Text style={styles.statLabel}>Approved</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.rejected}</Text>
            <Text style={styles.statLabel}>Rejected</Text>
          </View>
        </View>
      </LinearGradient>
      
      {/* List */}
      <FlatList
        data={pendingTeachers}
        keyExtractor={item => item.id}
        renderItem={renderTeacher}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color={theme.textSecondary} />
            <Text style={styles.emptyTitle}>No Pending Approvals</Text>
            <Text style={styles.emptyText}>
              Teachers who accept your invitations will appear here for approval.
            </Text>
            <TouchableOpacity
              style={styles.inviteButton}
              onPress={() => router.push('/screens/teacher-management')}
            >
              <Ionicons name="person-add" size={20} color="#fff" />
              <Text style={styles.inviteButtonText}>Invite Teachers</Text>
            </TouchableOpacity>
          </View>
        }
      />
      
      {/* Rejection Modal */}
      <Modal
        visible={showRejectionModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowRejectionModal(false)}
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Reject Application</Text>
            <TouchableOpacity onPress={() => setShowRejectionModal(false)}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            {selectedTeacher && (
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Teacher</Text>
                <Text style={styles.modalText}>
                  {selectedTeacher.first_name} {selectedTeacher.last_name}
                </Text>
                <Text style={styles.modalTextSecondary}>{selectedTeacher.email}</Text>
              </View>
            )}
            
            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>Reason (Optional)</Text>
              <TextInput
                style={styles.reasonInput}
                value={rejectionReason}
                onChangeText={setRejectionReason}
                placeholder="Enter reason for rejection..."
                placeholderTextColor={theme.textSecondary}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelModalButton}
                onPress={() => setShowRejectionModal(false)}
              >
                <Text style={styles.cancelModalButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.confirmRejectButton}
                onPress={handleReject}
                disabled={processing === selectedTeacher?.id}
              >
                {processing === selectedTeacher?.id ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="close-circle" size={20} color="#fff" />
                    <Text style={styles.confirmRejectButtonText}>Reject Application</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: theme.textSecondary,
    fontSize: 16,
  },
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
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  teacherCard: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#06B6D420',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#06B6D4',
  },
  cardInfo: {
    flex: 1,
  },
  teacherName: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.text,
  },
  teacherEmail: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 2,
  },
  teacherPhone: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 1,
  },
  cardMeta: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
  },
  rejectButton: {
    backgroundColor: '#EF444410',
    borderWidth: 1,
    borderColor: '#EF444430',
  },
  approveButton: {
    backgroundColor: '#10B981',
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.text,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#06B6D4',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 24,
  },
  inviteButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: theme.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.text,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalSection: {
    marginBottom: 24,
  },
  modalSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  modalText: {
    fontSize: 17,
    color: theme.text,
    fontWeight: '500',
  },
  modalTextSecondary: {
    fontSize: 15,
    color: theme.textSecondary,
    marginTop: 4,
  },
  reasonInput: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: theme.text,
    minHeight: 120,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  cancelModalButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  cancelModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  confirmRejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#EF4444',
  },
  confirmRejectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
