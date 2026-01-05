/**
 * DailyActivityFeed Component
 * 
 * Displays daily activities for a child's class to parents.
 * Shows what activities were done today, materials used, and learning objectives.
 * 
 * Features:
 * - Real-time updates via Supabase subscription
 * - Activity timeline with icons and colors
 * - Expandable activity details
 * - Empty state for days with no activities logged
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { assertSupabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { formatTime } from '@/lib/utils/dateUtils';

interface DailyActivity {
  id: string;
  activity_name: string;
  description?: string;
  activity_date: string;
  start_time?: string;
  end_time?: string;
  materials_needed?: string[];
  learning_objectives?: string[];
  notes?: string;
  created_by: string;
  teacher_name?: string;
}

interface DailyActivityFeedProps {
  classId?: string;
  studentId?: string;
  date?: Date;
  maxItems?: number;
  showHeader?: boolean;
  onActivityPress?: (activity: DailyActivity) => void;
}

// Activity type icons and colors
const getActivityIcon = (name: string): { icon: string; color: string } => {
  const nameLower = name.toLowerCase();
  if (nameLower.includes('art') || nameLower.includes('craft') || nameLower.includes('paint')) {
    return { icon: 'color-palette', color: '#EC4899' };
  }
  if (nameLower.includes('music') || nameLower.includes('song') || nameLower.includes('sing')) {
    return { icon: 'musical-notes', color: '#8B5CF6' };
  }
  if (nameLower.includes('story') || nameLower.includes('read') || nameLower.includes('book')) {
    return { icon: 'book', color: '#3B82F6' };
  }
  if (nameLower.includes('play') || nameLower.includes('game') || nameLower.includes('outdoor')) {
    return { icon: 'basketball', color: '#10B981' };
  }
  if (nameLower.includes('math') || nameLower.includes('count') || nameLower.includes('number')) {
    return { icon: 'calculator', color: '#F59E0B' };
  }
  if (nameLower.includes('science') || nameLower.includes('experiment') || nameLower.includes('nature')) {
    return { icon: 'flask', color: '#06B6D4' };
  }
  if (nameLower.includes('lunch') || nameLower.includes('snack') || nameLower.includes('meal')) {
    return { icon: 'restaurant', color: '#EF4444' };
  }
  if (nameLower.includes('nap') || nameLower.includes('rest') || nameLower.includes('sleep')) {
    return { icon: 'moon', color: '#6366F1' };
  }
  return { icon: 'star', color: '#F59E0B' };
};

export function DailyActivityFeed({
  classId,
  studentId,
  date = new Date(),
  maxItems = 10,
  showHeader = true,
  onActivityPress,
}: DailyActivityFeedProps) {
  const { theme } = useTheme();
  const [activities, setActivities] = useState<DailyActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  const styles = useMemo(() => createStyles(theme), [theme]);
  const dateString = date.toISOString().split('T')[0];

  const loadActivities = useCallback(async () => {
    if (!classId) {
      setLoading(false);
      return;
    }

    try {
      const supabase = assertSupabase();
      
      const { data, error } = await supabase
        .from('daily_activities')
        .select(`
          *,
          profiles:created_by (first_name, last_name)
        `)
        .eq('class_id', classId)
        .eq('activity_date', dateString)
        .order('start_time', { ascending: true, nullsFirst: false })
        .limit(maxItems);

      if (error) {
        console.error('[DailyActivityFeed] Error loading activities:', error);
        setActivities([]);
      } else {
        const mapped = (data || []).map((a: any) => ({
          ...a,
          teacher_name: a.profiles 
            ? `${a.profiles.first_name || ''} ${a.profiles.last_name || ''}`.trim()
            : 'Teacher',
        }));
        setActivities(mapped);
      }
    } catch (err) {
      console.error('[DailyActivityFeed] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [classId, dateString, maxItems]);

  useEffect(() => {
    loadActivities();

    // Real-time subscription
    if (!classId) return;
    
    const supabase = assertSupabase();
    const subscription = supabase
      .channel(`daily_activities_${classId}_${dateString}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_activities',
          filter: `class_id=eq.${classId}`,
        },
        () => {
          loadActivities();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [classId, dateString, loadActivities]);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const renderActivity = ({ item, index }: { item: DailyActivity; index: number }) => {
    const { icon, color } = getActivityIcon(item.activity_name);
    const isExpanded = expandedId === item.id;
    const isLast = index === activities.length - 1;

    return (
      <TouchableOpacity
        style={styles.activityItem}
        onPress={() => {
          toggleExpand(item.id);
          onActivityPress?.(item);
        }}
        activeOpacity={0.7}
      >
        {/* Timeline connector */}
        <View style={styles.timelineContainer}>
          <View style={[styles.timelineDot, { backgroundColor: color }]}>
            <Ionicons name={icon as any} size={14} color="#FFF" />
          </View>
          {!isLast && <View style={[styles.timelineLine, { backgroundColor: theme.border }]} />}
        </View>

        {/* Activity content */}
        <View style={styles.activityContent}>
          <View style={styles.activityHeader}>
            <Text style={[styles.activityName, { color: theme.text }]}>
              {item.activity_name}
            </Text>
            {item.start_time && (
              <Text style={[styles.activityTime, { color: theme.textSecondary }]}>
                {formatTime(item.start_time)}
                {item.end_time ? ` - ${formatTime(item.end_time)}` : ''}
              </Text>
            )}
          </View>

          {item.description && (
            <Text 
              style={[styles.activityDescription, { color: theme.textSecondary }]}
              numberOfLines={isExpanded ? undefined : 2}
            >
              {item.description}
            </Text>
          )}

          {/* Expanded details */}
          {isExpanded && (
            <View style={styles.expandedDetails}>
              {item.learning_objectives && item.learning_objectives.length > 0 && (
                <View style={styles.detailSection}>
                  <Text style={[styles.detailLabel, { color: theme.primary }]}>
                    <Ionicons name="bulb" size={12} /> Learning Goals
                  </Text>
                  {item.learning_objectives.map((obj, i) => (
                    <Text key={i} style={[styles.detailText, { color: theme.textSecondary }]}>
                      • {obj}
                    </Text>
                  ))}
                </View>
              )}

              {item.materials_needed && item.materials_needed.length > 0 && (
                <View style={styles.detailSection}>
                  <Text style={[styles.detailLabel, { color: theme.warning }]}>
                    <Ionicons name="cube" size={12} /> Materials Used
                  </Text>
                  <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                    {item.materials_needed.join(', ')}
                  </Text>
                </View>
              )}

              {item.notes && (
                <View style={styles.detailSection}>
                  <Text style={[styles.detailLabel, { color: theme.info }]}>
                    <Ionicons name="document-text" size={12} /> Teacher Notes
                  </Text>
                  <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                    {item.notes}
                  </Text>
                </View>
              )}

              {item.teacher_name && (
                <Text style={[styles.teacherName, { color: theme.textTertiary }]}>
                  Added by {item.teacher_name}
                </Text>
              )}
            </View>
          )}

          {/* Expand indicator */}
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={theme.textSecondary}
            style={styles.expandIcon}
          />
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.card }]}>
      {showHeader && (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="sunny" size={20} color="#F59E0B" />
            <Text style={[styles.headerTitle, { color: theme.text }]}>
              Today's Activities
            </Text>
          </View>
          <Text style={[styles.headerDate, { color: theme.textSecondary }]}>
            {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </Text>
        </View>
      )}

      {activities.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={40} color={theme.textTertiary} />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            No activities logged yet today
          </Text>
          <Text style={[styles.emptySubtext, { color: theme.textTertiary }]}>
            Check back later for updates from your child's teacher
          </Text>
        </View>
      ) : (
        <FlatList
          data={activities}
          renderItem={renderActivity}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
    },
    loadingContainer: {
      padding: 40,
      alignItems: 'center',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
    },
    headerDate: {
      fontSize: 14,
    },
    activityItem: {
      flexDirection: 'row',
      marginBottom: 8,
    },
    timelineContainer: {
      width: 32,
      alignItems: 'center',
    },
    timelineDot: {
      width: 28,
      height: 28,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
    },
    timelineLine: {
      width: 2,
      flex: 1,
      marginTop: 4,
    },
    activityContent: {
      flex: 1,
      marginLeft: 12,
      paddingBottom: 12,
    },
    activityHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    activityName: {
      fontSize: 16,
      fontWeight: '600',
      flex: 1,
    },
    activityTime: {
      fontSize: 12,
      marginLeft: 8,
    },
    activityDescription: {
      fontSize: 14,
      lineHeight: 20,
    },
    expandedDetails: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: 'rgba(128, 128, 128, 0.2)',
    },
    detailSection: {
      marginBottom: 10,
    },
    detailLabel: {
      fontSize: 12,
      fontWeight: '600',
      marginBottom: 4,
    },
    detailText: {
      fontSize: 13,
      lineHeight: 18,
    },
    teacherName: {
      fontSize: 11,
      marginTop: 8,
      fontStyle: 'italic',
    },
    expandIcon: {
      position: 'absolute',
      right: 0,
      top: 0,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: 30,
    },
    emptyText: {
      fontSize: 16,
      fontWeight: '500',
      marginTop: 12,
    },
    emptySubtext: {
      fontSize: 13,
      marginTop: 4,
      textAlign: 'center',
    },
  });

export default DailyActivityFeed;
