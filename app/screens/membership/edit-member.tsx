/**
 * Edit Member Screen
 * Allows Youth President, Secretary, and other authorized executives 
 * to edit member details
 */
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useMemberDetail } from '@/hooks/membership/useMemberDetail';
import { DashboardWallpaperBackground } from '@/components/membership/dashboard';
import { AlertModal, useAlertModal } from '@/components/ui/AlertModal';
import { MemberType, MembershipTier, MEMBER_TYPE_LABELS, MEMBERSHIP_TIER_LABELS } from '@/components/membership/types';

import EduDashSpinner from '@/components/ui/EduDashSpinner';
// Authorized member types that can edit member details
const EDIT_AUTHORIZED_TYPES = [
  'ceo', 'president', 'deputy_president', 'secretary_general', 'treasurer', 'national_admin',
  'youth_president', 'youth_deputy', 'youth_secretary',
  'women_president', 'women_deputy', 'women_secretary',
  'veterans_president',
  'regional_manager', 'provincial_manager', 'branch_manager',
];

// South African provinces
const PROVINCES = [
  { value: 'GP', label: 'Gauteng' },
  { value: 'WC', label: 'Western Cape' },
  { value: 'KZN', label: 'KwaZulu-Natal' },
  { value: 'EC', label: 'Eastern Cape' },
  { value: 'LP', label: 'Limpopo' },
  { value: 'MP', label: 'Mpumalanga' },
  { value: 'NW', label: 'North West' },
  { value: 'FS', label: 'Free State' },
  { value: 'NC', label: 'Northern Cape' },
];

interface EditFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  id_number: string;
  date_of_birth: string;
  physical_address: string;
  city: string;
  province: string;
  postal_code: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
}

export default function EditMemberScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const memberId = typeof params.memberId === 'string' ? params.memberId : params.memberId?.[0] || null;
  const { showAlert, alertProps } = useAlertModal();
  
  const { member, loading, error, updateMember, refetch } = useMemberDetail(memberId);
  
  const [formData, setFormData] = useState<EditFormData>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    id_number: '',
    date_of_birth: '',
    physical_address: '',
    city: '',
    province: '',
    postal_code: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
  });
  const [saving, setSaving] = useState(false);
  const [showProvincePicker, setShowProvincePicker] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Check if current user is authorized to edit
  const currentUserMemberType = (profile as any)?.organization_membership?.member_type;
  const isAuthorized = currentUserMemberType && EDIT_AUTHORIZED_TYPES.includes(currentUserMemberType);
  
  // Populate form when member data loads
  useEffect(() => {
    if (member) {
      setFormData({
        first_name: member.first_name || '',
        last_name: member.last_name || '',
        email: member.email || '',
        phone: member.phone || '',
        id_number: member.id_number || '',
        date_of_birth: member.date_of_birth || '',
        physical_address: member.physical_address || '',
        city: member.city || '',
        province: member.province || '',
        postal_code: member.postal_code || '',
        emergency_contact_name: (member as any).emergency_contact_name || '',
        emergency_contact_phone: (member as any).emergency_contact_phone || '',
      });
    }
  }, [member]);
  
  const updateField = (field: keyof EditFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };
  
  const handleSave = async () => {
    if (!memberId) return;
    
    // Validation
    if (!formData.first_name.trim()) {
      showAlert({ title: 'Validation Error', message: 'First name is required' });
      return;
    }
    if (!formData.last_name.trim()) {
      showAlert({ title: 'Validation Error', message: 'Last name is required' });
      return;
    }
    
    setSaving(true);
    try {
      const success = await updateMember({
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        email: formData.email.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        physical_address: formData.physical_address.trim() || undefined,
        city: formData.city.trim() || undefined,
        province: formData.province || undefined,
      });
      
      if (success) {
        showAlert({ title: 'Success', message: 'Member details updated successfully', buttons: [
          { text: 'OK', onPress: () => router.back() }
        ]});
      } else {
        showAlert({ title: 'Error', message: 'Failed to update member details' });
      }
    } catch (err: any) {
      showAlert({ title: 'Error', message: err.message || 'Failed to update member' });
    } finally {
      setSaving(false);
    }
  };
  
  const handleCancel = () => {
    if (hasChanges) {
      showAlert({
        title: 'Discard Changes?',
        message: 'You have unsaved changes. Are you sure you want to go back?',
        buttons: [
          { text: 'Keep Editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => router.back() },
        ],
      });
    } else {
      router.back();
    }
  };
  
  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.centered}>
          <EduDashSpinner size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading member details...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  // Authorization check
  if (!isAuthorized) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.centered}>
          <Ionicons name="lock-closed-outline" size={64} color={theme.error || '#EF4444'} />
          <Text style={[styles.errorText, { color: theme.text }]}>Not Authorized</Text>
          <Text style={[styles.errorSubtext, { color: theme.textSecondary }]}>
            Only executives and secretaries can edit member details.
          </Text>
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: theme.primary }]}
            onPress={() => router.back()}
          >
            <Text style={styles.buttonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  
  // Error state
  if (error || !member) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={64} color={theme.error || '#EF4444'} />
          <Text style={[styles.errorText, { color: theme.text }]}>{error || 'Member not found'}</Text>
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: theme.primary }]}
            onPress={() => router.back()}
          >
            <Text style={styles.buttonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  
  const selectedProvince = PROVINCES.find(p => p.value === formData.province);

  return (
    <>
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Custom Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
          <Ionicons name="close" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Edit Member</Text>
        <TouchableOpacity 
          onPress={handleSave} 
          style={[styles.saveButton, { backgroundColor: theme.primary }]}
          disabled={saving || !hasChanges}
        >
          {saving ? (
            <EduDashSpinner size="small" color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>
      
      <DashboardWallpaperBackground>
        <KeyboardAvoidingView 
          style={{ flex: 1 }} 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView 
            style={styles.content}
            contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Member Info Header */}
            <View style={[styles.memberInfo, { backgroundColor: theme.card }]}>
              <View style={[styles.avatar, { backgroundColor: theme.primary + '20' }]}>
                <Text style={[styles.avatarText, { color: theme.primary }]}>
                  {member.first_name?.[0]}{member.last_name?.[0]}
                </Text>
              </View>
              <View style={styles.memberDetails}>
                <Text style={[styles.memberName, { color: theme.text }]}>
                  {member.first_name} {member.last_name}
                </Text>
                <Text style={[styles.memberNumber, { color: theme.textSecondary }]}>
                  #{member.member_number}
                </Text>
              </View>
            </View>
            
            {/* Personal Information */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Personal Information</Text>
              
              <View style={styles.row}>
                <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>First Name *</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                    value={formData.first_name}
                    onChangeText={(v) => updateField('first_name', v)}
                    placeholder="First name"
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>
                <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Last Name *</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                    value={formData.last_name}
                    onChangeText={(v) => updateField('last_name', v)}
                    placeholder="Last name"
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>
              </View>
              
              <View style={styles.inputContainer}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>ID Number</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                  value={formData.id_number}
                  onChangeText={(v) => updateField('id_number', v)}
                  placeholder="South African ID number"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="numeric"
                  maxLength={13}
                />
              </View>
              
              <View style={styles.inputContainer}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Date of Birth</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                  value={formData.date_of_birth}
                  onChangeText={(v) => updateField('date_of_birth', v)}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>
            </View>
            
            {/* Contact Information */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Contact Information</Text>
              
              <View style={styles.inputContainer}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Email</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                  value={formData.email}
                  onChangeText={(v) => updateField('email', v)}
                  placeholder="email@example.com"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              
              <View style={styles.inputContainer}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Phone Number</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                  value={formData.phone}
                  onChangeText={(v) => updateField('phone', v)}
                  placeholder="+27 XX XXX XXXX"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="phone-pad"
                />
              </View>
            </View>
            
            {/* Address */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Address</Text>
              
              <View style={styles.inputContainer}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Street Address</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                  value={formData.physical_address}
                  onChangeText={(v) => updateField('physical_address', v)}
                  placeholder="Street address"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>
              
              <View style={styles.row}>
                <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>City</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                    value={formData.city}
                    onChangeText={(v) => updateField('city', v)}
                    placeholder="City"
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>
                <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Postal Code</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                    value={formData.postal_code}
                    onChangeText={(v) => updateField('postal_code', v)}
                    placeholder="0000"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="numeric"
                    maxLength={5}
                  />
                </View>
              </View>
              
              <View style={styles.inputContainer}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Province</Text>
                <TouchableOpacity
                  style={[styles.picker, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  onPress={() => setShowProvincePicker(true)}
                >
                  <Text style={[styles.pickerText, { color: formData.province ? theme.text : theme.textSecondary }]}>
                    {selectedProvince?.label || 'Select Province'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
            
            {/* Emergency Contact */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Emergency Contact</Text>
              
              <View style={styles.inputContainer}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Contact Name</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                  value={formData.emergency_contact_name}
                  onChangeText={(v) => updateField('emergency_contact_name', v)}
                  placeholder="Emergency contact name"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>
              
              <View style={styles.inputContainer}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Contact Phone</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                  value={formData.emergency_contact_phone}
                  onChangeText={(v) => updateField('emergency_contact_phone', v)}
                  placeholder="+27 XX XXX XXXX"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="phone-pad"
                />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </DashboardWallpaperBackground>
      
      {/* Province Picker Modal */}
      <Modal
        visible={showProvincePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowProvincePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Select Province</Text>
              <TouchableOpacity onPress={() => setShowProvincePicker(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList}>
              {PROVINCES.map((province) => (
                <TouchableOpacity
                  key={province.value}
                  style={[
                    styles.modalOption,
                    formData.province === province.value && { backgroundColor: theme.primary + '20' }
                  ]}
                  onPress={() => {
                    updateField('province', province.value);
                    setShowProvincePicker(false);
                  }}
                >
                  <Text style={[styles.modalOptionText, { color: theme.text }]}>{province.label}</Text>
                  {formData.province === province.value && (
                    <Ionicons name="checkmark" size={20} color={theme.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
    <AlertModal {...alertProps} />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  errorText: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
  },
  memberDetails: {
    marginLeft: 16,
    flex: 1,
  },
  memberName: {
    fontSize: 18,
    fontWeight: '600',
  },
  memberNumber: {
    fontSize: 14,
    marginTop: 2,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    marginBottom: 6,
    fontWeight: '500',
  },
  input: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  picker: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerText: {
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalList: {
    padding: 8,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 8,
  },
  modalOptionText: {
    fontSize: 16,
  },
});
