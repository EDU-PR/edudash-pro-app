/**
 * Admin Add Member Screen
 * Form for administrators to manually add members to the organization
 */
import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { MemberType, MembershipTier, MEMBER_TYPE_LABELS, MEMBERSHIP_TIER_LABELS } from '@/components/membership/types';
import { DashboardWallpaperBackground } from '@/components/membership/dashboard';
import { assertSupabase } from '@/lib/supabase';
import { 
  generateTemporaryPassword, 
  generateMemberNumber, 
  isValidEmail, 
  isValidSAPhoneNumber 
} from '@/lib/memberRegistrationUtils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Regions
const REGIONS = [
  { id: 'r1', name: 'Gauteng', code: 'GP' },
  { id: 'r2', name: 'Western Cape', code: 'WC' },
  { id: 'r3', name: 'KwaZulu-Natal', code: 'KZN' },
  { id: 'r4', name: 'Eastern Cape', code: 'EC' },
  { id: 'r5', name: 'Limpopo', code: 'LP' },
  { id: 'r6', name: 'Mpumalanga', code: 'MP' },
  { id: 'r7', name: 'North West', code: 'NW' },
  { id: 'r8', name: 'Free State', code: 'FS' },
  { id: 'r9', name: 'Northern Cape', code: 'NC' },
];

// Member types
const MEMBER_TYPES: { value: MemberType; label: string }[] = [
  { value: 'learner', label: 'Learner' },
  { value: 'facilitator', label: 'Facilitator' },
  { value: 'mentor', label: 'Mentor' },
  { value: 'regional_manager', label: 'Regional Manager' },
];

// Membership tiers
const MEMBERSHIP_TIERS: { value: MembershipTier; label: string; price: number }[] = [
  { value: 'standard', label: 'Standard', price: 20 },
  { value: 'premium', label: 'Premium', price: 350 },
  { value: 'vip', label: 'VIP', price: 600 },
];

// Status options
const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', color: '#10B981' },
  { value: 'pending', label: 'Pending', color: '#F59E0B' },
  { value: 'suspended', label: 'Suspended', color: '#EF4444' },
];

interface AddMemberData {
  region_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  id_number: string;
  date_of_birth: string;
  address_line1: string;
  address_line2: string;
  city: string;
  province: string;
  postal_code: string;
  member_type: MemberType;
  membership_tier: MembershipTier;
  membership_status: 'active' | 'pending' | 'suspended';
  emergency_contact_name: string;
  emergency_contact_phone: string;
  notes: string;
  send_welcome_email: boolean;
  generate_id_card: boolean;
  waive_payment: boolean;
}

// Initial data will be set dynamically based on user's wing
const getInitialData = (defaultMemberType: MemberType = 'learner'): AddMemberData => ({
  region_id: '',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  id_number: '',
  date_of_birth: '',
  address_line1: '',
  address_line2: '',
  city: '',
  province: '',
  postal_code: '',
  member_type: defaultMemberType,
  membership_tier: 'standard',
  membership_status: 'active',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  notes: '',
  send_welcome_email: true,
  generate_id_card: true,
  waive_payment: false,
});

export default function AddMemberScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { user, profile } = useAuth();
  const insets = useSafeAreaInsets();
  
  // Get organization ID from current user's profile/context
  const organizationId = profile?.organization_id;
  
  // Determine which wing the current user belongs to (youth, women, veterans, or main)
  const currentUserMemberType = (profile as any)?.organization_membership?.member_type;
  const isYouthWing = currentUserMemberType?.startsWith('youth_');
  const isWomensWing = currentUserMemberType?.startsWith('women_');
  const isVeteransWing = currentUserMemberType?.startsWith('veterans_');
  
  // Filter member types based on current user's wing
  const availableMemberTypes = isYouthWing
    ? [
        { value: 'youth_member' as MemberType, label: 'Youth Member' },
        { value: 'youth_facilitator' as MemberType, label: 'Youth Facilitator' },
        { value: 'youth_mentor' as MemberType, label: 'Youth Mentor' },
        { value: 'youth_coordinator' as MemberType, label: 'Youth Coordinator' },
      ]
    : isWomensWing
    ? [
        { value: 'women_member' as MemberType, label: "Women's Member" },
        { value: 'women_facilitator' as MemberType, label: "Women's Facilitator" },
        { value: 'women_mentor' as MemberType, label: "Women's Mentor" },
      ]
    : isVeteransWing
    ? [
        { value: 'veterans_member' as MemberType, label: "Veterans Member" },
        { value: 'veterans_coordinator' as MemberType, label: "Veterans Coordinator" },
      ]
    : MEMBER_TYPES; // Default to generic types for main wing
  
  // Set initial member type based on available types
  const defaultMemberType = availableMemberTypes[0]?.value || 'learner';
  const [formData, setFormData] = useState<AddMemberData>(getInitialData(defaultMemberType));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [retryStatus, setRetryStatus] = useState<{ retry: number; maxRetries: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showRegionPicker, setShowRegionPicker] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showTierPicker, setShowTierPicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);

  const updateField = <K extends keyof AddMemberData>(field: K, value: AddMemberData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error message when user makes changes
    if (errorMessage) {
      setErrorMessage(null);
    }
  };

  const selectedRegion = REGIONS.find(r => r.id === formData.region_id);
  const selectedType = availableMemberTypes.find(t => t.value === formData.member_type);
  const selectedTier = MEMBERSHIP_TIERS.find(t => t.value === formData.membership_tier);
  const selectedStatus = STATUS_OPTIONS.find(s => s.value === formData.membership_status);

  const validateForm = (): boolean => {
    if (!organizationId) {
      Alert.alert('Error', 'Organization context missing. Please try logging in again.');
      return false;
    }
    if (!formData.region_id) {
      Alert.alert('Required', 'Please select a region');
      return false;
    }
    if (!formData.first_name || !formData.last_name) {
      Alert.alert('Required', 'Please enter member name');
      return false;
    }
    if (!formData.email) {
      Alert.alert('Required', 'Please enter email address');
      return false;
    }
    if (!isValidEmail(formData.email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return false;
    }
    if (!formData.phone) {
      Alert.alert('Required', 'Please enter phone number');
      return false;
    }
    if (!isValidSAPhoneNumber(formData.phone)) {
      Alert.alert('Invalid Phone', 'Please enter a valid South African phone number');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    if (!organizationId || !user?.id) {
      Alert.alert('Error', 'Missing user or organization context');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const supabase = assertSupabase();
      
      // 1. Generate temporary password and member number
      const tempPassword = generateTemporaryPassword();
      const memberNumber = generateMemberNumber(selectedRegion?.code || 'ZA');
      
      console.log('[AddMember] Creating member:', { email: formData.email, memberNumber });
      
      // 2. Create Supabase Auth account
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email.trim().toLowerCase(),
        password: tempPassword,
        options: {
          data: {
            first_name: formData.first_name.trim(),
            last_name: formData.last_name.trim(),
            phone: formData.phone.trim(),
          },
          emailRedirectTo: 'https://www.soilofafrica.org/auth/callback?flow=email-confirm',
        },
      });
      
      if (signUpError) {
        console.error('[AddMember] Auth signup error:', signUpError);
        throw new Error(signUpError.message);
      }
      
      if (!signUpData.user) {
        throw new Error('Failed to create user account - no user returned');
      }
      
      console.log('[AddMember] Auth account created:', signUpData.user.id);
      
      // 2.5. Wait briefly for user to be committed to auth.users (timing issue fix)
      // Supabase Auth signUp can have a small delay before user is visible in auth.users
      setRetryStatus({ retry: 0, maxRetries: 5 });
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds (increased from 1s)
      
      // 3. Look up actual region_id from organization_regions if we have a region code
      // The REGIONS array uses codes like 'GP', 'WC', etc., which match province_code in the database
      let actualRegionId: string | null = null;
      if (selectedRegion?.code && organizationId) {
        try {
          const { data: regionData, error: regionError } = await supabase
            .from('organization_regions')
            .select('id')
            .eq('organization_id', organizationId)
            .eq('province_code', selectedRegion.code)
            .maybeSingle();
          
          if (regionError) {
            console.error('[AddMember] Error looking up region:', regionError);
          } else if (regionData?.id) {
            actualRegionId = regionData.id;
            console.log('[AddMember] Found region UUID:', actualRegionId, 'for code:', selectedRegion.code);
          } else {
            console.warn('[AddMember] No region found for code:', selectedRegion.code);
          }
        } catch (error) {
          console.error('[AddMember] Exception looking up region:', error);
        }
      }
      
      // If formData.region_id looks like a UUID, use it directly, otherwise use the looked-up value
      const regionIdToUse = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(formData.region_id)
        ? formData.region_id
        : actualRegionId;
      
      // 4. Create organization member record via RPC with retry for timing issues
      let rpcResult: any = null;
      let rpcError: any = null;
      let retries = 0;
      const maxRetries = 5; // Increased from 3 to 5
      const retryDelays = [2000, 3000, 5000, 8000, 10000]; // Exponential backoff: 2s, 3s, 5s, 8s, 10s
      
      // 4. Create organization member record via RPC with retry for timing issues
      setRetryStatus({ retry: 0, maxRetries });
      setErrorMessage('Creating organization member...');
      
      while (retries < maxRetries) {
        setRetryStatus({ retry: retries, maxRetries });
        setErrorMessage(retries > 0 ? `Retrying registration... (Attempt ${retries + 1}/${maxRetries})` : 'Creating organization member...');
        
        const { data, error } = await supabase.rpc(
          'register_organization_member',
          {
            p_organization_id: organizationId,
            p_user_id: signUpData.user.id,
            p_region_id: regionIdToUse || null, // Pass null if no valid region found
            p_member_number: memberNumber,
            p_member_type: formData.member_type || (isYouthWing ? 'youth_member' : 'learner'),
            p_membership_tier: formData.membership_tier || 'standard',
            p_membership_status: formData.membership_status || 'active',
            p_first_name: formData.first_name.trim(),
            p_last_name: formData.last_name.trim(),
            p_email: formData.email.trim().toLowerCase(),
            p_phone: formData.phone.trim() || null,
            p_id_number: formData.id_number.trim() || null,
            p_role: 'member',
            p_invite_code_used: null,
            p_joined_via: 'admin_add',
          }
        );
        
        rpcResult = data;
        rpcError = error;
        
        // If RPC error or user not found, retry after a delay
        if (rpcError || (rpcResult && !rpcResult.success && rpcResult.code === 'USER_NOT_FOUND')) {
          retries++;
          if (retries < maxRetries) {
            console.log(`[AddMember] Retry attempt ${retries}/${maxRetries} after delay...`);
            const delay = retryDelays[retries - 1] || 10000; // Use exponential backoff delays
            setErrorMessage(`Account creation in progress... Retrying in ${delay / 1000}s (Attempt ${retries + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        } else {
          // Success or non-retryable error
          setRetryStatus(null);
          setErrorMessage(null);
          break;
        }
      }
      
      if (rpcError) {
        console.error('[AddMember] RPC error after retries:', rpcError);
        console.error('[AddMember] RPC error details:', JSON.stringify(rpcError, null, 2));
        console.error('[AddMember] Parameters sent:', {
          p_organization_id: organizationId,
          p_user_id: signUpData.user.id,
          p_region_id: regionIdToUse,
          p_member_type: formData.member_type,
          p_membership_tier: formData.membership_tier,
          p_membership_status: formData.membership_status,
        });
        throw new Error(`Registration failed: ${rpcError.message || rpcError.code || 'Unknown error'}`);
      }
      
      if (!rpcResult?.success) {
        console.error('[AddMember] RPC returned error after retries:', rpcResult);
        console.error('[AddMember] RPC error code:', rpcResult?.code);
        
        // Handle USER_NOT_FOUND with inline error message instead of blocking alert
        if (rpcResult?.code === 'USER_NOT_FOUND') {
          setErrorMessage('Account is still being created. Please wait a moment and try again, or contact support if the issue persists.');
          setRetryStatus(null);
          setIsSubmitting(false);
          // Don't return - let user retry manually
          // Show retry button in UI instead of blocking alert
          return;
        }
        
        // Other errors - show inline message
        const errorMsg = rpcResult?.error || rpcResult?.message || 'Failed to register member';
        setErrorMessage(errorMsg);
        setRetryStatus(null);
        setIsSubmitting(false);
        throw new Error(errorMsg);
      }
      
      // Clear any previous errors on success
      setErrorMessage(null);
      setRetryStatus(null);
      
      // Wing is now automatically set by RPC function based on member_type
      console.log('[AddMember] Member registered with wing:', rpcResult?.wing || 'main');
      
      console.log('[AddMember] Member registered successfully:', rpcResult);
      
      // 5. Show success with temporary password
      Alert.alert(
        'Member Added Successfully',
        `${formData.first_name} ${formData.last_name} has been registered.\n\n` +
        `Member Number: ${memberNumber}\n` +
        `Temporary Password: ${tempPassword}\n\n` +
        `A confirmation email has been sent to ${formData.email}.\n\n` +
        `⚠️ IMPORTANT: Please securely share the temporary password with the new member. ` +
        `They should change it after their first login.`,
        [
          { 
            text: 'Copy Password', 
            onPress: async () => {
              // Copy to clipboard if available
              try {
                await Clipboard.setStringAsync(tempPassword);
                Alert.alert('Copied', 'Temporary password copied to clipboard');
              } catch (error) {
                console.error('[AddMember] Failed to copy password:', error);
              }
            }
          },
          { text: 'Add Another', onPress: () => setFormData(getInitialData(defaultMemberType)) },
          { text: 'Done', onPress: () => router.back() },
        ]
      );
    } catch (error: any) {
      console.error('[AddMember] Registration error:', error);
      
      let errorMsg = 'Failed to add member. Please try again.';
      
      if (error.message?.includes('already registered')) {
        errorMsg = 'This email is already registered. Please use a different email.';
      } else if (error.message?.includes('rate limit')) {
        errorMsg = 'Too many registration attempts. Please wait a moment and try again.';
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      setErrorMessage(errorMsg);
      setRetryStatus(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount: number): string => {
    return `R ${amount.toLocaleString('en-ZA')}`;
  };

  const renderPicker = (
    visible: boolean,
    onClose: () => void,
    title: string,
    options: { value: string; label: string; color?: string }[],
    selectedValue: string,
    onSelect: (value: string) => void
  ) => {
    if (!visible) return null;
    
    return (
      <View style={[styles.pickerOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.pickerContainer, { backgroundColor: theme.card }]}>
          <View style={styles.pickerHeader}>
            <Text style={[styles.pickerTitle, { color: theme.text }]}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.pickerScroll}>
            {options.map(option => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.pickerOption,
                  selectedValue === option.value && { backgroundColor: theme.primary + '15' }
                ]}
                onPress={() => {
                  onSelect(option.value);
                  onClose();
                }}
              >
                <Text style={[
                  styles.pickerOptionText,
                  { color: option.color || theme.text },
                  selectedValue === option.value && { fontWeight: '700' }
                ]}>
                  {option.label}
                </Text>
                {selectedValue === option.value && (
                  <Ionicons name="checkmark" size={20} color={theme.primary} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Stack.Screen
        options={{
          title: 'Add New Member',
          headerRight: () => (
          <TouchableOpacity onPress={() => setFormData(getInitialData(defaultMemberType))}>
            <Text style={[styles.resetText, { color: theme.primary }]}>Reset</Text>
          </TouchableOpacity>
          ),
        }}
      />

      <DashboardWallpaperBackground>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Error Message Display */}
          {errorMessage && (
            <View style={[styles.errorContainer, { backgroundColor: '#FEE2E2', borderColor: '#EF4444' }]}>
              <View style={styles.errorContent}>
                <Ionicons name="alert-circle" size={20} color="#EF4444" />
                <View style={styles.errorTextContainer}>
                  <Text style={[styles.errorTitle, { color: '#991B1B' }]}>Registration Error</Text>
                  <Text style={[styles.errorMessage, { color: '#DC2626' }]}>{errorMessage}</Text>
                </View>
                <TouchableOpacity onPress={() => setErrorMessage(null)}>
                  <Ionicons name="close" size={20} color="#991B1B" />
                </TouchableOpacity>
              </View>
            </View>
          )}
          
          {/* Retry Status Display */}
          {retryStatus && !errorMessage && (
            <View style={[styles.retryContainer, { backgroundColor: '#DBEAFE', borderColor: '#3B82F6' }]}>
              <ActivityIndicator size="small" color="#3B82F6" />
              <Text style={[styles.retryText, { color: '#1E40AF' }]}>
                {retryStatus.retry > 0 
                  ? `Retrying... (Attempt ${retryStatus.retry + 1}/${retryStatus.maxRetries})`
                  : `Creating account... (Attempt ${retryStatus.retry + 1}/${retryStatus.maxRetries})`
                }
              </Text>
            </View>
          )}
          
          {/* Region Selection */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Region *</Text>
            <TouchableOpacity
              style={[styles.selectButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => setShowRegionPicker(true)}
            >
              <View style={styles.selectContent}>
                <Ionicons name="location-outline" size={20} color={theme.textSecondary} />
                <Text style={[styles.selectText, { color: selectedRegion ? theme.text : theme.textSecondary }]}>
                  {selectedRegion ? selectedRegion.name : 'Select Region'}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Personal Information */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Personal Information</Text>
            
            <View style={styles.inputRow}>
              <View style={styles.inputHalf}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>First Name *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                  placeholder="First Name"
                  placeholderTextColor={theme.textSecondary}
                  value={formData.first_name}
                  onChangeText={(v) => updateField('first_name', v)}
                />
              </View>
              <View style={styles.inputHalf}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Last Name *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                  placeholder="Last Name"
                  placeholderTextColor={theme.textSecondary}
                  value={formData.last_name}
                  onChangeText={(v) => updateField('last_name', v)}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Email Address *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                placeholder="email@example.com"
                placeholderTextColor={theme.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
                value={formData.email}
                onChangeText={(v) => updateField('email', v)}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Phone Number *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                placeholder="+27 82 123 4567"
                placeholderTextColor={theme.textSecondary}
                keyboardType="phone-pad"
                value={formData.phone}
                onChangeText={(v) => updateField('phone', v)}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>SA ID Number</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                placeholder="9001015012089"
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
                maxLength={13}
                value={formData.id_number}
                onChangeText={(v) => updateField('id_number', v)}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Date of Birth</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.textSecondary}
                value={formData.date_of_birth}
                onChangeText={(v) => updateField('date_of_birth', v)}
              />
            </View>
          </View>

          {/* Address */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Address</Text>
            
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Street Address</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                placeholder="123 Main Road"
                placeholderTextColor={theme.textSecondary}
                value={formData.address_line1}
                onChangeText={(v) => updateField('address_line1', v)}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Address Line 2</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                placeholder="Apartment, suite, etc."
                placeholderTextColor={theme.textSecondary}
                value={formData.address_line2}
                onChangeText={(v) => updateField('address_line2', v)}
              />
            </View>

            <View style={styles.inputRow}>
              <View style={styles.inputHalf}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>City</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                  placeholder="City"
                  placeholderTextColor={theme.textSecondary}
                  value={formData.city}
                  onChangeText={(v) => updateField('city', v)}
                />
              </View>
              <View style={styles.inputHalf}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Postal Code</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                  placeholder="0000"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="number-pad"
                  value={formData.postal_code}
                  onChangeText={(v) => updateField('postal_code', v)}
                />
              </View>
            </View>
          </View>

          {/* Membership Details */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Membership Details</Text>
            
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                Member Type * {isYouthWing ? '(Youth Wing)' : isWomensWing ? "(Women's Wing)" : isVeteransWing ? "(Veterans Wing)" : ''}
              </Text>
              <TouchableOpacity
                style={[styles.selectButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => setShowTypePicker(true)}
              >
                <View style={styles.selectContent}>
                  <Ionicons name="ribbon-outline" size={20} color={theme.textSecondary} />
                  <Text style={[styles.selectText, { color: theme.text }]}>
                    {selectedType?.label || availableMemberTypes[0]?.label || 'Select Type'}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Membership Tier *</Text>
              <TouchableOpacity
                style={[styles.selectButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => setShowTierPicker(true)}
              >
                <View style={styles.selectContent}>
                  <Ionicons name="star-outline" size={20} color={theme.textSecondary} />
                  <Text style={[styles.selectText, { color: theme.text }]}>
                    {selectedTier?.label} - {formatCurrency(selectedTier?.price || 0)}/year
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Status *</Text>
              <TouchableOpacity
                style={[styles.selectButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => setShowStatusPicker(true)}
              >
                <View style={styles.selectContent}>
                  <View style={[styles.statusDot, { backgroundColor: selectedStatus?.color }]} />
                  <Text style={[styles.selectText, { color: theme.text }]}>
                    {selectedStatus?.label}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Emergency Contact */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Emergency Contact</Text>
            
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Contact Name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                placeholder="Emergency Contact Name"
                placeholderTextColor={theme.textSecondary}
                value={formData.emergency_contact_name}
                onChangeText={(v) => updateField('emergency_contact_name', v)}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Contact Phone</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                placeholder="+27 82 123 4567"
                placeholderTextColor={theme.textSecondary}
                keyboardType="phone-pad"
                value={formData.emergency_contact_phone}
                onChangeText={(v) => updateField('emergency_contact_phone', v)}
              />
            </View>
          </View>

          {/* Notes */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Notes</Text>
            <TextInput
              style={[styles.textArea, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
              placeholder="Additional notes about this member..."
              placeholderTextColor={theme.textSecondary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              value={formData.notes}
              onChangeText={(v) => updateField('notes', v)}
            />
          </View>

          {/* Options */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Options</Text>
            
            <View style={[styles.optionRow, { backgroundColor: theme.card }]}>
              <View style={styles.optionInfo}>
                <Ionicons name="mail-outline" size={22} color={theme.primary} />
                <View style={styles.optionText}>
                  <Text style={[styles.optionTitle, { color: theme.text }]}>Send Welcome Email</Text>
                  <Text style={[styles.optionDesc, { color: theme.textSecondary }]}>
                    Notify member of their registration
                  </Text>
                </View>
              </View>
              <Switch
                value={formData.send_welcome_email}
                onValueChange={(v) => updateField('send_welcome_email', v)}
                trackColor={{ false: theme.border, true: theme.primary + '50' }}
                thumbColor={formData.send_welcome_email ? theme.primary : '#f4f3f4'}
              />
            </View>
            
            <View style={[styles.optionRow, { backgroundColor: theme.card }]}>
              <View style={styles.optionInfo}>
                <Ionicons name="card-outline" size={22} color={theme.primary} />
                <View style={styles.optionText}>
                  <Text style={[styles.optionTitle, { color: theme.text }]}>Generate ID Card</Text>
                  <Text style={[styles.optionDesc, { color: theme.textSecondary }]}>
                    Create digital ID card immediately
                  </Text>
                </View>
              </View>
              <Switch
                value={formData.generate_id_card}
                onValueChange={(v) => updateField('generate_id_card', v)}
                trackColor={{ false: theme.border, true: theme.primary + '50' }}
                thumbColor={formData.generate_id_card ? theme.primary : '#f4f3f4'}
              />
            </View>
            
            <View style={[styles.optionRow, { backgroundColor: theme.card }]}>
              <View style={styles.optionInfo}>
                <Ionicons name="cash-outline" size={22} color={theme.primary} />
                <View style={styles.optionText}>
                  <Text style={[styles.optionTitle, { color: theme.text }]}>Waive Payment</Text>
                  <Text style={[styles.optionDesc, { color: theme.textSecondary }]}>
                    Skip membership fee requirement
                  </Text>
                </View>
              </View>
              <Switch
                value={formData.waive_payment}
                onValueChange={(v) => updateField('waive_payment', v)}
                trackColor={{ false: theme.border, true: theme.primary + '50' }}
                thumbColor={formData.waive_payment ? theme.primary : '#f4f3f4'}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Submit Button */}
      <View style={[styles.bottomNav, { backgroundColor: theme.card, paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity 
          style={[styles.submitButton, { backgroundColor: theme.primary }]}
          onPress={handleSubmit}
          disabled={isSubmitting || !!retryStatus}
        >
          {isSubmitting || retryStatus ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.submitText}>
                {retryStatus ? `Creating... (${retryStatus.retry + 1}/${retryStatus.maxRetries})` : 'Creating Member...'}
              </Text>
            </View>
          ) : (
            <>
              <Ionicons name="person-add" size={20} color="#fff" />
              <Text style={styles.submitText}>Add Member</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Pickers */}
      {renderPicker(
        showRegionPicker,
        () => setShowRegionPicker(false),
        'Select Region',
        REGIONS.map(r => ({ value: r.id, label: r.name })),
        formData.region_id,
        (v) => updateField('region_id', v)
      )}
      
      {renderPicker(
        showTypePicker,
        () => setShowTypePicker(false),
        `Select Member Type${isYouthWing ? ' (Youth Wing)' : isWomensWing ? " (Women's Wing)" : isVeteransWing ? " (Veterans Wing)" : ''}`,
        availableMemberTypes.map(t => ({ value: t.value, label: t.label })),
        formData.member_type,
        (v) => updateField('member_type', v as MemberType)
      )}
      
      {renderPicker(
        showTierPicker,
        () => setShowTierPicker(false),
        'Select Membership Tier',
        MEMBERSHIP_TIERS.map(t => ({ value: t.value, label: `${t.label} - ${formatCurrency(t.price)}/year` })),
        formData.membership_tier,
        (v) => updateField('membership_tier', v as MembershipTier)
      )}
      
      {renderPicker(
        showStatusPicker,
        () => setShowStatusPicker(false),
        'Select Status',
        STATUS_OPTIONS.map(s => ({ value: s.value, label: s.label, color: s.color })),
        formData.membership_status,
        (v) => updateField('membership_status', v as 'active' | 'pending' | 'suspended')
      )}
      </DashboardWallpaperBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  resetText: {
    fontSize: 15,
    fontWeight: '600',
    marginRight: 16,
  },
  
  // Section
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  
  // Input
  inputGroup: {
    marginBottom: 14,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  inputHalf: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 13,
    marginBottom: 6,
  },
  input: {
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    borderWidth: 1,
  },
  textArea: {
    height: 100,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    fontSize: 15,
    borderWidth: 1,
  },
  
  // Select
  selectButton: {
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  selectText: {
    fontSize: 15,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  
  // Options
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  optionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  optionDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  
  // Picker
  pickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
  },
  pickerContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  pickerScroll: {
    padding: 8,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 10,
    marginBottom: 4,
  },
  pickerOptionText: {
    fontSize: 15,
  },
  
  // Bottom Nav
  bottomNav: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  errorContainer: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  errorContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  errorTextContainer: {
    flex: 1,
    gap: 4,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  errorMessage: {
    fontSize: 13,
    lineHeight: 18,
  },
  retryContainer: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  retryText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
});
