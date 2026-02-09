/**
 * Parent Activity Feed Screen
 *
 * Full-screen feed showing daily classroom activities posted by teachers.
 * Parents can browse by child, date, react with emoji, and comment.
 *
 * Features:
 * - Child selector (multi-child families)
 * - Date navigation (today / pick a date)
 * - Pull-to-refresh & real-time updates
 * - Emoji reactions & threaded comments
 * - Image lightbox
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import { SubPageHeader } from '@/components/SubPageHeader';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { ActivityCard } from '@/components/activities/ActivityCard';
import {
  useChildActivityFeed,
  useActivityFeedRealtime,
  useToggleActivityReaction,
  useAddActivityComment,
  useDeleteActivityComment,
  type ActivityItem,
} from '@/hooks/useActivityFeed';

import EduDashSpinner from '@/components/ui/EduDashSpinner';
import {
  type ActivityFilter, type ChildOption,
  FILTER_OPTIONS, toDateKey, formatDateLabel,
  createActivityFeedStyles,
} from '@/lib/screen-styles/parent-activity-feed.styles';

// ── Component ───────────────────────────────────────────────────────────────

export default function ParentActivityFeedScreen() {
  const { theme } = useTheme();
  const { user, profile } = useAuth();
  const styles = useMemo(() => createActivityFeedStyles(theme), [theme]);

  // State
  const [selectedChild, setSelectedChild] = useState<string | undefined>();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [typeFilter, setTypeFilter] = useState<ActivityFilter>('all');

  // ── Fetch parent's children ──────────────────────
  const {
    data: children = [],
    isLoading: childrenLoading,
  } = useQuery({
    queryKey: ['parent-children-activity', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const supabase = assertSupabase();

      // Try profile-based lookup first (profiles.auth_user_id → students.parent_id)
      let profileId = user.id;
      const { data: prof } = await supabase
        .from('profiles')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle();
      if (prof) profileId = prof.id;

      const { data, error } = await supabase
        .from('students')
        .select('id, first_name, last_name, class_id, classes:class_id(name)')
        .eq('parent_id', profileId);

      if (error) {
        logger.error('ActivityFeed', 'Children fetch error', error);
        return [];
      }

      return (data || []).map((s: any) => ({
        id: s.id,
        first_name: s.first_name,
        last_name: s.last_name,
        class_name: s.classes?.name || undefined,
      })) as ChildOption[];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 10,
  });

  // Auto-select first child
  useEffect(() => {
    if (children.length > 0 && !selectedChild) {
      setSelectedChild(children[0].id);
    }
  }, [children, selectedChild]);

  // ── Activity feed query ──────────────────────────
  const dateKey = toDateKey(selectedDate);
  const {
    data: activities = [],
    isLoading: activitiesLoading,
    refetch,
    isFetching,
  } = useChildActivityFeed(selectedChild, { date: dateKey, limit: 50 });

  // ── Real-time ────────────────────────────────────
  useActivityFeedRealtime(selectedChild);

  // ── Mutations ────────────────────────────────────
  const toggleReaction = useToggleActivityReaction();
  const addComment = useAddActivityComment();
  const deleteComment = useDeleteActivityComment();

  const handleReaction = useCallback(
    (activityId: string, emoji: string) => {
      if (!profile?.id) return;
      toggleReaction.mutate({ activityId, emoji, parentId: profile.id });
    },
    [profile?.id, toggleReaction],
  );

  const handleComment = useCallback(
    (activityId: string, text: string) => {
      if (!profile?.id) return;
      addComment.mutate({ activityId, parentId: profile.id, text });
    },
    [profile?.id, addComment],
  );

  const handleDeleteComment = useCallback(
    (commentId: string) => {
      deleteComment.mutate({ commentId });
    },
    [deleteComment],
  );

  // ── Filter activities by type ────────────────────
  const filteredActivities = useMemo(() => {
    if (typeFilter === 'all') return activities;
    return activities.filter((a) => a.activity_type === typeFilter);
  }, [activities, typeFilter]);

  // ── Date arrows ──────────────────────────────────
  const goDay = useCallback(
    (offset: number) => {
      setSelectedDate((prev) => {
        const next = new Date(prev);
        next.setDate(next.getDate() + offset);
        // Don't go past today
        if (next > new Date()) return new Date();
        return next;
      });
    },
    [],
  );

  const isToday = toDateKey(selectedDate) === toDateKey(new Date());

  // ── Activity counts by type ──────────────────────
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: activities.length };
    activities.forEach((a) => {
      counts[a.activity_type] = (counts[a.activity_type] || 0) + 1;
    });
    return counts;
  }, [activities]);

  const isLoading = childrenLoading || activitiesLoading;

  // ── Render ────────────────────────────────────────

  const renderActivity = useCallback(
    ({ item }: { item: ActivityItem }) => (
      <ActivityCard
        activity={item}
        currentUserId={profile?.id}
        onReaction={handleReaction}
        onComment={handleComment}
        onDeleteComment={handleDeleteComment}
      />
    ),
    [profile?.id, handleReaction, handleComment, handleDeleteComment],
  );

  const keyExtractor = useCallback((item: ActivityItem) => item.id, []);

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <SubPageHeader
          title="Activity Feed"
          subtitle="See what your child did today"
          onBack={() => router.back()}
        />

        {/* ── Child selector (multi-child) ─── */}
        {children.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.childSelectorScroll}
            style={styles.childSelector}
          >
            {children.map((child) => {
              const active = selectedChild === child.id;
              return (
                <TouchableOpacity
                  key={child.id}
                  style={[
                    styles.childChip,
                    {
                      backgroundColor: active ? theme.primary : 'transparent',
                      borderColor: active ? theme.primary : theme.border,
                    },
                  ]}
                  onPress={() => setSelectedChild(child.id)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.childChipText,
                      { color: active ? '#fff' : theme.text },
                    ]}
                  >
                    {child.first_name}
                  </Text>
                  {child.class_name && (
                    <Text
                      style={[
                        styles.childChipClass,
                        { color: active ? 'rgba(255,255,255,0.7)' : theme.textSecondary },
                      ]}
                    >
                      {child.class_name}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* ── Date navigator ─── */}
        <View style={[styles.dateNav, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={() => goDay(-1)} style={styles.dateArrow} activeOpacity={0.6}>
            <Ionicons name="chevron-back" size={20} color={theme.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dateCenter}
            onPress={() => setSelectedDate(new Date())}
            activeOpacity={0.7}
          >
            <Ionicons name="calendar-outline" size={16} color={theme.primary} />
            <Text style={[styles.dateLabelText, { color: theme.text }]}>
              {formatDateLabel(selectedDate)}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => goDay(1)}
            style={[styles.dateArrow, { opacity: isToday ? 0.3 : 1 }]}
            disabled={isToday}
            activeOpacity={0.6}
          >
            <Ionicons name="chevron-forward" size={20} color={theme.text} />
          </TouchableOpacity>
        </View>

        {/* ── Activity type filters ─── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
          style={styles.filterBar}
        >
          {FILTER_OPTIONS.map((f) => {
            const active = typeFilter === f.key;
            const count = typeCounts[f.key] || 0;
            if (f.key !== 'all' && count === 0) return null;
            return (
              <TouchableOpacity
                key={f.key}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: active ? theme.primary : 'transparent',
                    borderColor: active ? theme.primary : theme.border,
                  },
                ]}
                onPress={() => setTypeFilter(f.key)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={f.icon as any}
                  size={14}
                  color={active ? '#fff' : theme.textSecondary}
                />
                <Text
                  style={[
                    styles.filterChipText,
                    { color: active ? '#fff' : theme.text },
                  ]}
                >
                  {f.label}{count > 0 ? ` (${count})` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Content ─── */}
        {isLoading ? (
          <View style={styles.centered}>
            <EduDashSpinner size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
              Loading activities...
            </Text>
          </View>
        ) : filteredActivities.length === 0 ? (
          <View style={styles.centered}>
            <Ionicons name="albums-outline" size={56} color={theme.textSecondary} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No activities yet</Text>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              {isToday
                ? 'Your child\'s teacher hasn\'t posted any activities today yet. Check back later!'
                : `No activities were posted on ${selectedDate.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long' })}.`}
            </Text>
            {!isToday && (
              <TouchableOpacity
                style={[styles.todayBtn, { backgroundColor: theme.primary }]}
                onPress={() => setSelectedDate(new Date())}
                activeOpacity={0.7}
              >
                <Text style={styles.todayBtnText}>Go to Today</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <FlatList
            data={filteredActivities}
            renderItem={renderActivity}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isFetching && !activitiesLoading}
                onRefresh={() => refetch()}
                tintColor={theme.primary}
                colors={[theme.primary]}
              />
            }
            ListHeaderComponent={
              <View style={styles.feedHeader}>
                <Text style={[styles.feedHeaderCount, { color: theme.textSecondary }]}>
                  {filteredActivities.length} activit{filteredActivities.length === 1 ? 'y' : 'ies'}
                </Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
}

