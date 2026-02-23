import { isUniformLabel } from '@/lib/utils/feeUtils';

export interface ParentProfile {
  id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface UniformRow {
  id: string;
  child_name: string;
  age_years: number;
  tshirt_size: string;
  tshirt_quantity?: number | null;
  shorts_quantity?: number | null;
  tshirt_number?: string | null;
  is_returning?: boolean | null;
  sample_supplied?: boolean | null;
  created_at: string;
  updated_at?: string | null;
  student_id: string;
  parent_id?: string | null;
  student?: {
    first_name?: string | null;
    last_name?: string | null;
    student_id?: string | null;
  } | null;
  parent?: ParentProfile | null;
}

export interface StudentRow {
  id: string;
  first_name: string;
  last_name: string;
  student_id?: string | null;
  parent_id?: string | null;
  guardian_id?: string | null;
  class_id?: string | null;
  classroom?: { id?: string | null; name?: string | null } | null;
  parent?: ParentProfile | null;
  guardian?: ParentProfile | null;
}

export interface DisplayRow {
  id: string;
  studentId: string;
  childName: string;
  ageYears: number | null;
  tshirtSize: string;
  tshirtQuantity: number | null;
  shortsQuantity: number | null;
  tshirtNumber: string;
  isReturning: boolean;
  sampleSupplied: boolean;
  studentCode: string;
  parentId: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  submittedAt: string | null;
  updatedAt: string | null;
  status: 'submitted' | 'missing';
  className: string;
  paymentStatus: 'paid' | 'pending' | 'unpaid';
}

export const SIZE_OPTIONS = [
  '2-3', '3-4', '4-5', '5-6', '6-7', '7-8', '8-9',
  '9-10', '10-11', '11-12', '12-13', 'XS', 'S', 'M', 'L', 'XL',
];

export const escapeHtml = (value: string | number | null | undefined): string => {
  const s = value === null || value === undefined ? '' : String(value);
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
};

export const formatName = (first?: string | null, last?: string | null): string =>
  `${first || ''} ${last || ''}`.trim();

export const resolveParentProfile = (
  student?: StudentRow | null,
  override?: ParentProfile | null,
): ParentProfile | null => override || student?.parent || student?.guardian || null;

export const isUniformPaymentRecord = (payment: any): boolean =>
  isUniformLabel(payment?.description) ||
  isUniformLabel(payment?.metadata?.payment_purpose) ||
  String(payment?.metadata?.payment_context || '').toLowerCase() === 'uniform' ||
  String(payment?.metadata?.fee_type || '').toLowerCase() === 'uniform';
