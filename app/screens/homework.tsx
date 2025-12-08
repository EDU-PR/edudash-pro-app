/**
 * Parent Homework Screen
 * 
 * Shows homework assignments for parent's children with status tracking.
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Dimensions,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useParentDashboard } from '@/hooks/useDashboardData';
import SkeletonLoader from '@/components/ui/SkeletonLoader';
import { SubPageHeader } from '@/components/SubPageHeader';

const { width } = Dimensions.get('window');

// Homework Item Component
interface HomeworkItemProps {
  homework: {
    id: string;
    title: string;
    subject: string;
    due_date: string;
    status: 'not_submitted' | 'submitted' | 'graded';
    grade?: number;
    teacher_name?: string;
    child_name?: string;
  };
  onPress: () => void;
}

const HomeworkItem: React.FC<HomeworkItemProps> = ({ homework, onPress }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  
  const statusConfig = {
    not_submitted: { color: theme.warning, label: t('homework.pending', { defaultValue: 'Pending' }), icon: 'time-outline' as const },
    submitted: { color: theme.info, label: t('homework.submitted', { defaultValue: 'Submitted' }), icon: 'checkmark-circle-outline' as const },
    graded: { color: theme.success, label: t('homework.graded', { defaultValue: 'Graded' }), icon: 'ribbon-outline' as const },
  };
  
  const status = statusConfig[homework.status] || statusConfig.not_submitted;
  const isOverdue = new Date(homework.due_date) < new Date() && homework.status === 'not_submitted';
  
  return (
    <TouchableOpacity 
      style={[
        itemStyles.container, 
        { backgroundColor: theme.surface },
        isOverdue && { borderLeftColor: theme.error, borderLeftWidth: 4 }
      ]} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[itemStyles.iconContainer, { backgroundColor: status.color + '20' }]}>
        <Ionicons name={status.icon} size={24} color={status.color} />
      </View>
      
      <View style={itemStyles.content}>
        <View style={itemStyles.titleRow}>
          <Text style={[itemStyles.title, { color: theme.text }]} numberOfLines={1}>
            {homework.title}
          </Text>
          {homework.grade !== undefined && (
            <View style={[itemStyles.gradeBadge, { backgroundColor: theme.success + '20' }]}>
              <Text style={[itemStyles.gradeText, { color: theme.success }]}>
                {homework.grade}%
              </Text>
            </View>
          )}
        </View>
        
        <Text style={[itemStyles.subject, { color: theme.textSecondary }]}>
          {homework.subject} {homework.child_name && `• ${homework.child_name}`}
        </Text>
        
        <View style={itemStyles.footer}>
          <View style={[itemStyles.statusBadge, { backgroundColor: status.color + '20' }]}>
            <Text style={[itemStyles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
          
          <View style={itemStyles.dueDate}>
            <Ionicons 
              name="calendar-outline" 
              size={14} 
              color={isOverdue ? theme.error : theme.textSecondary} 
            />
            <Text style={[itemStyles.dueDateText, { color: isOverdue ? theme.error : theme.textSecondary }]}>
              {isOverdue ? t('homework.overdue', { defaultValue: 'Overdue' }) : new Date(homework.due_date).toLocaleDateString()}
            </Text>
          </View>
        </View>
      </View>
      
      <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
    </TouchableOpacity>
  );
};

// Filter Chip Component
interface FilterChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
  count?: number;
}

const FilterChip: React.FC<FilterChipProps> = ({ label, active, onPress, count }) => {
  const { theme } = useTheme();
  
  return (
    <TouchableOpacity 
      style={[
        filterStyles.chip,
        { backgroundColor: active ? theme.primary : theme.surface },
        { borderColor: active ? theme.primary : theme.border }
      ]}
      onPress={onPress}
    >
      <Text style={[filterStyles.chipText, { color: active ? theme.onPrimary : theme.text }]}>
        {label}
      </Text>
      {count !== undefined && count > 0 && (
        <View style={[filterStyles.chipBadge, { backgroundColor: active ? theme.onPrimary : theme.primary }]}>
          <Text style={[filterStyles.chipBadgeText, { color: active ? theme.primary : theme.onPrimary }]}>
            {count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

export default function HomeworkScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<'all' | 'pending' | 'submitted' | 'graded'>('all');
  
  const { data: dashboardData, loading, refresh } = useParentDashboard();
  const [refreshing, setRefreshing] = useState(false);
  
  // Get homework from dashboard data
  const allHomework = useMemo(() => {
    return dashboardData?.recentHomework || [];
  }, [dashboardData]);
  
  // Filter homework
  const filteredHomework = useMemo(() => {
    if (filter === 'all') return allHomework;
    if (filter === 'pending') return allHomework.filter((h: any) => h.status === 'not_submitted');
    if (filter === 'submitted') return allHomework.filter((h: any) => h.status === 'submitted');
    if (filter === 'graded') return allHomework.filter((h: any) => h.status === 'graded');
    return allHomework;
  }, [allHomework, filter]);
  
  // Count by status
  const counts = useMemo(() => ({
    all: allHomework.length,
    pending: allHomework.filter((h: any) => h.status === 'not_submitted').length,
    submitted: allHomework.filter((h: any) => h.status === 'submitted').length,
    graded: allHomework.filter((h: any) => h.status === 'graded').length,
  }), [allHomework]);
  
  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };
  
  const handleHomeworkPress = (homework: any) => {
    // Navigate to homework detail or AI helper
    router.push(`/screens/ai-homework-helper?homeworkId=${homework.id}`);
  };
  
  const handleAIHelp = () => {
    router.push('/screens/ai-homework-helper');
  };
  
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <SubPageHeader 
        title={t('homework.title', { defaultValue: 'Homework' })}
        subtitle={profile?.preschool_name || ''}
        rightAction={{
          icon: 'sparkles',
          onPress: handleAIHelp,
          label: 'AI Homework Help',
        }}
      />
      
      {/* Filter Chips */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <FilterChip 
            label={t('homework.all', { defaultValue: 'All' })} 
            active={filter === 'all'} 
            onPress={() => setFilter('all')}
            count={counts.all}
          />
          <FilterChip 
            label={t('homework.pending', { defaultValue: 'Pending' })} 
            active={filter === 'pending'} 
            onPress={() => setFilter('pending')}
            count={counts.pending}
          />
          <FilterChip 
            label={t('homework.submitted', { defaultValue: 'Submitted' })} 
            active={filter === 'submitted'} 
            onPress={() => setFilter('submitted')}
            count={counts.submitted}
          />
          <FilterChip 
            label={t('homework.graded', { defaultValue: 'Graded' })} 
            active={filter === 'graded'} 
            onPress={() => setFilter('graded')}
            count={counts.graded}
          />
        </ScrollView>
      </View>
      
      <ScrollView 
        style={styles.content}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
        }
      >
        {loading ? (
          // Loading skeleton
          <>
            {[1, 2, 3].map((i) => (
              <SkeletonLoader key={i} width="100%" height={100} borderRadius={12} style={{ marginBottom: 12 }} />
            ))}
          </>
        ) : filteredHomework.length === 0 ? (
          // Empty state
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: theme.primary + '20' }]}>
              <Ionicons name="book-outline" size={48} color={theme.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              {filter === 'all' 
                ? t('homework.no_homework', { defaultValue: 'No Homework Yet' })
                : t('homework.no_homework_filter', { defaultValue: 'No homework in this category' })}
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              {t('homework.no_homework_desc', { defaultValue: 'When teachers assign homework, it will appear here.' })}
            </Text>
            
            {/* AI Homework Help CTA */}
            <TouchableOpacity 
              style={[styles.aiButton, { backgroundColor: theme.primary }]}
              onPress={handleAIHelp}
            >
              <Ionicons name="sparkles" size={20} color={theme.onPrimary} />
              <Text style={[styles.aiButtonText, { color: theme.onPrimary }]}>
                {t('homework.get_ai_help', { defaultValue: 'Get AI Homework Help' })}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          // Homework list
          <>
            {filteredHomework.map((homework: any) => (
              <HomeworkItem 
                key={homework.id} 
                homework={homework} 
                onPress={() => handleHomeworkPress(homework)} 
              />
            ))}
            
            {/* AI Help Banner */}
            <TouchableOpacity 
              style={[styles.aiBanner, { backgroundColor: theme.primary + '15', borderColor: theme.primary + '30' }]}
              onPress={handleAIHelp}
            >
              <Ionicons name="sparkles" size={24} color={theme.primary} />
              <View style={styles.aiBannerContent}>
                <Text style={[styles.aiBannerTitle, { color: theme.text }]}>
                  {t('homework.need_help', { defaultValue: 'Need help with homework?' })}
                </Text>
                <Text style={[styles.aiBannerSubtitle, { color: theme.textSecondary }]}>
                  {t('homework.ai_help_desc', { defaultValue: 'Dash AI can help explain concepts and guide your child.' })}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.primary} />
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterContainer: {
    paddingVertical: 12,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  aiButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  aiBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 16,
    gap: 12,
  },
  aiBannerContent: {
    flex: 1,
  },
  aiBannerTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  aiBannerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
});

const itemStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  gradeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  gradeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  subject: {
    fontSize: 13,
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  dueDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dueDateText: {
    fontSize: 12,
  },
});

const filterStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  chipBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  chipBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
