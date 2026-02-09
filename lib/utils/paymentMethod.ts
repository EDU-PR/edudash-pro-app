export const normalizePaymentMethodCode = (value?: string | null): string => {
  const text = (value ?? '').toLowerCase().trim();
  if (!text) return 'other';

  if (text === 'cash') return 'cash';
  if (text === 'card' || text === 'card payment' || text === 'card_payment') return 'card';
  if (text === 'eft' || text === 'electronic funds transfer') return 'eft';
  if (text === 'bank_transfer' || text === 'bank transfer' || text.includes('eft / bank transfer')) return 'bank_transfer';
  if (text === 'debit order' || text === 'debit_order') return 'debit_order';
  if (text === 'cheque' || text === 'check') return 'cheque';
  if (text === 'mobile payment' || text === 'mobile_payment') return 'mobile_payment';

  return 'other';
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  bank_transfer: 'Bank Transfer',
  eft: 'EFT',
  cash: 'Cash',
  cheque: 'Cheque',
  card: 'Card',
  debit_order: 'Debit Order',
  mobile_payment: 'Mobile Payment',
  other: 'Other',
};
