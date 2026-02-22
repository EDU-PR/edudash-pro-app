/**
 * Parent Weekly Report Screen
 * 
 * Displays AI-generated weekly learning reports for parents.
 * Features:
 * - Week selector (current week, previous weeks)
 * - Beautiful card-based layout
 * - Progress visualizations
 * - Highlight cards with animations
 * - Home activity cards
 * - Share/download report
 */

import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { fetchParentChildren } from '@/lib/parent-children';
import { DesktopLayout } from '@/components/layout/DesktopLayout';
import { WeeklyReportDetail } from '@/components/reports/WeeklyReportDetail';
import { format, startOfWeek, endOfWeek, subWeeks, addWeeks } from 'date-fns';

import EduDashSpinner from '@/components/ui/EduDashSpinner';
import { AlertModal, useAlertModal } from '@/components/ui/AlertModal';
import { logger } from '@/lib/logger';
interface WeeklyReport {
  id: string;
  student_id: string;
  week_start: string;
  week_end: string;
  report_data: {
    highlights: string[];
    focusAreas: string[];
    attendanceSummary: {
      daysPresent: number;
      daysAbsent: number;
      totalDays: number;
      attendanceRate: number;
    };
    homeworkCompletion: number;
    teacherNotes: string[];
    homeActivities: string[];
    moodSummary: string;
    progressMetrics: {
      socialSkills: number;
      academicProgress: number;
      participation: number;
      behavior: number;
    };
    activityBreakdown: Record<string, number>;
  };
  generated_at: string;
  viewed_at: string | null;
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
}

export default function ParentWeeklyReportScreen() {
  const { theme } = useTheme();
  const { user, profile } = useAuth();
  const { showAlert, alertProps } = useAlertModal();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    // Get start of current week (Monday)
    const now = new Date();
    return startOfWeek(now, { weekStartsOn: 1 });
  });
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingReports, setLoadingReports] = useState(true);

  useEffect(() => {
    loadStudents();
  }, [profile?.id]);

  useEffect(() => {
    if (selectedStudent) {
      loadReport();
    }
  }, [selectedStudent, currentWeekStart]);

  const loadStudents = async () => {
    if (!profile?.id) return;

    try {
      const children = await fetchParentChildren(profile.id, {
        includeInactive: false,
        schoolId: profile.preschool_id || profile.organization_id || undefined,
      });

      setStudents(children || []);
      if (children && children.length > 0 && !selectedStudent) {
        setSelectedStudent(children[0].id);
      }
    } catch (error) {
      logger.error('[ParentWeeklyReport] Error loading students:', error);
      showAlert({ title: 'Error', message: 'Failed to load your children' });
    } finally {
      setLoadingReports(false);
    }
  };

  const loadReport = async () => {
    if (!selectedStudent) return;

    setLoading(true);
    try {
      const supabase = assertSupabase();
      const weekStart = format(currentWeekStart, 'yyyy-MM-dd');
      const weekEnd = format(endOfWeek(currentWeekStart, { weekStartsOn: 1 }), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('weekly_learning_reports')
        .select('*')
        .eq('student_id', selectedStudent)
        .eq('week_start', weekStart)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows returned (not an error)
        throw error;
      }

      setReport(data || null);

      // Mark as viewed if not already
      if (data && !data.viewed_at) {
        await supabase
          .from('weekly_learning_reports')
          .update({ viewed_at: new Date().toISOString() })
          .eq('id', data.id);
      }
    } catch (error) {
      logger.error('[ParentWeeklyReport] Error loading report:', error);
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  const goToPreviousWeek = () => {
    setCurrentWeekStart(prev => subWeeks(prev, 1));
  };

  const goToNextWeek = () => {
    const nextWeek = addWeeks(currentWeekStart, 1);
    const now = new Date();
    // Don't allow going into the future
    if (nextWeek <= now) {
      setCurrentWeekStart(nextWeek);
    }
  };

  const goToCurrentWeek = () => {
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
  };

  const selectedStudentData = students.find(s => s.id === selectedStudent);
  const weekStart = format(currentWeekStart, 'MMM d');
  const weekEnd = format(endOfWeek(currentWeekStart, { weekStartsOn: 1 }), 'MMM d, yyyy');
  const isCurrentWeek = format(currentWeekStart, 'yyyy-MM-dd') === format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

  if (loadingReports) {
    return (
      <DesktopLayout role="parent">
        <SafeAreaView style={styles.loadingContainer} edges={['bottom']}>
          <EduDashSpinner size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading reports...
          </Text>
        </SafeAreaView>
      </DesktopLayout>
    );
  }

  if (students.length === 0) {
    return (
      <DesktopLayout role="parent">
        <Stack.Screen
          options={{
            title: 'Weekly Reports',
            headerShown: true,
            headerStyle: { backgroundColor: theme.card },
            headerTintColor: theme.text,
          }}
        />
        <SafeAreaView style={styles.emptyContainer} edges={['bottom']}>
          <Ionicons name="document-text-outline" size={80} color={theme.textTertiary} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            No Children Found
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            You don't have any children registered in the system.
          </Text>
        </SafeAreaView>
      </DesktopLayout>
    );
  }

  return (
    <DesktopLayout role="parent">
      <Stack.Screen
        options={{
          title: 'Weekly Learning Reports',
          headerShown: true,
          headerStyle: { backgroundColor: theme.card },
          headerTintColor: theme.text,
        }}
      />
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['bottom']}>
        <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Student Selector */}
        {students.length > 1 && (
          <View style={[styles.studentSelector, { backgroundColor: theme.card }]}>
            <Text style={[styles.selectorLabel, { color: theme.textSecondary }]}>
              Select Child:
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {students.map(student => (
                <TouchableOpacity
                  key={student.id}
                  style={[
                    styles.studentButton,
                    { borderColor: theme.border },
                    selectedStudent === student.id && {
                      backgroundColor: theme.primary,
                      borderColor: theme.primary,
                    },
                  ]}
                  onPress={() => setSelectedStudent(student.id)}
                >
                  <Text
                    style={[
                      styles.studentButtonText,
                      { color: theme.text },
                      selectedStudent === student.id && { color: '#FFF' },
                    ]}
                  >
                    {student.first_name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Week Selector */}
        <View style={[styles.weekSelector, { backgroundColor: theme.card }]}>
          <TouchableOpacity
            style={styles.weekButton}
            onPress={goToPreviousWeek}
          >
            <Ionicons name="chevron-back" size={24} color={theme.primary} />
          </TouchableOpacity>

          <View style={styles.weekInfo}>
            <Text style={[styles.weekRange, { color: theme.text }]}>
              {weekStart} - {weekEnd}
            </Text>
            {!isCurrentWeek && (
              <TouchableOpacity
                style={[styles.currentWeekButton, { borderColor: theme.border }]}
                onPress={goToCurrentWeek}
              >
                <Text style={[styles.currentWeekText, { color: theme.primary }]}>
                  Current Week
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={[styles.weekButton, !isCurrentWeek && { opacity: 1 }]}
            onPress={goToNextWeek}
            disabled={isCurrentWeek}
          >
            <Ionicons
              name="chevron-forward"
              size={24}
              color={isCurrentWeek ? theme.textTertiary : theme.primary}
            />
          </TouchableOpacity>
        </View>

        {/* Report Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <EduDashSpinner size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
              Loading report...
            </Text>
          </View>
        ) : report ? (
          <WeeklyReportDetail
            report={report}
            studentName={selectedStudentData ? `${selectedStudentData.first_name} ${selectedStudentData.last_name}` : 'Your Child'}
            theme={theme}
          />
        ) : (
          <View style={[styles.noReportCard, { backgroundColor: theme.card }]}>
            <Ionicons name="calendar-outline" size={60} color={theme.textTertiary} />
            <Text style={[styles.noReportTitle, { color: theme.text }]}>
              No Report Available
            </Text>
            <Text style={[styles.noReportSubtitle, { color: theme.textSecondary }]}>
              Reports are generated every Sunday evening.{'\n'}
              Check back after the weekend for your child's weekly progress report.
            </Text>
          </View>
        )}

        <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
      <AlertModal {...alertProps} />
    </DesktopLayout>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 16,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    emptyTitle: {
      fontSize: 24,
      fontWeight: '600',
      marginTop: 20,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: 16,
      marginTop: 8,
      textAlign: 'center',
    },
    studentSelector: {
      padding: 16,
      marginHorizontal: 16,
      marginTop: 16,
      borderRadius: 12,
    },
    selectorLabel: {
      fontSize: 14,
      fontWeight: '500',
      marginBottom: 12,
    },
    studentButton: {
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 20,
      borderWidth: 2,
      marginRight: 12,
    },
    studentButtonText: {
      fontSize: 15,
      fontWeight: '600',
    },
    weekSelector: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      marginHorizontal: 16,
      marginTop: 16,
      borderRadius: 12,
    },
    weekButton: {
      padding: 8,
    },
    weekInfo: {
      flex: 1,
      alignItems: 'center',
      gap: 8,
    },
    weekRange: {
      fontSize: 18,
      fontWeight: '600',
    },
    currentWeekButton: {
      paddingVertical: 4,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
    },
    currentWeekText: {
      fontSize: 12,
      fontWeight: '600',
    },
    noReportCard: {
      margin: 16,
      padding: 40,
      borderRadius: 16,
      alignItems: 'center',
    },
    noReportTitle: {
      fontSize: 20,
      fontWeight: '600',
      marginTop: 16,
      textAlign: 'center',
    },
    noReportSubtitle: {
      fontSize: 15,
      marginTop: 8,
      textAlign: 'center',
      lineHeight: 22,
    },
  });
