export interface PettyCashDashboardMetrics {
  currentBalance: number;
  monthlyExpenses: number;
  monthlyReplenishments: number;
  pendingTransactionsCount: number;
  recentTransactions: Array<{
    id: string;
    amount: number;
    type: 'expense' | 'replenishment' | 'adjustment';
    description: string;
    status: 'pending' | 'approved' | 'rejected';
    occurred_at: string;
  }>;
  monthlyTrend: {
    expensesVsPreviousMonth: number;
    balanceChange: number;
    transactionCount: number;
  };
  categories: Array<{
    name: string;
    amount: number;
    percentage: number;
  }>;
  lastUpdated: Date;
}

export interface UsePettyCashDashboardResult {
  metrics: PettyCashDashboardMetrics | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  hasData: boolean;
  isEmpty: boolean;
}
