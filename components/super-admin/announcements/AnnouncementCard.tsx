/**
 * Announcement Card Component
 */

import React from 'react';
import { StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PlatformAnnouncement } from './types';
import { formatDate, getTypeColor, getPriorityColor, getTypeIcon } from './utils';

interface AnnouncementCardProps {
  announcement: PlatformAnnouncement;
  theme: any;
  onEdit: () => void;
  onDelete: () => void;
  onToggleStatus: () => void;
}

export function AnnouncementCard({
  announcement,
  theme,
  onEdit,
  onDelete,
  onToggleStatus,
}: AnnouncementCardProps) {
  return (
    <View style={styles.announcementCard}>
      <View style={styles.announcementHeader}>
        <View style={styles.announcementInfo}>
          <View style={[styles.typeIcon, { backgroundColor: getTypeColor(announcement.type) + '20' }]}>
            <Ionicons 
              name={getTypeIcon(announcement.type) as any} 
              size={20} 
              color={getTypeColor(announcement.type)} 
            />
          </View>
          <View style={styles.announcementDetails}>
            <Text style={styles.announcementTitle} numberOfLines={1}>
              {announcement.title}
            </Text>
            <Text style={styles.announcementMeta}>
              {announcement.target_audience} • {formatDate(announcement.created_at)}
            </Text>
          </View>
        </View>
        
        <View style={styles.announcementActions}>
          <Switch
            value={announcement.is_active}
            onValueChange={onToggleStatus}
            trackColor={{ false: theme.border, true: theme.primary + '40' }}
            thumbColor={announcement.is_active ? theme.primary : theme.textTertiary}
            style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
          />
        </View>
      </View>

      <Text style={styles.announcementContent} numberOfLines={2}>
        {announcement.content}
      </Text>

      <View style={styles.announcementFooter}>
        <View style={styles.announcementBadges}>
          <View style={[
            styles.typeBadge, 
            { backgroundColor: getTypeColor(announcement.type) + '20', borderColor: getTypeColor(announcement.type) }
          ]}>
            <Text style={[styles.typeBadgeText, { color: getTypeColor(announcement.type) }]}>
              {announcement.type.toUpperCase()}
            </Text>
          </View>
          
          <View style={[
            styles.priorityBadge, 
            { backgroundColor: getPriorityColor(announcement.priority) + '20', borderColor: getPriorityColor(announcement.priority) }
          ]}>
            <Text style={[styles.priorityBadgeText, { color: getPriorityColor(announcement.priority) }]}>
              {announcement.priority.toUpperCase()}
            </Text>
          </View>

          {announcement.is_pinned && (
            <View style={styles.pinnedBadge}>
              <Ionicons name="pin" size={12} color={theme.warning} />
              <Text style={styles.pinnedBadgeText}>PINNED</Text>
            </View>
          )}

          {announcement.show_banner && (
            <View style={styles.bannerBadge}>
              <Ionicons name="megaphone" size={12} color={theme.accent} />
              <Text style={styles.bannerBadgeText}>BANNER</Text>
            </View>
          )}
        </View>

        <View style={styles.announcementStats}>
          <Ionicons name="eye" size={12} color="#9ca3af" />
          <Ionicons name="hand-left" size={12} color="#9ca3af" />
        </View>
      </View>

      {announcement.expires_at && (
        <View style={styles.expiryInfo}>
          <Ionicons name="time" size={12} color={theme.warning} />
          <Text style={styles.expiryText}>
            Expires: {formatDate(announcement.expires_at)}
          </Text>
        </View>
      )}

      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.actionButton} onPress={onEdit}>
          <Ionicons name="create" size={16} color={theme.primary} />
          <Text style={styles.actionButtonText}>Edit</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.actionButton, styles.deleteButton]} onPress={onDelete}>
          <Ionicons name="trash" size={16} color={theme.error} />
          <Text style={[styles.actionButtonText, { color: theme.error }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  announcementCard: {
    backgroundColor: '#1f2937',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  announcementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  announcementInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  typeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  announcementDetails: {
    flex: 1,
  },
  announcementTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  announcementMeta: {
    color: '#9ca3af',
    fontSize: 12,
  },
  announcementActions: {
    alignItems: 'center',
  },
  announcementContent: {
    color: '#d1d5db',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  announcementFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  announcementBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  priorityBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  pinnedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: '#f59e0b20',
    gap: 2,
  },
  pinnedBadgeText: {
    color: '#f59e0b',
    fontSize: 9,
    fontWeight: '600',
  },
  bannerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: '#8b5cf620',
    gap: 2,
  },
  bannerBadgeText: {
    color: '#8b5cf6',
    fontSize: 9,
    fontWeight: '600',
  },
  announcementStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  expiryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  expiryText: {
    color: '#f59e0b',
    fontSize: 11,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#374151',
    gap: 4,
  },
  deleteButton: {
    backgroundColor: '#7f1d1d20',
  },
  actionButtonText: {
    color: '#00f5ff',
    fontSize: 12,
    fontWeight: '500',
  },
});
