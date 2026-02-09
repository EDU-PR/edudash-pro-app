/** Types for registration-detail */
import type { AlertButton } from '@/components/ui/AlertModal';

export type ShowAlert = (
  title: string, message: string,
  type?: 'info' | 'warning' | 'success' | 'error',
  buttons?: AlertButton[],
) => void;

export interface Registration {
  id: string;
  organization_id: string;
  organization_name?: string;
  edusite_id?: string;
  guardian_name: string;
  guardian_email: string;
  guardian_phone: string;
  guardian_address?: string;
  guardian_id_number?: string;
  student_first_name: string;
  student_last_name: string;
  student_dob: string;
  student_gender?: string;
  student_id_number?: string;
  student_birth_certificate_url?: string;
  student_clinic_card_url?: string;
  guardian_id_document_url?: string;
  documents_uploaded: boolean;
  documents_deadline?: string;
  payment_reference?: string;
  registration_fee_amount?: number;
  registration_fee_paid: boolean;
  payment_verified?: boolean;
  payment_method?: string;
  payment_date?: string;
  proof_of_payment_url?: string;
  campaign_applied?: string;
  discount_amount?: number;
  medical_conditions?: string;
  allergies?: string;
  special_needs?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by?: string;
  reviewed_date?: string;
  rejection_reason?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
  source?: 'edusite' | 'in-app' | 'aftercare';
  parent_id?: string;
}
