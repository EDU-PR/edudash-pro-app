/**
 * usePettyCash Hook
 * 
 * Handles all petty cash data fetching and business logic
 * Part of Principal Dashboard refactoring
 */

import { useState, useCallback } from 'react';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { withPettyCashTenant } from '@/lib/utils/pettyCashTenant';
import type { useAlertModal } from '@/components/ui/AlertModal';

export interface PettyCashTransaction {
  id: string;
  amount: number;
  description: string;
  category: string;
  type: 'expense' | 'replenishment';
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

export type ShowAlert = ReturnType<typeof useAlertModal>['showAlert'];

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
  'Bank Charges & Fees',
  'Petty Licensing Fees',
  'Subscriptions (small)',
  'Other',
];

export function usePettyCash(showAlert?: ShowAlert) {
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

  const alert = useCallback(
    (config: Parameters<NonNullable<ShowAlert>>[0]) => {
      if (showAlert) {
        showAlert(config);
      } else {
        const message = config.message ? ` ${config.message}` : '';
        console.warn(`[PettyCash] ${config.title}${message}`);
      }
    },
    [showAlert]
  );

  const loadPettyCashData = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get user's preschool (auth_user_id links to auth.users.id)
      const { data: userProfile } = await assertSupabase()
        .from('profiles')
        .select('preschool_id, organization_id')
        .eq('auth_user_id', user.id)
        .single();

      let schoolId = userProfile?.preschool_id || null;

      if (!schoolId && userProfile?.organization_id) {
        const { data: preschoolRow } = await assertSupabase()
          .from('preschools')
          .select('id')
          .eq('organization_id', userProfile.organization_id)
          .maybeSingle();
        schoolId = preschoolRow?.id || userProfile.organization_id;
      }
      if (!schoolId) {
        alert({ title: t('common.error'), message: t('petty_cash.error_no_school'), type: 'error' });
        return;
      }

      setPreschoolId(schoolId);

      // Ensure petty cash account exists (support both function signatures)
      try {
        const { data: ensuredId, error: ensureError } = await assertSupabase()
          .rpc('ensure_petty_cash_account', { school_uuid: schoolId });
        if (ensureError) throw ensureError;
        if (ensuredId) setAccountId(String(ensuredId));
      } catch {
        try {
          const { data: ensuredIdV2, error: ensureErrorV2 } = await assertSupabase()
            .rpc('ensure_petty_cash_account_v2', { preschool_uuid: schoolId });
          if (ensureErrorV2) throw ensureErrorV2;
          if (ensuredIdV2) setAccountId(String(ensuredIdV2));
        } catch {
          const { data: acct } = await withPettyCashTenant((column, client) =>
            client
              .from('petty_cash_accounts')
              .select('id')
              .eq(column, schoolId)
              .eq('is_active', true)
              .maybeSingle()
          );
          if (acct?.id) setAccountId(String(acct.id));
        }
      }

      // Load transactions
      const { data: transactionsData, error: transError } = await withPettyCashTenant((column, client) =>
        client
          .from('petty_cash_transactions')
          .select('*')
          .eq(column, schoolId)
          .order('created_at', { ascending: false })
          .limit(50)
      );

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
      const { data: accountRow } = await withPettyCashTenant((column, client) =>
        client
          .from('petty_cash_accounts')
          .select('opening_balance, low_balance_threshold')
          .eq(column, schoolId)
          .eq('is_active', true)
          .maybeSingle()
      );

      const openingBalance = Number(accountRow?.opening_balance ?? 0);

      const { data: approvedAll } = await withPettyCashTenant((column, client) =>
        client
          .from('petty_cash_transactions')
          .select('amount, type, status')
          .eq(column, schoolId)
          .eq('status', 'approved')
          .limit(1000)
      );

      const totalSignedAll = (approvedAll || []).reduce((sum, tx: any) => {
        const amt = Number(tx.amount || 0);
        if (tx.type === 'expense') return sum - amt;
        if (tx.type === 'replenishment') return sum + amt;
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
      alert({ title: t('common.error'), message: t('petty_cash.error_failed_load'), type: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, t, alert]);

  const addExpense = async (form: ExpenseFormData, receiptImage: string | null, uploadReceiptImage: (uri: string, txId: string) => Promise<string | null>) => {
    if (!form.amount || !form.description || !form.category) {
      alert({ title: t('common.error'), message: t('petty_cash.error_fill_fields'), type: 'error' });
      return false;
    }
    if (!preschoolId || !accountId) {
      alert({ title: t('common.error'), message: t('petty_cash.error_no_school'), type: 'error' });
      return false;
    }

    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) {
      alert({ title: t('common.error'), message: t('petty_cash.error_valid_amount'), type: 'error' });
      return false;
    }

    if (amount > summary.current_balance) {
      alert({ title: t('common.error'), message: t('petty_cash.error_insufficient_balance'), type: 'error' });
      return false;
    }

    try {
      const { data: transactionData, error: transactionError } = await withPettyCashTenant((column, client) =>
        client
          .from('petty_cash_transactions')
          .insert({
            [column]: preschoolId,
            account_id: accountId,
            amount,
            description: form.description.trim(),
            category: form.category,
            type: 'expense',
            reference_number: form.receipt_number.trim() || null,
            created_by: user?.id,
            approved_by: user?.id,
            status: 'approved',
          })
          .select()
          .single()
      );

      if (transactionError) {
        console.error('Error adding expense:', transactionError);
        alert({ title: t('common.error'), message: t('petty_cash.error_failed_add'), type: 'error' });
        return false;
      }

      let receiptPath = null;
      if (receiptImage && transactionData) {
        receiptPath = await uploadReceiptImage(receiptImage, transactionData.id);
      }

      alert({
        title: t('common.success'),
        message: t('petty_cash.success_expense_added') + (receiptPath ? t('petty_cash.success_expense_receipt') : ''),
        type: 'success',
      });
      loadPettyCashData();
      return true;
    } catch {
      alert({ title: t('common.error'), message: t('petty_cash.error_failed_add'), type: 'error' });
      return false;
    }
  };

  const addReplenishment = async (amount: string) => {
    if (!amount) {
      alert({ title: t('common.error'), message: t('petty_cash.error_replenishment_amount'), type: 'error' });
      return false;
    }
    if (!preschoolId || !accountId) {
      alert({ title: t('common.error'), message: t('petty_cash.error_no_school'), type: 'error' });
      return false;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert({ title: t('common.error'), message: t('petty_cash.error_valid_amount'), type: 'error' });
      return false;
    }

    try {
      const { error } = await withPettyCashTenant((column, client) =>
        client
          .from('petty_cash_transactions')
          .insert({
            [column]: preschoolId,
            account_id: accountId,
            amount: amountNum,
            description: `Petty cash replenishment - ${new Date().toLocaleDateString()}`,
            category: 'Replenishment',
            type: 'replenishment',
            created_by: user?.id,
            approved_by: user?.id,
            status: 'approved',
          })
      );

      if (error) {
        console.error('Error adding replenishment:', error);
        alert({ title: t('common.error'), message: t('petty_cash.error_failed_record'), type: 'error' });
        return false;
      }

      alert({ title: t('common.success'), message: t('petty_cash.success_replenishment'), type: 'success' });
      loadPettyCashData();
      return true;
    } catch {
      alert({ title: t('common.error'), message: t('petty_cash.error_failed_record'), type: 'error' });
      return false;
    }
  };

  const addWithdrawal = async (form: ExpenseFormData) => {
    if (!form.amount || !form.description) {
      alert({ title: t('common.error'), message: t('petty_cash.error_amount_description'), type: 'error' });
      return false;
    }
    if (!preschoolId || !accountId) {
      alert({ title: t('common.error'), message: t('petty_cash.error_no_school'), type: 'error' });
      return false;
    }

    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) {
      alert({ title: t('common.error'), message: t('petty_cash.error_valid_amount'), type: 'error' });
      return false;
    }

    if (amount > summary.current_balance) {
      alert({ title: t('common.error'), message: t('petty_cash.error_withdrawal_exceeds'), type: 'error' });
      return false;
    }

    try {
      const { error } = await withPettyCashTenant((column, client) =>
        client
          .from('petty_cash_transactions')
          .insert({
            [column]: preschoolId,
            account_id: accountId,
            amount,
            description: form.description.trim(),
            category: 'Withdrawal/Adjustment',
            type: 'expense',
            reference_number: form.receipt_number.trim() || null,
            created_by: user?.id,
            approved_by: user?.id,
            status: 'approved',
          })
      );

      if (error) {
        console.error('Error adding withdrawal:', error);
        alert({ title: t('common.error'), message: t('petty_cash.error_failed_withdrawal'), type: 'error' });
        return false;
      }

      alert({ title: t('common.success'), message: t('petty_cash.success_withdrawal'), type: 'success' });
      loadPettyCashData();
      return true;
    } catch {
      alert({ title: t('common.error'), message: t('petty_cash.error_failed_withdrawal'), type: 'error' });
      return false;
    }
  };

  const resetPettyCash = async (reason?: string) => {
    if (!preschoolId || !accountId) {
      alert({ title: t('common.error'), message: t('petty_cash.error_no_school'), type: 'error' });
      return false;
    }

    const currentBalance = Number(summary.current_balance || 0);
    if (Math.abs(currentBalance) < 0.01) {
      alert({ title: t('common.info', 'Info'), message: t('petty_cash.reset_already_zero', 'Petty cash balance is already zero.'), type: 'info' });
      return false;
    }

    const now = new Date();
    const reference = `RESET-${now.toISOString().slice(0, 10).replace(/-/g, '')}`;
    const description = reason?.trim()
      ? `Petty cash reset: ${reason.trim()}`
      : `Petty cash reset - ${now.toLocaleDateString()}`;
    const type = currentBalance > 0 ? 'expense' : 'replenishment';
    const amount = Math.abs(currentBalance);

    try {
      const { error } = await withPettyCashTenant((column, client) =>
        client
          .from('petty_cash_transactions')
          .insert({
            [column]: preschoolId,
            account_id: accountId,
            amount,
            description,
            category: 'Reset',
            type,
            reference_number: reference,
            created_by: user?.id,
            approved_by: user?.id,
            status: 'approved',
          })
      );

      if (error) {
        alert({ title: t('common.error'), message: t('petty_cash.reset_failed', 'Failed to reset petty cash.'), type: 'error' });
        return false;
      }

      alert({ title: t('common.success'), message: t('petty_cash.reset_success', 'Petty cash reset to zero.'), type: 'success' });
      loadPettyCashData();
      return true;
    } catch {
      alert({ title: t('common.error'), message: t('petty_cash.reset_failed', 'Failed to reset petty cash.'), type: 'error' });
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
      alert({ title: t('common.error'), message: t('transaction.failed_cancel', 'Failed to cancel transaction'), type: 'error' });
      return false;
    }
  };

  const canDelete = async (): Promise<boolean> => {
    try {
      const { data } = await assertSupabase()
        .from('profiles')
        .select('role')
        .eq('auth_user_id', user?.id)
        .maybeSingle();
      const role = data?.role;
      if (role) {
        return ['principal', 'principal_admin', 'admin', 'superadmin'].includes(role);
      }
      const { data: userRow } = await assertSupabase()
        .from('users')
        .select('role')
        .eq('auth_user_id', user?.id)
        .maybeSingle();
      return ['principal', 'principal_admin', 'admin', 'superadmin'].includes(userRow?.role || '');
    } catch {
      return false;
    }
  };

  const deleteTransaction = async (transactionId: string) => {
    try {
      const allowed = await canDelete();
      if (!allowed) {
        alert({ title: t('common.not_allowed', 'Not allowed'), message: t('transaction.principals_only_delete', 'Only principals can delete transactions'), type: 'warning' });
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
      alert({ title: t('common.error'), message: t('transaction.failed_delete', 'Failed to delete transaction'), type: 'error' });
      return false;
    }
  };

  const reverseTransaction = async (transaction: PettyCashTransaction) => {
    try {
      const oppositeType = transaction.type === 'expense' ? 'replenishment' : 'expense';
      const { error } = await withPettyCashTenant((column, client) =>
        client
          .from('petty_cash_transactions')
          .insert({
            [column]: preschoolId,
            account_id: accountId,
            amount: transaction.amount,
            description: `Reversal of ${transaction.type} (${transaction.id.substring(0, 8)}) - ${transaction.description}`,
            category: 'Other',
            type: oppositeType as any,
            created_by: user?.id,
            status: 'approved',
          })
      );
      if (error) throw error;
      alert({ title: t('common.success'), message: t('transaction.reversal_success', 'Transaction reversed successfully'), type: 'success' });
      loadPettyCashData();
      return true;
    } catch (error: any) {
      alert({ title: t('common.error'), message: error?.message || t('transaction.failed_reverse', 'Failed to create reversal'), type: 'error' });
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
    resetPettyCash,
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
