/**
 * Fetches registrations from all three tables and merges them.
 *
 * Tables: registration_requests (EduSite), child_registration_requests (in-app),
 * aftercare_registrations (aftercare).
 */

import { assertSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

import type { Registration } from './types';

export async function fetchRegistrationsData(
  organizationId: string,
): Promise<Registration[]> {
  const supabase = assertSupabase();

  logger.debug('Registrations', 'Fetching for organization', { organizationId });

  // Fetch from registration_requests (EduSitePro sync)
  const { data: edusiteData, error: edusiteError } = await supabase
    .from('registration_requests')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  // Fetch from child_registration_requests (in-app submissions)
  const { data: inAppData, error: inAppError } = await supabase
    .from('child_registration_requests')
    .select(`
      id, child_first_name, child_last_name, child_birth_date, child_gender,
      medical_info, dietary_requirements, special_needs,
      emergency_contact_name, emergency_contact_phone, notes,
      parent_id, preschool_id, status, reviewed_by, reviewed_at,
      rejection_reason, created_at, registration_fee_amount,
      registration_fee_paid, payment_method, proof_of_payment_url, payment_verified,
      parent:profiles!parent_id(first_name, last_name, email, phone)
    `)
    .eq('preschool_id', organizationId)
    .order('created_at', { ascending: false });

  // Fetch from aftercare_registrations
  const { data: aftercareData, error: aftercareError } = await supabase
    .from('aftercare_registrations')
    .select('*')
    .eq('preschool_id', organizationId)
    .order('created_at', { ascending: false });

  if (edusiteError && edusiteError.code !== '42P01') {
    logger.warn('Registrations', 'EduSite fetch error', edusiteError);
  }
  if (inAppError && inAppError.code !== '42P01') {
    logger.warn('Registrations', 'In-app fetch error', inAppError);
  }
  if (aftercareError && aftercareError.code !== '42P01') {
    logger.warn('Registrations', 'Aftercare fetch error', aftercareError);
  }

  // Transform in-app registrations
  const transformedInApp: Registration[] = (inAppData || []).map((item: any) => ({
    id: item.id,
    organization_id: item.preschool_id,
    parent_id: item.parent_id,
    guardian_name: item.parent
      ? `${item.parent.first_name || ''} ${item.parent.last_name || ''}`.trim()
      : 'Parent',
    guardian_email: item.parent?.email || '',
    guardian_phone: item.parent?.phone || '',
    student_first_name: item.child_first_name,
    student_last_name: item.child_last_name,
    student_dob: item.child_birth_date,
    student_gender: item.child_gender,
    documents_uploaded: true,
    registration_fee_amount: item.registration_fee_amount || 0,
    registration_fee_paid: item.registration_fee_paid || false,
    payment_verified: item.payment_verified || false,
    payment_method: item.payment_method,
    proof_of_payment_url: item.proof_of_payment_url,
    status: item.status,
    reviewed_by: item.reviewed_by,
    reviewed_date: item.reviewed_at,
    rejection_reason: item.rejection_reason,
    created_at: item.created_at,
    source: 'in-app' as const,
    medical_info: item.medical_info,
    dietary_requirements: item.dietary_requirements,
    special_needs: item.special_needs,
    emergency_contact_name: item.emergency_contact_name,
    emergency_contact_phone: item.emergency_contact_phone,
  }));

  // Add source to EduSite registrations
  const transformedEdusite: Registration[] = (edusiteData || []).map((item: any) => ({
    ...item,
    source: 'edusite' as const,
  }));

  // Transform aftercare registrations
  const mapAftercareStatus = (status: string): 'pending' | 'approved' | 'rejected' => {
    if (status === 'paid' || status === 'enrolled') return 'approved';
    if (status === 'cancelled') return 'rejected';
    return 'pending';
  };

  const transformedAftercare: Registration[] = (aftercareData || []).map((item: any) => ({
    id: item.id,
    organization_id: item.preschool_id,
    guardian_name: `${item.parent_first_name || ''} ${item.parent_last_name || ''}`.trim(),
    guardian_email: item.parent_email || '',
    guardian_phone: item.parent_phone || '',
    student_first_name: item.child_first_name,
    student_last_name: item.child_last_name,
    student_dob: item.child_date_of_birth || '',
    student_gender: undefined,
    documents_uploaded: true,
    payment_reference: item.payment_reference,
    registration_fee_amount: item.registration_fee || 0,
    registration_fee_paid: item.status === 'paid' || item.status === 'enrolled',
    payment_verified: item.status === 'paid' || item.status === 'enrolled',
    payment_method: undefined,
    proof_of_payment_url: item.proof_of_payment_url,
    campaign_applied: item.promotion_code,
    discount_amount:
      item.registration_fee_original && item.registration_fee
        ? item.registration_fee_original - item.registration_fee
        : 0,
    status: mapAftercareStatus(item.status),
    reviewed_by: undefined,
    reviewed_date: item.payment_date || item.updated_at,
    rejection_reason: item.status === 'cancelled' ? 'Cancelled' : undefined,
    created_at: item.created_at,
    source: 'aftercare' as const,
    medical_info: item.child_medical_conditions,
    dietary_requirements: item.child_allergies,
    special_needs: undefined,
    emergency_contact_name: item.emergency_contact_name,
    emergency_contact_phone: item.emergency_contact_phone,
  }));

  const combined = [...transformedEdusite, ...transformedInApp, ...transformedAftercare].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  logger.info('Registrations', 'Found registrations', {
    total: combined.length,
    edusite: transformedEdusite.length,
    inApp: transformedInApp.length,
    aftercare: transformedAftercare.length,
  });

  return combined;
}
