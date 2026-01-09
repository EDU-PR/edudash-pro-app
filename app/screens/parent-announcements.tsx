/**
 * Parent Announcements Screen
 * 
 * Displays school announcements for parents, matching web functionality.
 * Shows announcements from all preschools where the parent has children enrolled.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

interface Announcement {
  id: string;
  preschool_id: string;
  title: string;
  content: string;
  author_id: string;
  target_audience: 'all' | 'teachers' | 'parents' | 'students';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  is_published: boolean;
  published_at: string;
  expires_at: string | null;
  created_at: string;
  preschool?: {
    name: string;
  };
}

type PriorityFilter = 'all' | 'urgent' | 'high' | 'medium' | 'low';

export default function ParentAnnouncementsScreen() {
  const { theme } = useTheme();
  const { user, profile } = useAuth();
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');

  // Fetch announcements
  const { data: announcements = [], isLoading, refetch, isRefreshing } = useQuery({
    queryKey: ['parent-announcements', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const supabase = assertSupabase();

      // Get user's children to find their preschools
      const { data: children } = await supabase
        .from('students')
        .select('preschool_id')
        .eq('parent_id', user.id);

      if (!children || children.length === 0) {
        return [];
      }

      const preschoolIds = [...new Set(children.map((c: any) => c.preschool_id).filter(Boolean))];

      if (preschoolIds.length === 0) {
        return [];
      }

      // Get announcements for these preschools
      const { data, error } = await supabase
        .from('announcements')
        .select(`
          *,
          preschool:preschools(name)
        `)
        .in('preschool_id', preschoolIds)
        .in('target_audience', ['all', 'parents'])
        .eq('is_published', true)
        .or(`expires_at.is.null,expires_at.gte.${new Date().toISOString()}`)
        .order('priority', { ascending: false })
        .order('published_at', { ascending: false });

      if (error) {
        console.error('[ParentAnnouncements] Error:', error);
        return [];
      }

      return (data || []) as Announcement[];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'urgent':
        return theme.error || '#EF4444';
      case 'high':
        return theme.warning || '#F59E0B';
      case 'medium':
        return theme.primary || '#3B82F6';
      case 'low':
        return theme.textSecondary || '#6B7280';
      default:
        return theme.textSecondary || '#6B7280';
    }
  };

  const getPriorityLabel = (priority: string): string => {
    return priority.charAt(0).toUpperCase() + priority.slice(1);
  };

  const filteredAnnouncements = announcements.filter((announcement) => {
    if (priorityFilter === 'all') return true;
    return announcement.priority === priorityFilter;
  });

  const urgentCount = announcements.filter((a) => a.priority === 'urgent').length;
  const highCount = announcements.filter((a) => a.priority === 'high').length;
  const mediumCount = announcements.filter((a) => a.priority === 'medium').length;
  const lowCount = announcements.filter((a) => a.priority === 'low').length;

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const renderAnnouncement = ({ item }: { item: Announcement }) => {
    const priorityColor = getPriorityColor(item.priority);

    return (
      <View
        style={[
          styles.announcementCard,
          {
            backgroundColor: theme.surface,
            borderLeftColor: priorityColor,
            borderLeftWidth: 4,
          },
        ]}
      >
        {/* Header */}
        <View style={styles.announcementHeader}>
          <View style={styles.headerLeft}>
            <View
              style={[
                styles.priorityBadge,
                {
                  backgroundColor: priorityColor,
                },
              ]}
            >
              <Text style={styles.priorityBadgeText}>{getPriorityLabel(item.priority)}</Text>
            </View>
            {item.preschool && (
              <Text style={[styles.preschoolName, { color: theme.textSecondary }]}>
                {item.preschool.name}
              </Text>
            )}
          </View>
          <Ionicons name="megaphone" size={24} color={priorityColor} />
        </View>

        {/* Title */}
        <Text style={[styles.announcementTitle, { color: theme.text }]}>{item.title}</Text>

        {/* Content */}
        <Text style={[styles.announcementContent, { color: theme.textSecondary }]} numberOfLines={4}>
          {item.content}
        </Text>

        {/* Footer */}
        <View style={[styles.announcementFooter, { borderTopColor: theme.border }]}>
          <View style={styles.footerLeft}>
            <Ionicons name="time-outline" size={14} color={theme.textSecondary} />
            <Text style={[styles.footerText, { color: theme.textSecondary }]}>
              {formatDate(item.published_at)}
            </Text>
          </View>
          {item.expires_at && (
            <Text style={[styles.footerText, { color: theme.textSecondary }]}>
              Expires: {new Date(item.expires_at).toLocaleDateString('en-ZA')}
            </Text>
          )}
        </View>
      </View>
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    content: {
      flex: 1,
    },
    header: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.text,
    },
    headerSubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 4,
    },
    filtersContainer: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    filtersScroll: {
      flexDirection: 'row',
      gap: 8,
    },
    filterButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      minWidth: 80,
      alignItems: 'center',
    },
    filterButtonActive: {
      borderWidth: 0,
    },
    filterButtonText: {
      fontSize: 14,
      fontWeight: '600',
    },
    listContent: {
      padding: 16,
      gap: 16,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
    },
    emptyIcon: {
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
    },
    announcementCard: {
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    announcementHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    headerLeft: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },
    priorityBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
    },
    priorityBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    preschoolName: {
      fontSize: 13,
    },
    announcementTitle: {
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 8,
    },
    announcementContent: {
      fontSize: 15,
      lineHeight: 22,
      marginBottom: 12,
    },
    announcementFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 12,
      borderTopWidth: 1,
      flexWrap: 'wrap',
      gap: 8,
    },
    footerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    footerText: {
      fontSize: 13,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingText: {
      marginTop: 12,
      fontSize: 14,
      color: theme.textSecondary,
    },
  });

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: 'Announcements',
          headerStyle: { backgroundColor: theme.surface },
          headerTitleStyle: { color: theme.text },
          headerTintColor: theme.primary,
        }}
      />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>School Announcements</Text>
          <Text style={styles.headerSubtitle}>
            Important updates and news from your child's school
          </Text>
        </View>

        {/* Priority Filter Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersScroll}
          style={styles.filtersContainer}
        >
          <TouchableOpacity
            style={[
              styles.filterButton,
              {
                backgroundColor: priorityFilter === 'all' ? theme.primary : 'transparent',
                borderColor: priorityFilter === 'all' ? theme.primary : theme.border,
              },
              priorityFilter === 'all' && styles.filterButtonActive,
            ]}
            onPress={() => setPriorityFilter('all')}
          >
            <Text
              style={[
                styles.filterButtonText,
                {
                  color: priorityFilter === 'all' ? '#FFFFFF' : theme.text,
                },
              ]}
            >
              All ({announcements.length})
            </Text>
          </TouchableOpacity>
          {urgentCount > 0 && (
            <TouchableOpacity
              style={[
                styles.filterButton,
                {
                  backgroundColor: priorityFilter === 'urgent' ? theme.error : 'transparent',
                  borderColor: priorityFilter === 'urgent' ? theme.error : theme.border,
                },
                priorityFilter === 'urgent' && styles.filterButtonActive,
              ]}
              onPress={() => setPriorityFilter('urgent')}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  {
                    color: priorityFilter === 'urgent' ? '#FFFFFF' : theme.text,
                  },
                ]}
              >
                Urgent ({urgentCount})
              </Text>
            </TouchableOpacity>
          )}
          {highCount > 0 && (
            <TouchableOpacity
              style={[
                styles.filterButton,
                {
                  backgroundColor: priorityFilter === 'high' ? theme.warning : 'transparent',
                  borderColor: priorityFilter === 'high' ? theme.warning : theme.border,
                },
                priorityFilter === 'high' && styles.filterButtonActive,
              ]}
              onPress={() => setPriorityFilter('high')}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  {
                    color: priorityFilter === 'high' ? '#FFFFFF' : theme.text,
                  },
                ]}
              >
                High ({highCount})
              </Text>
            </TouchableOpacity>
          )}
          {mediumCount > 0 && (
            <TouchableOpacity
              style={[
                styles.filterButton,
                {
                  backgroundColor: priorityFilter === 'medium' ? theme.primary : 'transparent',
                  borderColor: priorityFilter === 'medium' ? theme.primary : theme.border,
                },
                priorityFilter === 'medium' && styles.filterButtonActive,
              ]}
              onPress={() => setPriorityFilter('medium')}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  {
                    color: priorityFilter === 'medium' ? '#FFFFFF' : theme.text,
                  },
                ]}
              >
                Medium ({mediumCount})
              </Text>
            </TouchableOpacity>
          )}
          {lowCount > 0 && (
            <TouchableOpacity
              style={[
                styles.filterButton,
                {
                  backgroundColor: priorityFilter === 'low' ? theme.textSecondary : 'transparent',
                  borderColor: priorityFilter === 'low' ? theme.textSecondary : theme.border,
                },
                priorityFilter === 'low' && styles.filterButtonActive,
              ]}
              onPress={() => setPriorityFilter('low')}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  {
                    color: priorityFilter === 'low' ? '#FFFFFF' : theme.text,
                  },
                ]}
              >
                Low ({lowCount})
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* List */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={styles.loadingText}>Loading announcements...</Text>
          </View>
        ) : filteredAnnouncements.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons
              name="megaphone-outline"
              size={64}
              color={theme.textSecondary}
              style={styles.emptyIcon}
            />
            <Text style={styles.emptyTitle}>No announcements</Text>
            <Text style={styles.emptyText}>
              {priorityFilter === 'all'
                ? 'There are no announcements from your school at this time.'
                : `No ${priorityFilter} priority announcements found.`}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredAnnouncements}
            renderItem={renderAnnouncement}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={() => refetch()}
                tintColor={theme.primary}
              />
            }
            showsVerticalScrollIndicator={false}
          />
        )}
      </SafeAreaView>
    </View>
  );
}
