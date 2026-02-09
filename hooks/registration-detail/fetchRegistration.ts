/** Fetch logic for registration-detail (tries both tables) */
import { assertSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import type { Registration } from './types';

const TAG = 'RegistrationFetch';

export async function fetchRegistration(id: string): Promise<Registration> {
  const supabase = assertSupabase();

  // First try registration_requests (EduSite sync)
  const { data, error: fetchError } = await supabase
    .from('registration_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

  if (data) {
    return { ...data, source: 'edusite' as const };
  }

  // Try child_registration_requests (in-app submissions)
  const { data: inAppData, error: inAppError } = await supabase
    .from('child_registration_requests')
    .select(`
      id, child_first_name, child_last_name, child_birth_date, child_gender,
      medical_info, dietary_requirements, special_needs,
      emergency_contact_name, emergency_contact_phone, notes,
      parent_id, preschool_id, status, reviewed_by, reviewed_at,
      rejection_reason, created_at, registration_fee_amount,
      registration_fee_paid, payment_method, proof_of_payment_url,
      payment_verified,
      parent:profiles!parent_id(first_name, last_name, email, phone)
    `)
    .eq('id', id)
    .maybeSingle();

  if (inAppError && inAppError.code !== 'PGRST116') throw inAppError;

  if (inAppData) {
    const parentData = Array.isArray(inAppData.parent) ? inAppData.parent[0] : inAppData.parent;
    return {
      id: inAppData.id,
      organization_id: inAppData.preschool_id,
      guardian_name: parentData
        ? `${parentData.first_name || ''} ${parentData.last_name || ''}`.trim()
        : 'Parent',
      guardian_email: parentData?.email || '',
      guardian_phone: parentData?.phone || '',
      student_first_name: inAppData.child_first_name,
      student_last_name: inAppData.child_last_name,
      student_dob: inAppData.child_birth_date,
      student_gender: inAppData.child_gender,
      documents_uploaded: true,
      registration_fee_amount: inAppData.registration_fee_amount || 0,
      registration_fee_paid: inAppData.registration_fee_paid || false,
      payment_verified: inAppData.payment_verified || false,
      payment_method: inAppData.payment_method,
      proof_of_payment_url: inAppData.proof_of_payment_url,
      status: inAppData.status,
      reviewed_by: inAppData.reviewed_by,
      rejection_reason: inAppData.rejection_reason,
      notes: inAppData.notes,
      created_at: inAppData.created_at,
      source: 'in-app' as const,
      parent_id: inAppData.parent_id,
      guardian_id_document_url: undefined,
      student_birth_certificate_url: undefined,
      student_clinic_card_url: undefined,
    };
  }

  throw new Error('Registration not found. It may have been deleted or you do not have permission to view it.');
}
