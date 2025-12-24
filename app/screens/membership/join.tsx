/**
 * Join by Code Screen
 * Quick registration using organization/region invite code
 */
import React, { useState, useRef } from 'react';
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
  Animated,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { MemberType, MEMBER_TYPE_LABELS } from '@/components/membership/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Organization info returned from code lookup
interface OrganizationInfo {
  id: string;
  name: string;
  region: string;
  region_id: string;
  region_code: string;
  manager_name: string;
  member_count: number;
  logo_url?: string;
  default_tier: string;
  allowed_types: MemberType[];
}

interface JoinFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  member_type: MemberType;
}

export default function JoinByCodeScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  
  const [inviteCode, setInviteCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orgInfo, setOrgInfo] = useState<OrganizationInfo | null>(null);
  const [codeError, setCodeError] = useState('');
  const [formData, setFormData] = useState<JoinFormData>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    member_type: 'learner',
  });
  
  // Animation for success
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  const updateField = (field: keyof JoinFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const verifyCode = async () => {
    if (inviteCode.length < 5) {
      setCodeError('Please enter a valid invite code');
      return;
    }
    
    setIsVerifying(true);
    setCodeError('');
    
    try {
      const supabase = assertSupabase();
      
      // Query the region_invite_codes table
      const { data: codeData, error: codeError } = await supabase
        .from('region_invite_codes')
        .select(`
          id,
          code,
          organization_id,
          region_id,
          allowed_member_types,
          default_tier,
          max_uses,
          current_uses,
          expires_at,
          is_active,
          organizations (
            id,
            name,
            logo_url
          ),
          organization_regions (
            id,
            name,
            code,
            province_code
          )
        `)
        .eq('code', inviteCode.toUpperCase())
        .eq('is_active', true)
        .single();

      if (codeError || !codeData) {
        setCodeError('Invalid invite code. Please check and try again.');
        return;
      }

      // Check if code has expired
      if (codeData.expires_at && new Date(codeData.expires_at) < new Date()) {
        setCodeError('This invite code has expired.');
        return;
      }

      // Check if code has reached max uses
      if (codeData.max_uses && codeData.current_uses >= codeData.max_uses) {
        setCodeError('This invite code has reached its maximum usage limit.');
        return;
      }

      // Get member count for the region
      const { count: memberCount } = await supabase
        .from('organization_members')
        .select('id', { count: 'exact', head: true })
        .eq('region_id', codeData.region_id);

      // Get regional manager name
      const { data: managerData } = await supabase
        .from('organization_members')
        .select('first_name, last_name')
        .eq('region_id', codeData.region_id)
        .eq('role', 'regional_manager')
        .single();

      const org = codeData.organizations as any;
      const region = codeData.organization_regions as any;

      const orgInfo: OrganizationInfo = {
        id: codeData.organization_id,
        name: org?.name || 'Unknown Organization',
        region: region?.name || 'Unknown Region',
        region_id: codeData.region_id,
        region_code: region?.province_code || region?.code || '',
        manager_name: managerData 
          ? `${managerData.first_name} ${managerData.last_name}`
          : 'Regional Manager',
        member_count: memberCount || 0,
        logo_url: org?.logo_url,
        default_tier: codeData.default_tier || 'standard',
        allowed_types: (codeData.allowed_member_types || ['learner']) as MemberType[],
      };

      setOrgInfo(orgInfo);
      
      // Animate the form in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    } catch (error) {
      console.error('[JoinByCode] Error verifying code:', error);
      setCodeError('Failed to verify code. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleJoin = async () => {
    if (!formData.first_name || !formData.last_name) {
      Alert.alert('Required', 'Please enter your full name');
      return;
    }
    if (!formData.email || !formData.email.includes('@')) {
      Alert.alert('Required', 'Please enter a valid email address');
      return;
    }
    if (!formData.phone) {
      Alert.alert('Required', 'Please enter your phone number');
      return;
    }
    if (!orgInfo) {
      Alert.alert('Error', 'Please verify your invite code first');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const supabase = assertSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        Alert.alert('Sign In Required', 'Please sign in or create an account to join.');
        router.push('/(auth)/sign-in');
        return;
      }

      // Generate member number
      const year = new Date().getFullYear().toString().slice(-2);
      
      // Get next sequence number for the region
      const { count } = await supabase
        .from('organization_members')
        .select('id', { count: 'exact', head: true })
        .eq('region_id', orgInfo.region_id);
      
      const sequence = String((count || 0) + 1).padStart(5, '0');
      const memberNumber = `SOA-${orgInfo.region_code}-${year}-${sequence}`;
      
      // Create organization member record
      const { data: memberData, error: memberError } = await supabase
        .from('organization_members')
        .insert({
          organization_id: orgInfo.id,
          region_id: orgInfo.region_id,
          user_id: user.id,
          member_number: memberNumber,
          member_type: formData.member_type,
          membership_status: 'active',
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
          phone: formData.phone,
          role: 'member',
          join_date: new Date().toISOString(),
        })
        .select()
        .single();

      if (memberError) {
        console.error('[JoinByCode] Error creating member:', memberError);
        if (memberError.code === '23505') {
          Alert.alert('Already a Member', 'You are already a member of this organization.');
        } else {
          throw memberError;
        }
        return;
      }

      // Update invite code usage count
      await supabase
        .from('region_invite_codes')
        .update({ current_uses: (orgInfo as any).current_uses + 1 })
        .eq('code', inviteCode.toUpperCase());
      
      Alert.alert(
        'Welcome to Soil of Africa! 🎉',
        `You've successfully joined ${orgInfo.region} region.\n\nYour Member Number: ${memberNumber}`,
        [
          { 
            text: 'View ID Card', 
            onPress: () => router.replace('/screens/membership/id-card')
          },
        ]
      );
    } catch (error) {
      console.error('[JoinByCode] Error joining:', error);
      Alert.alert('Error', 'Failed to complete registration. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetCode = () => {
    setOrgInfo(null);
    setInviteCode('');
    setCodeError('');
    fadeAnim.setValue(0);
    slideAnim.setValue(50);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Stack.Screen
        options={{
          title: 'Join with Invite Code',
        }}
      />

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
          {/* Header Illustration */}
          <View style={styles.header}>
            <LinearGradient
              colors={['#166534', '#22C55E']}
              style={styles.headerIcon}
            >
              <Ionicons name="ticket-outline" size={48} color="#fff" />
            </LinearGradient>
            <Text style={[styles.headerTitle, { color: theme.text }]}>
              Join with Invite Code
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
              Enter the invite code you received from your regional manager or facilitator
            </Text>
          </View>

          {/* Code Input Section */}
          {!orgInfo && (
            <View style={styles.codeSection}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Invite Code</Text>
              <View style={[styles.codeInputContainer, { backgroundColor: theme.surface, borderColor: codeError ? '#EF4444' : theme.border }]}>
                <Ionicons name="key-outline" size={24} color={codeError ? '#EF4444' : theme.textSecondary} />
                <TextInput
                  style={[styles.codeInput, { color: theme.text }]}
                  placeholder="e.g., SOA-GP-2025"
                  placeholderTextColor={theme.textSecondary}
                  autoCapitalize="characters"
                  value={inviteCode}
                  onChangeText={(v) => {
                    setInviteCode(v.toUpperCase());
                    setCodeError('');
                  }}
                />
                {inviteCode.length > 0 && (
                  <TouchableOpacity onPress={() => setInviteCode('')}>
                    <Ionicons name="close-circle" size={22} color={theme.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
              
              {codeError ? (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle" size={16} color="#EF4444" />
                  <Text style={styles.errorText}>{codeError}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.verifyButton,
                  { backgroundColor: inviteCode.length >= 5 ? theme.primary : theme.border }
                ]}
                onPress={verifyCode}
                disabled={isVerifying || inviteCode.length < 5}
              >
                {isVerifying ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="search-outline" size={20} color="#fff" />
                    <Text style={styles.verifyText}>Verify Code</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Example codes hint */}
              <View style={[styles.hintBox, { backgroundColor: theme.surface }]}>
                <Ionicons name="information-circle-outline" size={20} color={theme.primary} />
                <Text style={[styles.hintText, { color: theme.textSecondary }]}>
                  Example codes: SOA-GP-2025, SOA-WC-2025, SOA-KZN-2025
                </Text>
              </View>
            </View>
          )}

          {/* Organization Info & Join Form */}
          {orgInfo && (
            <Animated.View 
              style={[
                styles.joinSection,
                { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
              ]}
            >
              {/* Verified Organization Card */}
              <View style={[styles.orgCard, { backgroundColor: theme.card }]}>
                <View style={styles.orgCardHeader}>
                  <View style={[styles.verifiedBadge, { backgroundColor: '#10B98120' }]}>
                    <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                    <Text style={styles.verifiedText}>Verified Organization</Text>
                  </View>
                  <TouchableOpacity onPress={resetCode}>
                    <Text style={[styles.changeCode, { color: theme.primary }]}>Change</Text>
                  </TouchableOpacity>
                </View>
                
                <View style={styles.orgInfo}>
                  <View style={[styles.orgLogo, { backgroundColor: theme.primary + '20' }]}>
                    <Ionicons name="leaf" size={32} color={theme.primary} />
                  </View>
                  <View style={styles.orgDetails}>
                    <Text style={[styles.orgName, { color: theme.text }]}>{orgInfo.name}</Text>
                    <Text style={[styles.orgRegion, { color: theme.primary }]}>{orgInfo.region} Region</Text>
                    <Text style={[styles.orgManager, { color: theme.textSecondary }]}>
                      Manager: {orgInfo.manager_name}
                    </Text>
                  </View>
                </View>
                
                <View style={[styles.orgStats, { borderTopColor: theme.border }]}>
                  <View style={styles.orgStatItem}>
                    <Ionicons name="people-outline" size={18} color={theme.textSecondary} />
                    <Text style={[styles.orgStatText, { color: theme.textSecondary }]}>
                      {orgInfo.member_count} members
                    </Text>
                  </View>
                  <View style={styles.orgStatItem}>
                    <Ionicons name="shield-checkmark-outline" size={18} color={theme.textSecondary} />
                    <Text style={[styles.orgStatText, { color: theme.textSecondary }]}>
                      {orgInfo.default_tier.charAt(0).toUpperCase() + orgInfo.default_tier.slice(1)} tier
                    </Text>
                  </View>
                </View>
              </View>

              {/* Join Form */}
              <View style={styles.formSection}>
                <Text style={[styles.formTitle, { color: theme.text }]}>Your Information</Text>
                
                <View style={styles.inputRow}>
                  <View style={styles.inputHalf}>
                    <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>First Name *</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                      placeholder="First Name"
                      placeholderTextColor={theme.textSecondary}
                      value={formData.first_name}
                      onChangeText={(v) => updateField('first_name', v)}
                    />
                  </View>
                  <View style={styles.inputHalf}>
                    <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Last Name *</Text>
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
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Email Address *</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                    placeholder="your@email.com"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={formData.email}
                    onChangeText={(v) => updateField('email', v)}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Phone Number *</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                    placeholder="+27 82 123 4567"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="phone-pad"
                    value={formData.phone}
                    onChangeText={(v) => updateField('phone', v)}
                  />
                </View>

                {/* Member Type Selection */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Join as *</Text>
                  <View style={styles.typeOptions}>
                    {orgInfo.allowed_types.map(type => (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.typeOption,
                          { 
                            backgroundColor: formData.member_type === type ? theme.primary + '15' : theme.surface,
                            borderColor: formData.member_type === type ? theme.primary : theme.border,
                          }
                        ]}
                        onPress={() => updateField('member_type', type)}
                      >
                        {formData.member_type === type && (
                          <Ionicons name="checkmark-circle" size={18} color={theme.primary} />
                        )}
                        <Text style={[
                          styles.typeOptionText,
                          { color: formData.member_type === type ? theme.primary : theme.text }
                        ]}>
                          {MEMBER_TYPE_LABELS[type]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              {/* Terms */}
              <View style={[styles.termsBox, { backgroundColor: theme.surface }]}>
                <Text style={[styles.termsText, { color: theme.textSecondary }]}>
                  By joining, you agree to Soil of Africa's Terms of Service and Privacy Policy.
                  Your membership will be reviewed by the regional manager.
                </Text>
              </View>
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Join Button */}
      {orgInfo && (
        <View style={[styles.bottomNav, { backgroundColor: theme.card, paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity
            style={[styles.joinButton, { backgroundColor: theme.primary }]}
            onPress={handleJoin}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="person-add" size={20} color="#fff" />
                <Text style={styles.joinButtonText}>Join {orgInfo.region} Region</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Full Registration Link */}
      {!orgInfo && (
        <View style={[styles.bottomLink, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={[styles.bottomLinkText, { color: theme.textSecondary }]}>
            Don't have an invite code?
          </Text>
          <TouchableOpacity onPress={() => router.push('/screens/membership/register')}>
            <Text style={[styles.bottomLinkAction, { color: theme.primary }]}>
              Register normally
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  
  // Header
  header: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  headerIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  
  // Code Input
  codeSection: {
    paddingHorizontal: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  codeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: 14,
    paddingHorizontal: 16,
    borderWidth: 2,
    gap: 12,
  },
  codeInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 1,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
  },
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 14,
    marginTop: 16,
    gap: 10,
  },
  verifyText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginTop: 16,
    gap: 10,
  },
  hintText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  
  // Join Section
  joinSection: {
    padding: 20,
  },
  
  // Org Card
  orgCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  orgCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  changeCode: {
    fontSize: 14,
    fontWeight: '600',
  },
  orgInfo: {
    flexDirection: 'row',
    gap: 14,
  },
  orgLogo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orgDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  orgName: {
    fontSize: 18,
    fontWeight: '700',
  },
  orgRegion: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  orgManager: {
    fontSize: 12,
    marginTop: 4,
  },
  orgStats: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  orgStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  orgStatText: {
    fontSize: 13,
  },
  
  // Form
  formSection: {
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    marginBottom: 6,
  },
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
  input: {
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    borderWidth: 1,
  },
  
  // Type Options
  typeOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  typeOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Terms
  termsBox: {
    padding: 14,
    borderRadius: 12,
  },
  termsText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  
  // Bottom
  bottomNav: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
    borderRadius: 14,
    gap: 10,
  },
  joinButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  bottomLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingTop: 16,
  },
  bottomLinkText: {
    fontSize: 14,
  },
  bottomLinkAction: {
    fontSize: 14,
    fontWeight: '600',
  },
});
