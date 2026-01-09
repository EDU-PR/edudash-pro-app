import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator, ScrollView, Platform, Image } from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';

// EduDash Pro Community School ID
const COMMUNITY_SCHOOL_ID = '00000000-0000-0000-0000-000000000001';
const EARLY_BIRD_LIMIT = 20; // First 20 registrations get 50% off
const REGISTRATION_FEE_ORIGINAL = 400.00;
const REGISTRATION_FEE_DISCOUNTED = 200.00;

type Grade = 'R' | '1' | '2' | '3' | '4' | '5' | '6' | '7';

export default function ParentAftercareRegistrationScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();

  // Parent Details
  const [parentFirstName, setParentFirstName] = useState(profile?.first_name || '');
  const [parentLastName, setParentLastName] = useState(profile?.last_name || '');
  const [parentEmail, setParentEmail] = useState(profile?.email || '');
  const [parentPhone, setParentPhone] = useState(profile?.phone || '');
  const [parentIdNumber, setParentIdNumber] = useState('');

  // Child Details
  const [childFirstName, setChildFirstName] = useState('');
  const [childLastName, setChildLastName] = useState('');
  const [childGrade, setChildGrade] = useState<Grade>('R');
  const [childDateOfBirth, setChildDateOfBirth] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [childAllergies, setChildAllergies] = useState('');
  const [childMedicalConditions, setChildMedicalConditions] = useState('');

  // Emergency Contact
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [emergencyContactRelation, setEmergencyContactRelation] = useState('');

  // Additional
  const [howDidYouHear, setHowDidYouHear] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<'eft' | 'cash' | 'card' | ''>('');
  const [proofOfPayment, setProofOfPayment] = useState<string | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);

  // State
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [spotsRemaining, setSpotsRemaining] = useState<number | null>(null);
  const [registrationsClosed, setRegistrationsClosed] = useState(false);

  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const formatPhoneNumber = (phone: string): string => {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('27')) {
      const rest = digits.slice(2);
      if (rest.length >= 9) {
        return `+27 ${rest.slice(0, 2)} ${rest.slice(2, 5)} ${rest.slice(5, 9)}`;
      }
      return `+27 ${rest}`;
    } else if (digits.startsWith('0') && digits.length === 10) {
      return `+27 ${digits.slice(1, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)}`;
    }
    return phone;
  };

  // Fetch current registration count
  useEffect(() => {
    const fetchSpots = async () => {
      try {
        const { count, error } = await assertSupabase()
          .from('aftercare_registrations')
          .select('*', { count: 'exact', head: true })
          .eq('preschool_id', COMMUNITY_SCHOOL_ID);
        
        if (!error && count !== null) {
          const remaining = Math.max(0, EARLY_BIRD_LIMIT - count);
          setSpotsRemaining(remaining);
          if (remaining === 0) {
            setRegistrationsClosed(true);
          }
        }
      } catch (err) {
        console.error('Error fetching spots:', err);
        setSpotsRemaining(EARLY_BIRD_LIMIT);
      }
    };
    fetchSpots();
  }, []);

  // Generate payment reference
  const generatePaymentReference = () => {
    const childPart = (childFirstName.substring(0, 3) + childLastName.substring(0, 3)).toUpperCase();
    const phonePart = parentPhone.slice(-4);
    return `AC-${childPart}-${phonePart}`;
  };

  // Handle POP upload
  const handlePopUpload = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please allow access to your photos to upload proof of payment.');
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      
      if (result.canceled || !result.assets?.[0]?.uri) return;
      
      setUploadingProof(true);
      const uri = result.assets[0].uri;
      const fileName = `aftercare_pop_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
      
      const response = await fetch(uri);
      const blob = await response.blob();
      
      const { data, error } = await assertSupabase()
        .storage
        .from('pop-uploads')
        .upload(`aftercare/${fileName}`, blob, {
          contentType: 'image/jpeg',
          upsert: false,
        });
      
      if (error) throw error;
      
      const { data: urlData } = assertSupabase()
        .storage
        .from('pop-uploads')
        .getPublicUrl(`aftercare/${fileName}`);
      
      setProofOfPayment(urlData.publicUrl);
      Alert.alert('Success', 'Proof of payment uploaded successfully!');
    } catch (error: any) {
      console.error('POP upload error:', error);
      Alert.alert('Upload Failed', error?.message || 'Failed to upload proof of payment. Please try again.');
    } finally {
      setUploadingProof(false);
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!parentFirstName.trim()) newErrors.parentFirstName = 'First name is required';
    if (!parentLastName.trim()) newErrors.parentLastName = 'Last name is required';
    if (!parentEmail.trim()) newErrors.parentEmail = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail)) newErrors.parentEmail = 'Invalid email format';
    if (!parentPhone.trim()) newErrors.parentPhone = 'Phone number is required';
    if (!childFirstName.trim()) newErrors.childFirstName = 'Child first name is required';
    if (!childLastName.trim()) newErrors.childLastName = 'Child last name is required';
    if (!childDateOfBirth) newErrors.childDateOfBirth = 'Date of birth is required';
    if (!emergencyContactName.trim()) newErrors.emergencyContactName = 'Emergency contact name is required';
    if (!emergencyContactPhone.trim()) newErrors.emergencyContactPhone = 'Emergency contact phone is required';
    if (!emergencyContactRelation.trim()) newErrors.emergencyContactRelation = 'Emergency contact relation is required';
    if (!acceptTerms) newErrors.acceptTerms = 'You must accept the terms and conditions';
    
    if (parentPhone && !/^\+?[0-9]{10,13}$/.test(parentPhone.replace(/\s/g, ''))) {
      newErrors.parentPhone = 'Invalid phone number format';
    }
    if (emergencyContactPhone && !/^\+?[0-9]{10,13}$/.test(emergencyContactPhone.replace(/\s/g, ''))) {
      newErrors.emergencyContactPhone = 'Invalid phone number format';
    }
    
    setErrors(newErrors);
    
    if (Object.keys(newErrors).length > 0) {
      Alert.alert('Validation Error', 'Please fix the errors before submitting');
      return false;
    }
    
    if (!profile?.id) {
      Alert.alert('Profile missing', 'We could not determine your user profile. Please try again after reloading.');
      return false;
    }
    return true;
  };

  const onSubmit = async () => {
    if (!validate()) return;
    
    if (!profile?.id) {
      Alert.alert('Profile Missing', 'We could not determine your user profile. Please try logging out and back in.');
      return;
    }
    
    if (registrationsClosed) {
      Alert.alert('Registrations Closed', 'Sorry, the early bird registrations are now full. Please contact the school for more information.');
      return;
    }
    
    setLoading(true);
    try {
      let proofOfPaymentUrl = null;
      
      // Upload POP if provided
      if (proofOfPayment) {
        proofOfPaymentUrl = proofOfPayment;
      }
      
      const paymentRef = generatePaymentReference();
      const registrationFee = spotsRemaining !== null && spotsRemaining > 0 
        ? REGISTRATION_FEE_DISCOUNTED 
        : REGISTRATION_FEE_ORIGINAL;
      
      const payload = {
        preschool_id: COMMUNITY_SCHOOL_ID,
        parent_first_name: parentFirstName.trim(),
        parent_last_name: parentLastName.trim(),
        parent_email: parentEmail.trim().toLowerCase(),
        parent_phone: formatPhoneNumber(parentPhone),
        parent_id_number: parentIdNumber.trim() || null,
        child_first_name: childFirstName.trim(),
        child_last_name: childLastName.trim(),
        child_grade: childGrade,
        child_date_of_birth: childDateOfBirth ? formatDate(childDateOfBirth) : null,
        child_allergies: childAllergies.trim() || null,
        child_medical_conditions: childMedicalConditions.trim() || null,
        emergency_contact_name: emergencyContactName.trim(),
        emergency_contact_phone: formatPhoneNumber(emergencyContactPhone),
        emergency_contact_relation: emergencyContactRelation.trim(),
        how_did_you_hear: howDidYouHear.trim() || null,
        registration_fee: registrationFee,
        registration_fee_original: REGISTRATION_FEE_ORIGINAL,
        promotion_code: spotsRemaining !== null && spotsRemaining > 0 ? 'EARLYBIRD50' : null,
        payment_reference: paymentRef,
        status: proofOfPaymentUrl ? 'paid' : 'pending_payment',
        proof_of_payment_url: proofOfPaymentUrl,
      };
      
      if (__DEV__) {
        console.log('[Aftercare Registration] Submitting payload:', payload);
      }

      const { data, error: insertError } = await assertSupabase()
        .from('aftercare_registrations')
        .insert(payload)
        .select()
        .single();

      if (insertError) {
        if (insertError.code === '42P01') {
          Alert.alert(
            'System Error',
            'The aftercare registration system is currently unavailable. Please contact support.',
            [{ text: 'OK' }]
          );
          return;
        }
        throw insertError;
      }

      // Send confirmation email via Edge Function
      try {
        await assertSupabase().functions.invoke('send-aftercare-confirmation', {
          body: {
            registration_id: data.id,
            parent_email: parentEmail,
            parent_name: `${parentFirstName} ${parentLastName}`,
            child_name: `${childFirstName} ${childLastName}`,
            payment_reference: paymentRef,
            has_proof: !!proofOfPaymentUrl,
          },
        });
      } catch (emailError) {
        console.warn('[Aftercare Registration] Failed to send confirmation email:', emailError);
        // Don't block success
      }

      // Notify admins
      try {
        await assertSupabase().functions.invoke('notifications-dispatcher', {
          body: {
            event_type: 'aftercare_registration_submitted',
            preschool_id: COMMUNITY_SCHOOL_ID,
            role_targets: ['principal', 'principal_admin'],
            registration_id: data.id,
            child_name: `${childFirstName} ${childLastName}`,
            parent_name: `${parentFirstName} ${parentLastName}`,
          },
        });
      } catch (notifError) {
        console.warn('[Aftercare Registration] Failed to send notification:', notifError);
      }

      Alert.alert(
        'Registration Submitted!',
        proofOfPaymentUrl
          ? 'Your registration has been submitted and your payment proof has been received. You will receive a confirmation email shortly.'
          : 'Your registration has been submitted. Please upload proof of payment to complete your registration. You will receive a confirmation email with banking details.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );

      // Reset form
      setChildFirstName('');
      setChildLastName('');
      setChildGrade('R');
      setChildDateOfBirth(null);
      setChildAllergies('');
      setChildMedicalConditions('');
      setEmergencyContactName('');
      setEmergencyContactPhone('');
      setEmergencyContactRelation('');
      setHowDidYouHear('');
      setAcceptTerms(false);
      setPaymentMethod('');
      setProofOfPayment(null);
      setParentIdNumber('');
      setErrors({});
    } catch (e: any) {
      console.error('[Aftercare Registration] Submission error:', e);
      const errorMessage = e?.message || e?.toString() || 'Please try again';
      Alert.alert('Submission failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    content: { flexGrow: 1, padding: 16, gap: 12, paddingBottom: 32 },
    label: { color: theme.text, fontWeight: '600', marginTop: 6 },
    input: { backgroundColor: theme.surface, borderRadius: 10, padding: 12, color: theme.text, borderWidth: 1, borderColor: theme.border },
    inputError: { borderColor: theme.error },
    hint: { color: theme.textSecondary, fontSize: 12, marginBottom: 4 },
    error: { color: theme.error, fontSize: 12, marginTop: 4 },
    section: { marginTop: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border },
    sectionTitle: { color: theme.text, fontWeight: '700', fontSize: 16, marginBottom: 8 },
    btn: { backgroundColor: theme.primary, padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 16 },
    btnText: { color: theme.onPrimary, fontWeight: '800' },
    headerTint: { backgroundColor: theme.background },
    dateButton: {
      backgroundColor: theme.surface,
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.border,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    dateButtonText: { color: theme.text, fontSize: 16 },
    dateButtonPlaceholder: { color: theme.textSecondary, fontSize: 16 },
    gradeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
    gradeButton: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      minWidth: 60,
      alignItems: 'center',
    },
    gradeButtonActive: {
      backgroundColor: theme.primary + '20',
      borderColor: theme.primary,
    },
    gradeButtonText: { color: theme.text, fontWeight: '500' },
    gradeButtonTextActive: { color: theme.primary, fontWeight: '600' },
    paymentMethodRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
    paymentMethodButton: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      alignItems: 'center',
    },
    paymentMethodButtonActive: {
      backgroundColor: theme.primary + '20',
      borderColor: theme.primary,
    },
    paymentMethodButtonText: { color: theme.text, fontWeight: '500' },
    paymentMethodButtonTextActive: { color: theme.primary, fontWeight: '600' },
    checkboxRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
    checkbox: {
      width: 24,
      height: 24,
      borderWidth: 2,
      borderColor: theme.border,
      borderRadius: 4,
      marginRight: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxActive: { backgroundColor: theme.primary, borderColor: theme.primary },
    infoBanner: {
      backgroundColor: theme.primary + '15',
      borderRadius: 10,
      padding: 12,
      marginTop: 8,
      borderLeftWidth: 4,
      borderLeftColor: theme.primary,
    },
    priceBox: {
      backgroundColor: theme.surface,
      borderRadius: 10,
      padding: 16,
      marginTop: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
  });

  const grades: Grade[] = ['R', '1', '2', '3', '4', '5', '6', '7'];

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'Aftercare Registration', headerStyle: styles.headerTint as any, headerTitleStyle: { color: theme.text }, headerTintColor: theme.primary }} />
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Info Banner */}
          {spotsRemaining !== null && spotsRemaining > 0 && (
            <View style={styles.infoBanner}>
              <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>
                🎉 Early Bird Special: {spotsRemaining} spots remaining at R{REGISTRATION_FEE_DISCOUNTED.toFixed(2)} (50% off!)
              </Text>
            </View>
          )}

          {registrationsClosed && (
            <View style={[styles.infoBanner, { backgroundColor: theme.error + '15', borderLeftColor: theme.error }]}>
              <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>
                ⚠️ Early bird registrations are now full. Regular pricing applies.
              </Text>
            </View>
          )}

          {/* Pricing */}
          <View style={styles.priceBox}>
            <Text style={[styles.sectionTitle, { marginTop: 0, marginBottom: 8 }]}>Registration Fee</Text>
            {spotsRemaining !== null && spotsRemaining > 0 ? (
              <>
                <Text style={{ color: theme.textSecondary, fontSize: 14 }}>Original Price</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 18, textDecorationLine: 'line-through', marginTop: 4 }}>
                  R {REGISTRATION_FEE_ORIGINAL.toFixed(2)}
                </Text>
                <Text style={{ color: '#10b981', fontSize: 28, fontWeight: '800', marginTop: 8 }}>
                  R {REGISTRATION_FEE_DISCOUNTED.toFixed(2)}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, backgroundColor: '#10b981' + '20', padding: 8, borderRadius: 8 }}>
                  <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                  <Text style={{ color: '#10b981', fontSize: 14, fontWeight: '600', marginLeft: 6 }}>
                    EARLYBIRD50 applied - You save R{REGISTRATION_FEE_DISCOUNTED.toFixed(2)}!
                  </Text>
                </View>
              </>
            ) : (
              <Text style={{ color: theme.text, fontSize: 28, fontWeight: '800', marginTop: 4 }}>
                R {REGISTRATION_FEE_ORIGINAL.toFixed(2)}
              </Text>
            )}
            <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 4 }}>
              One-time registration fee
            </Text>
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 0 }]}>Parent Information</Text>
          
          <Text style={styles.label}>First name *</Text>
          <TextInput 
            value={parentFirstName} 
            onChangeText={(text) => {
              setParentFirstName(text);
              if (errors.parentFirstName) setErrors(prev => ({...prev, parentFirstName: ''}));
            }} 
            style={[styles.input, errors.parentFirstName && styles.inputError]} 
            placeholder="e.g. Thandi" 
            placeholderTextColor={theme.textSecondary} 
          />
          {errors.parentFirstName ? <Text style={styles.error}>{errors.parentFirstName}</Text> : null}

          <Text style={styles.label}>Last name *</Text>
          <TextInput 
            value={parentLastName} 
            onChangeText={(text) => {
              setParentLastName(text);
              if (errors.parentLastName) setErrors(prev => ({...prev, parentLastName: ''}));
            }} 
            style={[styles.input, errors.parentLastName && styles.inputError]} 
            placeholder="e.g. Ndlovu" 
            placeholderTextColor={theme.textSecondary} 
          />
          {errors.parentLastName ? <Text style={styles.error}>{errors.parentLastName}</Text> : null}

          <Text style={styles.label}>Email *</Text>
          <TextInput 
            value={parentEmail} 
            onChangeText={(text) => {
              setParentEmail(text);
              if (errors.parentEmail) setErrors(prev => ({...prev, parentEmail: ''}));
            }} 
            style={[styles.input, errors.parentEmail && styles.inputError]} 
            placeholder="e.g. thandi@example.com" 
            placeholderTextColor={theme.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          {errors.parentEmail ? <Text style={styles.error}>{errors.parentEmail}</Text> : null}

          <Text style={styles.label}>Phone number *</Text>
          <Text style={styles.hint}>Format: +27 XX XXX XXXX or 0XX XXX XXXX</Text>
          <TextInput 
            value={parentPhone} 
            onChangeText={(text) => {
              setParentPhone(text);
              if (errors.parentPhone) setErrors(prev => ({...prev, parentPhone: ''}));
            }} 
            style={[styles.input, errors.parentPhone && styles.inputError]} 
            placeholder="e.g. +27 82 123 4567" 
            keyboardType="phone-pad" 
            placeholderTextColor={theme.textSecondary} 
          />
          {errors.parentPhone ? <Text style={styles.error}>{errors.parentPhone}</Text> : null}

          <Text style={styles.label}>ID Number (optional)</Text>
          <TextInput 
            value={parentIdNumber} 
            onChangeText={setParentIdNumber} 
            style={styles.input} 
            placeholder="e.g. 9001015800085" 
            placeholderTextColor={theme.textSecondary}
            keyboardType="numeric"
          />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Child Information</Text>
            
            <Text style={styles.label}>First name *</Text>
            <TextInput 
              value={childFirstName} 
              onChangeText={(text) => {
                setChildFirstName(text);
                if (errors.childFirstName) setErrors(prev => ({...prev, childFirstName: ''}));
              }} 
              style={[styles.input, errors.childFirstName && styles.inputError]} 
              placeholder="e.g. Sipho" 
              placeholderTextColor={theme.textSecondary} 
            />
            {errors.childFirstName ? <Text style={styles.error}>{errors.childFirstName}</Text> : null}

            <Text style={styles.label}>Last name *</Text>
            <TextInput 
              value={childLastName} 
              onChangeText={(text) => {
                setChildLastName(text);
                if (errors.childLastName) setErrors(prev => ({...prev, childLastName: ''}));
              }} 
              style={[styles.input, errors.childLastName && styles.inputError]} 
              placeholder="e.g. Ndlovu" 
              placeholderTextColor={theme.textSecondary} 
            />
            {errors.childLastName ? <Text style={styles.error}>{errors.childLastName}</Text> : null}

            <Text style={styles.label}>Grade *</Text>
            <View style={styles.gradeRow}>
              {grades.map((grade) => (
                <TouchableOpacity
                  key={grade}
                  style={[styles.gradeButton, childGrade === grade && styles.gradeButtonActive]}
                  onPress={() => setChildGrade(grade)}
                >
                  <Text style={[styles.gradeButtonText, childGrade === grade && styles.gradeButtonTextActive]}>
                    Grade {grade}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Date of birth *</Text>
            <TouchableOpacity 
              style={[styles.dateButton, errors.childDateOfBirth && styles.inputError]} 
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={childDateOfBirth ? styles.dateButtonText : styles.dateButtonPlaceholder}>
                {childDateOfBirth ? formatDate(childDateOfBirth) : 'Select date of birth'}
              </Text>
              <Ionicons name="calendar" size={20} color={theme.primary} />
            </TouchableOpacity>
            {errors.childDateOfBirth ? <Text style={styles.error}>{errors.childDateOfBirth}</Text> : null}
            
            {showDatePicker && (
              <DateTimePicker
                value={childDateOfBirth || new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                maximumDate={new Date()}
                minimumDate={new Date(2000, 0, 1)}
                onChange={(event, selectedDate) => {
                  setShowDatePicker(Platform.OS === 'ios');
                  if (selectedDate) {
                    setChildDateOfBirth(selectedDate);
                    if (errors.childDateOfBirth) setErrors(prev => ({...prev, childDateOfBirth: ''}));
                  }
                }}
              />
            )}

            <Text style={styles.label}>Allergies (optional)</Text>
            <TextInput 
              value={childAllergies} 
              onChangeText={setChildAllergies} 
              style={styles.input} 
              placeholder="e.g. Peanuts, Dairy" 
              placeholderTextColor={theme.textSecondary} 
              multiline
            />

            <Text style={styles.label}>Medical conditions (optional)</Text>
            <TextInput 
              value={childMedicalConditions} 
              onChangeText={setChildMedicalConditions} 
              style={styles.input} 
              placeholder="e.g. Asthma, Diabetes" 
              placeholderTextColor={theme.textSecondary} 
              multiline
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Emergency Contact</Text>
            
            <Text style={styles.label}>Name *</Text>
            <TextInput 
              value={emergencyContactName} 
              onChangeText={(text) => {
                setEmergencyContactName(text);
                if (errors.emergencyContactName) setErrors(prev => ({...prev, emergencyContactName: ''}));
              }} 
              style={[styles.input, errors.emergencyContactName && styles.inputError]} 
              placeholder="e.g. Sipho Mthethwa" 
              placeholderTextColor={theme.textSecondary} 
            />
            {errors.emergencyContactName ? <Text style={styles.error}>{errors.emergencyContactName}</Text> : null}

            <Text style={styles.label}>Phone number *</Text>
            <Text style={styles.hint}>Format: +27 XX XXX XXXX or 0XX XXX XXXX</Text>
            <TextInput 
              value={emergencyContactPhone} 
              onChangeText={(text) => {
                setEmergencyContactPhone(text);
                if (errors.emergencyContactPhone) setErrors(prev => ({...prev, emergencyContactPhone: ''}));
              }} 
              style={[styles.input, errors.emergencyContactPhone && styles.inputError]} 
              placeholder="e.g. +27 82 123 4567" 
              keyboardType="phone-pad" 
              placeholderTextColor={theme.textSecondary} 
            />
            {errors.emergencyContactPhone ? <Text style={styles.error}>{errors.emergencyContactPhone}</Text> : null}

            <Text style={styles.label}>Relationship *</Text>
            <TextInput 
              value={emergencyContactRelation} 
              onChangeText={(text) => {
                setEmergencyContactRelation(text);
                if (errors.emergencyContactRelation) setErrors(prev => ({...prev, emergencyContactRelation: ''}));
              }} 
              style={[styles.input, errors.emergencyContactRelation && styles.inputError]} 
              placeholder="e.g. Mother, Father, Aunt" 
              placeholderTextColor={theme.textSecondary} 
            />
            {errors.emergencyContactRelation ? <Text style={styles.error}>{errors.emergencyContactRelation}</Text> : null}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Additional Information</Text>
            
            <Text style={styles.label}>How did you hear about us? (optional)</Text>
            <TextInput 
              value={howDidYouHear} 
              onChangeText={setHowDidYouHear} 
              style={styles.input} 
              placeholder="e.g. Facebook, Friend, School notice" 
              placeholderTextColor={theme.textSecondary} 
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment</Text>
            
            <Text style={styles.label}>Payment Method *</Text>
            <View style={styles.paymentMethodRow}>
              {([
                { value: 'eft', label: '🏦 EFT', desc: 'Bank Transfer' },
                { value: 'cash', label: '💵 Cash', desc: 'Cash Payment' },
                { value: 'card', label: '💳 Card', desc: 'Card Payment' },
              ] as const).map((method) => (
                <TouchableOpacity
                  key={method.value}
                  style={[styles.paymentMethodButton, paymentMethod === method.value && styles.paymentMethodButtonActive]}
                  onPress={() => {
                    setPaymentMethod(method.value);
                  }}
                >
                  <Text style={[styles.paymentMethodButtonText, paymentMethod === method.value && styles.paymentMethodButtonTextActive]}>
                    {method.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <Text style={[styles.label, { marginTop: 16 }]}>Proof of Payment (optional but recommended)</Text>
            <Text style={styles.hint}>Upload proof now to get approved within 24 hours. Otherwise, approval takes 2-3 days.</Text>
            
            {proofOfPayment ? (
              <View style={{ marginTop: 8 }}>
                <Image 
                  source={{ uri: proofOfPayment }} 
                  style={{ width: '100%', height: 200, borderRadius: 10, backgroundColor: theme.surface }} 
                  resizeMode="cover"
                />
                <TouchableOpacity 
                  style={[styles.btn, { backgroundColor: theme.error, marginTop: 8 }]} 
                  onPress={() => setProofOfPayment(null)}
                >
                  <Text style={styles.btnText}>Remove & Upload Different Image</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity 
                style={[styles.btn, { backgroundColor: theme.surface, borderWidth: 2, borderColor: theme.primary, borderStyle: 'dashed' }]} 
                onPress={handlePopUpload}
                disabled={uploadingProof}
              >
                {uploadingProof ? (
                  <ActivityIndicator color={theme.primary} />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="cloud-upload" size={24} color={theme.primary} />
                    <Text style={[styles.btnText, { color: theme.primary, marginLeft: 8 }]}>Upload Proof of Payment</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.section}>
            <TouchableOpacity 
              style={styles.checkboxRow} 
              onPress={() => setAcceptTerms(!acceptTerms)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, acceptTerms && styles.checkboxActive]}>
                {acceptTerms && <Ionicons name="checkmark" size={16} color={theme.onPrimary} />}
              </View>
              <Text style={{ color: theme.text, flex: 1, fontSize: 14 }}>
                I accept the terms and conditions and privacy policy *
              </Text>
            </TouchableOpacity>
            {errors.acceptTerms ? <Text style={styles.error}>{errors.acceptTerms}</Text> : null}
          </View>

          <TouchableOpacity style={styles.btn} onPress={onSubmit} disabled={loading || registrationsClosed}>
            {loading ? (
              <ActivityIndicator color={theme.onPrimary} />
            ) : (
              <Text style={styles.btnText}>Submit Registration</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
