/** useUniformRegister — orchestrator hook (≤200 lines) */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { logger } from '@/lib/logger';
import type {
  UniformEntry,
  UniformRegisterSummary,
  UniformRegisterFilter,
  ShowAlert,
} from './types';
import { fetchUniformRegister } from './fetchUniformRegister';
import {
  verifyUniformPayment,
  printRegister,
  shareRegisterPdf,
  sendListViaShare,
} from './uniformRegisterActions';

const TAG = 'useUniformRegister';

const EMPTY_SUMMARY: UniformRegisterSummary = {
  total_students: 0, forms_filled: 0, forms_pending: 0,
  total_paid: 0, total_partial: 0, total_unpaid: 0,
  total_revenue: 0, total_outstanding: 0,
};

export function useUniformRegister(
  preschoolId: string | undefined,
  schoolName: string,
  showAlert: ShowAlert,
) {
  const [entries, setEntries] = useState<UniformEntry[]>([]);
  const [summary, setSummary] = useState<UniformRegisterSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [filter, setFilter] = useState<UniformRegisterFilter>({
    status: 'all',
    filledOut: 'all',
    searchQuery: '',
  });

  const loadData = useCallback(async () => {
    if (!preschoolId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const result = await fetchUniformRegister(preschoolId);
      setEntries(result.entries);
      setSummary(result.summary);
    } catch (err: any) {
      logger.error(TAG, 'Load failed', err);
      showAlert('Error', err.message || 'Failed to load uniform register', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [preschoolId, showAlert]);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredEntries = useMemo(() => {
    let result = [...entries];
    if (filter.status !== 'all') result = result.filter((e) => e.payment_status === filter.status);
    if (filter.filledOut === 'yes') result = result.filter((e) => e.filled_out);
    if (filter.filledOut === 'no') result = result.filter((e) => !e.filled_out);
    if (filter.searchQuery.trim()) {
      const q = filter.searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.student_name.toLowerCase().includes(q) ||
          (e.parent_name && e.parent_name.toLowerCase().includes(q)),
      );
    }
    return result.sort((a, b) => a.student_name.localeCompare(b.student_name));
  }, [entries, filter]);

  const handleVerifyPayment = useCallback(async (studentId: string) => {
    if (!preschoolId) return;
    setProcessing(true);
    try {
      await verifyUniformPayment(studentId, preschoolId);
      await loadData();
      showAlert('Success', 'Uniform payment verified ✅', 'success');
    } catch (err: any) {
      showAlert('Error', err.message, 'error');
    } finally { setProcessing(false); }
  }, [preschoolId, loadData, showAlert]);

  const handlePrint = useCallback(async () => {
    setProcessing(true);
    try { await printRegister(filteredEntries, summary, schoolName); }
    catch (err: any) { showAlert('Error', err.message, 'error'); }
    finally { setProcessing(false); }
  }, [filteredEntries, summary, schoolName, showAlert]);

  const handleSharePdf = useCallback(async () => {
    setProcessing(true);
    try { await shareRegisterPdf(filteredEntries, summary, schoolName); }
    catch (err: any) { showAlert('Error', err.message, 'error'); }
    finally { setProcessing(false); }
  }, [filteredEntries, summary, schoolName, showAlert]);

  const handleSendList = useCallback(async () => {
    setProcessing(true);
    try { await sendListViaShare(filteredEntries, summary, schoolName); }
    catch (err: any) { showAlert('Error', err.message, 'error'); }
    finally { setProcessing(false); }
  }, [filteredEntries, summary, schoolName, showAlert]);

  const onRefresh = useCallback(() => { setRefreshing(true); loadData(); }, [loadData]);

  return {
    entries: filteredEntries, allEntries: entries, summary,
    loading, refreshing, processing,
    filter, setFilter,
    handleVerifyPayment, handlePrint, handleSharePdf, handleSendList,
    onRefresh, reload: loadData,
  };
}

export type { UniformEntry, UniformRegisterSummary, UniformRegisterFilter } from './types';
