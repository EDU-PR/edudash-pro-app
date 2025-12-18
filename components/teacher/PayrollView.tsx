/**
 * PayrollView Component
 * 
 * Displays teacher salary and payroll information.
 * Extracted from app/screens/teacher-management.tsx per WARP.md standards.
 */

import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Teacher } from '@/types/teacher-management';
import type { ThemeColors } from '@/contexts/ThemeContext';

interface PayrollViewProps {
  teachers: Teacher[];
  theme?: ThemeColors;
  onGeneratePayslip?: (teacherId: string) => void;
}

export function PayrollView({ teachers, theme, onGeneratePayslip }: PayrollViewProps) {
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const handleGeneratePayslip = (teacher: Teacher) => {
    if (onGeneratePayslip) {
      onGeneratePayslip(teacher.id);
    } else {
      Alert.alert(
        '📄 Payslip Generation',
        `Generate payslip for ${teacher.firstName} ${teacher.lastName}?\n\nNet: R${teacher.salary.net.toLocaleString()}`,
        [
          { text: 'Generate', style: 'default', onPress: () => Alert.alert('Success', 'Payslip generated and ready for download!') },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    }
  };

  const renderPayrollCard = ({ item }: { item: Teacher }) => (
    <View style={styles.payrollCard}>
      <View style={styles.payrollHeader}>
        <View style={styles.teacherDetails}>
          <Text style={styles.teacherName}>
            {item.firstName} {item.lastName}
          </Text>
          <Text style={styles.payScale}>{item.salary.payScale}</Text>
        </View>
      </View>
      <View style={styles.salaryBreakdown}>
        <View style={styles.salaryRow}>
          <Text style={styles.salaryLabel}>Basic Salary:</Text>
          <Text style={styles.salaryAmount}>R{item.salary.basic.toLocaleString()}</Text>
        </View>
        <View style={styles.salaryRow}>
          <Text style={styles.salaryLabel}>Allowances:</Text>
          <Text style={styles.salaryAmount}>R{item.salary.allowances.toLocaleString()}</Text>
        </View>
        <View style={styles.salaryRow}>
          <Text style={styles.salaryLabel}>Deductions:</Text>
          <Text style={[styles.salaryAmount, styles.deduction]}>
            -R{item.salary.deductions.toLocaleString()}
          </Text>
        </View>
        <View style={[styles.salaryRow, styles.netRow]}>
          <Text style={styles.netLabel}>Net Salary:</Text>
          <Text style={styles.netAmount}>R{item.salary.net.toLocaleString()}</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.payrollButton} onPress={() => handleGeneratePayslip(item)}>
        <Ionicons name="document-text" size={16} color="white" />
        <Text style={styles.payrollButtonText}>Generate Payslip</Text>
      </TouchableOpacity>
    </View>
  );

  // Calculate totals
  const totalPayroll = teachers.reduce((sum, t) => sum + t.salary.net, 0);

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Payroll Management</Text>
          <Text style={styles.sectionSubtitle}>Monthly salary overview</Text>
        </View>
        <View style={styles.totalBadge}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalAmount}>R{totalPayroll.toLocaleString()}</Text>
        </View>
      </View>
      <FlatList
        data={teachers}
        renderItem={renderPayrollCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="card-outline" size={48} color={theme?.textSecondary || '#9ca3af'} />
            <Text style={styles.emptyText}>No payroll data available</Text>
          </View>
        }
      />
    </View>
  );
}

const createStyles = (theme?: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 16,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
      marginTop: 8,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme?.text || '#111827',
    },
    sectionSubtitle: {
      fontSize: 14,
      color: theme?.textSecondary || '#6b7280',
    },
    totalBadge: {
      alignItems: 'flex-end',
      backgroundColor: theme?.success + '15' || '#d1fae5',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
    },
    totalLabel: {
      fontSize: 11,
      color: theme?.textSecondary || '#6b7280',
      textTransform: 'uppercase',
    },
    totalAmount: {
      fontSize: 16,
      fontWeight: '700',
      color: theme?.success || '#059669',
    },
    listContent: {
      paddingBottom: 16,
    },
    payrollCard: {
      backgroundColor: theme?.cardBackground || 'white',
      borderRadius: 16,
      padding: 20,
      marginBottom: 12,
      shadowColor: theme?.shadow || '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
      borderWidth: 1,
      borderColor: theme?.border || '#f3f4f6',
    },
    payrollHeader: {
      marginBottom: 16,
    },
    teacherDetails: {
      flex: 1,
    },
    teacherName: {
      fontSize: 16,
      fontWeight: '700',
      color: theme?.text || '#111827',
      marginBottom: 2,
    },
    payScale: {
      fontSize: 13,
      color: theme?.textSecondary || '#6b7280',
      marginTop: 2,
    },
    salaryBreakdown: {
      marginBottom: 16,
    },
    salaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    salaryLabel: {
      fontSize: 14,
      color: theme?.textSecondary || '#6b7280',
    },
    salaryAmount: {
      fontSize: 14,
      fontWeight: '600',
      color: theme?.text || '#333',
    },
    deduction: {
      color: theme?.error || '#dc2626',
    },
    netRow: {
      borderTopWidth: 1,
      borderTopColor: theme?.border || '#f3f4f6',
      paddingTop: 8,
      marginTop: 4,
    },
    netLabel: {
      fontSize: 16,
      fontWeight: '700',
      color: theme?.text || '#333',
    },
    netAmount: {
      fontSize: 16,
      fontWeight: '700',
      color: theme?.success || '#059669',
    },
    payrollButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme?.success || '#059669',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 12,
      alignSelf: 'flex-start',
      shadowColor: '#0f172a',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.2,
      shadowRadius: 10,
      elevation: 4,
    },
    payrollButtonText: {
      color: 'white',
      fontSize: 14,
      fontWeight: '700',
      marginLeft: 8,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: 48,
    },
    emptyText: {
      fontSize: 14,
      color: theme?.textSecondary || '#9ca3af',
      marginTop: 12,
    },
  });

export default PayrollView;
