/**
 * HiringView Component
 * 
 * Displays available teachers and invitations for hiring.
 * Extracted from app/screens/teacher-management.tsx per WARP.md standards.
 */

import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TeacherInviteService } from '@/lib/services/teacherInviteService';
import type { AvailableTeacher, TeacherInvite } from '@/types/teacher-management';
import type { ThemeColors } from '@/contexts/ThemeContext';

interface HiringViewProps {
  availableTeachers: AvailableTeacher[];
  invites: TeacherInvite[];
  hiringSearch: string;
  radiusKm: number;
  loading: boolean;
  theme?: ThemeColors;
  userId?: string;
  preschoolId: string | null;
  onSearchChange: (search: string) => void;
  onRadiusChange: (km: number) => void;
  onRefresh: () => void;
  onLoadInvites: () => Promise<void>;
}

export function HiringView({
  availableTeachers,
  invites,
  hiringSearch,
  radiusKm,
  loading,
  theme,
  userId,
  preschoolId,
  onSearchChange,
  onRadiusChange,
  onRefresh,
  onLoadInvites,
}: HiringViewProps) {
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const handleInvite = async (teacher: AvailableTeacher) => {
    try {
      if (!preschoolId) return;
      if (!teacher.email) {
        Alert.alert('Missing email', 'This teacher profile has no email.');
        return;
      }
      await TeacherInviteService.createInvite({
        schoolId: preschoolId,
        email: teacher.email,
        invitedBy: userId || '',
      });
      await onLoadInvites();
      Alert.alert('Invite sent', `Invitation sent to ${teacher.email}`);
    } catch (_e) {
      console.error('Invite error:', _e);
      Alert.alert('Error', 'Failed to send invite.');
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    try {
      await TeacherInviteService.revoke(inviteId);
      await onLoadInvites();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to revoke invite';
      Alert.alert('Error', message);
    }
  };

  const renderAvailableTeacher = ({ item }: { item: AvailableTeacher }) => (
    <View style={styles.candidateCard}>
      <View style={styles.candidateHeader}>
        <View style={styles.candidateInfo}>
          <Text style={styles.candidateName}>{item.name}</Text>
          <Text style={styles.candidateEmail}>{item.email}</Text>
          <Text style={styles.candidateDetails}>
            {(item.home_city || 'Unknown city') +
              (item.home_postal_code ? ` • ${item.home_postal_code}` : '')}
            {item.distance_km !== undefined && ` • ${item.distance_km.toFixed(1)} km away`}
          </Text>
        </View>
        <TouchableOpacity style={styles.inviteButton} onPress={() => handleInvite(item)}>
          <Ionicons name="send" size={16} color="#fff" />
          <Text style={styles.inviteButtonText}>Invite</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderInvite = ({ item }: { item: TeacherInvite }) => (
    <View style={styles.candidateCard}>
      <View style={styles.candidateHeader}>
        <View style={styles.candidateInfo}>
          <Text style={styles.candidateName}>{item.email}</Text>
          <Text style={styles.candidateEmail}>Status: {item.status}</Text>
        </View>
        {item.status === 'pending' && (
          <TouchableOpacity style={styles.revokeButton} onPress={() => handleRevokeInvite(item.id)}>
            <Ionicons name="trash" size={18} color="#dc2626" />
            <Text style={styles.revokeButtonText}>Revoke</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Available teachers section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Available Teachers</Text>
        <Text style={styles.sectionSubtitle}>{availableTeachers.length} available</Text>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={theme?.textSecondary || '#666'} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, email, city or postal code..."
            value={hiringSearch}
            onChangeText={onSearchChange}
            onSubmitEditing={onRefresh}
          />
        </View>
        <View style={styles.radiusChips}>
          {[5, 10, 25].map((km) => (
            <TouchableOpacity
              key={km}
              style={[styles.radiusChip, radiusKm === km && styles.radiusChipActive]}
              onPress={() => onRadiusChange(km)}
            >
              <Text style={[styles.radiusChipText, radiusKm === km && styles.radiusChipTextActive]}>
                {km} km
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
          <Ionicons name="refresh" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={availableTeachers}
        keyExtractor={(i) => i.id}
        renderItem={renderAvailableTeacher}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={styles.emptyText}>No available teachers</Text>}
      />

      {/* Invites section */}
      <View style={[styles.sectionHeader, { marginTop: 16 }]}>
        <Text style={styles.sectionTitle}>Invitations</Text>
        <Text style={styles.sectionSubtitle}>{invites.length} invites</Text>
      </View>

      <FlatList
        data={invites}
        keyExtractor={(i) => i.id}
        renderItem={renderInvite}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<Text style={styles.emptyText}>No pending invitations</Text>}
      />
    </View>
  );
}

const createStyles = (theme?: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 16,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
      marginTop: 8,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme?.text || '#111827',
    },
    sectionSubtitle: {
      fontSize: 14,
      color: theme?.textSecondary || '#6b7280',
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      gap: 8,
    },
    searchBox: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme?.inputBackground || '#f9fafb',
      borderWidth: 1,
      borderColor: theme?.inputBorder || '#d1d5db',
      borderRadius: 12,
      paddingHorizontal: 12,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 10,
      fontSize: 14,
      color: theme?.inputText || '#111827',
    },
    radiusChips: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    radiusChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme?.border || '#334155',
      backgroundColor: theme?.surface || '#0f172a',
    },
    radiusChipActive: {
      backgroundColor: '#4F46E5',
      borderColor: '#4F46E5',
    },
    radiusChipText: {
      color: theme?.textSecondary || '#9ca3af',
      fontWeight: '700',
      fontSize: 12,
    },
    radiusChipTextActive: {
      color: '#fff',
      fontWeight: '800',
    },
    refreshButton: {
      backgroundColor: theme?.primary || '#4F46E5',
      padding: 10,
      borderRadius: 12,
    },
    listContent: {
      paddingBottom: 16,
    },
    candidateCard: {
      backgroundColor: theme?.cardBackground || 'white',
      borderRadius: 12,
      padding: 16,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme?.border || '#f3f4f6',
    },
    candidateHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    candidateInfo: {
      flex: 1,
    },
    candidateName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme?.text || '#111827',
      marginBottom: 2,
    },
    candidateEmail: {
      fontSize: 13,
      color: theme?.textSecondary || '#6b7280',
      marginBottom: 2,
    },
    candidateDetails: {
      fontSize: 12,
      color: theme?.textSecondary || '#9ca3af',
    },
    inviteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#4F46E5',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      gap: 6,
    },
    inviteButtonText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 13,
    },
    revokeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: '#fee2e2',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 12,
    },
    revokeButtonText: {
      color: '#dc2626',
      fontWeight: '700',
      fontSize: 13,
    },
    emptyText: {
      fontSize: 14,
      color: theme?.textSecondary || '#6b7280',
      textAlign: 'center',
      paddingVertical: 24,
    },
  });

export default HiringView;
