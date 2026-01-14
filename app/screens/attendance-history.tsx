/**
 * Attendance History Screen
 * 
 * Shows attendance records that teachers have marked previously
 * Allows filtering by date, class, and student
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { assertSupabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import ThemedStatusBar from '@/components/ui/ThemedStatusBar';
import { Stack, router } from 'expo-router';
import { useSimplePullToRefresh } from '@/hooks/usePullToRefresh';
import { useTheme } from '@/contexts/ThemeContext';
import { useTeacherSchool } from '@/hooks/useTeacherSchool';
import { useAuth, usePermissions } from '@/contexts/AuthContext';
import { track } from '@/lib/analytics';

interface AttendanceRecord {
  id: string;
  attendance_date: string;
  student_id: string;
  status: 'present' | 'absent' | 'late';
  recorded_by: string;
  created_at: string;
  student_name?: string;
  class_name?: string;
}

interface AttendanceStats {
  total_records: number;
  present_count: number;
  absent_count: number;
  late_count?: number;
}

export default function AttendanceHistoryScreen() {
  const { profile, loading: authLoading, profileLoading } = useAuth();
  const permissions = usePermissions();
  const { theme } = useTheme();
  const { schoolId, schoolName, loading: schoolLoading } = useTeacherSchool();
  
  // RBAC Guard: Only teachers and principals can access this screen
  const isTeacher = permissions?.hasRole ? permissions.hasRole('teacher') : profile?.role === 'teacher';
  const isPrincipal = permissions?.hasRole ? permissions.hasRole('principal') : profile?.role === 'principal' || profile?.role === 'principal_admin';
  const canAccessAttendance = isTeacher || isPrincipal;

  // Redirect non-authorized users
  const hasRedirectedRef = useRef(false);
  useEffect(() => {
    if (hasRedirectedRef.current) return;
    if (!authLoading && !profileLoading && profile) {
      if (!canAccessAttendance) {
        hasRedirectedRef.current = true;
        console.warn('[AttendanceHistory] Access denied for role:', profile.role);
        track('edudash.attendance_history.access_denied', {
          user_id: profile.id,
          role: profile.role,
        });
        Alert.alert(
          'Access Denied',
          'Only teachers and principals can view attendance history.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      }
    }
  }, [authLoading, profileLoading, profile, canAccessAttendance]);
  
  const palette = {
    background: theme.background,
    text: theme.text,
    textSecondary: theme.textSecondary,
    outline: theme.border,
    surface: theme.surface,
    primary: theme.primary,
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
  };

  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('all');

  useEffect(() => {
    // Set today as default date
    const today = new Date().toISOString().slice(0, 10);
    setSelectedDate(today);
  }, []);

  // Fetch attendance history
  const attendanceQuery = useQuery({
    queryKey: ['attendance_history', schoolId, selectedDate, selectedClass],
    queryFn: async () => {
      if (!schoolId) return { records: [], stats: null };

      let query = assertSupabase()
        .from('attendance')
        .select(`
          id,
          attendance_date,
          student_id,
          status,
          recorded_by,
          created_at,
          students!attendance_student_id_fkey (
            first_name,
            last_name,
            classes!students_class_id_fkey (
              name
            )
          )
        `)
        .eq('students.preschool_id', schoolId)
        .order('attendance_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (selectedDate) {
        query = query.eq('attendance_date', selectedDate);
      }

      if (selectedClass !== 'all') {
        query = query.eq('students.class_id', selectedClass);
      }

      const { data, error } = await query;
      
      if (error) throw error;

      const records: AttendanceRecord[] = (data || []).map((record: any) => ({
        id: record.id,
        attendance_date: record.attendance_date,
        student_id: record.student_id,
        status: record.status,
        recorded_by: record.recorded_by,
        created_at: record.created_at,
        student_name: record.students 
          ? `${record.students.first_name} ${record.students.last_name}`
          : 'Unknown Student',
        class_name: record.students?.classes?.name || 'No Class',
      }));

      // Calculate stats for the selected date/filters
      const stats: AttendanceStats = {
        total_records: records.length,
        present_count: records.filter(r => r.status === 'present').length,
        absent_count: records.filter(r => r.status === 'absent').length,
        late_count: records.filter(r => r.status === 'late').length,
      };

      return { records, stats };
    },
    enabled: !!schoolId,
    staleTime: 30_000,
  });

  // Fetch classes for filtering
  const classesQuery = useQuery({
    queryKey: ['teacher_classes', schoolId],
    queryFn: async () => {
      if (!schoolId) return [];
      const { data, error } = await assertSupabase()
        .from('classes')
        .select('id, name')
        .eq('preschool_id', schoolId)
        .eq('active', true)
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!schoolId,
    staleTime: 60_000,
  });

  const handleRefresh = async () => {
    try {
      await attendanceQuery.refetch();
    } catch (error) {
      console.error('Error refreshing attendance history:', error);
    }
  };

  const { refreshing, onRefreshHandler } = useSimplePullToRefresh(handleRefresh, 'attendance_history');

  const renderAttendanceRecord = ({ item }: { item: AttendanceRecord }) => {
    const statusColor = item.status === 'present' 
      ? palette.success 
      : item.status === 'late' 
      ? palette.warning 
      : palette.danger;

    return (
      <View style={[styles.recordCard, { backgroundColor: palette.surface, borderColor: palette.outline }]}>
        <View style={styles.recordHeader}>
          <Text style={[styles.studentName, { color: palette.text }]}>
            {item.student_name}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <Ionicons 
              name={item.status === 'present' ? 'checkmark-circle' : item.status === 'late' ? 'time' : 'close-circle'} 
              size={16} 
              color={statusColor} 
            />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Text>
          </View>
        </View>
        <View style={styles.recordMeta}>
          <Text style={[styles.classText, { color: palette.textSecondary }]}>
            {item.class_name}
          </Text>
          <Text style={[styles.dateText, { color: palette.textSecondary }]}>
            {format(new Date(item.created_at), 'HH:mm')}
          </Text>
        </View>
      </View>
    );
  };

  const renderStatsCard = () => {
    const stats = attendanceQuery.data?.stats;
    if (!stats) return null;

    return (
      <View style={[styles.statsCard, { backgroundColor: palette.surface, borderColor: palette.outline }]}>
        <Text style={[styles.statsTitle, { color: palette.text }]}>
          Attendance Summary
          {selectedDate && (
            <Text style={{ color: palette.textSecondary, fontWeight: 'normal' }}>
              {' '}for {format(new Date(selectedDate), 'MMM d, yyyy')}
            </Text>
          )}
        </Text>
        
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: palette.primary }]}>{stats.total_records}</Text>
            <Text style={[styles.statLabel, { color: palette.textSecondary }]}>Total</Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: palette.success }]}>{stats.present_count}</Text>
            <Text style={[styles.statLabel, { color: palette.textSecondary }]}>Present</Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: palette.danger }]}>{stats.absent_count}</Text>
            <Text style={[styles.statLabel, { color: palette.textSecondary }]}>Absent</Text>
          </View>
          
          {(stats.late_count || 0) > 0 && (
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: palette.warning }]}>{stats.late_count}</Text>
              <Text style={[styles.statLabel, { color: palette.textSecondary }]}>Late</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderHeader = () => (
    <View>
      {renderStatsCard()}
      
      {/* Filter Controls */}
      <View style={[styles.filtersCard, { backgroundColor: palette.surface, borderColor: palette.outline }]}>
        <Text style={[styles.filterTitle, { color: palette.text }]}>Filters</Text>
        
        {/* Date Selection */}
        <View style={styles.filterRow}>
          <Text style={[styles.filterLabel, { color: palette.textSecondary }]}>Date:</Text>
          <TouchableOpacity 
            style={[styles.filterButton, { borderColor: palette.outline }]}
            onPress={() => {
              // You can implement a date picker here
              Alert.alert('Date Selection', 'Date picker would be implemented here');
            }}
          >
            <Ionicons name="calendar-outline" size={16} color={palette.primary} />
            <Text style={[styles.filterButtonText, { color: palette.text }]}>
              {selectedDate ? format(new Date(selectedDate), 'MMM d, yyyy') : 'Select Date'}
            </Text>
          </TouchableOpacity>
        </View>
        
        {/* Class Selection */}
        <View style={styles.filterRow}>
          <Text style={[styles.filterLabel, { color: palette.textSecondary }]}>Class:</Text>
          <View style={styles.classFilters}>
            <TouchableOpacity
              style={[
                styles.classFilterChip,
                selectedClass === 'all' && { backgroundColor: palette.primary + '20', borderColor: palette.primary },
                { borderColor: palette.outline }
              ]}
              onPress={() => setSelectedClass('all')}
            >
              <Text style={[
                styles.classFilterText,
                selectedClass === 'all' && { color: palette.primary },
                { color: palette.text }
              ]}>
                All Classes
              </Text>
            </TouchableOpacity>
            
            {(classesQuery.data || []).map((cls: any) => (
              <TouchableOpacity
                key={cls.id}
                style={[
                  styles.classFilterChip,
                  selectedClass === cls.id && { backgroundColor: palette.primary + '20', borderColor: palette.primary },
                  { borderColor: palette.outline }
                ]}
                onPress={() => setSelectedClass(cls.id)}
              >
                <Text style={[
                  styles.classFilterText,
                  selectedClass === cls.id && { color: palette.primary },
                  { color: palette.text }
                ]}>
                  {cls.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="calendar-outline" size={64} color={palette.textSecondary} />
      <Text style={[styles.emptyTitle, { color: palette.text }]}>No Attendance Records</Text>
      <Text style={[styles.emptyText, { color: palette.textSecondary }]}>
        No attendance has been marked for the selected date and filters.
      </Text>
      <TouchableOpacity
        style={[styles.takeAttendanceButton, { backgroundColor: palette.primary }]}
        onPress={() => router.push('/screens/attendance')}
      >
        <Ionicons name="checkmark-circle" size={20} color="#FFF" />
        <Text style={styles.takeAttendanceText}>Take Attendance</Text>
      </TouchableOpacity>
    </View>
  );

  if (schoolLoading || attendanceQuery.isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: palette.background }]}>
        <Stack.Screen options={{
          title: 'Attendance History',
          headerStyle: { backgroundColor: palette.background },
          headerTitleStyle: { color: palette.text },
          headerTintColor: palette.primary,
          headerBackVisible: true
        }} />
        <ThemedStatusBar />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={palette.primary} />
          <Text style={[styles.loadingText, { color: palette.textSecondary }]}>
            Loading attendance history...
          </Text>
        </View>
      </View>
    );
  }

  const records = attendanceQuery.data?.records || [];

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <Stack.Screen options={{
        title: 'Attendance History',
        headerStyle: { backgroundColor: palette.background },
        headerTitleStyle: { color: palette.text },
        headerTintColor: palette.primary,
        headerBackVisible: true
      }} />
      <ThemedStatusBar />
      
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: palette.background }}>
        <FlatList
          data={records}
          keyExtractor={(item) => item.id}
          renderItem={renderAttendanceRecord}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={[
            styles.listContent,
            records.length === 0 && { flex: 1, justifyContent: 'center' }
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefreshHandler}
              tintColor={palette.primary}
              title="Refreshing attendance history..."
            />
          }
          showsVerticalScrollIndicator={false}
        />
        
        {/* Floating Action Button */}
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: palette.primary }]}
          onPress={() => router.push('/screens/attendance')}
        >
          <Ionicons name="add-circle" size={28} color="#FFF" />
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: { fontSize: 14 },
  listContent: { padding: 16, paddingBottom: 100 },
  
  // Stats Card
  statsCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  
  // Filters Card
  filtersCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  filterRow: {
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    gap: 8,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  classFilters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  classFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 16,
  },
  classFilterText: {
    fontSize: 12,
    fontWeight: '600',
  },
  
  // Record Card
  recordCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  recordMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  classText: {
    fontSize: 14,
  },
  dateText: {
    fontSize: 14,
  },
  
  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  takeAttendanceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  takeAttendanceText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },
  
  // FAB
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
});