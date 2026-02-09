import type { Ionicons } from '@expo/vector-icons';
import type { FinancePendingPOPRow } from '@/types/finance';

export type CenterTab = 'overview' | 'receivables' | 'collections' | 'queue' | 'payroll' | 'rules';

export type PendingPOP = FinancePendingPOPRow;

export const TAB_ITEMS: Array<{ id: CenterTab; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { id: 'overview', label: 'Overview', icon: 'analytics' },
  { id: 'receivables', label: 'Receivables', icon: 'people' },
  { id: 'collections', label: 'Collections', icon: 'bar-chart' },
  { id: 'queue', label: 'Payment Queue', icon: 'receipt' },
  { id: 'payroll', label: 'Payroll', icon: 'people' },
  { id: 'rules', label: 'Categories & Rules', icon: 'settings' },
];

export const formatCurrency = (amount?: number): string =>
  `R${Number(amount || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
