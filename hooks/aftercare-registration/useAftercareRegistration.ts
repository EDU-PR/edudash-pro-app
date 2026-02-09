/** useAftercareRegistration — state + effects + handlers for aftercare registration */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import {
  COMMUNITY_SCHOOL_ID, EARLY_BIRD_LIMIT,
  validateAftercareFields, formatDate,
  type Grade, type ShowAlert,
} from '../useAftercareRegistration.helpers';
import { usePopUpload } from './usePopUpload';
import { submitRegistration } from './submitRegistration';

export function useAftercareRegistration(showAlert: ShowAlert) {
  const { profile, user } = useAuth();

  // Parent fields
  const [parentFirstName, setParentFirstName] = useState(profile?.first_name || '');
  const [parentLastName, setParentLastName] = useState(profile?.last_name || '');
  const [parentEmail, setParentEmail] = useState(profile?.email || '');
  const [parentPhone, setParentPhone] = useState((profile as any)?.phone || '');
  const [parentIdNumber, setParentIdNumber] = useState('');

  // Child fields
  const [childFirstName, setChildFirstName] = useState('');
  const [childLastName, setChildLastName] = useState('');
  const [childGrade, setChildGrade] = useState<Grade>('R');
  const [childDateOfBirth, setChildDateOfBirth] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [childAllergies, setChildAllergies] = useState('');
  const [childMedicalConditions, setChildMedicalConditions] = useState('');

  // Emergency contact
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [emergencyContactRelation, setEmergencyContactRelation] = useState('');

  // Additional
  const [howDidYouHear, setHowDidYouHear] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'eft' | 'cash' | 'card' | ''>('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [spotsRemaining, setSpotsRemaining] = useState<number | null>(null);
  const [registrationsClosed, setRegistrationsClosed] = useState(false);

  // Pop upload (extracted hook)
  const pop = usePopUpload(showAlert);

  // Spots tracking
  const fetchSpots = useCallback(async () => {
    try {
      const { count, error } = await assertSupabase()
        .from('aftercare_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('preschool_id', COMMUNITY_SCHOOL_ID);
      if (!error && count !== null) {
        const remaining = Math.max(0, EARLY_BIRD_LIMIT - count);
        setSpotsRemaining(remaining);
        if (remaining === 0) setRegistrationsClosed(true);
      }
    } catch {
      setSpotsRemaining(EARLY_BIRD_LIMIT);
    }
  }, []);

  useEffect(() => {
    fetchSpots();
    const supabase = assertSupabase();
    const channel = supabase
      .channel('aftercare-registrations-count')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'aftercare_registrations', filter: `preschool_id=eq.${COMMUNITY_SCHOOL_ID}` }, () => fetchSpots())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'aftercare_registrations', filter: `preschool_id=eq.${COMMUNITY_SCHOOL_ID}` }, () => fetchSpots())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchSpots]);

  // Validation
  const validate = (): boolean => {
    const e = validateAftercareFields({
      parentFirstName, parentLastName, parentEmail, parentPhone,
      childFirstName, childLastName, childDateOfBirth,
      emergencyContactName, emergencyContactPhone, emergencyContactRelation,
      acceptTerms, profileId: profile?.id,
    });
    setErrors(e);
    if (Object.keys(e).length > 0) { showAlert({ title: 'Validation Error', message: 'Please fix the errors before submitting' }); return false; }
    if (!profile?.id) { showAlert({ title: 'Profile missing', message: 'We could not determine your user profile. Please try again after reloading.' }); return false; }
    return true;
  };

  // Submit
  const onSubmit = useCallback(async () => {
    if (!validate()) return;
    if (!profile?.id) { showAlert({ title: 'Profile Missing', message: 'We could not determine your user profile. Please try logging out and back in.' }); return; }
    if (registrationsClosed) { showAlert({ title: 'Registrations Closed', message: 'Sorry, the early bird registrations are now full. Please contact the school for more information.' }); return; }
    setLoading(true);
    try {
      const success = await submitRegistration({
        userId: user?.id, parentFirstName, parentLastName, parentEmail, parentPhone,
        parentIdNumber, childFirstName, childLastName, childGrade,
        childDateOfBirth, childAllergies, childMedicalConditions,
        emergencyContactName, emergencyContactPhone, emergencyContactRelation,
        howDidYouHear, proofOfPayment: pop.proofOfPayment, spotsRemaining,
      }, showAlert, fetchSpots);
      if (success) {
        // Reset form
        setChildFirstName(''); setChildLastName(''); setChildGrade('R'); setChildDateOfBirth(null);
        setChildAllergies(''); setChildMedicalConditions(''); setEmergencyContactName('');
        setEmergencyContactPhone(''); setEmergencyContactRelation(''); setHowDidYouHear('');
        setAcceptTerms(false); setPaymentMethod(''); pop.setProofOfPayment(null); setParentIdNumber(''); setErrors({});
      }
    } catch (e: any) {
      showAlert({ title: 'Submission failed', message: e?.message || e?.toString() || 'Please try again' });
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAlert, registrationsClosed, profile, spotsRemaining, parentFirstName, parentLastName, parentEmail, parentPhone, parentIdNumber, childFirstName, childLastName, childGrade, childDateOfBirth, childAllergies, childMedicalConditions, emergencyContactName, emergencyContactPhone, emergencyContactRelation, howDidYouHear, acceptTerms, pop.proofOfPayment, user]);

  const clearFieldError = useCallback((field: string) => {
    setErrors(prev => ({ ...prev, [field]: '' }));
  }, []);

  return {
    parentFirstName, setParentFirstName, parentLastName, setParentLastName,
    parentEmail, setParentEmail, parentPhone, setParentPhone,
    parentIdNumber, setParentIdNumber,
    childFirstName, setChildFirstName, childLastName, setChildLastName,
    childGrade, setChildGrade, childDateOfBirth, setChildDateOfBirth,
    showDatePicker, setShowDatePicker, childAllergies, setChildAllergies,
    childMedicalConditions, setChildMedicalConditions,
    emergencyContactName, setEmergencyContactName,
    emergencyContactPhone, setEmergencyContactPhone,
    emergencyContactRelation, setEmergencyContactRelation,
    howDidYouHear, setHowDidYouHear, acceptTerms, setAcceptTerms,
    paymentMethod, setPaymentMethod,
    proofOfPayment: pop.proofOfPayment, setProofOfPayment: pop.setProofOfPayment,
    uploadingProof: pop.uploadingProof, pendingPopUri: pop.pendingPopUri,
    handlePopUpload: pop.handlePopUpload, confirmPopUpload: pop.confirmPopUpload,
    cancelPopUpload: pop.cancelPopUpload,
    loading, errors, clearFieldError, spotsRemaining, registrationsClosed,
    onSubmit, formatDate,
  };
}
