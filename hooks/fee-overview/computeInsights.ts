/**
 * Insights computation for the fee overview.
 * Pure function — no side effects.
 */

import type { AccountingSnapshot, ExpenseSummary, PaymentSummary } from './types';

export interface FeeInsights {
  doList: string[];
  avoidList: string[];
}

export function computeInsights(
  accountingSnapshot: AccountingSnapshot | null,
  expenseSummary: ExpenseSummary | null,
  paymentSummary: PaymentSummary | null,
): FeeInsights {
  const doList: string[] = [];
  const avoidList: string[] = [];
  const income = accountingSnapshot?.income ?? 0;
  const pending = accountingSnapshot?.pending ?? 0;
  const expenses = accountingSnapshot?.expenses ?? 0;
  const net = accountingSnapshot?.net ?? 0;
  const completionRate = accountingSnapshot?.completionRate ?? 0;
  const missingPaymentEvidence = paymentSummary?.missingEvidenceCount ?? 0;
  const missingExpenseReceipts = expenseSummary?.missingReceiptCount ?? 0;

  if (pending > 0) {
    doList.push('Follow up on unpaid fees and pending POPs weekly.');
  }
  if (completionRate < 70 && pending > 0) {
    doList.push('Send payment reminders and offer short payment plans.');
  }
  if (missingPaymentEvidence > 0) {
    doList.push('Collect POP or bank references for all completed payments.');
    avoidList.push('Do not mark payments complete without verification.');
  }
  if (missingExpenseReceipts > 0) {
    doList.push('Attach receipts for every expense entry.');
  }
  if (net < 0) {
    doList.push('Prioritize essential spending and pause non-critical purchases.');
    avoidList.push('Avoid new discretionary expenses until cash flow improves.');
  } else if (net > 0 && income > 0) {
    doList.push('Set aside a cash reserve (10–15%) for unexpected costs.');
  }

  const expenseRatio = income > 0 ? expenses / income : 0;
  if (expenseRatio > 0.8) {
    avoidList.push('Avoid increasing recurring expenses without matching income.');
  }
  if (completionRate > 0 && completionRate < 50) {
    avoidList.push('Avoid committing to new costs based on unpaid fees.');
  }

  if (!doList.length) {
    doList.push('Review income vs expenses every week and keep records updated.');
  }
  if (!avoidList.length) {
    avoidList.push('Avoid delaying reconciliations or skipping receipt uploads.');
  }

  return { doList, avoidList };
}
