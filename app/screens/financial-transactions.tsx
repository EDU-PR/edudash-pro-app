/**
 * Advanced Transaction List Screen
 * 
 * Features:
 * - Comprehensive transaction filtering and search
 * - Date range picker for custom periods
 * - Real-time search with debouncing
 * - Export functionality per transaction selection
 * - Pull-to-refresh and pagination
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, RefreshControl, Modal, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { router } from 'expo-router';
import { navigateBack } from '@/lib/navigation';
import { derivePreschoolId } from '@/lib/roleUtils';
import { assertSupabase } from '@/lib/supabase';

import { FinancialDataService } from '@/services/FinancialDataService';
import { ExportService } from '@/lib/services/finance/ExportService';
import { ReceiptService } from '@/lib/services/ReceiptService';
import type { TransactionRecord, DateRange } from '@/services/FinancialDataService';

import EduDashSpinner from '@/components/ui/EduDashSpinner';
interface FilterOptions {
  type: 'all' | 'income' | 'expense';
  category: string;
  status: string;
  dateRange: DateRange;
  searchTerm: string;
}

export default function TransactionsScreen() {
  const { t } = useTranslation('common');
  const { profile } = useAuth();
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [receiptLoadingId, setReceiptLoadingId] = useState<string | null>(null);
  
  const [filters, setFilters] = useState<FilterOptions>({
    type: 'all',
    category: 'all',
    status: 'all',
    dateRange: {
      from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      to: new Date().toISOString(),
    },
    searchTerm: '',
  });

  const categoryOptions = React.useMemo(() => {
    const baseCategories = [
      { key: 'Tuition', label: t('transactions.cat_tuition', { defaultValue: 'Tuition' }) },
      { key: 'Supplies', label: t('transactions.cat_supplies', { defaultValue: 'Supplies' }) },
      { key: 'Salaries', label: t('transactions.cat_salaries', { defaultValue: 'Salaries' }) },
      { key: 'Maintenance', label: t('transactions.cat_maintenance', { defaultValue: 'Maintenance' }) },
      { key: 'Utilities', label: t('transactions.cat_utilities', { defaultValue: 'Utilities' }) },
    ];

    const dynamic = Array.from(new Set(
      transactions
        .map((transaction) => transaction.category)
        .filter(Boolean)
    ));

    const baseKeys = new Set(baseCategories.map((category) => category.key));
    const dynamicOptions = dynamic
      .filter((category) => !baseKeys.has(category))
      .sort((a, b) => a.localeCompare(b))
      .map((category) => ({ key: category, label: category }));

    return [
      { key: 'all', label: t('transactions.all_categories', { defaultValue: 'All Categories' }) },
      ...baseCategories,
      ...dynamicOptions,
    ];
  }, [transactions, t]);

  useEffect(() => {
    loadTransactions();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [transactions, filters]);

  useEffect(() => {
    if (filters.category !== 'all' && !categoryOptions.some(option => option.key === filters.category)) {
      setFilters(prev => ({ ...prev, category: 'all' }));
    }
  }, [categoryOptions, filters.category]);

  const canAccessFinances = (): boolean => {
    return profile?.role === 'principal' || profile?.role === 'principal_admin';
  };

  const loadTransactions = async (forceRefresh = false) => {
    try {
      setLoading(!forceRefresh);
      if (forceRefresh) setRefreshing(true);

      const preschoolId = derivePreschoolId(profile);
      
      console.log('[TransactionsScreen] Loading transactions with:', {
        preschoolId,
        profile: {
          id: profile?.id,
          role: profile?.role,
          preschool_id: profile?.preschool_id,
          organization_id: profile?.organization_id,
        },
        dateRange: filters.dateRange,
      });

      const data = await FinancialDataService.getTransactions(
        filters.dateRange,
        preschoolId || undefined,
        { useAccountingDate: true }
      );
      
      console.log('[TransactionsScreen] Loaded transactions count:', data.length);
      
      setTransactions(data);

    } catch (error) {
      console.error('Failed to load transactions:', error);
      Alert.alert(t('common.error'), t('transactions.load_failed', { defaultValue: 'Failed to load transactions' }));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...transactions];

    // Type filter
    if (filters.type !== 'all') {
      filtered = filtered.filter(t => t.type === filters.type);
    }

    // Category filter
    if (filters.category !== 'all') {
      filtered = filtered.filter(t => t.category === filters.category);
    }

    // Status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(t => t.status === filters.status);
    }

    // Search term
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(t => 
        t.description.toLowerCase().includes(term) ||
        t.category.toLowerCase().includes(term) ||
        (t.feeSummary || '').toLowerCase().includes(term)
      );
    }

    setFilteredTransactions(filtered);
  };

  const handleExport = () => {
    if (!filteredTransactions.length) {
      Alert.alert(t('transactions.no_data', { defaultValue: 'No Data' }), t('transactions.no_transactions_export', { defaultValue: 'No transactions available to export' }));
      return;
    }

    const totalRevenue = filteredTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalExpenses = filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const summary = {
      revenue: totalRevenue,
      expenses: totalExpenses,
      cashFlow: totalRevenue - totalExpenses,
    };

    ExportService.exportFinancialData(filteredTransactions, summary, {
      format: 'excel',
      dateRange: filters.dateRange,
      includeCharts: false,
    });
  };

  const openReceiptUrl = async (url: string) => {
    const isPdf = /\.pdf(\?|$)/i.test(url);
    if (isPdf) {
      router.push({ pathname: '/screens/pdf-viewer', params: { url, title: 'Receipt' } } as any);
      return;
    }
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert(t('common.error'), t('receipt.unable_open', { defaultValue: 'Unable to open receipt link.' }));
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert(t('common.error'), t('receipt.unable_open', { defaultValue: 'Unable to open receipt link.' }));
    }
  };

  const handleReceiptPress = async (item: TransactionRecord) => {
    if (item.source !== 'payment') return;

    if (item.receiptUrl) {
      await openReceiptUrl(item.receiptUrl);
      return;
    }

    if (item.receiptStoragePath) {
      try {
        const { data } = await assertSupabase()
          .storage
          .from('generated-pdfs')
          .createSignedUrl(item.receiptStoragePath, 60 * 60);
        if (data?.signedUrl) {
          await openReceiptUrl(data.signedUrl);
          return;
        }
      } catch {
        // fall through to generation
      }
    }

    if (item.status !== 'completed') {
      Alert.alert(
        t('common.info', { defaultValue: 'Info' }),
        t('receipt.pending_payment', { defaultValue: 'Receipts are available once a payment is completed.' })
      );
      return;
    }

    await generateReceiptForPayment(item);
  };

  const generateReceiptForPayment = async (item: TransactionRecord) => {
    if (!profile?.id) {
      Alert.alert(t('common.error'), t('receipt.missing_profile', { defaultValue: 'Unable to identify receipt issuer.' }));
      return;
    }

    setReceiptLoadingId(item.id);
    try {
      const supabase = assertSupabase();
      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .select('id, amount, payment_reference, payment_method, created_at, student_id, parent_id, fee_ids, description, metadata, preschool_id, attachment_url')
        .eq('id', item.id)
        .maybeSingle();

      if (paymentError || !payment) {
        throw new Error(paymentError?.message || 'Payment not found');
      }

      const schoolId = payment.preschool_id || derivePreschoolId(profile);
      if (!schoolId) {
        throw new Error('School not found for receipt generation');
      }

      const { data: student } = await supabase
        .from('students')
        .select('id, first_name, last_name, classes(name)')
        .eq('id', payment.student_id)
        .maybeSingle();

      if (!student) {
        throw new Error('Student not found for receipt generation');
      }

      let parentProfile: { id?: string | null; first_name?: string | null; last_name?: string | null; email?: string | null } | null = null;
      if (payment.parent_id) {
        const { data } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email')
          .eq('id', payment.parent_id)
          .maybeSingle();
        parentProfile = data || null;
      }

      let feeId = payment.id;
      let feeDescription = payment.description || 'School fee';
      let feeDueDate: string | null = null;
      const primaryFeeId = Array.isArray(payment.fee_ids) ? payment.fee_ids[0] : null;
      if (primaryFeeId) {
        feeId = primaryFeeId;
        const { data: feeRow } = await supabase
          .from('student_fees')
          .select('id, due_date, fee_structures(name, fee_type, description)')
          .eq('id', primaryFeeId)
          .maybeSingle();
        const feeStructure = Array.isArray(feeRow?.fee_structures) ? feeRow?.fee_structures[0] : feeRow?.fee_structures;
        feeDescription = feeStructure?.name || feeStructure?.fee_type || payment.description || 'School fee';
        feeDueDate = feeRow?.due_date || null;
      }

      const issuerName =
        profile.full_name ||
        `${profile.first_name || ''} ${profile.last_name || ''}`.trim() ||
        'School Administrator';

      const paymentReference = payment.payment_reference || `PAY-${payment.id.slice(0, 8)}`;
      const receiptAmount = Number(payment.amount ?? item.amount ?? 0);
      const studentName = `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Student';
      const receiptNumber = `REC-${new Date().getFullYear()}-${payment.id.slice(0, 6).toUpperCase()}`;

      const result = await ReceiptService.generateFeeReceipt({
        schoolId,
        fee: {
          id: feeId,
          description: feeDescription,
          amount: receiptAmount,
          dueDate: feeDueDate,
          paidDate: payment.created_at || new Date().toISOString(),
          paymentReference,
          paymentMethod: payment.payment_method || 'manual',
        },
        student: {
          id: student.id,
          firstName: student.first_name,
          lastName: student.last_name,
          className: (student as any).classes?.name || null,
        },
        parent: {
          id: parentProfile?.id || null,
          name: parentProfile
            ? `${parentProfile.first_name || ''} ${parentProfile.last_name || ''}`.trim()
            : null,
          email: parentProfile?.email || null,
        },
        issuer: {
          id: profile.id,
          name: issuerName,
        },
      });

      const nowIso = new Date().toISOString();
      const nextMetadata = {
        ...(payment.metadata || {}),
        receipt_storage_path: result.storagePath,
        receipt_url: result.receiptUrl,
      };

      const updates: any = {
        metadata: nextMetadata,
        updated_at: nowIso,
      };
      if (!payment.attachment_url && result.receiptUrl) {
        updates.attachment_url = result.receiptUrl;
      }

      await supabase
        .from('payments')
        .update(updates)
        .eq('id', payment.id);

      if (result.storagePath && payment.payment_reference) {
        await supabase
          .from('financial_transactions')
          .update({
            receipt_image_path: result.storagePath,
            updated_at: nowIso,
          })
          .eq('payment_reference', payment.payment_reference);
      }

      await sendReceiptNotification(
        parentProfile,
        studentName,
        result.receiptUrl ?? null,
        receiptNumber,
        receiptAmount,
        {
          studentId: student.id,
          feeId,
          paymentId: payment.id,
          paymentPurpose: feeDescription,
          paymentReference,
        }
      );

      Alert.alert(t('common.success'), t('receipt.generated_success', { defaultValue: 'Receipt generated successfully.' }));
      if (result.receiptUrl) {
        await openReceiptUrl(result.receiptUrl);
      }

      loadTransactions(true);
    } catch (error: any) {
      Alert.alert(t('common.error'), error?.message || t('receipt.generate_failed', { defaultValue: 'Failed to generate receipt.' }));
    } finally {
      setReceiptLoadingId(null);
    }
  };

  const sendReceiptNotification = async (
    parent: { id?: string | null; first_name?: string | null; last_name?: string | null; email?: string | null } | null,
    studentName: string,
    receiptUrl: string | null,
    receiptNumber: string,
    amount: number,
    context?: {
      studentId?: string;
      feeId?: string;
      paymentId?: string;
      paymentPurpose?: string;
      paymentReference?: string;
    }
  ) => {
    if (!parent?.email && !parent?.id) return;
    const supabase = assertSupabase();
    const subject = `Payment receipt for ${studentName}`;
    const text = receiptUrl
      ? `Your payment of R ${amount.toFixed(2)} for ${studentName} has been marked as paid. Receipt #${receiptNumber}. Download: ${receiptUrl}`
      : `Your payment of R ${amount.toFixed(2)} for ${studentName} has been marked as paid. Receipt #${receiptNumber}.`;
    const html = `
      <p>Your payment of <strong>R ${amount.toFixed(2)}</strong> for <strong>${studentName}</strong> has been marked as paid.</p>
      <p>Receipt #: <strong>${receiptNumber}</strong></p>
      ${receiptUrl ? `<p><a href="${receiptUrl}">Download your receipt</a></p>` : ''}
    `;

    await supabase.functions.invoke('notifications-dispatcher', {
      body: {
        event_type: 'payment_receipt',
        user_ids: parent?.id ? [parent.id] : undefined,
        recipient_email: parent?.email || undefined,
        include_email: true,
        template_override: {
          title: 'Payment Receipt Ready',
          body: `Receipt issued for ${studentName}.`,
          data: {
            type: 'receipt',
            student_name: studentName,
            receipt_url: receiptUrl,
            student_id: context?.studentId,
            fee_id: context?.feeId,
            payment_id: context?.paymentId,
            payment_purpose: context?.paymentPurpose,
            payment_reference: context?.paymentReference,
          },
        },
        email_template_override: {
          subject,
          text,
          html,
        },
      },
    });
  };

  const formatCurrency = (amount: number): string => {
    return `R${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString?: string | null): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed': return '#059669';
      case 'pending': return '#EA580C';
      case 'overdue': return '#DC2626';
      case 'approved': return '#4F46E5';
      case 'rejected': return '#DC2626';
      default: return '#6B7280';
    }
  };

  const renderTransaction = ({ item }: { item: TransactionRecord }) => {
    const isPayment = item.source === 'payment';
    const hasReceipt = Boolean(item.receiptUrl || item.receiptStoragePath || item.hasReceipt);
    const hasEvidence = Boolean(
      item.attachmentUrl || hasReceipt || (item.receiptCount ?? 0) > 0
    );
    const dueLabel = isPayment && item.dueDate
      ? t('transactions.due_label', { defaultValue: 'Due {{date}}', date: formatDate(item.dueDate) })
      : formatDate(item.date);
    const paidLabel = isPayment && item.paidDate
      ? t('transactions.paid_label', { defaultValue: 'Paid {{date}}', date: formatDate(item.paidDate) })
      : '';
    const dateLine = paidLabel ? `${dueLabel} • ${paidLabel}` : dueLabel;
    const advanceTag = isPayment && item.isAdvancePayment
      ? ` • ${t('transactions.advance', { defaultValue: 'Advance' })}`
      : '';
    const showReceiptButton = item.source === 'payment';
    const isReceiptLoading = receiptLoadingId === item.id;
    const receiptDisabled = !hasReceipt && item.status !== 'completed';
    const receiptLabel = hasReceipt
      ? t('receipt.view_receipt', { defaultValue: 'View Receipt' })
      : item.status === 'completed'
        ? t('receipt.generate_receipt', { defaultValue: 'Generate Receipt' })
        : t('receipt.pending_payment', { defaultValue: 'Awaiting Approval' });
    const evidenceLabel = item.source === 'payment'
      ? (hasReceipt ? t('receipt.view_receipt', { defaultValue: 'View Receipt' }) : t('receipt.attach_receipt', { defaultValue: 'Attach Receipt' }))
      : ((item.receiptCount ?? 0) > 0
        ? `${item.receiptCount} ${t('receipt.view_receipts', { defaultValue: 'View Receipts' })}`
        : t('receipt.attach_receipt', { defaultValue: 'Attach Receipt' }));
    return (
      <TouchableOpacity style={styles.transactionCard}>
        <View style={styles.transactionHeader}>
          <View style={styles.transactionIcon}>
            <Ionicons 
              name={item.type === 'income' ? 'trending-up' : 'trending-down'} 
              size={20} 
              color={item.type === 'income' ? '#059669' : '#DC2626'} 
            />
          </View>
          <View style={styles.transactionInfo}>
            <Text style={styles.transactionDescription}>{item.description}</Text>
            <Text style={styles.transactionCategory}>{item.category} • {dateLine}{advanceTag}</Text>
            {item.feeSummary && item.feeSummary !== item.category && (
              <Text style={styles.transactionSubtext}>{item.feeSummary}</Text>
            )}
          </View>
          <View style={styles.transactionAmount}>
            <Text style={[
              styles.amountText,
              { color: item.type === 'income' ? '#059669' : '#DC2626' }
            ]}>
              {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount)}
            </Text>
            {hasEvidence && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <Ionicons name="document-attach" size={16} color={theme?.primary || '#4F46E5'} />
                <Text style={{ fontSize: 11, color: theme?.textSecondary || '#6B7280' }}>
                  {evidenceLabel}
                </Text>
              </View>
            )}
            {showReceiptButton && (
              <TouchableOpacity
                style={[
                  styles.receiptButton,
                  receiptDisabled && styles.receiptButtonDisabled,
                ]}
                onPress={() => handleReceiptPress(item)}
                disabled={receiptDisabled || isReceiptLoading}
              >
                {isReceiptLoading ? (
                  <EduDashSpinner size="small" color={theme?.primary || '#4F46E5'} />
                ) : (
                  <Ionicons name="receipt-outline" size={14} color={receiptDisabled ? '#9CA3AF' : (theme?.primary || '#4F46E5')} />
                )}
                <Text style={[
                  styles.receiptButtonText,
                  receiptDisabled && styles.receiptButtonTextDisabled,
                ]}>
                  {receiptLabel}
                </Text>
              </TouchableOpacity>
            )}
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
              <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                {item.status}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderFilterModal = () => (
    <Modal visible={showFilters} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('transactions.filter_title', { defaultValue: 'Filter Transactions' })}</Text>
            <TouchableOpacity onPress={() => setShowFilters(false)}>
              <Ionicons name="close" size={24} color={theme?.text || '#333'} />
            </TouchableOpacity>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>{t('transactions.type', { defaultValue: 'Transaction Type' })}</Text>
            <View style={styles.filterOptions}>
              {[
                { key: 'all', label: t('transactions.all_types', { defaultValue: 'All Types' }) },
                { key: 'income', label: t('transactions.income', { defaultValue: 'Income' }) },
                { key: 'expense', label: t('transactions.expenses', { defaultValue: 'Expenses' }) },
              ].map(({ key, label }) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.filterOption,
                    filters.type === key && styles.filterOptionActive,
                  ]}
                  onPress={() => setFilters(prev => ({ ...prev, type: key as any }))}
                >
                  <Text style={[
                    styles.filterOptionText,
                    filters.type === key && styles.filterOptionTextActive,
                  ]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>{t('transactions.category', { defaultValue: 'Category' })}</Text>
            <View style={styles.filterOptions}>
              {categoryOptions.map(({ key, label }) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.filterOption,
                    filters.category === key && styles.filterOptionActive,
                  ]}
                  onPress={() => setFilters(prev => ({ ...prev, category: key }))}
                >
                  <Text style={[
                    styles.filterOptionText,
                    filters.category === key && styles.filterOptionTextActive,
                  ]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => setFilters({
                type: 'all',
                category: 'all',
                status: 'all',
                dateRange: {
                  from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                  to: new Date().toISOString(),
                },
                searchTerm: '',
              })}
            >
              <Text style={styles.clearButtonText}>{t('transactions.clear_all', { defaultValue: 'Clear All' })}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.applyButton}
              onPress={() => setShowFilters(false)}
            >
              <Text style={styles.applyButtonText}>{t('transactions.apply_filters', { defaultValue: 'Apply Filters' })}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (!canAccessFinances()) {
    return (
      <View style={styles.accessDenied}>
        <Ionicons name="lock-closed" size={64} color={theme?.textSecondary || '#666'} />
        <Text style={styles.accessDeniedTitle}>{t('dashboard.accessDenied', { defaultValue: 'Access Denied' })}</Text>
        <Text style={styles.accessDeniedText}>
          {t('transactions.access_denied_text', { defaultValue: 'Only school principals can access transaction details.' })}
        </Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigateBack()}>
          <Text style={styles.backButtonText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigateBack()}>
          <Ionicons name="arrow-back" size={24} color={theme?.text || '#333'} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('transactions.title', { defaultValue: 'Transactions' })}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerAction}
            onPress={() => setShowFilters(true)}
          >
            <Ionicons name="filter" size={20} color={theme?.text || '#333'} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerAction}
            onPress={handleExport}
          >
            <Ionicons name="download" size={20} color={theme?.text || '#333'} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={theme?.textSecondary || '#666'} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('transactions.search_placeholder', { defaultValue: 'Search transactions...' })}
          value={filters.searchTerm}
          onChangeText={(text) => setFilters(prev => ({ ...prev, searchTerm: text }))}
          placeholderTextColor={theme?.textSecondary || '#666'}
        />
      </View>

      {/* Summary Bar */}
      <View style={styles.summaryContainer}>
        <Text style={styles.summaryText}>
          {t('transactions.summary_count', { defaultValue: '{{count}} of {{total}} transactions', count: filteredTransactions.length, total: transactions.length })}
        </Text>
        <Text style={styles.summaryAmount}>
          {t('transactions.total', { defaultValue: 'Total' })}: {formatCurrency(
            filteredTransactions.reduce((sum, t) => 
              sum + (t.type === 'income' ? t.amount : -t.amount), 0
            )
          )}
        </Text>
      </View>

      {/* Transaction List */}
      <FlatList
        data={filteredTransactions}
        renderItem={renderTransaction}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadTransactions(true)} />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Filter Modal */}
      {renderFilterModal()}
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme?.background || '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 60,
    backgroundColor: theme?.surface || 'white',
    borderBottomWidth: 1,
    borderBottomColor: theme?.border || '#e2e8f0',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: theme?.text || '#333',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerAction: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme?.surface || 'white',
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme?.border || '#e2e8f0',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: theme?.text || '#333',
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  summaryText: {
    fontSize: 14,
    color: theme?.textSecondary || '#666',
  },
  summaryAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: theme?.text || '#333',
  },
  listContent: {
    paddingHorizontal: 16,
  },
  transactionCard: {
    backgroundColor: theme?.cardBackground || 'white',
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: theme?.shadow || '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  transactionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme?.surfaceVariant || '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 16,
    fontWeight: '500',
    color: theme?.text || '#333',
    marginBottom: 4,
  },
  transactionCategory: {
    fontSize: 14,
    color: theme?.textSecondary || '#666',
  },
  transactionSubtext: {
    marginTop: 2,
    fontSize: 12,
    color: theme?.textSecondary || '#6B7280',
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  receiptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme?.primary || '#4F46E5',
  },
  receiptButtonDisabled: {
    borderColor: theme?.border || '#E5E7EB',
    backgroundColor: theme?.surfaceVariant || '#F3F4F6',
  },
  receiptButtonText: {
    fontSize: 11,
    color: theme?.primary || '#4F46E5',
    fontWeight: '600',
  },
  receiptButtonTextDisabled: {
    color: theme?.textSecondary || '#9CA3AF',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: theme?.surface || 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme?.border || '#e2e8f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme?.text || '#333',
  },
  filterSection: {
    padding: 20,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme?.text || '#333',
    marginBottom: 12,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: theme?.surfaceVariant || '#f1f5f9',
    borderWidth: 1,
    borderColor: theme?.border || '#e2e8f0',
  },
  filterOptionActive: {
    backgroundColor: (theme?.primary || '#007AFF') + '20',
    borderColor: theme?.primary || '#007AFF',
  },
  filterOptionText: {
    fontSize: 14,
    color: theme?.textSecondary || '#666',
  },
  filterOptionTextActive: {
    color: theme?.primary || '#007AFF',
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: theme?.border || '#e2e8f0',
  },
  clearButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme?.textSecondary || '#666',
    alignItems: 'center',
  },
  clearButtonText: {
    color: theme?.textSecondary || '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  applyButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: theme?.primary || '#007AFF',
    alignItems: 'center',
  },
  applyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  accessDenied: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  accessDeniedTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: theme?.text || '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  accessDeniedText: {
    fontSize: 16,
    color: theme?.textSecondary || '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: theme?.primary || '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
