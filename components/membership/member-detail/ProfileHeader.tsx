/**
 * Profile Header Component
 * Member profile header with avatar, badges, and dates
 */
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { MEMBER_TYPE_LABELS, STATUS_COLORS, MEMBERSHIP_TIER_LABELS } from '@/components/membership/types';
import type { ProfileHeaderProps } from './types';

export function ProfileHeader({ member, theme }: ProfileHeaderProps) {
  const initials = `${member.first_name?.[0] || '?'}${member.last_name?.[0] || ''}`.toUpperCase();
  const statusColor = STATUS_COLORS[member.membership_status] || STATUS_COLORS.pending;

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <LinearGradient
      colors={[theme.primary, theme.primary + 'CC']}
      style={styles.profileHeader}
    >
      <View style={styles.avatarContainer}>
        {member.photo_url ? (
          <Image source={{ uri: member.photo_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        )}
        <View style={[styles.statusIndicator, { backgroundColor: statusColor }]} />
      </View>
      
      <Text style={styles.profileName}>{member.first_name} {member.last_name}</Text>
      <Text style={styles.profileNumber}>{member.member_number}</Text>
      
      <View style={styles.profileBadges}>
        <View style={styles.profileBadge}>
          <Ionicons name="ribbon-outline" size={14} color="#fff" />
          <Text style={styles.profileBadgeText}>{MEMBER_TYPE_LABELS[member.member_type]}</Text>
        </View>
        <View style={styles.profileBadge}>
          <Ionicons name="star-outline" size={14} color="#fff" />
          <Text style={styles.profileBadgeText}>{MEMBERSHIP_TIER_LABELS[member.membership_tier]}</Text>
        </View>
        <View style={styles.profileBadge}>
          <Ionicons name="location-outline" size={14} color="#fff" />
          <Text style={styles.profileBadgeText}>{member.region?.name || member.province}</Text>
        </View>
      </View>
      
      <View style={styles.membershipDates}>
        <View style={styles.dateItem}>
          <Text style={styles.dateLabel}>Joined</Text>
          <Text style={styles.dateValue}>{formatDate(member.joined_date)}</Text>
        </View>
        <View style={styles.dateDivider} />
        <View style={styles.dateItem}>
          <Text style={styles.dateLabel}>Expires</Text>
          <Text style={styles.dateValue}>{member.expiry_date ? formatDate(member.expiry_date) : 'N/A'}</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  profileHeader: {
    paddingTop: 24,
    paddingBottom: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
  },
  statusIndicator: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#fff',
  },
  profileName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  profileNumber: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 16,
  },
  profileBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  profileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  profileBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  membershipDates: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  dateItem: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  dateLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 2,
  },
  dateValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  dateDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
});
