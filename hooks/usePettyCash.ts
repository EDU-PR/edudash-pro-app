/**
 * usePettyCash Hook
 * 
 * Handles all petty cash data fetching and business logic
 * Part of Principal Dashboard refactoring
 */

import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';

export interface PettyCashTransaction {
  id: string;
  amount: number;
  description: string;
  category: string;
  type: 'expense' | 'replenishment' | 'adjustment';
  receipt_number?: string;
  reference_number?: string;
  created_at: string;
  created_by: string;
  approved_by?: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface PettyCashSummary {
  opening_balance: number;
  current_balance: number;
  total_expenses: number;
  total_replenishments: number;
  pending_approval: number;
}

export interface ExpenseFormData {
  amount: string;
  description: string;
  category: string;
  receipt_number: string;
}

export const EXPENSE_CATEGORIES = [
  // Office & Educational
  'Stationery & Supplies',
  'Teaching Materials',
  'Art & Craft Supplies',
  'Books & Educational Resources',
  'Printing & Photocopying',
  // Food & Refreshments
  'Groceries',
  'Refreshments',
  'Staff Tea & Coffee',
  'Student Snacks',
  'Kitchen Supplies',
  // Maintenance & Facilities
  'Maintenance & Repairs',
  'Cleaning Supplies',
  'Cleaning Services',
  'Pest Control',
  'Waste Removal',
  'Minor Repairs',
  // Utilities & Services
  'Utilities (small amounts)',
  'Electricity (top-ups)',
  'Water (top-ups)',
  'Internet & Wi-Fi',
  'Telephone & Mobile',
  'Airtime (Mobile)',
  'Data Bundles',
  // Medical & Safety
  'Medical & First Aid',
  'First Aid Supplies',
  'Sanitizers & Disinfectants',
  'Safety Equipment',
  // Transport & Logistics
  'Transport',
  'Travel & Transport',
  'Fuel (petty amounts)',
  'Parking Fees',
  'Taxi/Uber Fares',
  'Vehicle Maintenance',
  // Communication & Marketing
  'Communication',
  'Postage & Courier',
  'Advertising Materials',
  'Signage & Banners',
  // Staff & Administration
  'Staff Welfare',
  'Staff Uniforms',
  'Staff Training Materials',
  'Office Furniture (small items)',
  // Events & Activities
  'Events & Celebrations',
  'Birthday Parties',
  'Sports Day Supplies',
  'Field Trip Expenses',
  'Parent Meeting Refreshments',
  // Emergency & Miscellaneous
  'Emergency Expenses',
  'Bank Charges',
  'Petty Licensing Fees',
  'Subscriptions (small)',
  'Other',
];

export function usePettyCash() {
  const { user } = useAuth();
  const { t } = useTranslation('common');

  const [transactions, setTransactions] = useState<PettyCashTransaction[]>([]);
  const [summary, setSummary] = useState<PettyCashSummary>({
    opening_balance: 0,
    current_balance: 0,
    total_expenses: 0,
    total_replenishments: 0,
    pending_approval: 0,
  });
  const [accountId, setAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [preschoolId, setPreschoolId] = useState<string | null>(null);

  const loadPettyCashData = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get user's preschool
      const { data: userProfile } = await assertSupabase()
        .from('users')
        .select('preschool_id')
        .eq('auth_user_id', user.id)
        .single();

      if (!userProfile?.preschool_id) {
        Alert.alert(t('common.error'), t('petty_cash.error_no_school'));
        return;
      }

      setPreschoolId(userProfile.preschool_id);

      // Ensure petty cash account exists
      try {
        const { data: ensuredId } = await assertSupabase()
          .rpc('ensure_petty_cash_account', { school_uuid: userProfile.preschool_id });
        if (ensuredId) setAccountId(String(ensuredId));
      } catch {
        const { data: acct } = await assertSupabase()
          .from('petty_cash_accounts')
          .select('id')
          .eq('school_id', userProfile.preschool_id)
          .eq('is_active', true)
          .maybeSingle();
        if (acct?.id) setAccountId(String(acct.id));
      }

      // Load transactions
      const { data: transactionsData, error: transError } = await assertSupabase()
        .from('petty_cash_transactions')
        .select('*')
        .eq('school_id', userProfile.preschool_id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (transError) {
        console.error('Error loading transactions:', transError);
      } else {
        setTransactions(transactionsData || []);
      }

      // Calculate summary
      const currentMonthStart = new Date();
      currentMonthStart.setDate(1);
      currentMonthStart.setHours(0, 0, 0, 0);

      const monthlyTransactions = (transactionsData || []).filter(tx => 
        new Date(tx.created_at) >= currentMonthStart
      );

      const expenses = monthlyTransactions
        .filter(tx => tx.type === 'expense' && tx.status === 'approved')
        .reduce((sum, tx) => sum + tx.amount, 0);

      const replenishments = monthlyTransactions
        .filter(tx => tx.type === 'replenishment' && tx.status === 'approved')
        .reduce((sum, tx) => sum + tx.amount, 0);

      const pending = monthlyTransactions
        .filter(tx => tx.status === 'pending')
        .reduce((sum, tx) => sum + tx.amount, 0);

      // Get account balances
      const { data: accountRow } = await assertSupabase()
        .from('petty_cash_accounts')
        .select('opening_balance, low_balance_threshold')
        .eq('school_id', userProfile.preschool_id)
        .eq('is_active', true)
        .maybeSingle();

      const openingBalance = Number(accountRow?.opening_balance ?? 0);

      const { data: approvedAll } = await assertSupabase()
        .from('petty_cash_transactions')
        .select('amount, type, status')
        .eq('school_id', userProfile.preschool_id)
        .eq('status', 'approved')
        .limit(1000);

      const totalSignedAll = (approvedAll || []).reduce((sum, tx: any) => {
        const amt = Number(tx.amount || 0);
        if (tx.type === 'expense') return sum - amt;
        if (tx.type === 'replenishment') return sum + amt;
        if (tx.type === 'adjustment') return sum - amt;
        return sum;
      }, 0);

      setSummary({
        opening_balance: openingBalance,
        current_balance: openingBalance + totalSignedAll,
        total_expenses: expenses,
        total_replenishments: replenishments,
        pending_approval: pending,
      });

    } catch (error) {
      console.error('Error loading petty cash data:', error);
      Alert.alert(t('common.error'), t('petty_cash.error_failed_load'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, t]);

  const addExpense = async (form: ExpenseFormData, receiptImage: string | null, uploadReceiptImage: (uri: string, txId: string) => Promise<string | null>) => {
    if (!form.amount || !form.description || !form.category) {
      Alert.alert(t('common.error'), t('petty_cash.error_fill_fields'));
      return false;
    }

    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert(t('common.error'), t('petty_cash.error_valid_amount'));
      return false;
    }

    if (amount > summary.current_balance) {
      Alert.alert(t('common.error'), t('petty_cash.error_insufficient_balance'));
      return false;
    }

    try {
      const { data: transactionData, error: transactionError } = await assertSupabase()
        .from('petty_cash_transactions')
        .insert({
          school_id: preschoolId,
          account_id: accountId,
          amount,
          description: form.description.trim(),
          category: form.category,
          type: 'expense',
          reference_number: form.receipt_number.trim() || null,
          created_by: user?.id,
          status: 'approved',
        })
        .select()
        .single();

      if (transactionError) {
        Alert.alert(t('common.error'), t('petty_cash.error_failed_add'));
        return false;
      }

      let receiptPath = null;
      if (receiptImage && transactionData) {
        receiptPath = await uploadReceiptImage(receiptImage, transactionData.id);
      }

      Alert.alert(
        t('common.success'), 
        t('petty_cash.success_expense_added') + (receiptPath ? t('petty_cash.success_expense_receipt') : '')
      );
      loadPettyCashData();
      return true;
    } catch {
      Alert.alert(t('common.error'), t('petty_cash.error_failed_add'));
      return false;
    }
  };

  const addReplenishment = async (amount: string) => {
    if (!amount) {
      Alert.alert(t('common.error'), t('petty_cash.error_replenishment_amount'));
      return false;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert(t('common.error'), t('petty_cash.error_valid_amount'));
      return false;
    }

    try {
      const { error } = await assertSupabase()
        .from('petty_cash_transactions')
        .insert({
          school_id: preschoolId,
          account_id: accountId,
          amount: amountNum,
          description: `Petty cash replenishment - ${new Date().toLocaleDateString()}`,
          category: 'Replenishment',
          type: 'replenishment',
          created_by: user?.id,
          status: 'approved',
        });

      if (error) {
        Alert.alert(t('common.error'), t('petty_cash.error_failed_record'));
        return false;
      }

      Alert.alert(t('common.success'), t('petty_cash.success_replenishment'));
      loadPettyCashData();
      return true;
    } catch {
      Alert.alert(t('common.error'), t('petty_cash.error_failed_record'));
      return false;
    }
  };

  const addWithdrawal = async (form: ExpenseFormData) => {
    if (!form.amount || !form.description) {
      Alert.alert(t('common.error'), t('petty_cash.error_amount_description'));
      return false;
    }

    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert(t('common.error'), t('petty_cash.error_valid_amount'));
      return false;
    }

    if (amount > summary.current_balance) {
      Alert.alert(t('common.error'), t('petty_cash.error_withdrawal_exceeds'));
      return false;
    }

    try {
      const { error } = await assertSupabase()
        .from('petty_cash_transactions')
        .insert({
          school_id: preschoolId,
          account_id: accountId,
          amount,
          description: form.description.trim(),
          category: 'Withdrawal/Adjustment',
          type: 'adjustment',
          reference_number: form.receipt_number.trim() || null,
          created_by: user?.id,
          status: 'approved',
        });

      if (error) {
        Alert.alert(t('common.error'), t('petty_cash.error_failed_withdrawal'));
        return false;
      }

      Alert.alert(t('common.success'), t('petty_cash.success_withdrawal'));
      loadPettyCashData();
      return true;
    } catch {
      Alert.alert(t('common.error'), t('petty_cash.error_failed_withdrawal'));
      return false;
    }
  };

  const cancelTransaction = async (transactionId: string) => {
    try {
      const { error } = await assertSupabase()
        .from('petty_cash_transactions')
        .update({ status: 'rejected' })
        .eq('id', transactionId)
        .eq('status', 'pending');
      if (error) throw error;
      loadPettyCashData();
      return true;
    } catch {
      Alert.alert(t('common.error'), t('transaction.failed_cancel', 'Failed to cancel transaction'));
      return false;
    }
  };

  const canDelete = async (): Promise<boolean> => {
    try {
      const { data } = await assertSupabase()
        .from('users')
        .select('role')
        .eq('auth_user_id', user?.id)
        .single();
      return data?.role === 'principal_admin';
    } catch {
      return false;
    }
  };

  const deleteTransaction = async (transactionId: string) => {
    try {
      const allowed = await canDelete();
      if (!allowed) {
        Alert.alert(t('common.not_allowed', 'Not allowed'), t('transaction.principals_only_delete', 'Only principals can delete transactions'));
        return false;
      }

      const { error } = await assertSupabase()
        .from('petty_cash_transactions')
        .delete()
        .eq('id', transactionId);
      if (error) throw error;
      loadPettyCashData();
      return true;
    } catch {
      Alert.alert(t('common.error'), t('transaction.failed_delete', 'Failed to delete transaction'));
      return false;
    }
  };

  const reverseTransaction = async (transaction: PettyCashTransaction) => {
    try {
      const oppositeType = transaction.type === 'expense' ? 'replenishment' : 'expense';
      const { error } = await assertSupabase()
        .from('petty_cash_transactions')
        .insert({
          school_id: preschoolId,
          account_id: accountId,
          amount: transaction.amount,
          description: `Reversal of ${transaction.type} (${transaction.id.substring(0, 8)}) - ${transaction.description}`,
          category: 'Other',
          type: oppositeType as any,
          created_by: user?.id,
          status: 'approved',
        });
      if (error) throw error;
      Alert.alert(t('common.success'), t('transaction.reversal_success', 'Transaction reversed successfully'));
      loadPettyCashData();
      return true;
    } catch (error: any) {
      Alert.alert(t('common.error'), error?.message || t('transaction.failed_reverse', 'Failed to create reversal'));
      return false;
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadPettyCashData();
  };

  return {
    // State
    transactions,
    summary,
    accountId,
    preschoolId,
    loading,
    refreshing,
    // Actions
    loadPettyCashData,
    addExpense,
    addReplenishment,
    addWithdrawal,
    cancelTransaction,
    deleteTransaction,
    reverseTransaction,
    canDelete,
    onRefresh,
  };
}

// Utility functions
export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
  }).format(amount);
};

export const getStatusColor = (status: string, theme?: any) => {
  switch (status) {
    case 'approved': return theme?.success || '#10B981';
    case 'pending': return theme?.warning || '#F59E0B';
    case 'rejected': return theme?.error || '#EF4444';
    default: return theme?.textSecondary || '#6B7280';
  }
};

export const getCategoryIcon = (category: string): string => {
  switch (category) {
    case 'Stationery & Supplies': return 'library';
    case 'Refreshments': return 'cafe';
    case 'Maintenance & Repairs': return 'construct';
    case 'Travel & Transport': return 'car';
    case 'Communication': return 'call';
    case 'Medical & First Aid': return 'medical';
    case 'Cleaning Supplies': return 'sparkles';
    case 'Utilities (small amounts)': return 'flash';
    case 'Airtime (Mobile)': return 'phone-portrait';
    case 'Data Bundles': return 'wifi';
    case 'Groceries': return 'cart';
    case 'Transport': return 'car';
    case 'Emergency Expenses': return 'alert-circle';
    case 'Replenishment': return 'add-circle';
    case 'Withdrawal/Adjustment': return 'arrow-down-circle';
    default: return 'receipt';
  }
};
