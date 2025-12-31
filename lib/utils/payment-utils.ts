// Payment utility functions

import type { FeeStatusInfo } from '@/types/payments';

export function formatCurrency(amount: number): string {
  return `R ${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`;
}

export function formatPaymentDate(dateString: string): string {
  const date = new Date(dateString);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(date.getDate()).padStart(2, '0');
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

export function getFeeStatusColor(dueDate: string, gracePeriodDays: number = 7): FeeStatusInfo {
  const now = new Date();
  const due = new Date(dueDate);
  const diffTime = now.getTime() - due.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 0) {
    return { 
      color: '#22c55e', 
      bgColor: 'rgba(34, 197, 94, 0.1)', 
      label: 'Due Soon',
    };
  } else if (diffDays <= gracePeriodDays) {
    const daysLeft = gracePeriodDays - diffDays;
    return { 
      color: '#fbbf24', 
      bgColor: 'rgba(251, 191, 36, 0.1)', 
      label: `Grace Period (${daysLeft}d left)`,
    };
  } else if (diffDays <= gracePeriodDays + 3) {
    return { 
      color: '#f97316', 
      bgColor: 'rgba(249, 115, 22, 0.1)', 
      label: 'Late Payment',
    };
  } else {
    return { 
      color: '#ef4444', 
      bgColor: 'rgba(239, 68, 68, 0.1)', 
      label: 'Overdue',
    };
  }
}

export function getUploadStatusColor(status: string): { color: string; bgColor: string } {
  switch (status) {
    case 'approved':
      return { color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.1)' };
    case 'rejected':
      return { color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.1)' };
    default:
      return { color: '#fbbf24', bgColor: 'rgba(251, 191, 36, 0.1)' };
  }
}
