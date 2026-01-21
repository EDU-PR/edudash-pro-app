/**
 * Birthday Chart Screen
 * 
 * Full-screen birthday chart displaying all students' birthdays by month.
 * Accessible by parents, teachers, and principals.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { BirthdayChart } from '@/components/dashboard/BirthdayChart';
import { BirthdayPlannerService, type StudentBirthday } from '@/services/BirthdayPlannerService';
import { getActiveOrganizationId } from '@/lib/tenant/compat';

export default function BirthdayChartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { profile } = useAuth();
  
  const [birthdays, setBirthdays] = useState<StudentBirthday[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Get organization ID from profile using tenant compatibility utility
  const organizationId = getActiveOrganizationId(profile);
  
  // Debug logging for organizationId
  useEffect(() => {
    console.log('[BirthdayChart] Profile info:', {
      organizationId,
      hasProfile: !!profile,
      profileOrgId: profile?.organization_id,
      profilePreschoolId: (profile as any)?.preschool_id,
      profileOrganizationId: (profile as any)?.organizationId,
      profileKeys: profile ? Object.keys(profile).slice(0, 15) : [], // First 15 keys for debugging
    });
  }, [profile, organizationId]);

  // Load all birthdays
  const loadBirthdays = useCallback(async () => {
    if (!organizationId) {
      console.log('[BirthdayChart] No organization ID, skipping birthday load');
      setError('Unable to determine school. Please try again.');
      return;
    }
    
    try {
      setError(null);
      console.log('[BirthdayChart] Loading birthdays for org:', organizationId);
      const data = await BirthdayPlannerService.getAllBirthdays(organizationId);
      console.log('[BirthdayChart] Loaded birthdays:', data.length, 'students');
      setBirthdays(data);
      
      if (data.length === 0) {
        console.log('[BirthdayChart] No birthdays found - students may not have DOB set');
      }
    } catch (error: any) {
      console.error('[BirthdayChart] Error loading birthdays:', error);
      setError(error.message || 'Failed to load birthdays');
    }
  }, [organizationId]);

  // Load classes for filtering
  const loadClasses = useCallback(async () => {
    if (!organizationId) return;
    
    try {
      const { assertSupabase } = await import('@/lib/supabase');
      const supabase = assertSupabase();
      
      const { data } = await supabase
        .from('classes')
        .select('id, name')
        .eq('preschool_id', organizationId)
        .eq('is_active', true)
        .order('name');
      
      setClasses(data || []);
    } catch (error) {
      console.error('[BirthdayChart] Error loading classes:', error);
    }
  }, [organizationId]);

  // Initial load
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([loadBirthdays(), loadClasses()]);
      setLoading(false);
    };
    load();
  }, [loadBirthdays, loadClasses]);

  // Refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadBirthdays();
    setRefreshing(false);
  }, [loadBirthdays]);

  // Filter birthdays by class
  const filteredBirthdays = useMemo(() => {
    if (!selectedClass) return birthdays;
    return birthdays.filter(b => b.classId === selectedClass);
  }, [birthdays, selectedClass]);

  // Get stats
  const stats = useMemo(() => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentDay = today.getDate();
    
    const todayBirthdays = birthdays.filter(b => {
      const dob = new Date(b.dateOfBirth);
      return dob.getMonth() === currentMonth && dob.getDate() === currentDay;
    });
    
    const thisMonthBirthdays = birthdays.filter(b => {
      const dob = new Date(b.dateOfBirth);
      return dob.getMonth() === currentMonth;
    });
    
    return {
      total: birthdays.length,
      today: todayBirthdays.length,
      thisMonth: thisMonthBirthdays.length,
    };
  }, [birthdays]);

  const styles = useMemo(() => createStyles(theme, isDark, insets), [theme, isDark, insets]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Stack.Screen options={{ title: 'Birthday Chart' }} />
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.loadingText}>Loading birthdays...</Text>
      </View>
    );
  }

  // Show error state if no organization ID
  if (!organizationId) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Stack.Screen options={{ title: 'Birthday Chart' }} />
        <Ionicons name="alert-circle" size={48} color={theme.warning} />
        <Text style={[styles.loadingText, { marginTop: 16 }]}>
          Unable to determine your school.
        </Text>
        <Text style={[styles.loadingText, { fontSize: 14, color: theme.textSecondary }]}>
          Please check your profile settings.
        </Text>
        <TouchableOpacity
          style={[styles.headerButton, { marginTop: 20 }]}
          onPress={() => router.back()}
        >
          <Text style={{ color: theme.primary, fontWeight: '600' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Show error state if there was an error loading data
  if (error) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Stack.Screen options={{ title: 'Birthday Chart' }} />
        <Ionicons name="warning" size={48} color={theme.error} />
        <Text style={[styles.loadingText, { marginTop: 16 }]}>
          {error}
        </Text>
        <TouchableOpacity
          style={[styles.headerButton, { marginTop: 20, backgroundColor: theme.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }]}
          onPress={onRefresh}
        >
          <Text style={{ color: theme.onPrimary, fontWeight: '600' }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: 'Birthday Chart',
          headerRight: () => (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={onRefresh}
            >
              <Ionicons name="refresh" size={22} color={theme.primary} />
            </TouchableOpacity>
          ),
        }} 
      />
      
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
      >
        {/* Stats Summary */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total Students</Text>
          </View>
          <View style={[styles.statCard, styles.statCardHighlight]}>
            <Text style={[styles.statValue, styles.statValueHighlight]}>{stats.today}</Text>
            <Text style={styles.statLabel}>Today 🎉</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.thisMonth}</Text>
            <Text style={styles.statLabel}>This Month</Text>
          </View>
        </View>

        {/* Class Filter */}
        {classes.length > 0 && (
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Filter by Class:</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  !selectedClass && styles.filterChipActive,
                ]}
                onPress={() => setSelectedClass(null)}
              >
                <Text style={[
                  styles.filterChipText,
                  !selectedClass && styles.filterChipTextActive,
                ]}>
                  All Classes
                </Text>
              </TouchableOpacity>
              
              {classes.map((cls) => (
                <TouchableOpacity
                  key={cls.id}
                  style={[
                    styles.filterChip,
                    selectedClass === cls.id && styles.filterChipActive,
                  ]}
                  onPress={() => setSelectedClass(cls.id)}
                >
                  <Text style={[
                    styles.filterChipText,
                    selectedClass === cls.id && styles.filterChipTextActive,
                  ]}>
                    {cls.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Empty State */}
        {birthdays.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={64} color={theme.textSecondary} />
            <Text style={styles.emptyStateTitle}>No Birthdays Found</Text>
            <Text style={styles.emptyStateText}>
              No students have their date of birth recorded yet.
              {'\n'}Add dates of birth to student profiles to see them here.
            </Text>
            <TouchableOpacity
              style={[styles.headerButton, { marginTop: 20, backgroundColor: theme.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }]}
              onPress={() => router.push('/screens/student-management' as any)}
            >
              <Text style={{ color: theme.onPrimary, fontWeight: '600' }}>Manage Students</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Birthday Chart */}
            <BirthdayChart
              birthdays={filteredBirthdays}
              loading={false}
              showHeader={false}
              compact={false}
            />

            {/* Legend */}
            <View style={styles.legend}>
              <Text style={styles.legendTitle}>How to use:</Text>
              <View style={styles.legendItem}>
                <Ionicons name="finger-print-outline" size={18} color={theme.textSecondary} />
                <Text style={styles.legendText}>Tap a month to see birthdays</Text>
              </View>
              <View style={styles.legendItem}>
                <Ionicons name="person" size={18} color={theme.textSecondary} />
                <Text style={styles.legendText}>Tap a student to view their profile</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: '#FFD700' }]} />
                <Text style={styles.legendText}>Today's birthdays highlighted</Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: any, isDark: boolean, insets: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: insets.bottom + 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: theme.textSecondary,
  },
  headerButton: {
    padding: 8,
    marginRight: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statCardHighlight: {
    backgroundColor: '#FFD700' + '20',
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.text,
  },
  statValueHighlight: {
    color: '#FF6B00',
  },
  statLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  filterSection: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 8,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
  },
  filterChipActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  filterChipText: {
    fontSize: 14,
    color: theme.text,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  legend: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  legendText: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  legendColor: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.text,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
