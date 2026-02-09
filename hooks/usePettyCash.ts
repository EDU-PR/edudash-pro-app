/**
 * Re-export barrel for backward compatibility.
 * All logic lives in hooks/petty-cash/.
 */
export { usePettyCash } from './petty-cash';
export {
  type PettyCashTransaction,
  type PettyCashSummary,
  type ExpenseFormData,
  type ShowAlert,
  EXPENSE_CATEGORIES,
  formatCurrency,
  getStatusColor,
  getCategoryIcon,
} from './petty-cash';
