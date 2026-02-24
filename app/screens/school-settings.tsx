import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { assertSupabase } from '@/lib/supabase';
import {
  SchoolSettingsService,
  DEFAULT_SCHOOL_SETTINGS,
  type AttendanceLifecyclePolicy,
} from '@/lib/services/SchoolSettingsService';
import { resolveFinancePrivacySettings } from '@/lib/finance/privacySettings';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SuccessModal } from '@/components/ui/SuccessModal';
import { useEduDashAlert } from '@/components/ui/EduDashAlert';
import { logger } from '@/lib/logger';
import { getFeatureFlagsSync } from '@/lib/featureFlags';

import EduDashSpinner from '@/components/ui/EduDashSpinner';
interface BankDetails {
  bank_name: string;
  account_name: string;
  account_number: string;
  branch_code: string;
  account_type: string;
}

interface ModalState {
  visible: boolean;
  title: string;
  message: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

export default function SchoolSettingsScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const { t } = useTranslation();
  const { showError, showWarning, AlertComponent } = useEduDashAlert();
  const lifecycleEnabled = React.useMemo(
    () => getFeatureFlagsSync().learner_activity_lifecycle_v1 !== false,
    []
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingBank, setSavingBank] = useState(false);
  const [savingLifecycle, setSavingLifecycle] = useState(false);
  const [savingUniformFeature, setSavingUniformFeature] = useState(false);
  const [savingStationeryFeature, setSavingStationeryFeature] = useState(false);
  const [savingFinancePrivacy, setSavingFinancePrivacy] = useState(false);
  const [savingGroupCreatorSetting, setSavingGroupCreatorSetting] = useState(false);
  const [groupCreatorAutoAddAsAdmin, setGroupCreatorAutoAddAsAdmin] = useState(true);
  const [number, setNumber] = useState('');
  const [uniformOrdersEnabled, setUniformOrdersEnabled] = useState(false);
  const [stationeryEnabled, setStationeryEnabled] = useState(false);
  const [feesPrivateModeEnabled, setFeesPrivateModeEnabled] = useState(false);
  const [financeAdminControls, setFinanceAdminControls] = useState(
    DEFAULT_SCHOOL_SETTINGS.permissions.financeAdminControls
  );
  const [financialReportsSettings, setFinancialReportsSettings] = useState(
    DEFAULT_SCHOOL_SETTINGS.features.financialReports
  );
  const [attendanceLifecycle, setAttendanceLifecycle] = useState<AttendanceLifecyclePolicy>(
    DEFAULT_SCHOOL_SETTINGS.attendanceLifecycle
  );
  const [bankDetails, setBankDetails] = useState<BankDetails>({
    bank_name: '',
    account_name: '',
    account_number: '',
    branch_code: '',
    account_type: 'cheque',
  });
  const [existingBankId, setExistingBankId] = useState<string | null>(null);
  const [successModal, setSuccessModal] = useState<ModalState>({ visible: false, title: '', message: '' });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        if (!profile?.organization_id) return;
        const supabase = assertSupabase();
        
        // Load school/organization settings
        // Try preschools first, then organizations (for membership orgs like SOA)
        let data = null;
        let error = null;
        
        ({ data, error } = await supabase
          .from('preschools')
          .select('settings, phone, name')
          .eq('id', profile.organization_id)
          .maybeSingle());
        
        // If not in preschools, try organizations table
        if (!data && !error) {
          ({ data, error } = await supabase
            .from('organizations')
            .select('settings, phone, name')
            .eq('id', profile.organization_id)
            .maybeSingle());
        }
        
        if (error) throw error;
        
        const configured = data?.settings?.whatsapp_number || data?.phone || '';
        if (active) setNumber(configured);

        const mergedSettings = await SchoolSettingsService.get(profile.organization_id);
        if (active && mergedSettings?.attendanceLifecycle) {
          setAttendanceLifecycle(mergedSettings.attendanceLifecycle);
        }
        if (active) {
          setUniformOrdersEnabled(Boolean(mergedSettings?.features?.uniforms?.enabled));
          setStationeryEnabled(Boolean((mergedSettings as any)?.features?.stationery?.enabled));
          const financePrivacy = resolveFinancePrivacySettings((mergedSettings as any) || {});
          setFeesPrivateModeEnabled(financePrivacy.hideFeesOnDashboards && financePrivacy.requireAppPasswordForFees);
          setFinanceAdminControls(
            mergedSettings?.permissions?.financeAdminControls ||
              DEFAULT_SCHOOL_SETTINGS.permissions.financeAdminControls
          );
          setFinancialReportsSettings(
            mergedSettings?.features?.financialReports || DEFAULT_SCHOOL_SETTINGS.features.financialReports
          );
        }

        // Load preschool_settings (group creator auto-add)
        const { data: psData } = await supabase
          .from('preschool_settings')
          .select('group_creator_auto_add_as_admin')
          .eq('preschool_id', profile.organization_id)
          .maybeSingle();
        if (active && psData) {
          setGroupCreatorAutoAddAsAdmin(psData.group_creator_auto_add_as_admin !== false);
        }

        // Load bank details
        const { data: bankData } = await supabase
          .from('organization_bank_accounts')
          .select('*')
          .eq('organization_id', profile.organization_id)
          .eq('is_primary', true)
          .maybeSingle();

        if (bankData && active) {
          setExistingBankId(bankData.id);
          setBankDetails({
            bank_name: bankData.bank_name || '',
            account_name: bankData.account_name || data?.name || '',
            account_number: bankData.account_number || '',
            branch_code: bankData.branch_code || '',
            account_type: bankData.account_type || 'cheque',
          });
        } else if (data?.name && active) {
          // Pre-fill account name with school name
          setBankDetails(prev => ({ ...prev, account_name: data.name }));
        }
      } catch (e: any) {
        showError('Error', e?.message || 'Failed to load school settings');
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [profile?.organization_id]);

  const save = async () => {
    try {
      if (!profile?.organization_id) return;
      const cleaned = number.replace(/\s+/g, '');
      if (!/^\+?\d{8,15}$/.test(cleaned)) {
        showWarning('Invalid number', 'Please enter a valid WhatsApp number in E.164 format (e.g. +27821234567)');
        return;
      }
      setSaving(true);
      await SchoolSettingsService.updateWhatsAppNumber(profile.organization_id, cleaned);
      setSuccessModal({ visible: true, title: 'Saved', message: 'WhatsApp number updated' });
    } catch (e: any) {
      showError('Error', e?.message || 'Failed to save number');
    } finally { setSaving(false); }
  };

  const saveBankDetails = async () => {
    try {
      if (!profile?.organization_id) return;
      
      // Validate required fields
      if (!bankDetails.bank_name.trim()) {
        showWarning('Required', 'Please enter the bank name');
        return;
      }
      if (!bankDetails.account_name.trim()) {
        showWarning('Required', 'Please enter the account holder name');
        return;
      }
      if (!bankDetails.account_number.trim()) {
        showWarning('Required', 'Please enter the account number');
        return;
      }
      if (!bankDetails.branch_code.trim()) {
        showWarning('Required', 'Please enter the branch code');
        return;
      }

      setSavingBank(true);
      const supabase = assertSupabase();

      const bankRecord = {
        organization_id: profile.organization_id,
        bank_name: bankDetails.bank_name.trim(),
        account_name: bankDetails.account_name.trim(),
        account_number: bankDetails.account_number.trim(),
        account_number_masked: `****${bankDetails.account_number.slice(-4)}`,
        branch_code: bankDetails.branch_code.trim(),
        account_type: bankDetails.account_type,
        is_primary: true,
        is_active: true,
      };

      if (existingBankId) {
        // Update existing
        const { error } = await supabase
          .from('organization_bank_accounts')
          .update(bankRecord)
          .eq('id', existingBankId);
        if (error) throw error;
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('organization_bank_accounts')
          .insert(bankRecord)
          .select()
          .single();
        if (error) throw error;
        setExistingBankId(data.id);
      }

      setSuccessModal({ visible: true, title: '✓ Saved', message: 'Banking details updated successfully. Parents will now see these details when making payments.' });
    } catch (e: any) {
      logger.error('SchoolSettings', 'Error saving bank details:', e);
      showError('Error', e?.message || 'Failed to save banking details');
    } finally { setSavingBank(false); }
  };

  const saveLifecyclePolicy = async () => {
    try {
      if (!profile?.organization_id) return;
      setSavingLifecycle(true);
      const updated = await SchoolSettingsService.update(profile.organization_id, {
        attendanceLifecycle,
      });
      setAttendanceLifecycle(updated.attendanceLifecycle);
      setSuccessModal({
        visible: true,
        title: '✓ Saved',
        message: 'Learner lifecycle policy updated successfully.',
      });
    } catch (e: any) {
      showError('Error', e?.message || 'Failed to save learner lifecycle policy');
    } finally {
      setSavingLifecycle(false);
    }
  };

  const saveUniformFeaturePolicy = async () => {
    try {
      if (!profile?.organization_id) return;
      setSavingUniformFeature(true);
      await SchoolSettingsService.update(profile.organization_id, {
        features: {
          uniforms: {
            enabled: uniformOrdersEnabled,
          },
        },
      } as any);
      setSuccessModal({
        visible: true,
        title: '✓ Saved',
        message: uniformOrdersEnabled
          ? 'Uniform orders are now enabled for parents.'
          : 'Uniform orders are now hidden from parents.',
      });
    } catch (e: any) {
      showError('Error', e?.message || 'Failed to save uniform order setting');
    } finally {
      setSavingUniformFeature(false);
    }
  };

  const saveFinancePrivacyPolicy = async () => {
    try {
      if (!profile?.organization_id) return;
      setSavingFinancePrivacy(true);
      await SchoolSettingsService.update(profile.organization_id, {
        features: {
          financialReports: {
            ...financialReportsSettings,
            hideOnDashboards: feesPrivateModeEnabled,
            requirePasswordForAccess: feesPrivateModeEnabled,
            privateModeEnabled: feesPrivateModeEnabled,
          },
        },
        permissions: {
          financeAdminControls,
        },
        // Legacy compatibility for older readers.
        ...( {
          finance_permissions: {
            admin_can_manage_fees: financeAdminControls.canManageFees,
            admin_can_manage_student_profile: financeAdminControls.canManageStudentProfile,
            admin_can_delete_fees: financeAdminControls.canDeleteFees,
          },
        } as any),
      } as any);
      setSuccessModal({
        visible: true,
        title: '✓ Saved',
        message: feesPrivateModeEnabled
          ? 'Fee privacy and admin permissions were updated. Dashboards are now private-fee mode.'
          : 'Fee privacy and admin permissions were updated.',
      });
    } catch (e: any) {
      showError('Error', e?.message || 'Failed to save fee privacy setting');
    } finally {
      setSavingFinancePrivacy(false);
    }
  };

  const saveStationeryFeaturePolicy = async () => {
    try {
      if (!profile?.organization_id) return;
      setSavingStationeryFeature(true);
      await SchoolSettingsService.update(profile.organization_id, {
        features: {
          stationery: {
            enabled: stationeryEnabled,
          },
        },
      } as any);
      setSuccessModal({
        visible: true,
        title: '✓ Saved',
        message: stationeryEnabled
          ? 'Stationery checklists are now visible to parents.'
          : 'Stationery checklists are now hidden from parents.',
      });
    } catch (e: any) {
      showError('Error', e?.message || 'Failed to save stationery setting');
    } finally {
      setSavingStationeryFeature(false);
    }
  };

  const saveGroupCreatorSetting = async () => {
    try {
      if (!profile?.organization_id) return;
      setSavingGroupCreatorSetting(true);
      const supabase = assertSupabase();
      const { error } = await supabase
        .from('preschool_settings')
        .upsert(
          { preschool_id: profile.organization_id, group_creator_auto_add_as_admin: groupCreatorAutoAddAsAdmin },
          { onConflict: 'preschool_id' }
        );
      if (error) throw error;
      setSuccessModal({
        visible: true,
        title: '✓ Saved',
        message: groupCreatorAutoAddAsAdmin
          ? 'Teachers who create class groups will be automatically added as admins.'
          : 'Teachers who create class groups will not be automatically added (only class teacher and parents).',
      });
    } catch (e: any) {
      showError('Error', e?.message || 'Failed to save group setting');
    } finally {
      setSavingGroupCreatorSetting(false);
    }
  };

  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: t('settings.school_settings', { defaultValue: 'School Settings' }), headerStyle: { backgroundColor: theme.background }, headerTitleStyle: { color: theme.text }, headerTintColor: theme.primary }} />
      <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          {loading ? (
            <EduDashSpinner color={theme.primary} size="large" />
          ) : (
            <>
              {/* Banking Details Section */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="card-outline" size={24} color={theme.primary} />
                  <Text style={styles.sectionTitle}>{t('settings.banking_details', { defaultValue: 'Banking Details' })}</Text>
                </View>
                <Text style={styles.sectionHint}>
                  {t('settings.banking_hint', { defaultValue: 'Parents will see these details when making EFT payments' })}
                </Text>

                <Text style={styles.label}>{t('settings.bank_name', { defaultValue: 'Bank Name' })} *</Text>
                <TextInput
                  style={styles.input}
                  value={bankDetails.bank_name}
                  onChangeText={(text) => setBankDetails(prev => ({ ...prev, bank_name: text }))}
                  placeholder="e.g. FNB, Standard Bank, ABSA, Nedbank"
                  placeholderTextColor={theme.textSecondary}
                />

                <Text style={styles.label}>{t('settings.account_holder', { defaultValue: 'Account Holder Name' })} *</Text>
                <TextInput
                  style={styles.input}
                  value={bankDetails.account_name}
                  onChangeText={(text) => setBankDetails(prev => ({ ...prev, account_name: text }))}
                  placeholder="e.g. Young Eagles Preschool"
                  placeholderTextColor={theme.textSecondary}
                />

                <Text style={styles.label}>{t('settings.account_number', { defaultValue: 'Account Number' })} *</Text>
                <TextInput
                  style={styles.input}
                  value={bankDetails.account_number}
                  onChangeText={(text) => setBankDetails(prev => ({ ...prev, account_number: text.replace(/\D/g, '') }))}
                  placeholder="e.g. 62123456789"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="number-pad"
                />

                <Text style={styles.label}>{t('settings.branch_code', { defaultValue: 'Branch Code' })} *</Text>
                <TextInput
                  style={styles.input}
                  value={bankDetails.branch_code}
                  onChangeText={(text) => setBankDetails(prev => ({ ...prev, branch_code: text.replace(/\D/g, '') }))}
                  placeholder="e.g. 250655"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="number-pad"
                />

                <Text style={styles.label}>{t('settings.account_type', { defaultValue: 'Account Type' })}</Text>
                <View style={styles.accountTypeRow}>
                  {['cheque', 'savings', 'transmission'].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.accountTypeBtn, bankDetails.account_type === type && styles.accountTypeBtnActive]}
                      onPress={() => setBankDetails(prev => ({ ...prev, account_type: type }))}
                    >
                      <Text style={[styles.accountTypeBtnText, bankDetails.account_type === type && styles.accountTypeBtnTextActive]}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity style={styles.btn} onPress={saveBankDetails} disabled={savingBank}>
                  {savingBank ? (
                    <EduDashSpinner color={theme.onPrimary} />
                  ) : (
                    <>
                      <Ionicons name="save-outline" size={18} color={theme.onPrimary} style={{ marginRight: 8 }} />
                      <Text style={styles.btnText}>{t('common.save_banking_details', { defaultValue: 'Save Banking Details' })}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Learner Lifecycle Section */}
              {lifecycleEnabled ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="pulse-outline" size={24} color={theme.primary} />
                  <Text style={styles.sectionTitle}>Learner Lifecycle</Text>
                </View>
                <Text style={styles.sectionHint}>
                  Class-register driven automation for at-risk and inactive learner handling.
                </Text>

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Enable automation</Text>
                  <TouchableOpacity
                    style={[styles.switchPill, attendanceLifecycle.enabled && styles.switchPillActive]}
                    onPress={() =>
                      setAttendanceLifecycle((prev) => ({ ...prev, enabled: !prev.enabled }))
                    }
                  >
                    <Text style={[styles.switchPillText, attendanceLifecycle.enabled && styles.switchPillTextActive]}>
                      {attendanceLifecycle.enabled ? 'ON' : 'OFF'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.stepperRow}>
                  <Text style={styles.switchLabel}>Trigger absences</Text>
                  <View style={styles.stepperControl}>
                    <TouchableOpacity
                      style={styles.stepperButton}
                      onPress={() =>
                        setAttendanceLifecycle((prev) => ({
                          ...prev,
                          trigger_absent_days: Math.max(1, prev.trigger_absent_days - 1),
                        }))
                      }
                    >
                      <Ionicons name="remove" size={16} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.stepperValue}>{attendanceLifecycle.trigger_absent_days}</Text>
                    <TouchableOpacity
                      style={styles.stepperButton}
                      onPress={() =>
                        setAttendanceLifecycle((prev) => ({
                          ...prev,
                          trigger_absent_days: prev.trigger_absent_days + 1,
                        }))
                      }
                    >
                      <Ionicons name="add" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.stepperRow}>
                  <Text style={styles.switchLabel}>Grace period (days)</Text>
                  <View style={styles.stepperControl}>
                    <TouchableOpacity
                      style={styles.stepperButton}
                      onPress={() =>
                        setAttendanceLifecycle((prev) => ({
                          ...prev,
                          grace_days: Math.max(1, prev.grace_days - 1),
                        }))
                      }
                    >
                      <Ionicons name="remove" size={16} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.stepperValue}>{attendanceLifecycle.grace_days}</Text>
                    <TouchableOpacity
                      style={styles.stepperButton}
                      onPress={() =>
                        setAttendanceLifecycle((prev) => ({
                          ...prev,
                          grace_days: prev.grace_days + 1,
                        }))
                      }
                    >
                      <Ionicons name="add" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Require principal approval</Text>
                  <TouchableOpacity
                    style={[
                      styles.switchPill,
                      attendanceLifecycle.require_principal_approval && styles.switchPillActive,
                    ]}
                    onPress={() =>
                      setAttendanceLifecycle((prev) => ({
                        ...prev,
                        require_principal_approval: !prev.require_principal_approval,
                      }))
                    }
                  >
                    <Text
                      style={[
                        styles.switchPillText,
                        attendanceLifecycle.require_principal_approval && styles.switchPillTextActive,
                      ]}
                    >
                      {attendanceLifecycle.require_principal_approval ? 'ON' : 'OFF'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.subsectionLabel}>Notify channels</Text>
                <View style={styles.notifyGrid}>
                  {(['push', 'email', 'sms', 'whatsapp'] as const).map((channel) => {
                    const enabled = attendanceLifecycle.notify_channels[channel];
                    return (
                      <TouchableOpacity
                        key={channel}
                        style={[styles.notifyChip, enabled && styles.notifyChipActive]}
                        onPress={() =>
                          setAttendanceLifecycle((prev) => ({
                            ...prev,
                            notify_channels: {
                              ...prev.notify_channels,
                              [channel]: !prev.notify_channels[channel],
                            },
                          }))
                        }
                      >
                        <Text style={[styles.notifyChipText, enabled && styles.notifyChipTextActive]}>
                          {channel.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity style={styles.btn} onPress={saveLifecyclePolicy} disabled={savingLifecycle}>
                  {savingLifecycle ? (
                    <EduDashSpinner color={theme.onPrimary} />
                  ) : (
                    <>
                      <Ionicons name="save-outline" size={18} color={theme.onPrimary} style={{ marginRight: 8 }} />
                      <Text style={styles.btnText}>Save Learner Lifecycle Policy</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.secondaryBtn]}
                  onPress={() => router.push('/screens/principal-learner-activity-control')}
                >
                  <Ionicons name="open-outline" size={16} color={theme.primary} style={{ marginRight: 8 }} />
                  <Text style={styles.secondaryBtnText}>Open Learner Activity Control</Text>
                </TouchableOpacity>
              </View>
              ) : null}

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="shirt-outline" size={24} color={theme.primary} />
                  <Text style={styles.sectionTitle}>Uniform Orders</Text>
                </View>
                <Text style={styles.sectionHint}>
                  Toggle whether parents can view and submit uniform orders from their dashboard.
                </Text>

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Enable parent uniform ordering</Text>
                  <TouchableOpacity
                    style={[styles.switchPill, uniformOrdersEnabled && styles.switchPillActive]}
                    onPress={() => setUniformOrdersEnabled((prev) => !prev)}
                  >
                    <Text style={[styles.switchPillText, uniformOrdersEnabled && styles.switchPillTextActive]}>
                      {uniformOrdersEnabled ? 'ON' : 'OFF'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.btn} onPress={saveUniformFeaturePolicy} disabled={savingUniformFeature}>
                  {savingUniformFeature ? (
                    <EduDashSpinner color={theme.onPrimary} />
                  ) : (
                    <>
                      <Ionicons name="save-outline" size={18} color={theme.onPrimary} style={{ marginRight: 8 }} />
                      <Text style={styles.btnText}>Save Uniform Order Setting</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="chatbubbles-outline" size={24} color={theme.primary} />
                  <Text style={styles.sectionTitle}>Messaging & Groups</Text>
                </View>
                <Text style={styles.sectionHint}>
                  When teachers create class groups, automatically add them as admins. Turn off if you prefer only the class teacher and parents in each group.
                </Text>

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Auto-add teacher as admin when they create a group</Text>
                  <TouchableOpacity
                    style={[styles.switchPill, groupCreatorAutoAddAsAdmin && styles.switchPillActive]}
                    onPress={() => setGroupCreatorAutoAddAsAdmin((prev) => !prev)}
                  >
                    <Text style={[styles.switchPillText, groupCreatorAutoAddAsAdmin && styles.switchPillTextActive]}>
                      {groupCreatorAutoAddAsAdmin ? 'ON' : 'OFF'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.btn} onPress={saveGroupCreatorSetting} disabled={savingGroupCreatorSetting}>
                  {savingGroupCreatorSetting ? (
                    <EduDashSpinner color={theme.onPrimary} />
                  ) : (
                    <>
                      <Ionicons name="save-outline" size={18} color={theme.onPrimary} style={{ marginRight: 8 }} />
                      <Text style={styles.btnText}>Save Group Setting</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="checkbox-outline" size={24} color={theme.primary} />
                  <Text style={styles.sectionTitle}>Stationery Checklists</Text>
                </View>
                <Text style={styles.sectionHint}>
                  Allow parents to track stationery items, upload proof photos, and share expected delivery dates.
                </Text>

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Enable parent stationery tracking</Text>
                  <TouchableOpacity
                    style={[styles.switchPill, stationeryEnabled && styles.switchPillActive]}
                    onPress={() => setStationeryEnabled((prev) => !prev)}
                  >
                    <Text style={[styles.switchPillText, stationeryEnabled && styles.switchPillTextActive]}>
                      {stationeryEnabled ? 'ON' : 'OFF'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.btn} onPress={saveStationeryFeaturePolicy} disabled={savingStationeryFeature}>
                  {savingStationeryFeature ? (
                    <EduDashSpinner color={theme.onPrimary} />
                  ) : (
                    <>
                      <Ionicons name="save-outline" size={18} color={theme.onPrimary} style={{ marginRight: 8 }} />
                      <Text style={styles.btnText}>Save Stationery Setting</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* WhatsApp Section */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="lock-closed-outline" size={24} color={theme.primary} />
                  <Text style={styles.sectionTitle}>Fee Privacy</Text>
                </View>
                <Text style={styles.sectionHint}>
                  Hide fees and payment widgets on principal/admin dashboards, and control how much finance power school admins have.
                </Text>

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Enable private fees mode</Text>
                  <TouchableOpacity
                    style={[styles.switchPill, feesPrivateModeEnabled && styles.switchPillActive]}
                    onPress={() => setFeesPrivateModeEnabled((prev) => !prev)}
                  >
                    <Text style={[styles.switchPillText, feesPrivateModeEnabled && styles.switchPillTextActive]}>
                      {feesPrivateModeEnabled ? 'ON' : 'OFF'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.subsectionLabel}>Admin finance controls</Text>

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Admins can mark/waive/adjust fees</Text>
                  <TouchableOpacity
                    style={[styles.switchPill, financeAdminControls.canManageFees && styles.switchPillActive]}
                    onPress={() =>
                      setFinanceAdminControls((prev) => ({ ...prev, canManageFees: !prev.canManageFees }))
                    }
                  >
                    <Text style={[styles.switchPillText, financeAdminControls.canManageFees && styles.switchPillTextActive]}>
                      {financeAdminControls.canManageFees ? 'ON' : 'OFF'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Admins can change class/start date/lifecycle</Text>
                  <TouchableOpacity
                    style={[styles.switchPill, financeAdminControls.canManageStudentProfile && styles.switchPillActive]}
                    onPress={() =>
                      setFinanceAdminControls((prev) => ({
                        ...prev,
                        canManageStudentProfile: !prev.canManageStudentProfile,
                      }))
                    }
                  >
                    <Text style={[styles.switchPillText, financeAdminControls.canManageStudentProfile && styles.switchPillTextActive]}>
                      {financeAdminControls.canManageStudentProfile ? 'ON' : 'OFF'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Admins can delete fee rows</Text>
                  <TouchableOpacity
                    style={[styles.switchPill, financeAdminControls.canDeleteFees && styles.switchPillActive]}
                    onPress={() =>
                      setFinanceAdminControls((prev) => ({ ...prev, canDeleteFees: !prev.canDeleteFees }))
                    }
                  >
                    <Text style={[styles.switchPillText, financeAdminControls.canDeleteFees && styles.switchPillTextActive]}>
                      {financeAdminControls.canDeleteFees ? 'ON' : 'OFF'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.btn} onPress={saveFinancePrivacyPolicy} disabled={savingFinancePrivacy}>
                  {savingFinancePrivacy ? (
                    <EduDashSpinner color={theme.onPrimary} />
                  ) : (
                    <>
                      <Ionicons name="save-outline" size={18} color={theme.onPrimary} style={{ marginRight: 8 }} />
                      <Text style={styles.btnText}>Save Fee Privacy & Admin Controls</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
                  <Text style={styles.sectionTitle}>{t('settings.whatsapp_settings', { defaultValue: 'WhatsApp Settings' })}</Text>
                </View>
                
                <Text style={styles.label}>{t('settings.whatsapp_number', { defaultValue: 'WhatsApp Number (E.164)' })}</Text>
                <TextInput
                  style={styles.input}
                  value={number}
                  onChangeText={setNumber}
                  keyboardType="phone-pad"
                  placeholder="+27821234567"
                  placeholderTextColor={theme.textSecondary}
                />
                <Text style={styles.hint}>{t('settings.whatsapp_hint', { defaultValue: 'Used for WhatsApp updates (wa.me deep link). Include the + prefix.' })}</Text>
                
                <TouchableOpacity style={[styles.btn, { backgroundColor: '#25D366' }]} onPress={save} disabled={saving}>
                  {saving ? (
                    <EduDashSpinner color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="save-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={[styles.btnText, { color: '#fff' }]}>{t('common.save_whatsapp', { defaultValue: 'Save WhatsApp Number' })}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
      
      {/* Custom Alert Modal */}
      <AlertComponent />
      
      {/* Success Modal */}
      <SuccessModal
        visible={successModal.visible}
        title={successModal.title}
        message={successModal.message}
        onClose={() => setSuccessModal({ visible: false, title: '', message: '' })}
      />
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  scrollView: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  section: { 
    backgroundColor: theme.surface, 
    borderRadius: 12, 
    padding: 16, 
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  sectionHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 8,
  },
  sectionTitle: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: theme.text, 
    marginLeft: 10,
  },
  sectionHint: {
    color: theme.textSecondary,
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18,
  },
  label: { 
    color: theme.text, 
    marginBottom: 6, 
    marginTop: 12,
    fontWeight: '600',
  },
  input: { 
    backgroundColor: theme.background, 
    color: theme.text, 
    borderWidth: 1, 
    borderColor: theme.border, 
    borderRadius: 8, 
    padding: 12,
    fontSize: 16,
  },
  hint: { 
    color: theme.textSecondary, 
    fontSize: 12, 
    marginTop: 6,
    lineHeight: 16,
  },
  btn: { 
    backgroundColor: theme.primary, 
    borderRadius: 10, 
    padding: 14, 
    alignItems: 'center', 
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  btnText: { 
    color: theme.onPrimary, 
    fontWeight: '700',
    fontSize: 15,
  },
  accountTypeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  accountTypeBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.background,
    alignItems: 'center',
  },
  accountTypeBtnActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  accountTypeBtnText: {
    color: theme.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  accountTypeBtnTextActive: {
    color: theme.onPrimary,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  switchLabel: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    marginRight: 10,
  },
  switchPill: {
    minWidth: 56,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.background,
    alignItems: 'center',
  },
  switchPillActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  switchPillText: {
    color: theme.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  switchPillTextActive: {
    color: theme.onPrimary,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  stepperControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.primary,
  },
  stepperValue: {
    minWidth: 24,
    textAlign: 'center',
    color: theme.text,
    fontWeight: '700',
  },
  subsectionLabel: {
    color: theme.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 8,
  },
  notifyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  notifyChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.background,
  },
  notifyChipActive: {
    borderColor: theme.primary,
    backgroundColor: theme.primary + '20',
  },
  notifyChipText: {
    color: theme.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  notifyChipTextActive: {
    color: theme.primary,
  },
  secondaryBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.primary + '55',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    flexDirection: 'row',
    backgroundColor: theme.primary + '12',
  },
  secondaryBtnText: {
    color: theme.primary,
    fontWeight: '700',
    fontSize: 14,
  },
});
