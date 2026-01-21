/**
 * Principal Fee Overview Screen
 * 
 * Displays all students with their fee status summary.
 * Allows principals to:
 * - View overall financial summary (registration vs school fees)
 * - Search and filter students
 * - Navigate to individual student fee management
 * - See quick stats on outstanding, paid, and waived fees
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
  TextInput,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';

interface StudentWithFees {
  id: string;
  first_name: string;
  last_name: string;
  class_id: string | null;
  class_name?: string;
  parent_name?: string;
  fees: {
    outstanding: number;
    paid: number;
    waived: number;
    overdue_count: number;
    pending_count: number;
  };
}

interface FinancialSummary {
  totalStudents: number;
  totalOutstanding: number;
  totalPaid: number;
  totalWaived: number;
  overdueStudents: number;
  registrationFees: {
    collected: number;
    pending: number;
  };
  schoolFees: {
    collected: number;
    pending: number;
  };
}

type FilterType = 'all' | 'outstanding' | 'paid' | 'overdue';

export default function PrincipalFeeOverviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { profile } = useAuth();
  
  const [students, setStudents] = useState<StudentWithFees[]>([]);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');

  const organizationId = profile?.organization_id || (profile as any)?.preschool_id;

  // Load all students with fee data
  const loadData = useCallback(async () => {
    if (!organizationId) return;
    
    try {
      const supabase = assertSupabase();
      
      // Fetch all students with their fees
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select(`
          id,
          first_name,
          last_name,
          class_id,
          classes(name),
          profiles!students_parent_id_fkey(first_name, last_name)
        `)
        .eq('preschool_id', organizationId)
        .eq('is_active', true)
        .order('first_name');
      
      if (studentsError) throw studentsError;

      // Fetch all fees for these students
      const studentIds = (studentsData || []).map(s => s.id);
      const { data: feesData, error: feesError } = await supabase
        .from('student_fees')
        .select('*')
        .in('student_id', studentIds);
      
      if (feesError) throw feesError;

      // Fetch registration data
      const { data: registrations, error: regError } = await supabase
        .from('registration_requests')
        .select('registration_fee_amount, payment_verified, status')
        .eq('organization_id', organizationId);
      
      if (regError) console.warn('Registration fetch error:', regError);

      // Group fees by student
      const feesByStudent = new Map<string, typeof feesData>();
      (feesData || []).forEach(fee => {
        const existing = feesByStudent.get(fee.student_id) || [];
        existing.push(fee);
        feesByStudent.set(fee.student_id, existing);
      });

      // Process students with fee summaries
      const processedStudents: StudentWithFees[] = (studentsData || []).map((student: any) => {
        const studentFees = feesByStudent.get(student.id) || [];
        const classData = Array.isArray(student.classes) ? student.classes[0] : student.classes;
        const parentData = Array.isArray(student.profiles) ? student.profiles[0] : student.profiles;
        
        const outstanding = studentFees
          .filter(f => f.status === 'pending' || f.status === 'overdue')
          .reduce((sum, f) => sum + (f.final_amount || f.amount || 0), 0);
        
        const paid = studentFees
          .filter(f => f.status === 'paid')
          .reduce((sum, f) => sum + (f.final_amount || f.amount || 0), 0);
        
        const waived = studentFees
          .reduce((sum, f) => sum + (f.waived_amount || 0), 0);
        
        const overdue_count = studentFees.filter(f => f.status === 'overdue').length;
        const pending_count = studentFees.filter(f => f.status === 'pending').length;
        
        return {
          id: student.id,
          first_name: student.first_name,
          last_name: student.last_name,
          class_id: student.class_id,
          class_name: classData?.name,
          parent_name: parentData ? `${parentData.first_name} ${parentData.last_name}` : undefined,
          fees: {
            outstanding,
            paid,
            waived,
            overdue_count,
            pending_count,
          },
        };
      });

      setStudents(processedStudents);

      // Calculate overall summary
      const totalOutstanding = processedStudents.reduce((sum, s) => sum + s.fees.outstanding, 0);
      const totalPaid = processedStudents.reduce((sum, s) => sum + s.fees.paid, 0);
      const totalWaived = processedStudents.reduce((sum, s) => sum + s.fees.waived, 0);
      const overdueStudents = processedStudents.filter(s => s.fees.overdue_count > 0).length;

      // Registration fees
      const regData = registrations || [];
      const regCollected = regData
        .filter((r: any) => r.payment_verified && r.status === 'approved')
        .reduce((sum: number, r: any) => sum + (parseFloat(r.registration_fee_amount) || 0), 0);
      const regPending = regData
        .filter((r: any) => !r.payment_verified && r.registration_fee_amount && r.status !== 'rejected')
        .reduce((sum: number, r: any) => sum + (parseFloat(r.registration_fee_amount) || 0), 0);

      setSummary({
        totalStudents: processedStudents.length,
        totalOutstanding,
        totalPaid,
        totalWaived,
        overdueStudents,
        registrationFees: {
          collected: regCollected,
          pending: regPending,
        },
        schoolFees: {
          collected: totalPaid,
          pending: totalOutstanding,
        },
      });
    } catch (error) {
      console.error('[PrincipalFeeOverview] Error loading data:', error);
    }
  }, [organizationId]);

  // Initial load
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await loadData();
      setLoading(false);
    };
    load();
  }, [loadData]);

  // Refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // Filter and search students
  const filteredStudents = useMemo(() => {
    let result = students;
    
    // Apply filter
    switch (filter) {
      case 'outstanding':
        result = result.filter(s => s.fees.outstanding > 0);
        break;
      case 'paid':
        result = result.filter(s => s.fees.paid > 0 && s.fees.outstanding === 0);
        break;
      case 'overdue':
        result = result.filter(s => s.fees.overdue_count > 0);
        break;
    }
    
    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(s => 
        s.first_name.toLowerCase().includes(query) ||
        s.last_name.toLowerCase().includes(query) ||
        s.class_name?.toLowerCase().includes(query) ||
        s.parent_name?.toLowerCase().includes(query)
      );
    }
    
    return result;
  }, [students, filter, searchQuery]);

  // Navigate to student fee management
  const handleStudentPress = (studentId: string) => {
    router.push(`/screens/principal-student-fees?studentId=${studentId}`);
  };

  // Format currency
  const formatCurrency = (amount: number) => `R ${amount.toFixed(2)}`;

  const styles = useMemo(() => createStyles(theme, isDark, insets), [theme, isDark, insets]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Stack.Screen options={{ title: 'Fee Management' }} />
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.loadingText}>Loading financial data...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: 'Fee Management',
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
        {/* Financial Summary */}
        {summary && (
          <View style={styles.summarySection}>
            <Text style={styles.sectionTitle}>Financial Overview</Text>
            
            {/* Main Stats Row */}
            <View style={styles.mainStatsRow}>
              <View style={[styles.mainStatCard, { borderLeftColor: theme.error }]}>
                <Text style={[styles.mainStatValue, { color: theme.error }]}>
                  {formatCurrency(summary.totalOutstanding)}
                </Text>
                <Text style={styles.mainStatLabel}>Outstanding</Text>
              </View>
              <View style={[styles.mainStatCard, { borderLeftColor: theme.success }]}>
                <Text style={[styles.mainStatValue, { color: theme.success }]}>
                  {formatCurrency(summary.totalPaid)}
                </Text>
                <Text style={styles.mainStatLabel}>Collected</Text>
              </View>
            </View>

            {/* Sub Stats Row */}
            <View style={styles.subStatsRow}>
              <View style={styles.subStatCard}>
                <Ionicons name="people" size={20} color={theme.primary} />
                <Text style={styles.subStatValue}>{summary.totalStudents}</Text>
                <Text style={styles.subStatLabel}>Students</Text>
              </View>
              <View style={styles.subStatCard}>
                <Ionicons name="alert-circle" size={20} color={theme.warning} />
                <Text style={[styles.subStatValue, { color: theme.warning }]}>{summary.overdueStudents}</Text>
                <Text style={styles.subStatLabel}>Overdue</Text>
              </View>
              <View style={styles.subStatCard}>
                <Ionicons name="ribbon" size={20} color="#6B7280" />
                <Text style={styles.subStatValue}>{formatCurrency(summary.totalWaived)}</Text>
                <Text style={styles.subStatLabel}>Waived</Text>
              </View>
            </View>

            {/* Fee Type Breakdown */}
            <View style={styles.breakdownSection}>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Registration Fees</Text>
                <View style={styles.breakdownValues}>
                  <Text style={[styles.breakdownValue, { color: theme.success }]}>
                    {formatCurrency(summary.registrationFees.collected)} collected
                  </Text>
                  <Text style={[styles.breakdownValue, { color: theme.warning }]}>
                    {formatCurrency(summary.registrationFees.pending)} pending
                  </Text>
                </View>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>School Fees</Text>
                <View style={styles.breakdownValues}>
                  <Text style={[styles.breakdownValue, { color: theme.success }]}>
                    {formatCurrency(summary.schoolFees.collected)} collected
                  </Text>
                  <Text style={[styles.breakdownValue, { color: theme.warning }]}>
                    {formatCurrency(summary.schoolFees.pending)} pending
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Search and Filter */}
        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color={theme.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search students..."
              placeholderTextColor={theme.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
          
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {(['all', 'outstanding', 'overdue', 'paid'] as FilterType[]).map((f) => (
              <TouchableOpacity
                key={f}
                style={[
                  styles.filterChip,
                  filter === f && styles.filterChipActive,
                ]}
                onPress={() => setFilter(f)}
              >
                <Text style={[
                  styles.filterChipText,
                  filter === f && styles.filterChipTextActive,
                ]}>
                  {f === 'all' ? 'All Students' : 
                   f === 'outstanding' ? 'Outstanding' :
                   f === 'overdue' ? 'Overdue' : 'Fully Paid'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Students List */}
        <View style={styles.studentsSection}>
          <Text style={styles.sectionTitle}>
            Students ({filteredStudents.length})
          </Text>
          
          {filteredStudents.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color={theme.textSecondary} />
              <Text style={styles.emptyTitle}>No Students Found</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery ? 'Try a different search term' : 'No students match the current filter'}
              </Text>
            </View>
          ) : (
            filteredStudents.map((student) => (
              <TouchableOpacity
                key={student.id}
                style={styles.studentCard}
                onPress={() => handleStudentPress(student.id)}
                activeOpacity={0.7}
              >
                <View style={styles.studentHeader}>
                  <View style={styles.studentAvatar}>
                    <Text style={styles.avatarText}>
                      {student.first_name.charAt(0)}{student.last_name.charAt(0)}
                    </Text>
                  </View>
                  <View style={styles.studentInfo}>
                    <Text style={styles.studentName}>
                      {student.first_name} {student.last_name}
                    </Text>
                    <Text style={styles.studentMeta}>
                      {student.class_name || 'No Class'}
                      {student.parent_name && ` • ${student.parent_name}`}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                </View>
                
                <View style={styles.feeRow}>
                  {student.fees.outstanding > 0 && (
                    <View style={[styles.feeBadge, { backgroundColor: theme.error + '15' }]}>
                      <Text style={[styles.feeBadgeText, { color: theme.error }]}>
                        {formatCurrency(student.fees.outstanding)} due
                      </Text>
                    </View>
                  )}
                  {student.fees.overdue_count > 0 && (
                    <View style={[styles.feeBadge, { backgroundColor: theme.warning + '15' }]}>
                      <Ionicons name="alert-circle" size={12} color={theme.warning} />
                      <Text style={[styles.feeBadgeText, { color: theme.warning }]}>
                        {student.fees.overdue_count} overdue
                      </Text>
                    </View>
                  )}
                  {student.fees.outstanding === 0 && student.fees.paid > 0 && (
                    <View style={[styles.feeBadge, { backgroundColor: theme.success + '15' }]}>
                      <Ionicons name="checkmark-circle" size={12} color={theme.success} />
                      <Text style={[styles.feeBadgeText, { color: theme.success }]}>
                        Up to date
                      </Text>
                    </View>
                  )}
                  {student.fees.waived > 0 && (
                    <View style={[styles.feeBadge, { backgroundColor: '#6B7280' + '15' }]}>
                      <Text style={[styles.feeBadgeText, { color: '#6B7280' }]}>
                        {formatCurrency(student.fees.waived)} waived
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
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
  summarySection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 12,
  },
  mainStatsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  mainStatCard: {
    flex: 1,
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
  },
  mainStatValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  mainStatLabel: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 4,
  },
  subStatsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  subStatCard: {
    flex: 1,
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  subStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.text,
    marginTop: 4,
  },
  subStatLabel: {
    fontSize: 11,
    color: theme.textSecondary,
    marginTop: 2,
  },
  breakdownSection: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  breakdownLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
  },
  breakdownValues: {
    alignItems: 'flex-end',
  },
  breakdownValue: {
    fontSize: 12,
    fontWeight: '500',
  },
  searchSection: {
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    height: 44,
    marginLeft: 8,
    fontSize: 15,
    color: theme.text,
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
    fontSize: 13,
    color: theme.text,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  studentsSection: {
    marginBottom: 16,
  },
  studentCard: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  studentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  studentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.primary,
  },
  studentInfo: {
    flex: 1,
    marginLeft: 12,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.text,
  },
  studentMeta: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  feeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  feeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  feeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
});
