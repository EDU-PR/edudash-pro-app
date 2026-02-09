/** usePettyCash — slim orchestrator. Delegates to extracted files. */

import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { logger } from '@/lib/logger';

import type { PettyCashTransaction, PettyCashSummary, ExpenseFormData, ShowAlert, AlertFn } from './types';
import { fetchPettyCashData } from './fetchPettyCashData';
import * as actions from './pettyCashActions';

export function usePettyCash(showAlert?: ShowAlert) {
  const { user } = useAuth();
  const { t } = useTranslation('common');

  const [transactions, setTransactions] = useState<PettyCashTransaction[]>([]);
  const [summary, setSummary] = useState<PettyCashSummary>({
    opening_balance: 0, current_balance: 0, total_expenses: 0,
    total_replenishments: 0, pending_approval: 0,
  });
  const [accountId, setAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [preschoolId, setPreschoolId] = useState<string | null>(null);

  const alert: AlertFn = useCallback(
    (config) => {
      if (showAlert) { showAlert(config); } else {
        logger.warn('PettyCash', `${config.title} ${config.message ?? ''}`);
      }
    },
    [showAlert],
  );

  const loadPettyCashData = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const result = await fetchPettyCashData(user.id);
      setAccountId(result.accountId);
      setPreschoolId(result.preschoolId);
      setTransactions(result.transactions);
      setSummary(result.summary);
    } catch (err: unknown) {
      const e = err as { message?: string };
      if (e.message === 'NO_SCHOOL') {
        alert({ title: t('common.error'), message: t('petty_cash.error_no_school'), type: 'error' });
      } else {
        logger.error('PettyCash', 'Error loading data', e);
        alert({ title: t('common.error'), message: t('petty_cash.error_failed_load'), type: 'error' });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, t, alert]);

  // Stable action context
  const ctx = useCallback(() => ({
    userId: user?.id, preschoolId, accountId, summary, alert, t: t as unknown as (key: string, ...args: any[]) => string, reload: loadPettyCashData,
  }), [user?.id, preschoolId, accountId, summary, alert, t, loadPettyCashData]);

  const addExpense = async (
    form: ExpenseFormData, receiptImage: string | null,
    uploadReceiptImage: (uri: string, txId: string) => Promise<string | null>,
  ) => actions.addExpense(ctx(), form, receiptImage, uploadReceiptImage);

  const addReplenishment = async (amount: string) => actions.addReplenishment(ctx(), amount);
  const addWithdrawal = async (form: ExpenseFormData) => actions.addWithdrawal(ctx(), form);
  const resetPettyCash = async (reason?: string) => actions.resetPettyCash(ctx(), reason);
  const cancelTransaction = async (id: string) => actions.cancelTransaction(ctx(), id);
  const deleteTransaction = async (id: string) => actions.deleteTransaction(ctx(), id);
  const reverseTransaction = async (tx: PettyCashTransaction) => actions.reverseTransaction(ctx(), tx);
  const canDelete = async () => actions.canDelete(user?.id);
  const onRefresh = () => { setRefreshing(true); loadPettyCashData(); };

  return {
    transactions, summary, accountId, preschoolId, loading, refreshing,
    loadPettyCashData, addExpense, addReplenishment, addWithdrawal,
    resetPettyCash, cancelTransaction, deleteTransaction, reverseTransaction,
    canDelete, onRefresh,
  };
}
