/**
 * Types, constants, helpers, and styles for UniformSizesSection
 * Extracted for WARP compliance
 */

import { StyleSheet } from 'react-native';
import type { ThemeColors } from '@/contexts/ThemeContext';

// ── Constants ───────────────────────────────────────────────────────────────

export const SIZE_OPTIONS = [
  '2-3', '3-4', '4-5', '5-6', '6-7', '7-8', '8-9', '9-10',
  '10-11', '11-12', '12-13', 'XS', 'S', 'M', 'L', 'XL',
];

// ── Types ───────────────────────────────────────────────────────────────────

export type EntryStatus = 'idle' | 'saving' | 'saved' | 'error';
export type PastNumberChoice = '' | 'yes' | 'no';

export interface UniformEntry {
  childName: string;
  ageYears: string;
  tshirtSize: string;
  tshirtQuantity: string;
  shortsQuantity: string;
  isReturning: boolean;
  pastNumberChoice: PastNumberChoice;
  tshirtNumber: string;
  sampleSupplied: boolean;
  status: EntryStatus;
  message?: string | null;
  updatedAt?: string | null;
  isEditing?: boolean;
}

export interface ChildRow {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
  studentCode?: string | null;
  preschoolId?: string | null;
}

export interface UniformSizesSectionProps {
  children: ChildRow[];
}

export interface UniformFeeRow {
  amount: number;
  fee_type?: string | null;
  name?: string | null;
  description?: string | null;
  effective_from?: string | null;
  created_at?: string | null;
}

export interface SchoolUniformFeeRow {
  amount_cents: number;
  fee_category?: string | null;
  name?: string | null;
  description?: string | null;
  created_at?: string | null;
}

export interface UniformPricing {
  setAmount?: number;
  tshirtAmount?: number;
  shortsAmount?: number;
  fallbackAmount?: number;
}

export interface UniformRequestRow {
  student_id: string;
  child_name?: string | null;
  age_years?: number | null;
  tshirt_size?: string | null;
  tshirt_quantity?: number | null;
  shorts_quantity?: number | null;
  is_returning?: boolean | null;
  tshirt_number?: string | null;
  sample_supplied?: boolean | null;
  updated_at?: string | null;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export const getAgeYears = (dob?: string | null): string => {
  if (!dob) return '';
  const date = new Date(dob);
  if (Number.isNaN(date.getTime())) return '';
  const age = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
  return age > 0 ? String(age) : '';
};

export const formatCurrency = (value: number) =>
  `R ${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`;

export const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return fallback;
};

/** Compute per-child pricing breakdown */
export function computeChildPricing(entry: UniformEntry, pricing?: UniformPricing) {
  const tshirtQty = Number.isFinite(Number(entry.tshirtQuantity)) ? Number(entry.tshirtQuantity) : 0;
  const shortsQty = Number.isFinite(Number(entry.shortsQuantity)) ? Number(entry.shortsQuantity) : 0;
  const setPrice = pricing?.setAmount ?? pricing?.fallbackAmount ?? 0;
  const tshirtPrice = pricing?.tshirtAmount ?? 0;
  const shortsPrice = pricing?.shortsAmount ?? 0;
  const impliedSetQty = Math.min(tshirtQty, shortsQty);
  const billableSetQty = setPrice > 0 ? impliedSetQty : 0;
  const remainingTshirts = Math.max(tshirtQty - billableSetQty, 0);
  const remainingShorts = Math.max(shortsQty - billableSetQty, 0);
  const orderExtraTshirts = Math.max(tshirtQty - impliedSetQty, 0);
  const orderExtraShorts = Math.max(shortsQty - impliedSetQty, 0);
  const totalAmount = (setPrice * billableSetQty) + (tshirtPrice * remainingTshirts) + (shortsPrice * remainingShorts);
  const hasPricing = Boolean(pricing && (setPrice > 0 || tshirtPrice > 0 || shortsPrice > 0));

  return {
    tshirtQty, shortsQty, setPrice, tshirtPrice, shortsPrice,
    impliedSetQty, billableSetQty, remainingTshirts, remainingShorts,
    orderExtraTshirts, orderExtraShorts, totalAmount, hasPricing,
  };
}

// ── Styles ──────────────────────────────────────────────────────────────────

export const createUniformStyles = (theme: ThemeColors) => StyleSheet.create({
  header: { marginBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headerText: { flex: 1 },
  title: { fontSize: 16, fontWeight: '700', color: theme.text },
  subtitle: { fontSize: 12, color: theme.textSecondary, marginTop: 4 },
  paymentsButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1, borderColor: theme.primary + '40', backgroundColor: theme.primary + '10',
  },
  paymentsButtonText: { fontSize: 12, fontWeight: '600', color: theme.primary },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  card: { borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: theme.border },
  childName: { fontSize: 15, fontWeight: '700', color: theme.text },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarCircle: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center',
    justifyContent: 'center', backgroundColor: theme.primary,
  },
  avatarText: { color: '#fff', fontWeight: '700' },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
    backgroundColor: theme.success + '20',
  },
  statusPillText: { color: theme.success, fontSize: 12, fontWeight: '700' },
  summaryText: { fontSize: 12, color: theme.textSecondary, marginBottom: 4 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  summaryLabel: { fontSize: 11, color: theme.textSecondary },
  summaryValue: { fontSize: 12, fontWeight: '700', color: theme.text },
  editButton: {
    marginTop: 8, alignSelf: 'flex-start', paddingHorizontal: 14,
    paddingVertical: 8, borderRadius: 10, backgroundColor: theme.primary + '15',
  },
  editButtonText: { color: theme.primary, fontWeight: '700', fontSize: 12 },
  label: { fontSize: 12, fontWeight: '600', color: theme.textSecondary, marginBottom: 6 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: theme.text, marginBottom: 8, marginTop: 4 },
  toggleLabel: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
  input: {
    borderWidth: 1, borderColor: theme.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, color: theme.text,
    backgroundColor: theme.elevated, marginBottom: 10,
  },
  pickerWrap: {
    borderWidth: 1, borderColor: theme.border, borderRadius: 10,
    overflow: 'hidden', backgroundColor: theme.elevated, marginBottom: 10,
  },
  picker: { color: theme.text },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  choiceButton: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.surface,
  },
  choiceButtonActive: {
    borderColor: theme.primary,
    backgroundColor: theme.primary + '14',
  },
  choiceButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.textSecondary,
  },
  choiceButtonTextActive: {
    color: theme.primary,
  },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  saveButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  saveButtonText: { color: '#fff', fontWeight: '700' },
  payButton: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1 },
  uploadButton: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1 },
  payButtonText: { fontWeight: '700' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  statusText: { fontSize: 12 },
  updatedText: { marginTop: 8, fontSize: 11, color: theme.textSecondary },
  helperText: { fontSize: 11, color: theme.textSecondary, marginBottom: 10 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  setInput: { flex: 1 },
  matchButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  matchButtonText: { fontSize: 12, fontWeight: '700' },
  pricingCard: {
    borderRadius: 10, borderWidth: 1, borderColor: theme.border,
    padding: 10, marginBottom: 12, backgroundColor: theme.surface,
  },
  pricingTitle: { fontSize: 12, fontWeight: '700', color: theme.text, marginBottom: 4 },
  pricingText: { fontSize: 11, color: theme.textSecondary, marginBottom: 2 },
  pricingTotal: { fontSize: 12, fontWeight: '700', color: theme.text, marginTop: 4 },
  pricingHint: { fontSize: 11, color: theme.textSecondary, marginTop: 6 },
  emptyText: { color: theme.textSecondary, textAlign: 'center' },
  mutedText: { color: theme.textSecondary, fontSize: 12 },
  errorText: { color: theme.error, fontSize: 12, marginBottom: 8 },
});
