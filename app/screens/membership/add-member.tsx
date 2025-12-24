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
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { MemberType, MembershipTier, MEMBER_TYPE_LABELS, MEMBERSHIP_TIER_LABELS } from '@/components/membership/types';
import { DashboardWallpaperBackground } from '@/components/membership/dashboard';

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
  { value: 'standard', label: 'Standard', price: 600 },
  { value: 'premium', label: 'Premium', price: 1200 },
  { value: 'vip', label: 'VIP', price: 2500 },
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

const initialData: AddMemberData = {
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
  member_type: 'learner',
  membership_tier: 'standard',
  membership_status: 'active',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  notes: '',
  send_welcome_email: true,
  generate_id_card: true,
  waive_payment: false,
};

export default function AddMemberScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  
  const [formData, setFormData] = useState<AddMemberData>(initialData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRegionPicker, setShowRegionPicker] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showTierPicker, setShowTierPicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);

  const updateField = <K extends keyof AddMemberData>(field: K, value: AddMemberData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const selectedRegion = REGIONS.find(r => r.id === formData.region_id);
  const selectedType = MEMBER_TYPES.find(t => t.value === formData.member_type);
  const selectedTier = MEMBERSHIP_TIERS.find(t => t.value === formData.membership_tier);
  const selectedStatus = STATUS_OPTIONS.find(s => s.value === formData.membership_status);

  const validateForm = (): boolean => {
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
    if (!formData.phone) {
      Alert.alert('Required', 'Please enter phone number');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Generate member number
      const year = new Date().getFullYear().toString().slice(-2);
      const sequence = String(Math.floor(Math.random() * 9999) + 1).padStart(5, '0');
      const memberNumber = `SOA-${selectedRegion?.code}-${year}-${sequence}`;
      
      Alert.alert(
        'Member Added Successfully',
        `${formData.first_name} ${formData.last_name} has been registered.\n\nMember Number: ${memberNumber}`,
        [
          { text: 'Add Another', onPress: () => setFormData(initialData) },
          { text: 'View Member', onPress: () => router.back() },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to add member. Please try again.');
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
            <TouchableOpacity onPress={() => setFormData(initialData)}>
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
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Member Type *</Text>
              <TouchableOpacity
                style={[styles.selectButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => setShowTypePicker(true)}
              >
                <View style={styles.selectContent}>
                  <Ionicons name="ribbon-outline" size={20} color={theme.textSecondary} />
                  <Text style={[styles.selectText, { color: theme.text }]}>
                    {selectedType?.label}
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
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
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
        'Select Member Type',
        MEMBER_TYPES.map(t => ({ value: t.value, label: t.label })),
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
});
