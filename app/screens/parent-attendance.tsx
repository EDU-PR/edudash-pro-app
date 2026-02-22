/**
 * Parent Attendance Screen
 * 
 * Allows parents to VIEW their child's attendance records.
 * No seat required - this is a read-only view for parents.
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { assertSupabase } from '@/lib/supabase';
import SkeletonLoader from '@/components/ui/SkeletonLoader';
import { DesktopLayout } from '@/components/layout/DesktopLayout';
import { attendanceStyles as styles } from '@/lib/screen-styles/parent-attendance.styles';
import { logger } from '@/lib/logger';

// Custom Header Component
interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
}

const ScreenHeader: React.FC<ScreenHeaderProps> = ({ title, subtitle, onBack }) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  
  return (
    <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: theme.surface }]}>
      <TouchableOpacity 
        style={styles.headerBackButton} 
        onPress={onBack || (() => router.back())}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="arrow-back" size={24} color={theme.text} />
      </TouchableOpacity>
      
      <View style={styles.headerTitleContainer}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>{title}</Text>
        {subtitle && (
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
        )}
      </View>
      
      <View style={styles.headerRightButton} />
    </View>
  );
};

// Attendance Record Item
interface AttendanceRecord {
  id: string;
  date: string;
  present: boolean;
  status?: 'present' | 'absent' | 'late' | 'excused';
  notes?: string;
  student_name?: string;
}

interface AttendanceItemProps {
  record: AttendanceRecord;
}

const AttendanceItem: React.FC<AttendanceItemProps> = ({ record }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  
  const getStatusConfig = () => {
    const status = record.status || (record.present ? 'present' : 'absent');
    switch (status) {
      case 'present':
        return { 
          color: theme.success, 
          icon: 'checkmark-circle' as const, 
          label: t('attendance.present', { defaultValue: 'Present' }) 
        };
      case 'late':
        return { 
          color: theme.warning, 
          icon: 'time' as const, 
          label: t('attendance.late', { defaultValue: 'Late' }) 
        };
      case 'excused':
        return { 
          color: theme.info, 
          icon: 'document-text' as const, 
          label: t('attendance.excused', { defaultValue: 'Excused' }) 
        };
      case 'absent':
      default:
        return { 
          color: theme.error, 
          icon: 'close-circle' as const, 
          label: t('attendance.absent', { defaultValue: 'Absent' }) 
        };
    }
  };
  
  const statusConfig = getStatusConfig();
  
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };
  
  return (
    <View style={[styles.attendanceItem, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={[styles.statusIndicator, { backgroundColor: statusConfig.color + '20' }]}>
        <Ionicons name={statusConfig.icon} size={24} color={statusConfig.color} />
      </View>
      
      <View style={styles.attendanceInfo}>
        <Text style={[styles.attendanceDate, { color: theme.text }]}>
          {formatDate(record.date)}
        </Text>
        <Text style={[styles.attendanceStatus, { color: statusConfig.color }]}>
          {statusConfig.label}
        </Text>
        {record.notes && (
          <Text style={[styles.attendanceNotes, { color: theme.textSecondary }]} numberOfLines={1}>
            {record.notes}
          </Text>
        )}
      </View>
    </View>
  );
};

// Filter Chip
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
        styles.filterChip,
        { backgroundColor: active ? theme.primary : theme.surface },
        { borderColor: active ? theme.primary : theme.border }
      ]}
      onPress={onPress}
    >
      <Text style={[styles.filterChipText, { color: active ? theme.onPrimary : theme.text }]}>
        {label}
      </Text>
      {count !== undefined && count > 0 && (
        <View style={[styles.filterChipBadge, { backgroundColor: active ? theme.onPrimary : theme.primary }]}>
          <Text style={[styles.filterChipBadgeText, { color: active ? theme.primary : theme.onPrimary }]}>
            {count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

// Hook to fetch child's attendance records
const useChildAttendance = (childId: string | null) => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['child-attendance', childId, user?.id],
    queryFn: async (): Promise<AttendanceRecord[]> => {
      if (!childId || !user?.id) return [];
      
      const client = assertSupabase();
      
      // Fetch attendance records for the child
      const { data, error } = await client
        .from('attendance')
        .select('id, attendance_date, status, notes')
        .eq('student_id', childId)
        .order('attendance_date', { ascending: false })
        .limit(100);
      
      if (error) {
        // Table may not exist
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          logger.warn('[useChildAttendance] attendance table not found');
          return [];
        }
        logger.error('useChildAttendance', 'Error fetching attendance', error);
        return [];
      }
      
      return (data || []).map(record => ({
        id: record.id,
        date: record.attendance_date,
        present: record.status === 'present',
        status: record.status || 'absent',
        notes: record.notes,
      }));
    },
    enabled: !!childId && !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

// Hook to fetch parent's children
const useParentChildren = () => {
  const { user, profile } = useAuth();
  
  // Resolve the correct parent ID (profile.id may differ from auth user.id)
  const parentId = (profile as any)?.id || user?.id;
  
  return useQuery({
    queryKey: ['parent-children', parentId],
    queryFn: async () => {
      if (!parentId) return [];
      
      const client = assertSupabase();
      
      // Fetch children linked to this parent via parent_id OR guardian_id
      const parentFilters = [`parent_id.eq.${parentId}`, `guardian_id.eq.${parentId}`];
      if (user?.id && user.id !== parentId) {
        parentFilters.push(`parent_id.eq.${user.id}`, `guardian_id.eq.${user.id}`);
      }
      
      const { data: directData, error: directError } = await client
        .from('students')
        .select('id, first_name, last_name, class_id')
        .or(parentFilters.join(','))
        .eq('is_active', true);
      
      if (directError) {
        logger.error('useParentChildren', 'Error fetching children', directError);
      }
      
      // Also check junction table for multi-parent support
      const { data: relationships } = await client
        .from('student_parent_relationships')
        .select('student_id')
        .eq('parent_id', parentId);
      
      let junctionData: any[] = [];
      if (relationships && relationships.length > 0) {
        const studentIds = relationships.map(r => r.student_id);
        const { data: junctionStudents } = await client
          .from('students')
          .select('id, first_name, last_name, class_id')
          .in('id', studentIds)
          .eq('is_active', true);
        junctionData = junctionStudents || [];
      }
      
      // Combine and deduplicate
      const allStudents = [...(directData || []), ...junctionData];
      const uniqueMap = new Map<string, any>();
      allStudents.forEach((s: any) => { if (s?.id) uniqueMap.set(s.id, s); });
      
      return Array.from(uniqueMap.values());
    },
    enabled: !!parentId,
  });
};

export default function ParentAttendanceScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<'all' | 'present' | 'absent'>('all');
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  const userRole = (profile?.role as string) || 'parent';
  
  // Fetch children and attendance
  const { data: children = [], isLoading: childrenLoading } = useParentChildren();
  const { data: attendance = [], isLoading: attendanceLoading, refetch } = useChildAttendance(
    selectedChildId || (children.length > 0 ? children[0]?.id : null)
  );
  
  // Set first child as selected by default
  React.useEffect(() => {
    if (children.length > 0 && !selectedChildId) {
      setSelectedChildId(children[0].id);
    }
  }, [children, selectedChildId]);
  
  // Filter attendance
  const filteredAttendance = useMemo(() => {
    if (filter === 'all') return attendance;
    if (filter === 'present') return attendance.filter(a => a.present);
    if (filter === 'absent') return attendance.filter(a => !a.present);
    return attendance;
  }, [attendance, filter]);
  
  // Calculate stats
  const stats = useMemo(() => {
    const total = attendance.length;
    const presentCount = attendance.filter(a => a.present).length;
    const absentCount = total - presentCount;
    const rate = total > 0 ? Math.round((presentCount / total) * 100) : 0;
    
    return { total, presentCount, absentCount, rate };
  }, [attendance]);
  
  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };
  
  const isLoading = childrenLoading || attendanceLoading;
  
  return (
    <DesktopLayout role={userRole as any}>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader 
          title={t('parent.attendance', { defaultValue: 'Attendance' })}
          subtitle={t('parent.attendance_history', { defaultValue: 'View attendance history' })}
        />
        
        <ScrollView
          style={styles.content}
          contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 100 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Child Selector (if multiple children) */}
          {children.length > 1 && (
            <View style={styles.childSelector}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                {t('parent.select_child', { defaultValue: 'Select Child' })}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.childScroll}>
                {children.map((child: any) => (
                  <TouchableOpacity
                    key={child.id}
                    style={[
                      styles.childChip,
                      { 
                        backgroundColor: selectedChildId === child.id ? theme.primary : theme.surface,
                        borderColor: selectedChildId === child.id ? theme.primary : theme.border,
                      }
                    ]}
                    onPress={() => setSelectedChildId(child.id)}
                  >
                    <Text style={[
                      styles.childChipText,
                      { color: selectedChildId === child.id ? theme.onPrimary : theme.text }
                    ]}>
                      {child.first_name} {child.last_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
          
          {/* Stats Card */}
          <View style={[styles.statsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.statsTitle, { color: theme.text }]}>
              {t('parent.attendance_overview', { defaultValue: 'Attendance Overview' })}
            </Text>
            
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: theme.primary }]}>{stats.rate}%</Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                  {t('parent.attendance_rate', { defaultValue: 'Attendance Rate' })}
                </Text>
              </View>
              
              <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
              
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: theme.success }]}>{stats.presentCount}</Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                  {t('attendance.present', { defaultValue: 'Present' })}
                </Text>
              </View>
              
              <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
              
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: theme.error }]}>{stats.absentCount}</Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                  {t('attendance.absent', { defaultValue: 'Absent' })}
                </Text>
              </View>
            </View>
          </View>
          
          {/* Filter Chips */}
          <View style={styles.filterContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
              <FilterChip 
                label={t('common.all', { defaultValue: 'All' })} 
                active={filter === 'all'} 
                onPress={() => setFilter('all')}
                count={stats.total}
              />
              <FilterChip 
                label={t('attendance.present', { defaultValue: 'Present' })} 
                active={filter === 'present'} 
                onPress={() => setFilter('present')}
                count={stats.presentCount}
              />
              <FilterChip 
                label={t('attendance.absent', { defaultValue: 'Absent' })} 
                active={filter === 'absent'} 
                onPress={() => setFilter('absent')}
                count={stats.absentCount}
              />
            </ScrollView>
          </View>
          
          {/* Attendance List */}
          {isLoading ? (
            <>
              {[1, 2, 3, 4, 5].map((i) => (
                <SkeletonLoader key={i} width="100%" height={72} borderRadius={12} style={{ marginBottom: 8 }} />
              ))}
            </>
          ) : filteredAttendance.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIcon, { backgroundColor: theme.primary + '20' }]}>
                <Ionicons name="calendar-outline" size={48} color={theme.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                {t('parent.no_attendance', { defaultValue: 'No Attendance Records' })}
              </Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                {t('parent.no_attendance_desc', { 
                  defaultValue: 'Attendance records will appear here once your child has been marked present or absent.' 
                })}
              </Text>
            </View>
          ) : (
            <>
              {filteredAttendance.map((record) => (
                <AttendanceItem key={record.id} record={record} />
              ))}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </DesktopLayout>
  );
}
