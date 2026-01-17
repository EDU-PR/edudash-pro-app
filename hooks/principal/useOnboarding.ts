// Custom hook for principal onboarding - WARP.md compliant (≤200 lines)

import { useState, useCallback, useEffect, useMemo } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { assertSupabase } from '@/lib/supabase';
import { TeacherInviteService } from '@/lib/services/teacherInviteService';
import { track } from '@/lib/analytics';
import type { OnboardingState, OnboardingStep, SchoolType } from '@/components/principal/onboarding/types';
import { INITIAL_ONBOARDING_STATE } from '@/components/principal/onboarding/types';

let AsyncStorage: any = null;
try { AsyncStorage = require('@react-native-async-storage/async-storage').default; } catch { /* noop */ }

interface UseOnboardingProps {
  user: any;
  profile: any;
  refreshProfile: () => Promise<void>;
}

export function useOnboarding({ user, profile, refreshProfile }: UseOnboardingProps) {
  const [state, setState] = useState<OnboardingState>(() => ({
    ...INITIAL_ONBOARDING_STATE,
    schoolId: profile?.organization_id || null,
    schoolName: profile?.organization_name || '',
    adminName: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(),
  }));

  // Load saved progress
  useEffect(() => {
    (async () => {
      if (!AsyncStorage) return;
      try {
        const raw = await AsyncStorage.getItem('onboarding_principal_state');
        if (raw) {
          const saved = JSON.parse(raw);
          setState(prev => ({ ...prev, ...saved }));
        }
      } catch { /* noop */ }
    })();
  }, []);

  // Persist state
  const persist = useCallback(async (updates?: Partial<OnboardingState>) => {
    const newState = updates ? { ...state, ...updates } : state;
    if (updates) setState(prev => ({ ...prev, ...updates }));
    if (!AsyncStorage) return;
    try { await AsyncStorage.setItem('onboarding_principal_state', JSON.stringify(newState)); } catch { /* noop */ }
  }, [state]);

  const canCreate = useMemo(() => Boolean(user?.id) && Boolean(state.schoolName.trim()), [user?.id, state.schoolName]);

  const handleCreateSchool = useCallback(async () => {
    if (!canCreate || state.creating) return;
    setState(prev => ({ ...prev, creating: true }));
    try {
      const { data, error } = await assertSupabase().rpc('register_new_school', {
        p_school_name: state.schoolName.trim(),
        p_principal_email: user?.email || profile?.email || '',
        p_principal_name: state.adminName.trim() || `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(),
        p_school_type: state.schoolType,
        p_grade_levels: state.schoolType === 'preschool' ? ['pre_k'] : state.schoolType === 'k12_school' ? ['foundation'] : ['pre_k', 'foundation'],
        p_contact_email: profile?.email || user?.email,
        p_contact_phone: state.phone.trim() || null,
        p_physical_address: null, p_selected_plan_id: null
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setState(prev => ({ ...prev, schoolId: data.school_id, step: 'invites', creating: false }));
      track('school_created_via_principal_onboarding', { school_type: state.schoolType, school_id: data.school_id });
      try { await refreshProfile(); } catch { /* noop */ }
      Alert.alert('School Created!', `${state.schoolName} has been registered. Let's invite your teachers next.`);
      persist({ step: 'invites', schoolId: data.school_id });
    } catch (e: any) {
      setState(prev => ({ ...prev, creating: false }));
      if (e.message?.includes('already exists')) {
        Alert.alert('Error', 'A school with this name already exists.');
      } else if (e.message?.includes('email already registered')) {
        Alert.alert('Email Already Registered', 'Would you like to sign in?', [
          { text: 'Use Different Email', style: 'cancel' },
          { text: 'Sign In', onPress: () => router.replace('/(auth)/sign-in') }
        ]);
      } else {
        Alert.alert('Error', e.message || 'Failed to create school');
      }
    }
  }, [canCreate, state, user, profile, refreshProfile, persist]);

  const addEmail = useCallback(() => {
    const trimmed = state.emailInput.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }
    if (state.emails.includes(trimmed)) return;
    const next = [...state.emails, trimmed];
    setState(prev => ({ ...prev, emails: next, emailInput: '' }));
    persist({ emails: next, emailInput: '' });
  }, [state.emailInput, state.emails, persist]);

  const removeEmail = useCallback((target: string) => {
    const next = state.emails.filter(e => e !== target);
    setState(prev => ({ ...prev, emails: next }));
    persist({ emails: next });
  }, [state.emails, persist]);

  const sendInvites = useCallback(async () => {
    if (!state.schoolId || !user?.id) { Alert.alert('Missing school', 'Create the school first.'); return; }
    if (!state.emails.length) { setState(prev => ({ ...prev, step: 'templates' })); persist({ step: 'templates' }); return; }
    setState(prev => ({ ...prev, sendingInvites: true }));
    const results: Array<{ email: string; status: 'sent' | 'error'; id?: string }> = [];
    for (const email of state.emails) {
      try {
        const inv = await TeacherInviteService.createInvite({ schoolId: state.schoolId, email, invitedBy: user.id });
        results.push({ email, status: 'sent', id: inv.id });
      } catch { results.push({ email, status: 'error' }); }
    }
    setState(prev => ({ ...prev, sentInvites: results, sendingInvites: false, step: 'templates' }));
    Alert.alert('Invites processed', `Sent: ${results.filter(r => r.status === 'sent').length}`);
    persist({ step: 'templates', sentInvites: results });
  }, [state.schoolId, state.emails, user?.id, persist]);

  const toggleTemplate = useCallback((id: string) => {
    const next = state.selectedTemplates.includes(id)
      ? state.selectedTemplates.filter(t => t !== id)
      : [...state.selectedTemplates, id];
    setState(prev => ({ ...prev, selectedTemplates: next }));
    persist({ selectedTemplates: next });
  }, [state.selectedTemplates, persist]);

  const setStep = useCallback((step: OnboardingStep) => {
    setState(prev => ({ ...prev, step }));
    persist({ step });
  }, [persist]);

  const setSchoolType = useCallback((schoolType: SchoolType) => {
    setState(prev => ({ ...prev, schoolType }));
    persist({ schoolType });
  }, [persist]);

  const setField = useCallback((field: keyof OnboardingState, value: any) => {
    setState(prev => ({ ...prev, [field]: value }));
    persist({ [field]: value });
  }, [persist]);

  const finish = useCallback(() => {
    Alert.alert('Setup complete', 'Your school is ready.');
    try { AsyncStorage?.removeItem('onboarding_principal_state'); } catch { /* noop */ }
    router.replace('/screens/principal-dashboard');
  }, []);

  return {
    ...state, canCreate, handleCreateSchool, addEmail, removeEmail, sendInvites,
    toggleTemplate, setStep, setSchoolType, setField, finish, persist,
  };
}
