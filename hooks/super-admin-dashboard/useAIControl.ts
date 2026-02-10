import { useCallback, useRef, useState } from 'react';
import { SuperAdminAIControl, SuperAdminAIControlState } from '@/services/superadmin/SuperAdminAIControl';
import { assertSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { isSuperAdmin } from '@/lib/roleUtils';
import type { PasswordModalState, ShowAlertFn } from './types';

/** Preset configs keyed by name */
const AUTONOMY_PRESETS: Record<string, Partial<SuperAdminAIControlState>> = {
  lockdown:   { autonomy_enabled: false, autonomy_mode: 'assistant', auto_execute_low: true, auto_execute_medium: false, auto_execute_high: false },
  assistant:  { autonomy_enabled: true,  autonomy_mode: 'assistant', auto_execute_low: true, auto_execute_medium: false, auto_execute_high: false },
  copilot:    { autonomy_enabled: true,  autonomy_mode: 'copilot',   auto_execute_low: true, auto_execute_medium: true,  auto_execute_high: false },
  full:       { autonomy_enabled: true,  autonomy_mode: 'full',      auto_execute_low: true, auto_execute_medium: true,  auto_execute_high: true },
};

interface UseAIControlParams {
  userId: string | undefined;
  userEmail: string | undefined;
  role: string | undefined;
  showAlert: ShowAlertFn;
}

const EMPTY_PW: PasswordModalState = { visible: false, message: '', value: '', error: null, submitting: false };

export function useAIControl({ userId, userEmail, role, showAlert }: UseAIControlParams) {
  const [aiControl, setAiControl] = useState<SuperAdminAIControlState | null>(null);
  const [aiControlLoading, setAiControlLoading] = useState(false);
  const [passwordModal, setPasswordModal] = useState<PasswordModalState>(EMPTY_PW);
  const passwordResolverRef = useRef<((ok: boolean) => void) | null>(null);
  const passwordValueRef = useRef('');

  const isSA = isSuperAdmin(role);

  const setPasswordValue = useCallback((v: string) => {
    passwordValueRef.current = v;
    setPasswordModal((prev) => ({ ...prev, value: v }));
  }, []);

  const closePasswordModal = useCallback((confirmed: boolean) => {
    setPasswordModal(EMPTY_PW);
    passwordResolverRef.current?.(confirmed);
    passwordResolverRef.current = null;
  }, []);

  const requestPassword = useCallback(async (actionLabel: string): Promise<boolean> => {
    if (!userEmail) {
      showAlert({ title: 'Password Required', message: 'Please sign in again to verify your password.', type: 'warning' });
      return false;
    }
    passwordValueRef.current = '';
    setPasswordModal({ visible: true, message: `Enter your password to ${actionLabel}.`, value: '', error: null, submitting: false });
    return new Promise((resolve) => { passwordResolverRef.current = resolve; });
  }, [showAlert, userEmail]);

  const handlePasswordConfirm = useCallback(async () => {
    if (!userEmail) {
      setPasswordModal((p) => ({ ...p, error: 'Email not available. Please sign in again.' }));
      return;
    }
    const pw = passwordValueRef.current;
    if (!pw) {
      setPasswordModal((p) => ({ ...p, error: 'Enter your password to continue.' }));
      return;
    }
    setPasswordModal((p) => ({ ...p, submitting: true }));
    try {
      const { error } = await assertSupabase().auth.signInWithPassword({ email: userEmail, password: pw });
      if (error) {
        setPasswordModal((p) => ({ ...p, error: 'Incorrect password. Please try again.', submitting: false }));
        return;
      }
      closePasswordModal(true);
    } catch (err) {
      logger.error('[SuperAdminDashboard] Password confirmation failed:', err);
      setPasswordModal((p) => ({ ...p, error: 'Unable to verify password. Please try again.', submitting: false }));
    }
  }, [closePasswordModal, userEmail]);

  const loadAIControl = useCallback(async (force = false) => {
    if (!isSA || !userId) return;
    setAiControlLoading(true);
    try {
      const state = await SuperAdminAIControl.getControlState({ force });
      setAiControl(state);
    } catch (err) {
      logger.error('[SuperAdminDashboard] Failed to load AI control state:', err);
      showAlert({ title: 'AI Control', message: 'Unable to load AI autonomy controls. Please try again.', type: 'error' });
    } finally {
      setAiControlLoading(false);
    }
  }, [isSA, showAlert, userId]);

  const claimOwnership = useCallback(async () => {
    if (!userId) return;
    const confirmed = await requestPassword('claim ownership');
    if (!confirmed) return;
    setAiControlLoading(true);
    try {
      const updated = await SuperAdminAIControl.claimOwnership(userId);
      setAiControl(updated);
      showAlert({ title: 'Ownership Claimed', message: 'You are now the platform owner for Dash AI autonomy.', type: 'success' });
    } catch (err) {
      logger.error('[SuperAdminDashboard] Failed to claim ownership:', err);
      showAlert({ title: 'Ownership Error', message: 'Unable to claim ownership. It may already be claimed.', type: 'error' });
    } finally {
      setAiControlLoading(false);
    }
  }, [requestPassword, showAlert, userId]);

  const updateAIControl = useCallback(async (patch: Partial<SuperAdminAIControlState>) => {
    if (!userId || !aiControl) return;
    if (aiControl.owner_user_id !== userId) {
      showAlert({ title: 'Owner Only', message: 'Only the platform owner can change Dash AI autonomy settings.', type: 'warning' });
      return;
    }
    const needsPassword =
      (patch.autonomy_enabled === true && !aiControl.autonomy_enabled) ||
      (patch.autonomy_mode !== undefined && patch.autonomy_mode !== aiControl.autonomy_mode && ['copilot', 'full'].includes(patch.autonomy_mode)) ||
      (patch.auto_execute_high === true && !aiControl.auto_execute_high);
    if (needsPassword) {
      const confirmed = await requestPassword('activate Dash AI autonomy privileges');
      if (!confirmed) return;
    }
    setAiControlLoading(true);
    try {
      const updated = await SuperAdminAIControl.updateControlState(patch, userId, { force: true });
      setAiControl(updated);
    } catch (err) {
      logger.error('[SuperAdminDashboard] Failed to update AI control state:', err);
      showAlert({ title: 'Update Error', message: 'Unable to update AI autonomy settings. Please try again.', type: 'error' });
    } finally {
      setAiControlLoading(false);
    }
  }, [aiControl, requestPassword, showAlert, userId]);

  const applyAutonomyPreset = useCallback(async (preset: 'lockdown' | 'assistant' | 'copilot' | 'full') => {
    if (!aiControl) return;
    const config = AUTONOMY_PRESETS[preset];
    if (config) await updateAIControl(config);
  }, [aiControl, updateAIControl]);

  // Derived state
  const isOwner = !!aiControl?.owner_user_id && aiControl.owner_user_id === userId;
  const isOwnerUnclaimed = aiControl ? !aiControl.owner_user_id : false;
  const canEditAIControl = isOwner && !aiControlLoading;
  const highRiskAvailable = aiControl?.autonomy_mode === 'full';
  const ownerStatusText = !isSA
    ? 'Owner controls are unavailable for this role.'
    : !aiControl
      ? 'Owner status unavailable.'
    : isOwner
      ? 'You control Dash AI autonomy.'
      : isOwnerUnclaimed
        ? 'Ownership is unclaimed.'
        : 'Owned by another account.';

  return {
    aiControl, aiControlLoading, loadAIControl,
    claimOwnership, updateAIControl, applyAutonomyPreset,
    isOwner, isOwnerUnclaimed, canEditAIControl, highRiskAvailable, ownerStatusText,
    passwordModal, setPasswordValue, closePasswordModal, handlePasswordConfirm,
  };
}
