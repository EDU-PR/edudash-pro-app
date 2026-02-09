/** Submit handler for aftercare registration */
import { assertSupabase } from '@/lib/supabase';
import {
  COMMUNITY_SCHOOL_ID, REGISTRATION_FEE_ORIGINAL, REGISTRATION_FEE_DISCOUNTED,
  formatPhoneNumber, generatePaymentReference, type ShowAlert,
} from '../useAftercareRegistration.helpers';

interface SubmitParams {
  userId: string | undefined;
  parentFirstName: string;
  parentLastName: string;
  parentEmail: string;
  parentPhone: string;
  parentIdNumber: string;
  childFirstName: string;
  childLastName: string;
  childGrade: string;
  childDateOfBirth: Date | null;
  childAllergies: string;
  childMedicalConditions: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  howDidYouHear: string;
  proofOfPayment: string | null;
  spotsRemaining: number | null;
}

/** Build and insert the aftercare registration, return true on success */
export async function submitRegistration(
  params: SubmitParams,
  showAlert: ShowAlert,
  fetchSpots: () => Promise<void>,
): Promise<boolean> {
  const {
    userId, parentFirstName, parentLastName, parentEmail, parentPhone,
    parentIdNumber, childFirstName, childLastName, childGrade,
    childDateOfBirth, childAllergies, childMedicalConditions,
    emergencyContactName, emergencyContactPhone, emergencyContactRelation,
    howDidYouHear, proofOfPayment, spotsRemaining,
  } = params;

  const paymentRef = generatePaymentReference(childFirstName, childLastName, parentPhone);
  const hasDiscount = spotsRemaining !== null && spotsRemaining > 0;
  const registrationFee = hasDiscount ? REGISTRATION_FEE_DISCOUNTED : REGISTRATION_FEE_ORIGINAL;
  const formatDateStr = (d: Date) => d.toISOString().split('T')[0];

  const payload = {
    preschool_id: COMMUNITY_SCHOOL_ID, parent_user_id: userId || null,
    parent_first_name: parentFirstName.trim(), parent_last_name: parentLastName.trim(),
    parent_email: parentEmail.trim().toLowerCase(), parent_phone: formatPhoneNumber(parentPhone),
    parent_id_number: parentIdNumber.trim() || null,
    child_first_name: childFirstName.trim(), child_last_name: childLastName.trim(),
    child_grade: childGrade, child_date_of_birth: childDateOfBirth ? formatDateStr(childDateOfBirth) : null,
    child_allergies: childAllergies.trim() || null, child_medical_conditions: childMedicalConditions.trim() || null,
    emergency_contact_name: emergencyContactName.trim(), emergency_contact_phone: formatPhoneNumber(emergencyContactPhone),
    emergency_contact_relation: emergencyContactRelation.trim(),
    how_did_you_hear: howDidYouHear.trim() || null,
    registration_fee: registrationFee, registration_fee_original: REGISTRATION_FEE_ORIGINAL,
    promotion_code: hasDiscount ? 'EARLYBIRD50' : null,
    payment_reference: paymentRef,
    status: proofOfPayment ? 'paid' : 'pending_payment',
    proof_of_payment_url: proofOfPayment,
  };

  const supabase = assertSupabase();

  // Check for duplicates
  const { data: existing } = await supabase
    .from('aftercare_registrations').select('id, status')
    .eq('parent_email', parentEmail.trim())
    .eq('child_first_name', childFirstName.trim())
    .eq('child_last_name', childLastName.trim())
    .eq('preschool_id', COMMUNITY_SCHOOL_ID)
    .neq('status', 'cancelled');

  if (existing?.find(r => r.status !== 'cancelled')) {
    showAlert({ title: 'Duplicate Registration', message: 'A registration for this child already exists. Please contact the school if you need to update your registration.' });
    return false;
  }

  const { data, error: insertError } = await supabase
    .from('aftercare_registrations').insert(payload).select().single();

  if (insertError) {
    if (insertError.code === '42P01') {
      showAlert({ title: 'System Error', message: 'The aftercare registration system is currently unavailable. Please contact support.' });
      return false;
    }
    throw insertError;
  }

  await fetchSpots();

  // Fire-and-forget notifications
  const fullParent = `${parentFirstName} ${parentLastName}`;
  const fullChild = `${childFirstName} ${childLastName}`;
  supabase.functions.invoke('send-aftercare-confirmation', {
    body: { registration_id: data.id, parent_email: parentEmail, parent_name: fullParent, child_name: fullChild, payment_reference: paymentRef, has_proof: !!proofOfPayment },
  }).catch(() => {});
  supabase.functions.invoke('notifications-dispatcher', {
    body: { event_type: 'aftercare_registration_submitted', preschool_id: COMMUNITY_SCHOOL_ID, role_targets: ['principal', 'principal_admin'], registration_id: data.id, child_name: fullChild, parent_name: fullParent },
  }).catch(() => {});

  const successMsg = proofOfPayment
    ? 'Your registration has been submitted and your payment proof has been received. You will receive a confirmation email shortly.'
    : 'Your registration has been submitted. Please upload proof of payment to complete your registration. You will receive a confirmation email with banking details.';
  showAlert({ title: 'Registration Submitted!', message: successMsg, buttons: [{ text: 'OK', onPress: () => require('expo-router').router.back() }] });

  return true;
}
