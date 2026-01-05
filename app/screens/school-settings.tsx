import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { assertSupabase } from '@/lib/supabase';
import { SchoolSettingsService } from '@/lib/services/SchoolSettingsService';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SuccessModal } from '@/components/ui/SuccessModal';
import { useEduDashAlert } from '@/components/ui/EduDashAlert';

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingBank, setSavingBank] = useState(false);
  const [number, setNumber] = useState('');
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
      console.error('Error saving bank details:', e);
      showError('Error', e?.message || 'Failed to save banking details');
    } finally { setSavingBank(false); }
  };

  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: t('settings.school_settings', { defaultValue: 'School Settings' }), headerStyle: { backgroundColor: theme.background }, headerTitleStyle: { color: theme.text }, headerTintColor: theme.primary }} />
      <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          {loading ? (
            <ActivityIndicator color={theme.primary} size="large" />
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
                    <ActivityIndicator color={theme.onPrimary} />
                  ) : (
                    <>
                      <Ionicons name="save-outline" size={18} color={theme.onPrimary} style={{ marginRight: 8 }} />
                      <Text style={styles.btnText}>{t('common.save_banking_details', { defaultValue: 'Save Banking Details' })}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* WhatsApp Section */}
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
                    <ActivityIndicator color="#fff" />
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
});
