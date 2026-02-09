/**
 * Petty cash types, constants, and utility functions.
 */

import type { useAlertModal } from '@/components/ui/AlertModal';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

export type ShowAlert = ReturnType<typeof useAlertModal>['showAlert'];

export type AlertFn = (config: { title: string; message: string; type: 'info' | 'warning' | 'success' | 'error' }) => void;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount);

export const getStatusColor = (status: string, theme?: { success?: string; warning?: string; error?: string; textSecondary?: string }): string => {
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
