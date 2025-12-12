import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator, ScrollView, Platform } from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';

export default function ParentChildRegistrationScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gender, setGender] = useState<'male' | 'female' | 'other' | ''>('');
  const [dietary, setDietary] = useState('');
  const [medicalInfo, setMedicalInfo] = useState('');
  const [specialNeeds, setSpecialNeeds] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [emergencyRelation, setEmergencyRelation] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Organization selection state (supports preschools, K-12, training centers, etc.)
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(profile?.organization_id || null);
  const [organizations, setOrganizations] = useState<Array<{ id: string; name: string; type: string; city?: string; tenant_slug?: string }>>([]);
  const [loadingOrganizations, setLoadingOrganizations] = useState(true);

  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const formatPhoneNumber = (phone: string): string => {
    // Remove non-digits
    const digits = phone.replace(/\D/g, '');
    // Format as +27 XX XXX XXXX
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
  
  // Fetch available organizations (preschools, K-12 schools, training centers, etc.)
  useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        setLoadingOrganizations(true);
        
        // Try to fetch from preschools table (always available for registration)
        const { data: preschoolsData, error: preschoolsError } = await assertSupabase()
          .from('preschools')
          .select('id, name, address, tenant_slug')
          .eq('is_active', true)
          .order('name');
        
        if (preschoolsError) {
          console.error('Preschools query error:', preschoolsError);
          throw preschoolsError;
        }
        
        if (preschoolsData && preschoolsData.length > 0) {
          // Transform preschools data to match organizations format
          // Extract city from address if possible
          const transformedData = preschoolsData.map(p => {
            // Try to extract city from address (basic heuristic)
            let city = undefined;
            if (p.address) {
              // Common SA patterns: "Street, City" or "123 Street, City, Province"
              const addressParts = p.address.split(',');
              if (addressParts.length >= 2) {
                city = addressParts[addressParts.length - 2].trim();
              }
            }
            
            return {
              id: p.id,
              name: p.name,
              type: 'preschool' as const,
              city: city,
              tenant_slug: p.tenant_slug
            };
          });
          
          setOrganizations(transformedData);
        } else {
          // Fallback: Try organizations table if preschools is empty
          const { data: orgsData, error: orgsError } = await assertSupabase()
            .from('organizations')
            .select('id, name, type, city')
            .eq('is_active', true)
            .order('name');
          
          if (orgsError) {
            console.error('Organizations query error:', orgsError);
            throw orgsError;
          }
          
          setOrganizations(orgsData || []);
        }
      } catch (error: any) {
        console.error('Failed to fetch organizations:', error);
        const errorMessage = error?.message || 'Failed to load organizations. Please try again.';
        Alert.alert('Error', errorMessage);
      } finally {
        setLoadingOrganizations(false);
      }
    };
    
    fetchOrganizations();
  }, []);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!firstName.trim()) newErrors.firstName = 'First name is required';
    if (!lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!dob) {
      newErrors.dob = 'Date of birth is required';
    } else {
      const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      if (age < 2 || age > 7) {
        newErrors.dob = 'Child must be between 2 and 7 years old for preschool';
      }
    }
    if (!gender) newErrors.gender = 'Please select gender';
    if (!selectedOrganizationId) newErrors.organization = 'Please select an organization';
    if (emergencyPhone && !/^\+?[0-9]{10,13}$/.test(emergencyPhone.replace(/\s/g, ''))) {
      newErrors.emergencyPhone = 'Invalid phone number format';
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
    
    // Validate profile exists
    if (!profile?.id) {
      Alert.alert('Profile Missing', 'We could not determine your user profile. Please try logging out and back in.');
      return;
    }
    
    // Validate organization selected
    if (!selectedOrganizationId) {
      Alert.alert('School Required', 'Please select a school for registration.');
      setErrors(prev => ({ ...prev, organization: 'Please select an organization' }));
      return;
    }
    
    setLoading(true);
    try {
      const relationshipNote = emergencyRelation ? `[EmergencyRelationship: ${emergencyRelation.trim()}]` : '';
      const combinedNotes = (relationshipNote + (notes ? ` ${notes}` : '')).trim();

      const payload = {
        child_first_name: firstName.trim(),
        child_last_name: lastName.trim(),
        child_birth_date: formatDate(dob!),
        child_gender: gender || null,
        dietary_requirements: dietary || null,
        medical_info: medicalInfo || null,
        special_needs: specialNeeds || null,
        emergency_contact_name: emergencyName || null,
        emergency_contact_phone: emergencyPhone ? formatPhoneNumber(emergencyPhone) : null,
        notes: combinedNotes || null,
        parent_id: profile.id,
        preschool_id: selectedOrganizationId,
        status: 'pending',
      };
      
      console.log('[Child Registration] Submitting payload:', {
        ...payload,
        parent_id: profile.id,
        preschool_id: selectedOrganizationId,
      });

      const response = await assertSupabase().from('child_registration_requests').insert(payload as any).select();
      
      // Log full response for debugging
      console.log('[Child Registration] Full response:', {
        hasData: !!response.data,
        dataLength: response.data?.length,
        hasError: !!response.error,
        error: response.error,
        errorType: typeof response.error,
        errorKeys: response.error ? Object.keys(response.error) : [],
        status: (response.error as any)?.status || (response.error as any)?.statusCode,
      });
      
      // Check if we got data (successful insert)
      if (response.data && response.data.length > 0) {
        console.log('[Child Registration] Insert successful:', response.data);
        // Success - show alert and reset form (continues below)
      } else if (response.error) {
        // Handle error
        const error = response.error;
        const errorKeys = Object.keys(error || {});
        const statusCode = (error as any)?.status || (error as any)?.statusCode || (error as any)?.code;
        
        // Check for 404 - table doesn't exist or not exposed via API
        if (statusCode === 404 || statusCode === 'PGRST116' || errorKeys.length === 0) {
          console.error('[Child Registration] 404 error - table not found or not exposed via API');
          Alert.alert(
            'System Error',
            `The registration system is currently unavailable. The required database table is not accessible.\n\nThis is a technical issue. Please:\n1. Try again in a few moments\n2. Contact support if the problem persists\n\nError: Table 'child_registration_requests' not found (404)`,
            [{ text: 'OK' }]
          );
          return;
        }
        
        // If error object is empty or has no useful properties, it's likely an RLS violation
        if (errorKeys.length === 0 || (!error.code && !error.message)) {
          console.error('[Child Registration] Empty error object - likely RLS policy violation');
          Alert.alert(
            'Permission Denied',
            `You don't have permission to register a child at this school. This could be because:\n\n1. Your account isn't properly linked to this school\n2. The selected school is not active\n3. There's a permission issue with your account\n\nPlease try selecting a different school or contact support if this persists.`,
            [{ text: 'OK' }]
          );
          return;
        }
        
        // Extract error properties
        const errorCode = (error as any)?.code || (error as any)?.error?.code || (error as any)?.statusCode;
        const errorMessage = (error as any)?.message || (error as any)?.error?.message || (error as any)?.msg || String(error);
        const errorDetails = (error as any)?.details || (error as any)?.error?.details;
        const errorHint = (error as any)?.hint || (error as any)?.error?.hint;
        
        console.error('[Child Registration] Insert error:', {
          code: errorCode,
          message: errorMessage,
          details: errorDetails,
          hint: errorHint,
          payload: payload,
        });
        
        // Check for duplicate/conflict error (409 Conflict or unique constraint violation)
        if (errorCode === '23505' || errorMessage?.includes('duplicate') || errorMessage?.includes('unique') || errorMessage?.includes('409')) {
          Alert.alert(
            'Duplicate Registration',
            `You have already submitted a registration request for ${firstName} ${lastName} at this school.\n\nPlease wait for the school to review your existing request, or contact the school if you need to update the information.`,
            [{ text: 'OK' }]
          );
          return;
        }
        
        // Check for RLS policy violation
        if (errorCode === '42501' || errorMessage?.toLowerCase().includes('permission denied') || errorMessage?.toLowerCase().includes('policy') || errorMessage?.toLowerCase().includes('row-level security')) {
          Alert.alert(
            'Permission Denied',
            `You don't have permission to register a child at this school. Please ensure you're logged in correctly and the school selection is valid.\n\nError: ${errorMessage}`,
            [{ text: 'OK' }]
          );
          return;
        }
        
        // Check for foreign key violation (invalid preschool_id)
        if (errorCode === '23503' || errorMessage?.toLowerCase().includes('foreign key')) {
          Alert.alert(
            'Invalid School',
            `The selected school is not valid. Please select a different school or contact support.\n\nError: ${errorMessage}`,
            [{ text: 'OK' }]
          );
          return;
        }
        
        // Generic error
        Alert.alert(
          'Submission Failed',
          errorMessage || errorDetails || errorHint || 'Unable to submit registration. Please try again or contact support.',
          [{ text: 'OK' }]
        );
        return;
      } else {
        // No data and no error - this shouldn't happen
        console.error('[Child Registration] No data and no error - unexpected response');
        Alert.alert(
          'Submission Failed',
          'The registration request could not be submitted. Please try again or contact support.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      // Success - show alert and reset form (only reaches here if data exists)
      Alert.alert(
        'Submitted Successfully',
        'Your registration request has been sent to the school. You will be notified once it is reviewed.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
      setFirstName('');
      setLastName('');
      setDob(null);
      setGender('');
      setDietary('');
      setMedicalInfo('');
      setSpecialNeeds('');
      setEmergencyName('');
      setEmergencyPhone('');
      setEmergencyRelation('');
      setNotes('');
      setSelectedOrganizationId(null);
      setErrors({});
    } catch (e: any) {
      console.error('[Child Registration] Submission error:', e);
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
    row: { flexDirection: 'row', gap: 10 },
    col: { flex: 1 },
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
    dateButtonText: {
      color: theme.text,
      fontSize: 16,
    },
    dateButtonPlaceholder: {
      color: theme.textSecondary,
      fontSize: 16,
    },
    genderRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 8,
    },
    genderButton: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      alignItems: 'center',
    },
    genderButtonActive: {
      backgroundColor: theme.primary + '20',
      borderColor: theme.primary,
    },
    genderButtonText: {
      color: theme.text,
      fontWeight: '500',
    },
    genderButtonTextActive: {
      color: theme.primary,
      fontWeight: '600',
    },
    preschoolPicker: {
      backgroundColor: theme.surface,
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.border,
      marginTop: 8,
    },
    organizationContainer: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
      marginTop: 8,
    },
    organizationScrollContainer: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      marginTop: 8,
      maxHeight: 300,
      padding: 8,
    },
    organizationOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 10,
      marginBottom: 8,
      borderWidth: 1.5,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    organizationOptionActive: {
      backgroundColor: theme.primary + '15',
      borderColor: theme.primary,
      borderWidth: 2,
    },
    organizationName: {
      color: theme.text,
      fontWeight: '600',
      fontSize: 16,
    },
    organizationNameActive: {
      color: theme.primary,
      fontWeight: '700',
    },
    preschoolOption: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 8,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    preschoolOptionActive: {
      backgroundColor: theme.primary + '20',
      borderColor: theme.primary,
    },
    preschoolOptionText: {
      color: theme.text,
      fontWeight: '500',
    },
    preschoolOptionTextActive: {
      color: theme.primary,
      fontWeight: '600',
    },
  });

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'Register a Child', headerStyle: styles.headerTint as any, headerTitleStyle: { color: theme.text }, headerTintColor: theme.primary }} />
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.sectionTitle, { marginTop: 0 }]}>Child Information</Text>
          
          <Text style={styles.label}>First name *</Text>
          <TextInput 
            value={firstName} 
            onChangeText={(text) => {
              setFirstName(text);
              if (errors.firstName) setErrors(prev => ({...prev, firstName: ''}));
            }} 
            style={[styles.input, errors.firstName && styles.inputError]} 
            placeholder="e.g. Thandi" 
            placeholderTextColor={theme.textSecondary} 
          />
          {errors.firstName ? <Text style={styles.error}>{errors.firstName}</Text> : null}

          <Text style={styles.label}>Last name *</Text>
          <TextInput 
            value={lastName} 
            onChangeText={(text) => {
              setLastName(text);
              if (errors.lastName) setErrors(prev => ({...prev, lastName: ''}));
            }} 
            style={[styles.input, errors.lastName && styles.inputError]} 
            placeholder="e.g. Ndlovu" 
            placeholderTextColor={theme.textSecondary} 
          />
          {errors.lastName ? <Text style={styles.error}>{errors.lastName}</Text> : null}

          <Text style={styles.label}>Date of birth *</Text>
          <Text style={styles.hint}>Child must be between 2 and 7 years old</Text>
          <TouchableOpacity 
            style={[styles.dateButton, errors.dob && styles.inputError]} 
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={dob ? styles.dateButtonText : styles.dateButtonPlaceholder}>
              {dob ? formatDate(dob) : 'Select date of birth'}
            </Text>
            <Ionicons name="calendar" size={20} color={theme.primary} />
          </TouchableOpacity>
          {errors.dob ? <Text style={styles.error}>{errors.dob}</Text> : null}
          
          {showDatePicker && (
            <DateTimePicker
              value={dob || new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              maximumDate={new Date()}
              minimumDate={new Date(1990, 0, 1)}
              onChange={(event, selectedDate) => {
                setShowDatePicker(Platform.OS === 'ios');
                if (selectedDate) {
                  setDob(selectedDate);
                  if (errors.dob) setErrors(prev => ({...prev, dob: ''}));
                }
              }}
            />
          )}

          <Text style={styles.label}>Gender *</Text>
          <View style={styles.genderRow}>
            {(['male', 'female', 'other'] as const).map((g) => (
              <TouchableOpacity
                key={g}
                style={[styles.genderButton, gender === g && styles.genderButtonActive]}
                onPress={() => {
                  setGender(g);
                  if (errors.gender) setErrors(prev => ({...prev, gender: ''}));
                }}
              >
                <Text style={[styles.genderButtonText, gender === g && styles.genderButtonTextActive]}>
                  {g.charAt(0).toUpperCase() + g.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {errors.gender ? <Text style={styles.error}>{errors.gender}</Text> : null}
          
          <Text style={[styles.label, { marginTop: 12 }]}>Select Organization *</Text>
          <Text style={styles.hint}>Choose the school or organization you want to register your child at</Text>
          {loadingOrganizations ? (
            <View style={[styles.organizationContainer, { paddingVertical: 20 }]}>
              <ActivityIndicator color={theme.primary} />
              <Text style={{ color: theme.textSecondary, marginTop: 8, textAlign: 'center' }}>Loading organizations...</Text>
            </View>
          ) : organizations.length === 0 ? (
            <View style={[styles.organizationContainer, { paddingVertical: 30 }]}>
              <Ionicons name="school-outline" size={48} color={theme.textSecondary} style={{ alignSelf: 'center', marginBottom: 12 }} />
              <Text style={{ color: theme.text, textAlign: 'center', fontWeight: '600', fontSize: 16 }}>No organizations available</Text>
              <Text style={{ color: theme.textSecondary, textAlign: 'center', fontSize: 14, marginTop: 4 }}>Please contact support</Text>
            </View>
          ) : (
            <ScrollView style={styles.organizationScrollContainer} nestedScrollEnabled>
              {organizations.map((org) => {
                const getOrgTypeLabel = (type: string) => {
                  const typeMap: Record<string, string> = {
                    'preschool': '🏫 Preschool',
                    'k12_school': '🎓 K-12 School',
                    'training_center': '📚 Training Center',
                    'tutoring_center': '✏️ Tutoring Center',
                    'skills_development': '🛠️ Skills Development'
                  };
                  return typeMap[type] || `📍 ${type}`;
                };
                
                const isSelected = selectedOrganizationId === org.id;
                
                return (
                  <TouchableOpacity
                    key={org.id}
                    style={[
                      styles.organizationOption,
                      isSelected && styles.organizationOptionActive,
                    ]}
                    onPress={() => {
                      setSelectedOrganizationId(org.id);
                      if (errors.organization) setErrors(prev => ({...prev, organization: ''}));
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[
                        styles.organizationName,
                        isSelected && styles.organizationNameActive,
                      ]}>
                        {org.name}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, flexWrap: 'wrap', gap: 8 }}>
                        <Text style={{ color: isSelected ? theme.primary : theme.textSecondary, fontSize: 12 }}>
                          {getOrgTypeLabel(org.type)}
                        </Text>
                        {org.city && (
                          <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                            📍 {org.city}
                          </Text>
                        )}
                        {org.tenant_slug && (
                          <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                            @{org.tenant_slug}
                          </Text>
                        )}
                      </View>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={24} color={theme.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
          {errors.organization ? <Text style={styles.error}>{errors.organization}</Text> : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Health & Dietary Information</Text>
            
            <Text style={styles.label}>Dietary requirements (optional)</Text>
            <TextInput value={dietary} onChangeText={setDietary} style={styles.input} placeholder="e.g. Halal, Vegetarian, Gluten-free" placeholderTextColor={theme.textSecondary} multiline />

            <Text style={styles.label}>Medical information (optional)</Text>
            <TextInput value={medicalInfo} onChangeText={setMedicalInfo} style={styles.input} placeholder="e.g. Asthma, Allergies, Medication" placeholderTextColor={theme.textSecondary} multiline />

            <Text style={styles.label}>Special needs (optional)</Text>
            <TextInput value={specialNeeds} onChangeText={setSpecialNeeds} style={styles.input} placeholder="e.g. Learning support, mobility" placeholderTextColor={theme.textSecondary} multiline />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Emergency Contact</Text>
            
            <Text style={styles.label}>Emergency contact name (optional)</Text>
            <TextInput value={emergencyName} onChangeText={setEmergencyName} style={styles.input} placeholder="e.g. Sipho Mthethwa" placeholderTextColor={theme.textSecondary} />

            <Text style={styles.label}>Emergency contact phone (optional)</Text>
            <Text style={styles.hint}>Format: +27 XX XXX XXXX or 0XX XXX XXXX</Text>
            <TextInput 
              value={emergencyPhone} 
              onChangeText={(text) => {
                setEmergencyPhone(text);
                if (errors.emergencyPhone) setErrors(prev => ({...prev, emergencyPhone: ''}));
              }} 
              style={[styles.input, errors.emergencyPhone && styles.inputError]} 
              placeholder="e.g. +27 82 123 4567" 
              keyboardType="phone-pad" 
              placeholderTextColor={theme.textSecondary} 
            />
            {errors.emergencyPhone ? <Text style={styles.error}>{errors.emergencyPhone}</Text> : null}

            <Text style={styles.label}>Relationship to child (optional)</Text>
            <TextInput value={emergencyRelation} onChangeText={setEmergencyRelation} style={styles.input} placeholder="e.g. Mother, Father, Aunt" placeholderTextColor={theme.textSecondary} />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Additional Information</Text>
            
            <Text style={styles.label}>Additional notes (optional)</Text>
            <TextInput 
              value={notes} 
              onChangeText={setNotes} 
              style={[styles.input, { minHeight: 80 }]} 
              placeholder="Anything else the school should know" 
              placeholderTextColor={theme.textSecondary} 
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity style={styles.btn} onPress={onSubmit} disabled={loading}>
            {loading ? (
              <ActivityIndicator color={theme.onPrimary} />
            ) : (
              <Text style={styles.btnText}>Submit Registration Request</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
