/**
 * Campaign Card Component
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { 
  Campaign, 
  CAMPAIGN_TYPE_LABELS, 
  getDiscountDisplayText 
} from './types';

interface CampaignCardProps {
  campaign: Campaign;
  theme: any;
  isDark: boolean;
  onPress: () => void;
  onToggleStatus: () => void;
  onShare: () => void;
  onDelete: () => void;
  onTestConversion: () => void;
}

export function CampaignCard({
  campaign,
  theme,
  isDark,
  onPress,
  onToggleStatus,
  onShare,
  onDelete,
  onTestConversion,
}: CampaignCardProps) {
  const typeInfo = CAMPAIGN_TYPE_LABELS[campaign.campaign_type];
  const isExpired = new Date(campaign.end_date) < new Date();

  return (
    <TouchableOpacity
      style={[styles.campaignCard, { backgroundColor: theme.surface }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={[styles.typeIcon, { backgroundColor: typeInfo.color + '20' }]}>
          <Ionicons name={typeInfo.icon as any} size={20} color={typeInfo.color} />
        </View>
        <View style={styles.cardHeaderText}>
          <Text style={[styles.campaignName, { color: theme.text }]} numberOfLines={1}>
            {campaign.name}
          </Text>
          <Text style={[styles.campaignType, { color: typeInfo.color }]}>
            {typeInfo.label}
          </Text>
        </View>
        <View style={styles.statusBadge}>
          {isExpired ? (
            <View style={[styles.badge, { backgroundColor: '#ef4444' }]}>
              <Text style={styles.badgeText}>Expired</Text>
            </View>
          ) : campaign.active ? (
            <View style={[styles.badge, { backgroundColor: '#22c55e' }]}>
              <Text style={styles.badgeText}>Active</Text>
            </View>
          ) : (
            <View style={[styles.badge, { backgroundColor: isDark ? '#4b5563' : theme.muted }]}>
              <Text style={styles.badgeText}>Paused</Text>
            </View>
          )}
        </View>
      </View>

      {/* Discount Info */}
      <View style={styles.discountInfo}>
        <Ionicons name="pricetag" size={16} color={theme.primary} />
        <Text style={[styles.discountText, { color: theme.text }]}>
          {getDiscountDisplayText(campaign)}
        </Text>
        {campaign.promo_code && (
          <View style={[styles.promoCodeBadge, { backgroundColor: theme.primary + '20' }]}>
            <Text style={[styles.promoCodeText, { color: theme.primary }]}>
              {campaign.promo_code}
            </Text>
          </View>
        )}
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Ionicons name="eye-outline" size={14} color={theme.muted} />
          <Text style={[styles.statText, { color: theme.muted }]}>
            {campaign.views_count} views
          </Text>
        </View>
        <View style={styles.stat}>
          <Ionicons 
            name="checkmark-circle-outline" 
            size={14} 
            color={campaign.current_redemptions > 0 ? '#22c55e' : theme.muted} 
          />
          <Text style={[styles.statText, { color: campaign.current_redemptions > 0 ? '#22c55e' : theme.muted }]}>
            {campaign.current_redemptions}
            {campaign.max_redemptions ? `/${campaign.max_redemptions}` : ''} used
          </Text>
        </View>
        <TouchableOpacity 
          style={styles.stat} 
          onPress={onTestConversion}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons 
            name="trending-up-outline" 
            size={14} 
            color={campaign.conversions_count > 0 ? '#3b82f6' : theme.muted} 
          />
          <Text style={[styles.statText, { color: campaign.conversions_count > 0 ? '#3b82f6' : theme.muted }]}>
            {campaign.conversions_count} conversions
          </Text>
          <Ionicons name="add-circle-outline" size={12} color={theme.muted} style={{ marginLeft: 4 }} />
        </TouchableOpacity>
      </View>

      {/* Actions */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.actionButton, { borderColor: theme.border }]}
          onPress={onToggleStatus}
        >
          <Ionicons
            name={campaign.active ? 'pause' : 'play'}
            size={16}
            color={campaign.active ? '#f59e0b' : '#22c55e'}
          />
          <Text style={[styles.actionButtonText, { color: campaign.active ? '#f59e0b' : '#22c55e' }]}>
            {campaign.active ? 'Pause' : 'Activate'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.shareButton]}
          onPress={onShare}
        >
          <Ionicons name="share-social" size={16} color="#3b82f6" />
          <Text style={[styles.actionButtonText, { color: '#3b82f6' }]}>
            Share
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, { borderColor: '#ef4444' }]}
          onPress={onDelete}
        >
          <Ionicons name="trash-outline" size={16} color="#ef4444" />
          <Text style={[styles.actionButtonText, { color: '#ef4444' }]}>
            Delete
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  campaignCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: {
    flex: 1,
    marginLeft: 12,
  },
  campaignName: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  campaignType: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 3,
  },
  statusBadge: {
    marginLeft: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  discountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.2)',
  },
  discountText: {
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  promoCodeBadge: {
    marginLeft: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  promoCodeText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 16,
    flexWrap: 'wrap',
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    marginTop: 14,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  shareButton: {
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
});
