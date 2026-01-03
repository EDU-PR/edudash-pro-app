/**
 * OrganizationCard Component
 *
 * Reusable card component for displaying organization information.
 * Used in discover organizations and organization selection screens.
 *
 * @module components/organizations/OrganizationCard
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';

export interface OrganizationCardData {
  id: string;
  name: string;
  description?: string | null;
  logo_url?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  organization_type?: string | null;
  is_verified?: boolean | null;
}

export interface OrganizationCardProps {
  organization: OrganizationCardData;
  onPress?: () => void;
  actionLabel?: string;
  onAction?: () => void;
  status?: 'member' | 'pending' | null;
  disabled?: boolean;
  compact?: boolean;
}

export function OrganizationCard({
  organization,
  onPress,
  actionLabel,
  onAction,
  status,
  disabled,
  compact,
}: OrganizationCardProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme, compact), [theme, compact]);

  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container
      style={[styles.card, disabled && styles.cardDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        {organization.logo_url ? (
          <Image source={{ uri: organization.logo_url }} style={styles.logo} />
        ) : (
          <View style={styles.logoPlaceholder}>
            <Ionicons name="business" size={compact ? 24 : 32} color={theme?.textSecondary || '#888'} />
          </View>
        )}
        <View style={styles.headerInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {organization.name}
            </Text>
            {organization.is_verified && (
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={theme?.success || '#10b981'}
                style={styles.verifiedIcon}
              />
            )}
          </View>
          {organization.organization_type && (
            <Text style={styles.type}>{organization.organization_type}</Text>
          )}
        </View>
      </View>

      {!compact && organization.description && (
        <Text style={styles.description} numberOfLines={2}>
          {organization.description}
        </Text>
      )}

      {!compact && (organization.city || organization.province) && (
        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={14} color={theme?.textSecondary} />
          <Text style={styles.infoText}>
            {[organization.city, organization.province].filter(Boolean).join(', ')}
          </Text>
        </View>
      )}

      {(actionLabel || status) && (
        <View style={styles.footer}>
          {status === 'member' && (
            <View style={styles.statusBadge}>
              <Ionicons name="checkmark-circle" size={16} color={theme?.success || '#10b981'} />
              <Text style={[styles.statusText, { color: theme?.success || '#10b981' }]}>Member</Text>
            </View>
          )}
          {status === 'pending' && (
            <View style={styles.statusBadge}>
              <Ionicons name="time" size={16} color={theme?.warning || '#f59e0b'} />
              <Text style={[styles.statusText, { color: theme?.warning || '#f59e0b' }]}>Pending</Text>
            </View>
          )}
          {actionLabel && !status && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={onAction}
              disabled={disabled}
            >
              <Text style={styles.actionButtonText}>{actionLabel}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </Container>
  );
}

function createStyles(theme: any, compact?: boolean) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme?.card || '#1a1a2e',
      borderRadius: compact ? 12 : 16,
      padding: compact ? 12 : 16,
      marginVertical: compact ? 4 : 8,
      borderWidth: 1,
      borderColor: theme?.border || '#2a2a4a',
    },
    cardDisabled: {
      opacity: 0.6,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: compact ? 0 : 12,
    },
    logo: {
      width: compact ? 40 : 56,
      height: compact ? 40 : 56,
      borderRadius: compact ? 8 : 12,
      backgroundColor: theme?.border || '#2a2a4a',
    },
    logoPlaceholder: {
      width: compact ? 40 : 56,
      height: compact ? 40 : 56,
      borderRadius: compact ? 8 : 12,
      backgroundColor: theme?.border || '#2a2a4a',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerInfo: {
      flex: 1,
      marginLeft: 12,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    name: {
      fontSize: compact ? 15 : 18,
      fontWeight: '700',
      color: theme?.text || '#fff',
      flex: 1,
    },
    verifiedIcon: {
      marginLeft: 6,
    },
    type: {
      fontSize: compact ? 12 : 13,
      color: theme?.textSecondary || '#888',
      marginTop: 2,
      textTransform: 'capitalize',
    },
    description: {
      fontSize: 14,
      color: theme?.textSecondary || '#aaa',
      lineHeight: 20,
      marginBottom: 12,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    infoText: {
      fontSize: 13,
      color: theme?.textSecondary || '#888',
      marginLeft: 4,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      borderTopWidth: compact ? 0 : 1,
      borderTopColor: theme?.border || '#2a2a4a',
      paddingTop: compact ? 8 : 12,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    statusText: {
      fontSize: 14,
      fontWeight: '600',
      marginLeft: 6,
    },
    actionButton: {
      backgroundColor: theme?.primary || '#00f5ff',
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 8,
    },
    actionButtonText: {
      color: '#000',
      fontSize: 14,
      fontWeight: '700',
    },
  });
}

export default OrganizationCard;
