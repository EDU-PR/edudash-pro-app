/**
 * Attendance History Screen
 * 
 * Shows attendance records that teachers have marked previously
 * Allows filtering by date, class, and student
 * Includes print/export functionality for attendance registers
 */

import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, Platform } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { assertSupabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { logger } from '@/lib/logger';

const TAG = 'AttendanceHistory';
import ThemedStatusBar from '@/components/ui/ThemedStatusBar';
import { Stack, router } from 'expo-router';
import { useSimplePullToRefresh } from '@/hooks/usePullToRefresh';
import { useTheme } from '@/contexts/ThemeContext';
import { useTeacherSchool } from '@/hooks/useTeacherSchool';
import { useAuth, usePermissions } from '@/contexts/AuthContext';
import { track } from '@/lib/analytics';
import { AlertModal, type AlertButton } from '@/components/ui/AlertModal';

import EduDashSpinner from '@/components/ui/EduDashSpinner';
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

// Alert modal state interface
interface AlertState {
  visible: boolean;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  buttons: AlertButton[];
}

export default function AttendanceHistoryScreen() {
  const { profile, loading: authLoading, profileLoading } = useAuth();
  const permissions = usePermissions();
  const { theme } = useTheme();
  const { schoolId, schoolName, loading: schoolLoading } = useTeacherSchool();
  
  // Alert modal state
  const [alertState, setAlertState] = useState<AlertState>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
    buttons: [],
  });

  const showAlert = (title: string, message: string, type: AlertState['type'] = 'info', buttons: AlertButton[] = [{ text: 'OK', style: 'default' }]) => {
    setAlertState({ visible: true, title, message, type, buttons });
  };

  const hideAlert = () => {
    setAlertState(prev => ({ ...prev, visible: false }));
  };
  
  // RBAC Guard: Teachers, principals, and admins can access this screen
  const normalizedRole = String(profile?.role || '').trim().toLowerCase();
  const isTeacher = permissions?.hasRole
    ? permissions.hasRole('teacher')
    : normalizedRole === 'teacher';
  const isPrincipal = permissions?.hasRoleOrHigher
    ? permissions.hasRoleOrHigher('principal_admin')
    : (
      normalizedRole === 'principal' ||
      normalizedRole === 'principal_admin' ||
      normalizedRole === 'admin' ||
      normalizedRole === 'super_admin' ||
      normalizedRole === 'superadmin' ||
      normalizedRole === 'platform_admin'
    );
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
        showAlert(
          'Access Denied',
          'Only teachers and principals can view attendance history.',
          'error',
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
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    // Set today as default date
    const today = new Date().toISOString().slice(0, 10);
    setSelectedDate(today);
  }, []);

  // Fetch attendance history
  const attendanceQuery = useQuery({
    queryKey: ['attendance_history', schoolId, selectedDate, selectedClass],
    queryFn: async () => {
      if (!schoolId) {
        logger.debug(TAG, 'No schoolId available');
        return { records: [], stats: null };
      }

      logger.debug(TAG, 'Fetching for schoolId:', schoolId, 'date:', selectedDate);

      // First get all students in this school (check both preschool_id and organization_id)
      const { data: schoolStudents, error: studentsError } = await assertSupabase()
        .from('students')
        .select('id')
        .or(`preschool_id.eq.${schoolId},organization_id.eq.${schoolId}`);
      
      if (studentsError) {
        console.error('[AttendanceHistory] Error fetching students:', studentsError);
      }
      
      const studentIds = schoolStudents?.map(s => s.id) || [];
      logger.debug(TAG, 'Found', studentIds.length, 'students');
      
      if (studentIds.length === 0) {
        return { records: [], stats: { total_records: 0, present_count: 0, absent_count: 0, late_count: 0 } };
      }

      let query = assertSupabase()
        .from('attendance')
        .select(`
          id,
          attendance_date,
          student_id,
          status,
          recorded_by,
          created_at,
          students:student_id (
            first_name,
            last_name,
            class_id,
            classes:class_id (
              name
            )
          )
        `)
        .in('student_id', studentIds)
        .order('attendance_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (selectedDate) {
        query = query.eq('attendance_date', selectedDate);
      }

      const { data, error } = await query;
      
      logger.debug(TAG, 'Query result - data:', data?.length || 0, 'records, error:', error);
      
      if (error) {
        console.error('[AttendanceHistory] Query error:', error);
        throw error;
      }

      let records: AttendanceRecord[] = (data || []).map((record: any) => ({
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
        class_id: record.students?.class_id,
      }));

      // Filter by class if selected
      if (selectedClass !== 'all') {
        records = records.filter(r => (r as any).class_id === selectedClass);
      }

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
        .or(`preschool_id.eq.${schoolId},organization_id.eq.${schoolId}`)
        .eq('active', true)
        .order('name');
      
      if (error) {
        console.error('[AttendanceHistory] Error fetching classes:', error);
        throw error;
      }
      logger.debug(TAG, 'Found', data?.length || 0, 'classes');
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

  // Date picker handler
  const handleDateChange = (event: any, date?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (date) {
      setSelectedDate(date.toISOString().slice(0, 10));
    }
  };

  // Navigate date forward/backward
  const navigateDate = (direction: 'prev' | 'next') => {
    const current = selectedDate ? new Date(selectedDate) : new Date();
    const newDate = new Date(current);
    newDate.setDate(current.getDate() + (direction === 'next' ? 1 : -1));
    setSelectedDate(newDate.toISOString().slice(0, 10));
  };

  // Generate and print/share attendance register
  const handlePrintRegister = async () => {
    const records = attendanceQuery.data?.records || [];
    const stats = attendanceQuery.data?.stats;
    
    if (records.length === 0) {
      showAlert('No Records', 'There are no attendance records to print for the selected date and filters.', 'warning');
      return;
    }

    setIsPrinting(true);
    try {
      // Group records by class
      const classesList = Array.from(new Set(records.map(r => r.class_name))).sort();
      
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Attendance Register</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
              .header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #333; padding-bottom: 16px; }
              .header h1 { font-size: 24px; margin-bottom: 8px; }
              .header p { color: #666; font-size: 14px; }
              .summary { display: flex; justify-content: space-around; margin-bottom: 24px; padding: 16px; background: #f5f5f5; border-radius: 8px; }
              .summary-item { text-align: center; }
              .summary-value { font-size: 24px; font-weight: bold; }
              .summary-label { font-size: 12px; color: #666; }
              .summary-present { color: #10B981; }
              .summary-absent { color: #EF4444; }
              .summary-late { color: #F59E0B; }
              .class-section { margin-bottom: 24px; }
              .class-header { background: #333; color: white; padding: 8px 12px; font-weight: bold; margin-bottom: 8px; border-radius: 4px; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
              th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
              th { background: #f0f0f0; font-weight: bold; }
              .status-present { background: #D1FAE5; color: #065F46; }
              .status-absent { background: #FEE2E2; color: #991B1B; }
              .status-late { background: #FEF3C7; color: #92400E; }
              .footer { text-align: center; margin-top: 32px; padding-top: 16px; border-top: 1px solid #ddd; color: #666; font-size: 12px; }
              @media print {
                body { padding: 0; }
                .summary { break-inside: avoid; }
                .class-section { break-inside: avoid; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>📋 Attendance Register</h1>
              <p>${schoolName || 'School'}</p>
              <p><strong>Date:</strong> ${selectedDate ? format(new Date(selectedDate), 'EEEE, MMMM d, yyyy') : 'All Dates'}</p>
              ${selectedClass !== 'all' ? `<p><strong>Class:</strong> ${classesList[0] || 'N/A'}</p>` : ''}
            </div>

            <div class="summary">
              <div class="summary-item">
                <div class="summary-value">${stats?.total_records || 0}</div>
                <div class="summary-label">Total Students</div>
              </div>
              <div class="summary-item">
                <div class="summary-value summary-present">${stats?.present_count || 0}</div>
                <div class="summary-label">Present</div>
              </div>
              <div class="summary-item">
                <div class="summary-value summary-absent">${stats?.absent_count || 0}</div>
                <div class="summary-label">Absent</div>
              </div>
              ${(stats?.late_count || 0) > 0 ? `
              <div class="summary-item">
                <div class="summary-value summary-late">${stats?.late_count || 0}</div>
                <div class="summary-label">Late</div>
              </div>` : ''}
            </div>

            ${classesList.map(className => {
              const classRecords = records.filter(r => r.class_name === className);
              return `
              <div class="class-section">
                <div class="class-header">${className}</div>
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Student Name</th>
                      <th>Status</th>
                      <th>Time Recorded</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${classRecords.map((record, idx) => `
                      <tr>
                        <td>${idx + 1}</td>
                        <td>${record.student_name}</td>
                        <td class="status-${record.status}">
                          ${record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                        </td>
                        <td>${format(new Date(record.created_at), 'HH:mm')}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
              `;
            }).join('')}

            <div class="footer">
              <p>Generated by EduDash Pro • ${format(new Date(), 'MMMM d, yyyy \'at\' HH:mm')}</p>
            </div>
          </body>
        </html>
      `;

      // Generate PDF
      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
      });

      track('edudash.attendance_history.print', {
        records_count: records.length,
        date: selectedDate,
        class_filter: selectedClass,
      });

      // Share the PDF
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Attendance Register',
          UTI: 'com.adobe.pdf',
        });
      } else {
        showAlert('PDF Generated', 'The attendance register has been generated successfully.', 'success');
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      showAlert('Print Error', 'Failed to generate the attendance register. Please try again.', 'error');
    } finally {
      setIsPrinting(false);
    }
  };

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
        <View style={styles.filterHeaderRow}>
          <Text style={[styles.filterTitle, { color: palette.text }]}>Filters</Text>
          
          {/* Print Button */}
          <TouchableOpacity
            style={[styles.printButton, { backgroundColor: palette.primary }]}
            onPress={handlePrintRegister}
            disabled={isPrinting}
          >
            {isPrinting ? (
              <EduDashSpinner size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="print-outline" size={18} color="#FFF" />
                <Text style={styles.printButtonText}>Print</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
        
        {/* Date Selection with navigation */}
        <View style={styles.filterRow}>
          <Text style={[styles.filterLabel, { color: palette.textSecondary }]}>Date:</Text>
          <View style={styles.dateNavContainer}>
            <TouchableOpacity
              style={[styles.dateNavButton, { borderColor: palette.outline }]}
              onPress={() => navigateDate('prev')}
            >
              <Ionicons name="chevron-back" size={20} color={palette.primary} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.filterButton, styles.dateFilterButton, { borderColor: palette.outline }]}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={16} color={palette.primary} />
              <Text style={[styles.filterButtonText, { color: palette.text }]}>
                {selectedDate ? format(new Date(selectedDate), 'EEE, MMM d, yyyy') : 'Select Date'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.dateNavButton, { borderColor: palette.outline }]}
              onPress={() => navigateDate('next')}
            >
              <Ionicons name="chevron-forward" size={20} color={palette.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick date selection */}
        <View style={styles.quickDateContainer}>
          <TouchableOpacity
            style={[
              styles.quickDateChip,
              selectedDate === new Date().toISOString().slice(0, 10) && { backgroundColor: palette.primary + '20', borderColor: palette.primary },
              { borderColor: palette.outline }
            ]}
            onPress={() => setSelectedDate(new Date().toISOString().slice(0, 10))}
          >
            <Text style={[
              styles.quickDateText,
              selectedDate === new Date().toISOString().slice(0, 10) && { color: palette.primary },
              { color: palette.text }
            ]}>Today</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.quickDateChip,
              selectedDate === new Date(Date.now() - 86400000).toISOString().slice(0, 10) && { backgroundColor: palette.primary + '20', borderColor: palette.primary },
              { borderColor: palette.outline }
            ]}
            onPress={() => {
              const yesterday = new Date(Date.now() - 86400000);
              setSelectedDate(yesterday.toISOString().slice(0, 10));
            }}
          >
            <Text style={[
              styles.quickDateText,
              selectedDate === new Date(Date.now() - 86400000).toISOString().slice(0, 10) && { color: palette.primary },
              { color: palette.text }
            ]}>Yesterday</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.quickDateChip,
              !selectedDate && { backgroundColor: palette.primary + '20', borderColor: palette.primary },
              { borderColor: palette.outline }
            ]}
            onPress={() => setSelectedDate('')}
          >
            <Text style={[
              styles.quickDateText,
              !selectedDate && { color: palette.primary },
              { color: palette.text }
            ]}>All Dates</Text>
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
          <EduDashSpinner size="large" color={palette.primary} />
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
      
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: palette.background }}>
        <FlashList
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
          estimatedItemSize={80}
        />
        
        {/* Floating Action Button */}
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: palette.primary }]}
          onPress={() => router.push('/screens/attendance')}
        >
          <Ionicons name="add-circle" size={28} color="#FFF" />
        </TouchableOpacity>
      </SafeAreaView>

      {/* Date Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={selectedDate ? new Date(selectedDate) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
          maximumDate={new Date()}
          themeVariant="dark"
        />
      )}

      {/* Alert Modal */}
      <AlertModal
        visible={alertState.visible}
        title={alertState.title}
        message={alertState.message}
        type={alertState.type}
        buttons={alertState.buttons}
        onClose={hideAlert}
      />
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
  
  // Filter Header with Print Button
  filterHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  printButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  printButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  
  // Date Navigation
  dateNavContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateNavButton: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateFilterButton: {
    flex: 1,
    justifyContent: 'center',
  },
  
  // Quick Date Selection
  quickDateContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  quickDateChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 16,
  },
  quickDateText: {
    fontSize: 12,
    fontWeight: '600',
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
