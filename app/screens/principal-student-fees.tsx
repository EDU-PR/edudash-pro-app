/**
 * Principal Student Fee Management Screen
 * 
 * Allows principals to:
 * - View all student fees at a glance
 * - Waive fees (full or partial)
 * - Correct/adjust student fees
 * - Change student classes
 * - View registration vs school fees summary
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
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import DateTimePicker from '@react-native-community/datetimepicker';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  class_id: string | null;
  class_name?: string;
  parent_name?: string;
  parent_id?: string | null;
  preschool_id?: string | null;
  enrollment_date?: string | null;
}

interface StudentFee {
  id: string;
  student_id: string;
  amount: number;
  final_amount: number;
  status: 'pending' | 'paid' | 'overdue' | 'waived' | 'partially_paid';
  due_date: string;
  fee_type: string;
  description?: string;
  waived_amount?: number;
  waived_reason?: string;
  waived_at?: string;
  waived_by?: string;
}

interface ClassOption {
  id: string;
  name: string;
}

type ModalType = 'waive' | 'adjust' | 'change_class' | null;

export default function StudentFeeManagementScreen() {
  const router = useRouter();
  const { studentId } = useLocalSearchParams<{ studentId?: string }>();
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { profile } = useAuth();
  
  const [student, setStudent] = useState<Student | null>(null);
  const [fees, setFees] = useState<StudentFee[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showEnrollmentPicker, setShowEnrollmentPicker] = useState(false);
  
  // Modal state
  const [modalType, setModalType] = useState<ModalType>(null);
  const [selectedFee, setSelectedFee] = useState<StudentFee | null>(null);
  
  // Form state for waiver
  const [waiveAmount, setWaiveAmount] = useState('');
  const [waiveReason, setWaiveReason] = useState('');
  const [waiveType, setWaiveType] = useState<'full' | 'partial'>('full');
  
  // Form state for adjustment
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  
  // Form state for class change
  const [newClassId, setNewClassId] = useState<string>('');

  const organizationId = profile?.organization_id || (profile as any)?.preschool_id;
  const [feeBootstrapAttempted, setFeeBootstrapAttempted] = useState(false);

  // Load student data
  const loadStudent = useCallback(async () => {
    if (!studentId) return;
    
    try {
      const supabase = assertSupabase();
      
      const { data, error } = await supabase
        .from('students')
        .select(`
          id, first_name, last_name, class_id, parent_id, preschool_id, enrollment_date,
          classes!students_class_id_fkey(name),
          profiles!students_parent_id_fkey(first_name, last_name)
        `)
        .eq('id', studentId)
        .single();
      
      if (error) throw error;
      
      const classData = Array.isArray(data.classes) ? data.classes[0] : data.classes;
      const parentData = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles;
      
      setStudent({
        id: data.id,
        first_name: data.first_name,
        last_name: data.last_name,
        class_id: data.class_id,
        class_name: classData?.name,
        parent_name: parentData ? `${parentData.first_name} ${parentData.last_name}` : undefined,
        parent_id: data.parent_id,
        preschool_id: data.preschool_id,
        enrollment_date: data.enrollment_date,
      });
    } catch (error) {
      console.error('[StudentFeeManagement] Error loading student:', error);
    }
  }, [studentId]);

  // Load student fees
  const loadFees = useCallback(async () => {
    if (!studentId) return;
    
    try {
      const supabase = assertSupabase();
      
      const { data, error } = await supabase
        .from('student_fees')
        .select(`
          *,
          fee_structures(name, fee_type, description)
        `)
        .eq('student_id', studentId)
        .order('due_date', { ascending: false });
      
      if (error) throw error;
      
      const mappedFees = (data || []).map((f: any) => ({
        id: f.id,
        student_id: f.student_id,
        amount: f.amount,
        final_amount: f.final_amount || f.amount,
        status: f.status,
        due_date: f.due_date,
        fee_type: f.fee_structures?.fee_type || f.fee_type || 'tuition',
        description: f.fee_structures?.description || f.fee_structures?.name,
        waived_amount: f.waived_amount,
        waived_reason: f.waived_reason,
        waived_at: f.waived_at,
        waived_by: f.waived_by,
      }));

      if (mappedFees.length === 0 && student && !feeBootstrapAttempted) {
        setFeeBootstrapAttempted(true);
        await bootstrapFeesIfMissing(student, supabase);
        const { data: refreshed } = await supabase
          .from('student_fees')
          .select(`
            *,
            fee_structures(name, fee_type, description)
          `)
          .eq('student_id', studentId)
          .order('due_date', { ascending: false });

        const refreshedFees = (refreshed || []).map((f: any) => ({
          id: f.id,
          student_id: f.student_id,
          amount: f.amount,
          final_amount: f.final_amount || f.amount,
          status: f.status,
          due_date: f.due_date,
          fee_type: f.fee_structures?.fee_type || f.fee_type || 'tuition',
          description: f.fee_structures?.description || f.fee_structures?.name,
          waived_amount: f.waived_amount,
          waived_reason: f.waived_reason,
          waived_at: f.waived_at,
          waived_by: f.waived_by,
        }));

        setFees(refreshedFees);
        return;
      }

      setFees(mappedFees);
    } catch (error) {
      console.error('[StudentFeeManagement] Error loading fees:', error);
    }
  }, [studentId, student, feeBootstrapAttempted]);

  const bootstrapFeesIfMissing = async (targetStudent: Student, supabase: ReturnType<typeof assertSupabase>) => {
    try {
      const { data: feeStructure, error: feeError } = await supabase
        .from('fee_structures')
        .select('id, amount, effective_from, created_at')
        .eq('preschool_id', targetStudent.preschool_id || organizationId)
        .eq('fee_type', 'tuition')
        .eq('is_active', true)
        .order('effective_from', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (feeError) {
        console.warn('[StudentFeeManagement] Fee structure lookup failed:', feeError);
        return;
      }

      if (!feeStructure) {
        return;
      }

      const enrollmentDate = targetStudent.enrollment_date
        ? new Date(targetStudent.enrollment_date)
        : new Date();
      const startMonth = new Date(enrollmentDate.getFullYear(), enrollmentDate.getMonth(), 1);
      const nextMonth = new Date(startMonth.getFullYear(), startMonth.getMonth() + 1, 1);
      const feesToInsert = [startMonth, nextMonth].map(date => ({
        student_id: targetStudent.id,
        fee_structure_id: feeStructure.id,
        amount: feeStructure.amount,
        final_amount: feeStructure.amount,
        due_date: date.toISOString().split('T')[0],
        status: 'pending',
        amount_outstanding: feeStructure.amount,
      }));

      await supabase.from('student_fees').insert(feesToInsert);
    } catch (error) {
      console.warn('[StudentFeeManagement] Fee bootstrap failed (non-fatal):', error);
    }
  };

  // Load classes
  const loadClasses = useCallback(async () => {
    if (!organizationId) return;
    
    try {
      const supabase = assertSupabase();
      
      const { data, error } = await supabase
        .from('classes')
        .select('id, name')
        .eq('preschool_id', organizationId)
        .eq('active', true)
        .order('name');
      
      if (error) throw error;
      setClasses(data || []);
    } catch (error) {
      console.error('[StudentFeeManagement] Error loading classes:', error);
    }
  }, [organizationId]);

  // Initial load
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([loadStudent(), loadFees(), loadClasses()]);
      setLoading(false);
    };
    load();
  }, [loadStudent, loadFees, loadClasses]);

  // Refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadStudent(), loadFees()]);
    setRefreshing(false);
  }, [loadStudent, loadFees]);

  // Waive fee
  const handleWaiveFee = async () => {
    if (!selectedFee || !profile?.id) return;
    
    const amount = waiveType === 'full' 
      ? selectedFee.final_amount 
      : parseFloat(waiveAmount);
    
    if (waiveType === 'partial' && (!amount || amount <= 0 || amount > selectedFee.final_amount)) {
      Alert.alert('Invalid Amount', 'Please enter a valid waiver amount.');
      return;
    }
    
    if (!waiveReason.trim()) {
      Alert.alert('Reason Required', 'Please provide a reason for the waiver.');
      return;
    }
    
    setSaving(true);
    try {
      const supabase = assertSupabase();
      
      const newFinalAmount = selectedFee.final_amount - amount;
      const newStatus = newFinalAmount <= 0 ? 'waived' : selectedFee.status;
      
      const { error } = await supabase
        .from('student_fees')
        .update({
          final_amount: Math.max(0, newFinalAmount),
          waived_amount: (selectedFee.waived_amount || 0) + amount,
          waived_reason: waiveReason.trim(),
          waived_at: new Date().toISOString(),
          waived_by: profile.id,
          status: newStatus,
          amount_outstanding: Math.max(0, newFinalAmount),
        })
        .eq('id', selectedFee.id);
      
      if (error) throw error;
      
      Alert.alert(
        'Fee Waived',
        waiveType === 'full' 
          ? 'The fee has been fully waived.' 
          : `R${amount.toFixed(2)} has been waived from this fee.`
      );
      
      setModalType(null);
      setSelectedFee(null);
      setWaiveAmount('');
      setWaiveReason('');
      setWaiveType('full');
      loadFees();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to waive fee.');
    } finally {
      setSaving(false);
    }
  };

  // Adjust fee
  const handleAdjustFee = async () => {
    if (!selectedFee || !profile?.id) return;
    
    const amount = parseFloat(adjustAmount);
    
    if (!amount || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }
    
    if (!adjustReason.trim()) {
      Alert.alert('Reason Required', 'Please provide a reason for the adjustment.');
      return;
    }
    
    setSaving(true);
    try {
      const supabase = assertSupabase();
      
      const { error } = await supabase
        .from('student_fees')
        .update({
          amount: amount,
          final_amount: amount,
          amount_outstanding: amount,
          status: 'pending',
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedFee.id);
      
      if (error) throw error;
      
      // Log the adjustment
      try {
        await supabase.from('fee_adjustments').insert({
          fee_id: selectedFee.id,
          student_id: selectedFee.student_id,
          previous_amount: selectedFee.final_amount,
          new_amount: amount,
          reason: adjustReason.trim(),
          adjusted_by: profile.id,
        });
      } catch {
        // Ignore if table doesn't exist
      }
      
      Alert.alert('Fee Adjusted', `Fee amount updated to R${amount.toFixed(2)}.`);
      
      setModalType(null);
      setSelectedFee(null);
      setAdjustAmount('');
      setAdjustReason('');
      loadFees();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to adjust fee.');
    } finally {
      setSaving(false);
    }
  };

  // Change class
  const handleChangeClass = async () => {
    if (!student || !newClassId) return;
    
    setSaving(true);
    try {
      const supabase = assertSupabase();
      
      const { error } = await supabase
        .from('students')
        .update({
          class_id: newClassId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', student.id);
      
      if (error) throw error;
      
      const newClass = classes.find(c => c.id === newClassId);
      Alert.alert('Class Changed', `Student moved to ${newClass?.name || 'new class'}.`);
      
      setModalType(null);
      setNewClassId('');
      loadStudent();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to change class.');
    } finally {
      setSaving(false);
    }
  };

  const getEnrollmentMonthStart = useCallback((date?: string | null) => {
    if (!date) return null;
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return null;
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }, []);

  const handleUpdateEnrollmentDate = async (date: Date) => {
    if (!student) return;
    setSaving(true);
    try {
      const supabase = assertSupabase();
      const formatted = date.toISOString().split('T')[0];
      const { error } = await supabase
        .from('students')
        .update({ enrollment_date: formatted, updated_at: new Date().toISOString() })
        .eq('id', student.id);
      
      if (error) throw error;
      
      setStudent({
        ...student,
        enrollment_date: formatted,
      });
      
      Alert.alert('Start Date Updated', `Enrollment start set to ${formatted}.`);
      loadFees();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update enrollment date.');
    } finally {
      setSaving(false);
    }
  };

  const upsertPaymentRecord = async (fee: StudentFee, status: 'completed' | 'reversed') => {
    if (!student) return;
    const supabase = assertSupabase();
    const nowIso = new Date().toISOString();
    const paymentReference = `MANUAL-FEE-${fee.id.slice(0, 8)}`;
    const amount = fee.final_amount || fee.amount;
    const preschoolId = student.preschool_id || organizationId;
    if (!preschoolId) return;

    const { data: existing } = await supabase
      .from('payments')
      .select('id')
      .eq('payment_reference', paymentReference)
      .maybeSingle();

    if (existing?.id) {
      await supabase
        .from('payments')
        .update({
          status,
          amount,
          amount_cents: Math.round(amount * 100),
          reviewed_at: nowIso,
          reviewed_by: profile?.id || undefined,
          updated_at: nowIso,
        })
        .eq('id', existing.id);
      return;
    }

    await supabase.from('payments').insert({
      amount,
      amount_cents: Math.round(amount * 100),
      currency: 'ZAR',
      status,
      payment_method: 'manual',
      payment_reference: paymentReference,
      description: fee.description || fee.fee_type || 'School fees payment',
      preschool_id: preschoolId,
      student_id: student.id,
      parent_id: student.parent_id || null,
      fee_ids: [fee.id],
      reviewed_at: nowIso,
      reviewed_by: profile?.id || undefined,
      submitted_at: nowIso,
      metadata: { source: 'manual_principal_update', fee_id: fee.id },
    });
  };

  const upsertFinancialTransaction = async (fee: StudentFee, status: 'completed' | 'voided') => {
    if (!student || !profile?.id) return;
    const supabase = assertSupabase();
    const nowIso = new Date().toISOString();
    const reference = `MANUAL-FEE-${fee.id.slice(0, 8)}`;
    const amount = fee.final_amount || fee.amount;
    const preschoolId = student.preschool_id || organizationId;
    if (!preschoolId) return;

    const { data: existing } = await supabase
      .from('financial_transactions')
      .select('id')
      .eq('payment_reference', reference)
      .maybeSingle();

    if (existing?.id) {
      await supabase
        .from('financial_transactions')
        .update({
          status,
          amount,
          approved_at: status === 'completed' ? nowIso : null,
          approved_by: status === 'completed' ? profile.id : null,
          updated_at: nowIso,
        })
        .eq('id', existing.id);
      return;
    }

    await supabase.from('financial_transactions').insert({
      amount,
      description: fee.description || fee.fee_type || 'School fees payment',
      type: 'fee_payment',
      status,
      payment_method: 'manual',
      payment_reference: reference,
      preschool_id: preschoolId,
      student_id: student.id,
      created_by: profile.id,
      approved_by: status === 'completed' ? profile.id : null,
      approved_at: status === 'completed' ? nowIso : null,
      metadata: { source: 'manual_principal_update', fee_id: fee.id },
    });
  };

  const handleMarkPaid = async (fee: StudentFee) => {
    if (!profile?.id) return;
    setSaving(true);
    try {
      const supabase = assertSupabase();
      const nowIso = new Date().toISOString();
      const paidDate = nowIso.split('T')[0];
      const amount = fee.final_amount || fee.amount;

      const { error } = await supabase
        .from('student_fees')
        .update({
          status: 'paid',
          paid_date: paidDate,
          amount_paid: amount,
          amount_outstanding: 0,
          updated_at: nowIso,
        })
        .eq('id', fee.id);
      
      if (error) throw error;
      
      await upsertPaymentRecord(fee, 'completed');
      await upsertFinancialTransaction(fee, 'completed');
      
      Alert.alert('Payment Updated', 'Fee marked as paid.');
      loadFees();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update fee status.');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkUnpaid = async (fee: StudentFee) => {
    if (!profile?.id) return;
    setSaving(true);
    try {
      const supabase = assertSupabase();
      const nowIso = new Date().toISOString();
      const amount = fee.final_amount || fee.amount;

      const { error } = await supabase
        .from('student_fees')
        .update({
          status: 'pending',
          paid_date: null,
          amount_paid: null,
          amount_outstanding: amount,
          updated_at: nowIso,
        })
        .eq('id', fee.id);
      
      if (error) throw error;
      
      await upsertPaymentRecord(fee, 'reversed');
      await upsertFinancialTransaction(fee, 'voided');
      
      Alert.alert('Payment Updated', 'Fee marked as unpaid.');
      loadFees();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update fee status.');
    } finally {
      setSaving(false);
    }
  };

  // Calculate totals
  const totals = useMemo(() => {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const enrollmentStart = getEnrollmentMonthStart(student?.enrollment_date);

    const isPreEnrollment = (fee: StudentFee) => {
      if (!enrollmentStart || !fee.due_date) return false;
      const due = new Date(fee.due_date);
      if (Number.isNaN(due.getTime())) return false;
      return due < enrollmentStart;
    };

    const unpaidStatuses = new Set(['pending', 'overdue', 'partially_paid']);
    const pending = fees.filter(f => {
      if (isPreEnrollment(f)) return false;
      if (!unpaidStatuses.has(f.status)) return false;
      if (!f.due_date) return true;
      const due = new Date(f.due_date);
      if (Number.isNaN(due.getTime())) return true;
      return due <= todayStart;
    });
    const paid = fees.filter(f => f.status === 'paid');
    const waived = fees.filter(f => f.status === 'waived' || f.waived_amount);
    
    return {
      outstanding: pending.reduce((sum, f) => sum + f.final_amount, 0),
      paid: paid.reduce((sum, f) => sum + f.final_amount, 0),
      waived: waived.reduce((sum, f) => sum + (f.waived_amount || 0), 0),
    };
  }, [fees]);

  const displayFees = useMemo(() => {
    const enrollmentStart = getEnrollmentMonthStart(student?.enrollment_date);
    if (!enrollmentStart) return fees;
    return fees.filter(f => {
      if (!f.due_date) return true;
      const due = new Date(f.due_date);
      if (Number.isNaN(due.getTime())) return true;
      return due >= enrollmentStart;
    });
  }, [fees, student?.enrollment_date, getEnrollmentMonthStart]);

  const styles = useMemo(() => createStyles(theme, isDark, insets), [theme, isDark, insets]);

  // Format currency
  const formatCurrency = (amount: number) => `R ${amount.toFixed(2)}`;
  
  // Format date
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return theme.success;
      case 'pending': return theme.warning;
      case 'overdue': return theme.error;
      case 'waived': return theme.info || '#6B7280';
      default: return theme.textSecondary;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <Stack.Screen options={{ title: 'Fee Management' }} />
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </SafeAreaView>
    );
  }

  if (!student) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <Stack.Screen options={{ title: 'Fee Management' }} />
        <Ionicons name="person-outline" size={64} color={theme.textSecondary} />
        <Text style={styles.emptyTitle}>Student Not Found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: `${student.first_name}'s Fees` }} />
      
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
        {/* Student Info Card */}
        <View style={styles.studentCard}>
          <View style={styles.studentInfo}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {student.first_name.charAt(0)}{student.last_name.charAt(0)}
              </Text>
            </View>
            <View style={styles.studentDetails}>
              <Text style={styles.studentName}>
                {student.first_name} {student.last_name}
              </Text>
              <Text style={styles.studentMeta}>
                {student.class_name || 'No Class'} • {student.parent_name || 'No Parent'}
              </Text>
            </View>
          </View>

          <View style={styles.enrollmentRow}>
            <Text style={styles.enrollmentLabel}>Start Date</Text>
            <TouchableOpacity
              style={styles.enrollmentButton}
              onPress={() => setShowEnrollmentPicker(true)}
            >
              <Ionicons name="calendar" size={16} color={theme.primary} />
              <Text style={styles.enrollmentButtonText}>
                {student.enrollment_date ? formatDate(student.enrollment_date) : 'Set Date'}
              </Text>
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity
            style={styles.changeClassButton}
            onPress={() => {
              setNewClassId(student.class_id || '');
              setModalType('change_class');
            }}
          >
            <Ionicons name="swap-horizontal" size={18} color={theme.primary} />
            <Text style={styles.changeClassText}>Change Class</Text>
          </TouchableOpacity>
        </View>

        {showEnrollmentPicker && (
          <DateTimePicker
            value={student.enrollment_date ? new Date(student.enrollment_date) : new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, selectedDate) => {
              if (Platform.OS !== 'ios') setShowEnrollmentPicker(false);
              if (selectedDate) {
                handleUpdateEnrollmentDate(selectedDate);
              }
            }}
          />
        )}

        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { borderLeftColor: theme.error }]}>
            <Text style={styles.summaryLabel}>Outstanding</Text>
            <Text style={[styles.summaryValue, { color: theme.error }]}>
              {formatCurrency(totals.outstanding)}
            </Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: theme.success }]}>
            <Text style={styles.summaryLabel}>Paid</Text>
            <Text style={[styles.summaryValue, { color: theme.success }]}>
              {formatCurrency(totals.paid)}
            </Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: '#6B7280' }]}>
            <Text style={styles.summaryLabel}>Waived</Text>
            <Text style={[styles.summaryValue, { color: '#6B7280' }]}>
              {formatCurrency(totals.waived)}
            </Text>
          </View>
        </View>

        {/* Fees List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fee History</Text>
          
          {displayFees.length === 0 ? (
            <View style={styles.emptyFees}>
              <Ionicons name="receipt-outline" size={48} color={theme.textSecondary} />
              <Text style={styles.emptyFeesText}>No fees recorded</Text>
            </View>
          ) : (
            displayFees.map((fee) => (
              <View key={fee.id} style={styles.feeCard}>
                <View style={styles.feeHeader}>
                  <View>
                    <Text style={styles.feeDescription}>
                      {fee.description || fee.fee_type}
                    </Text>
                    <Text style={styles.feeDueDate}>
                      Due: {formatDate(fee.due_date)}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(fee.status) + '20' }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(fee.status) }]}>
                      {fee.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.feeAmounts}>
                  <View style={styles.amountRow}>
                    <Text style={styles.amountLabel}>Original:</Text>
                    <Text style={styles.amountValue}>{formatCurrency(fee.amount)}</Text>
                  </View>
                  {fee.waived_amount && fee.waived_amount > 0 && (
                    <View style={styles.amountRow}>
                      <Text style={styles.amountLabel}>Waived:</Text>
                      <Text style={[styles.amountValue, { color: '#6B7280' }]}>
                        -{formatCurrency(fee.waived_amount)}
                      </Text>
                    </View>
                  )}
                  <View style={styles.amountRow}>
                    <Text style={styles.amountLabel}>Final:</Text>
                    <Text style={[styles.amountValue, styles.finalAmount]}>
                      {formatCurrency(fee.final_amount)}
                    </Text>
                  </View>
                </View>
                
                {fee.waived_reason && (
                  <View style={styles.waiverNote}>
                    <Ionicons name="information-circle" size={14} color={theme.textSecondary} />
                    <Text style={styles.waiverNoteText}>
                      Waiver: {fee.waived_reason}
                    </Text>
                  </View>
                )}
                
                {/* Actions */}
                {(fee.status === 'pending' || fee.status === 'overdue' || fee.status === 'partially_paid') && (
                  <>
                    <View style={styles.feeActions}>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.paidButton]}
                        onPress={() => handleMarkPaid(fee)}
                      >
                        <Ionicons name="checkmark-circle" size={16} color={theme.success} />
                        <Text style={styles.paidButtonText}>Mark Paid</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.feeActions}>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.waiveButton]}
                        onPress={() => {
                          setSelectedFee(fee);
                          setWaiveType('full');
                          setWaiveAmount('');
                          setWaiveReason('');
                          setModalType('waive');
                        }}
                      >
                        <Ionicons name="checkmark-done" size={16} color="#6B7280" />
                        <Text style={styles.waiveButtonText}>Waive</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={[styles.actionButton, styles.adjustButton]}
                        onPress={() => {
                          setSelectedFee(fee);
                          setAdjustAmount(fee.final_amount.toString());
                          setAdjustReason('');
                          setModalType('adjust');
                        }}
                      >
                        <Ionicons name="create" size={16} color={theme.primary} />
                        <Text style={styles.adjustButtonText}>Adjust</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}

                {fee.status === 'paid' && (
                  <View style={styles.feeActions}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.unpaidButton]}
                      onPress={() => handleMarkUnpaid(fee)}
                    >
                      <Ionicons name="refresh" size={16} color={theme.warning} />
                      <Text style={styles.unpaidButtonText}>Mark Unpaid</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Waive Fee Modal */}
      <Modal
        visible={modalType === 'waive'}
        transparent
        animationType="slide"
        onRequestClose={() => setModalType(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Waive Fee</Text>
              <TouchableOpacity onPress={() => setModalType(null)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            
            {selectedFee && (
              <>
                <Text style={styles.modalSubtitle}>
                  Current Amount: {formatCurrency(selectedFee.final_amount)}
                </Text>
                
                <View style={styles.waiveTypeRow}>
                  <TouchableOpacity
                    style={[
                      styles.waiveTypeButton,
                      waiveType === 'full' && styles.waiveTypeButtonActive,
                    ]}
                    onPress={() => setWaiveType('full')}
                  >
                    <Text style={[
                      styles.waiveTypeText,
                      waiveType === 'full' && styles.waiveTypeTextActive,
                    ]}>
                      Full Waiver
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.waiveTypeButton,
                      waiveType === 'partial' && styles.waiveTypeButtonActive,
                    ]}
                    onPress={() => setWaiveType('partial')}
                  >
                    <Text style={[
                      styles.waiveTypeText,
                      waiveType === 'partial' && styles.waiveTypeTextActive,
                    ]}>
                      Partial Waiver
                    </Text>
                  </TouchableOpacity>
                </View>
                
                {waiveType === 'partial' && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Amount to Waive (R)</Text>
                    <TextInput
                      style={styles.input}
                      value={waiveAmount}
                      onChangeText={setWaiveAmount}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor={theme.textSecondary}
                    />
                  </View>
                )}
                
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Reason for Waiver *</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={waiveReason}
                    onChangeText={setWaiveReason}
                    placeholder="e.g., Financial hardship, Scholarship recipient"
                    placeholderTextColor={theme.textSecondary}
                    multiline
                    numberOfLines={3}
                  />
                </View>
                
                <TouchableOpacity
                  style={[styles.submitButton, saving && styles.submitButtonDisabled]}
                  onPress={handleWaiveFee}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitButtonText}>
                      Waive {waiveType === 'full' ? 'Full Amount' : 'Partial Amount'}
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Adjust Fee Modal */}
      <Modal
        visible={modalType === 'adjust'}
        transparent
        animationType="slide"
        onRequestClose={() => setModalType(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Adjust Fee Amount</Text>
              <TouchableOpacity onPress={() => setModalType(null)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            
            {selectedFee && (
              <>
                <Text style={styles.modalSubtitle}>
                  Current Amount: {formatCurrency(selectedFee.final_amount)}
                </Text>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>New Amount (R) *</Text>
                  <TextInput
                    style={styles.input}
                    value={adjustAmount}
                    onChangeText={setAdjustAmount}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Reason for Adjustment *</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={adjustReason}
                    onChangeText={setAdjustReason}
                    placeholder="e.g., Correction, Age group change, Discount applied"
                    placeholderTextColor={theme.textSecondary}
                    multiline
                    numberOfLines={3}
                  />
                </View>
                
                <TouchableOpacity
                  style={[styles.submitButton, saving && styles.submitButtonDisabled]}
                  onPress={handleAdjustFee}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitButtonText}>Update Fee Amount</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Change Class Modal */}
      <Modal
        visible={modalType === 'change_class'}
        transparent
        animationType="slide"
        onRequestClose={() => setModalType(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Class</Text>
              <TouchableOpacity onPress={() => setModalType(null)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalSubtitle}>
              Current: {student?.class_name || 'No Class'}
            </Text>
            
            <View style={styles.classOptions}>
              {classes.map((cls) => (
                <TouchableOpacity
                  key={cls.id}
                  style={[
                    styles.classOption,
                    newClassId === cls.id && styles.classOptionSelected,
                  ]}
                  onPress={() => setNewClassId(cls.id)}
                >
                  <Text style={[
                    styles.classOptionText,
                    newClassId === cls.id && styles.classOptionTextSelected,
                  ]}>
                    {cls.name}
                  </Text>
                  {newClassId === cls.id && (
                    <Ionicons name="checkmark" size={20} color={theme.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
            
            <TouchableOpacity
              style={[
                styles.submitButton,
                (!newClassId || newClassId === student?.class_id || saving) && styles.submitButtonDisabled,
              ]}
              onPress={handleChangeClass}
              disabled={!newClassId || newClassId === student?.class_id || saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Change Class</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    padding: 24,
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
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
    marginTop: 16,
  },
  backButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: theme.primary,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  studentCard: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.primary,
  },
  studentDetails: {
    flex: 1,
    marginLeft: 12,
  },
  studentName: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
  },
  studentMeta: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 2,
  },
  enrollmentRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  enrollmentLabel: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  enrollmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: theme.primary + '15',
  },
  enrollmentButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.primary,
  },
  changeClassButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: theme.primary + '10',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  changeClassText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.primary,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 12,
  },
  emptyFees: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
  },
  emptyFeesText: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 8,
  },
  feeCard: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  feeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  feeDescription: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.text,
  },
  feeDueDate: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  feeAmounts: {
    backgroundColor: theme.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  amountLabel: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  amountValue: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.text,
  },
  finalAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  waiverNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  waiverNoteText: {
    fontSize: 12,
    color: theme.textSecondary,
    fontStyle: 'italic',
    flex: 1,
  },
  feeActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  waiveButton: {
    backgroundColor: '#6B7280' + '15',
  },
  waiveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  adjustButton: {
    backgroundColor: theme.primary + '15',
  },
  adjustButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.primary,
  },
  paidButton: {
    backgroundColor: theme.success + '15',
  },
  paidButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.success,
  },
  unpaidButton: {
    backgroundColor: theme.warning + '15',
  },
  unpaidButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.warning,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: insets.bottom + 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.text,
  },
  modalSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 20,
  },
  waiveTypeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  waiveTypeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: theme.border,
    alignItems: 'center',
  },
  waiveTypeButtonActive: {
    borderColor: theme.primary,
    backgroundColor: theme.primary + '10',
  },
  waiveTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  waiveTypeTextActive: {
    color: theme.primary,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.background,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: theme.text,
    borderWidth: 1,
    borderColor: theme.border,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: theme.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  classOptions: {
    marginBottom: 20,
  },
  classOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: theme.background,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  classOptionSelected: {
    borderColor: theme.primary,
    backgroundColor: theme.primary + '10',
  },
  classOptionText: {
    fontSize: 16,
    color: theme.text,
  },
  classOptionTextSelected: {
    fontWeight: '600',
    color: theme.primary,
  },
});
