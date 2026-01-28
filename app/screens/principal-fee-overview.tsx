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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
    fee_count: number;
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
type TimeFilter = 'month' | 'all';

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
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('month');

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
          enrollment_date,
          class_id,
          classes!students_class_id_fkey(name),
          profiles!students_parent_id_fkey(first_name, last_name)
        `)
        .eq('preschool_id', organizationId)
        .eq('is_active', true)
        .order('first_name');
      
      if (studentsError) throw studentsError;

      // Fetch all fees for these students
      const studentIds = (studentsData || []).map(s => s.id);
      const { data: feesData, error: feesError } = studentIds.length
        ? await supabase
            .from('student_fees')
            .select('*')
            .in('student_id', studentIds)
        : { data: [], error: null };
      
      if (feesError) throw feesError;

      // Fetch registration data (EduSite sync)
      const { data: registrations, error: regError } = await supabase
        .from('registration_requests')
        .select('registration_fee_amount, payment_verified, status, created_at')
        .eq('organization_id', organizationId);
      
      if (regError) console.warn('Registration fetch error:', regError);

      // Fetch in-app registration data
      const { data: inAppRegistrations, error: inAppRegError } = await supabase
        .from('child_registration_requests')
        .select('registration_fee_amount, payment_verified, status, created_at')
        .eq('preschool_id', organizationId);

      if (inAppRegError) console.warn('In-app registration fetch error:', inAppRegError);

      // Group fees by student
      const feesByStudent = new Map<string, typeof feesData>();
      (feesData || []).forEach(fee => {
        const existing = feesByStudent.get(fee.student_id) || [];
        existing.push(fee);
        feesByStudent.set(fee.student_id, existing);
      });

      // Process students with fee summaries
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const unpaidStatuses = new Set(['pending', 'overdue', 'partially_paid', 'pending_verification']);

      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);

      const toNumber = (value: unknown) => {
        const num = Number(value);
        return Number.isFinite(num) ? num : 0;
      };

      const getFeeAmount = (fee: any) => {
        const finalAmount = toNumber(fee?.final_amount);
        if (finalAmount > 0) return finalAmount;
        return toNumber(fee?.amount);
      };

      const getPaidAmount = (fee: any) => {
        const paid = toNumber(fee?.amount_paid);
        if (paid > 0) return paid;
        return fee?.status === 'paid' ? getFeeAmount(fee) : 0;
      };

      const getOutstandingAmount = (fee: any) => {
        const outstanding = toNumber(fee?.amount_outstanding);
        if (outstanding > 0) return outstanding;
        if (unpaidStatuses.has(String(fee?.status))) {
          return getFeeAmount(fee);
        }
        return 0;
      };

      const isInMonth = (dateString?: string | null) => {
        if (!dateString) return false;
        const date = new Date(dateString);
        if (Number.isNaN(date.getTime())) return false;
        return date >= monthStart && date < monthEnd;
      };

      const processedStudents: StudentWithFees[] = (studentsData || []).map((student: any) => {
        const studentFees = feesByStudent.get(student.id) || [];
        const classData = Array.isArray(student.classes) ? student.classes[0] : student.classes;
        const parentData = Array.isArray(student.profiles) ? student.profiles[0] : student.profiles;

        const enrollmentDate = student.enrollment_date ? new Date(student.enrollment_date) : null;
        const enrollmentMonthStart = enrollmentDate
          ? new Date(enrollmentDate.getFullYear(), enrollmentDate.getMonth(), 1)
          : null;

        const isPreEnrollment = (fee: any) => {
          if (!enrollmentMonthStart || !fee?.due_date) return false;
          const due = new Date(fee.due_date);
          if (Number.isNaN(due.getTime())) return false;
          return due < enrollmentMonthStart;
        };

        const isDueNow = (fee: any) => {
          if (!fee?.due_date) return true;
          const due = new Date(fee.due_date);
          if (Number.isNaN(due.getTime())) return true;
          return due <= todayStart;
        };
        
        const payableFees = studentFees.filter(f => !isPreEnrollment(f));
        const monthFees = payableFees.filter((f: any) => {
          if (isInMonth(f?.due_date)) return true;
          return isInMonth(f?.created_at);
        });
        const baseFees = timeFilter === 'month' ? monthFees : payableFees;
        const dueFees = baseFees.filter(
          (f: any) => unpaidStatuses.has(String(f.status)) && String(f.status) !== 'pending_verification' && isDueNow(f)
        );
        
        const outstanding = dueFees
          .reduce((sum, f) => sum + getOutstandingAmount(f), 0);
        
        const paid = baseFees
          .reduce((sum, f) => sum + getPaidAmount(f), 0);
        
        const waived = baseFees
          .reduce((sum, f) => sum + toNumber(f.waived_amount), 0);
        
        const overdue_count = baseFees.filter((f: any) => {
          if (!unpaidStatuses.has(String(f.status)) || String(f.status) === 'pending_verification') return false;
          if (!f?.due_date) return false;
          const due = new Date(f.due_date);
          if (Number.isNaN(due.getTime())) return false;
          return due < todayStart;
        }).length;
        const pending_count = baseFees.filter((f: any) => {
          if (!unpaidStatuses.has(String(f.status)) || String(f.status) === 'pending_verification') return false;
          if (!f?.due_date) return true;
          const due = new Date(f.due_date);
          if (Number.isNaN(due.getTime())) return true;
          return due >= todayStart;
        }).length;
        
        return {
          id: student.id,
          first_name: student.first_name,
          last_name: student.last_name,
          class_id: student.class_id,
          class_name: classData?.name,
          parent_name: parentData ? `${parentData.first_name} ${parentData.last_name}` : undefined,
          fees: {
            fee_count: baseFees.length,
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
      const regData = [...(registrations || []), ...(inAppRegistrations || [])];
      const filterByTime = (r: any) => {
        if (timeFilter !== 'month') return true;
        if (!r?.created_at) return false;
        const created = new Date(r.created_at);
        if (Number.isNaN(created.getTime())) return false;
        return created >= monthStart && created < monthEnd;
      };

      const regCollected = regData
        .filter(filterByTime)
        .filter((r: any) => r.payment_verified && r.status === 'approved')
        .reduce((sum: number, r: any) => sum + (parseFloat(r.registration_fee_amount) || 0), 0);
      const regPending = regData
        .filter(filterByTime)
        .filter((r: any) => !r.payment_verified && r.registration_fee_amount && r.status !== 'rejected')
        .reduce((sum: number, r: any) => sum + (parseFloat(r.registration_fee_amount) || 0), 0);

      const combinedCollected = totalPaid + regCollected;
      const combinedOutstanding = totalOutstanding + regPending;

      setSummary({
        totalStudents: processedStudents.length,
        totalOutstanding: combinedOutstanding,
        totalPaid: combinedCollected,
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
  }, [organizationId, timeFilter]);

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
  const isFullyPaid = useCallback((student: StudentWithFees) => {
    return (
      student.fees.outstanding <= 0 &&
      student.fees.overdue_count === 0 &&
      student.fees.pending_count === 0
    );
  }, []);

  const filteredStudents = useMemo(() => {
    let result = students;
    
    // Apply filter
    switch (filter) {
      case 'outstanding':
        result = result.filter(s => s.fees.outstanding > 0);
        break;
      case 'paid':
        result = result.filter(isFullyPaid);
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
  }, [students, filter, searchQuery, isFullyPaid]);

  // Navigate to student fee management
  const handleStudentPress = (studentId: string) => {
    router.push(`/screens/principal-student-fees?studentId=${studentId}`);
  };

  // Format currency
  const formatCurrency = (amount: number) => `R ${amount.toFixed(2)}`;

  const styles = useMemo(() => createStyles(theme, isDark, insets), [theme, isDark, insets]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <Stack.Screen options={{ title: 'Fee Management' }} />
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.loadingText}>Loading financial data...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
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
            <View style={styles.summaryHeader}>
              <Text style={styles.sectionTitle}>Financial Overview</Text>
              <View style={styles.summaryActions}>
                <TouchableOpacity
                  style={styles.expensesButton}
                  onPress={() => router.push('/screens/financial-dashboard')}
                >
                  <Ionicons name="cash-outline" size={16} color={theme.primary} />
                  <Text style={styles.expensesButtonText}>Expenses & Petty Cash</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.manageFeesButton}
                  onPress={() => router.push('/screens/admin/fee-management')}
                >
                  <Ionicons name="wallet-outline" size={16} color={theme.primary} />
                  <Text style={styles.expensesButtonText}>Manage Fee Structures</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.timeFilterRow}>
              <TouchableOpacity
                style={[styles.timeChip, timeFilter === 'month' && styles.timeChipActive]}
                onPress={() => setTimeFilter('month')}
              >
                <Text style={[styles.timeChipText, timeFilter === 'month' && styles.timeChipTextActive]}>
                  This Month
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.timeChip, timeFilter === 'all' && styles.timeChipActive]}
                onPress={() => setTimeFilter('all')}
              >
                <Text style={[styles.timeChipText, timeFilter === 'all' && styles.timeChipTextActive]}>
                  All Time
                </Text>
              </TouchableOpacity>
            </View>
            
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
                  {isFullyPaid(student) && (
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
    </SafeAreaView>
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
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 12,
  },
  summaryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  expensesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
  },
  expensesButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.text,
  },
  manageFeesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
  },
  timeFilterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  timeChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
  },
  timeChipActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  timeChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.text,
  },
  timeChipTextActive: {
    color: '#FFFFFF',
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
