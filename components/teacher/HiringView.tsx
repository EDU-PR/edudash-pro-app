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
  Share,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { TeacherInviteService } from '@/lib/services/teacherInviteService';
import * as Clipboard from 'expo-clipboard';
import { buildTeacherInviteLink, buildTeacherInviteMessage } from '@/lib/utils/teacherInviteLink';
import { useAlertModal } from '@/components/ui/AlertModal';
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
  schoolName?: string | null;
  inviterName?: string | null;
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
  schoolName,
  inviterName,
}: HiringViewProps) {
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const { showAlert } = useAlertModal();

  const openShareOptions = async (inviteToken: string, inviteEmail: string) => {
    const message = buildTeacherInviteMessage({
      token: inviteToken,
      email: inviteEmail,
      schoolName,
      inviterName,
      roleLabel: 'teacher',
    });
    const inviteLink = buildTeacherInviteLink(inviteToken, inviteEmail);

    const openWhatsApp = async () => {
      const url = `whatsapp://send?text=${encodeURIComponent(message)}`;
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        showAlert({
          title: 'WhatsApp Not Available',
          message: 'Install WhatsApp to use this option.',
          type: 'warning',
        });
        return;
      }
      await Linking.openURL(url);
    };

    const openSms = async () => {
      const url = `sms:?body=${encodeURIComponent(message)}`;
      await Linking.openURL(url);
    };

    const openEmail = async () => {
      const subject = encodeURIComponent(`EduDash Pro Teacher Invite`);
      const body = encodeURIComponent(message);
      const url = `mailto:${inviteEmail}?subject=${subject}&body=${body}`;
      await Linking.openURL(url);
    };

    const copyLink = async () => {
      await Clipboard.setStringAsync(inviteLink);
      showAlert({
        title: 'Copied',
        message: 'Invite link copied to clipboard.',
        type: 'success',
      });
    };

    const shareGeneric = async () => {
      await Share.share({ message, url: inviteLink });
    };

    showAlert({
      title: 'Invite Ready',
      message: `Choose how you want to send the invite.\n\nInvite token: ${inviteToken}\nLink: ${inviteLink}`,
      type: 'info',
      buttons: [
        { text: 'Share', onPress: () => void shareGeneric() },
        { text: 'WhatsApp', onPress: () => void openWhatsApp() },
        { text: 'SMS', onPress: () => void openSms() },
        { text: 'Email', onPress: () => void openEmail() },
        { text: 'Copy Link', onPress: () => void copyLink() },
        { text: 'Close', style: 'cancel' },
      ],
    });
  };

  const handleInvite = async (teacher: AvailableTeacher) => {
    try {
      if (!preschoolId) return;
      if (!teacher.email) {
        showAlert({
          title: 'Missing Email',
          message: 'This teacher profile has no email.',
          type: 'warning',
        });
        return;
      }
      const invite = await TeacherInviteService.createInvite({
        schoolId: preschoolId,
        email: teacher.email,
        invitedBy: userId || '',
      });
      await onLoadInvites();
      await openShareOptions(invite.token, teacher.email);
    } catch (_e) {
      console.error('Invite error:', _e);
      showAlert({
        title: 'Error',
        message: 'Failed to send invite.',
        type: 'error',
      });
    }
  };

  const handleViewReferences = (teacher: AvailableTeacher) => {
    if (!teacher.id) return;
    router.push({
      pathname: '/screens/teacher-references',
      params: { teacherUserId: teacher.id },
    });
  };

  const renderRatingStars = (rating?: number | null) => {
    if (!rating) return null;
    const rounded = Math.round(rating);
    return (
      <View style={styles.ratingStars}>
        {Array.from({ length: 5 }).map((_, idx) => (
          <Ionicons
            key={idx}
            name={idx + 1 <= rounded ? 'star' : 'star-outline'}
            size={14}
            color={idx + 1 <= rounded ? '#F59E0B' : '#D1D5DB'}
          />
        ))}
      </View>
    );
  };

  const handleRevokeInvite = async (inviteId: string) => {
    try {
      await TeacherInviteService.revoke(inviteId);
      await onLoadInvites();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to revoke invite';
      showAlert({
        title: 'Error',
        message,
        type: 'error',
      });
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
          {item.rating_average ? (
            <View style={styles.ratingRow}>
              {renderRatingStars(item.rating_average)}
              <Text style={styles.ratingText}>
                {item.rating_average.toFixed(1)}
                {item.rating_count ? ` (${item.rating_count})` : ''}
              </Text>
            </View>
          ) : (
            <Text style={styles.ratingEmpty}>No ratings yet</Text>
          )}
        </View>
        <TouchableOpacity style={styles.inviteButton} onPress={() => handleInvite(item)}>
          <Ionicons name="send" size={16} color="#fff" />
          <Text style={styles.inviteButtonText}>Invite</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.referencesButton} onPress={() => handleViewReferences(item)}>
        <Ionicons name="star-outline" size={16} color="#0f172a" />
        <Text style={styles.referencesText}>View References</Text>
      </TouchableOpacity>
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
      {item.status === 'pending' && (
        <View style={styles.inviteActionsRow}>
          <TouchableOpacity
            style={[styles.inviteActionButton, { backgroundColor: '#4F46E5' + '15' }]}
            onPress={() => openShareOptions(item.token, item.email)}
          >
            <Ionicons name="send" size={16} color="#4F46E5" />
            <Text style={[styles.inviteActionText, { color: '#4F46E5' }]}>Share Invite</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.inviteActionButton, { backgroundColor: '#0EA5E9' + '15' }]}
            onPress={async () => {
              const link = buildTeacherInviteLink(item.token, item.email);
              await Clipboard.setStringAsync(link);
              showAlert({
                title: 'Link Copied',
                message: 'Invite link copied to clipboard.',
                type: 'success',
              });
            }}
          >
            <Ionicons name="link-outline" size={16} color="#0EA5E9" />
            <Text style={[styles.inviteActionText, { color: '#0EA5E9' }]}>Copy Link</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.inviteActionButton, { backgroundColor: '#10B981' + '15' }]}
            onPress={async () => {
              await Clipboard.setStringAsync(item.token);
              showAlert({
                title: 'Token Copied',
                message: 'Invite token copied to clipboard.',
                type: 'success',
              });
            }}
          >
            <Ionicons name="key-outline" size={16} color="#10B981" />
            <Text style={[styles.inviteActionText, { color: '#10B981' }]}>Copy Token</Text>
          </TouchableOpacity>
        </View>
      )}
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
    ratingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 6,
    },
    ratingStars: {
      flexDirection: 'row',
      marginRight: 6,
    },
    ratingText: {
      color: theme?.text || '#0f172a',
      fontSize: 12,
      fontWeight: '600',
    },
    ratingEmpty: {
      color: theme?.textSecondary || '#94a3b8',
      fontSize: 12,
      marginTop: 6,
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
    referencesButton: {
      marginTop: 12,
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: '#F1F5F9',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
    },
    referencesText: {
      color: '#0f172a',
      fontSize: 12,
      fontWeight: '600',
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
    inviteActionsRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 12,
      flexWrap: 'wrap',
    },
    inviteActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
    },
    inviteActionText: {
      fontSize: 12,
      fontWeight: '700',
    },
    emptyText: {
      fontSize: 14,
      color: theme?.textSecondary || '#6b7280',
      textAlign: 'center',
      paddingVertical: 24,
    },
  });

export default HiringView;
