/**
 * Public Member Registration Screen
 * Multi-step registration flow for new members joining Soil of Africa
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
} from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { MemberType, MembershipTier, MEMBER_TYPE_LABELS, MEMBERSHIP_TIER_LABELS } from '@/components/membership/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Registration steps
type RegistrationStep = 'region' | 'personal' | 'membership' | 'payment' | 'complete';

const STEPS: { key: RegistrationStep; title: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'region', title: 'Region', icon: 'location-outline' },
  { key: 'personal', title: 'Personal', icon: 'person-outline' },
  { key: 'membership', title: 'Membership', icon: 'ribbon-outline' },
  { key: 'payment', title: 'Payment', icon: 'card-outline' },
  { key: 'complete', title: 'Complete', icon: 'checkmark-circle-outline' },
];

// South African Regions
const REGIONS = [
  { id: 'r1', name: 'Gauteng', code: 'GP', members: 847 },
  { id: 'r2', name: 'Western Cape', code: 'WC', members: 523 },
  { id: 'r3', name: 'KwaZulu-Natal', code: 'KZN', members: 412 },
  { id: 'r4', name: 'Eastern Cape', code: 'EC', members: 298 },
  { id: 'r5', name: 'Limpopo', code: 'LP', members: 234 },
  { id: 'r6', name: 'Mpumalanga', code: 'MP', members: 189 },
  { id: 'r7', name: 'North West', code: 'NW', members: 156 },
  { id: 'r8', name: 'Free State', code: 'FS', members: 134 },
  { id: 'r9', name: 'Northern Cape', code: 'NC', members: 54 },
];

// Member types with descriptions
const MEMBER_TYPES: { type: MemberType; title: string; description: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { type: 'learner', title: 'Learner', description: 'Join to learn and grow with our programs', icon: 'school-outline' },
  { type: 'facilitator', title: 'Facilitator', description: 'Lead workshops and guide learners', icon: 'people-outline' },
  { type: 'mentor', title: 'Mentor', description: 'Provide guidance and support to members', icon: 'heart-outline' },
];

// Membership tiers with pricing
const MEMBERSHIP_TIERS: { tier: MembershipTier; title: string; price: number; features: string[] }[] = [
  { 
    tier: 'standard', 
    title: 'Standard', 
    price: 600, 
    features: ['Digital ID Card', 'Access to resources', 'Event notifications', 'Community access']
  },
  { 
    tier: 'premium', 
    title: 'Premium', 
    price: 1200, 
    features: ['All Standard features', 'Premium ID Card', 'Priority event booking', 'Exclusive workshops', 'Certificate programs']
  },
  { 
    tier: 'vip', 
    title: 'VIP', 
    price: 2500, 
    features: ['All Premium features', 'Executive ID Card', 'One-on-one mentoring', 'Leadership programs', 'Annual summit access', 'VIP networking events']
  },
];

interface RegistrationData {
  // Region
  region_id: string;
  region_name: string;
  region_code: string;
  // Personal
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  id_number: string;
  date_of_birth: string;
  address_line1: string;
  city: string;
  postal_code: string;
  // Membership
  member_type: MemberType;
  membership_tier: MembershipTier;
  // Emergency
  emergency_contact_name: string;
  emergency_contact_phone: string;
}

const initialData: RegistrationData = {
  region_id: '',
  region_name: '',
  region_code: '',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  id_number: '',
  date_of_birth: '',
  address_line1: '',
  city: '',
  postal_code: '',
  member_type: 'learner',
  membership_tier: 'standard',
  emergency_contact_name: '',
  emergency_contact_phone: '',
};

export default function MemberRegistrationScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  
  const [currentStep, setCurrentStep] = useState<RegistrationStep>('region');
  const [formData, setFormData] = useState<RegistrationData>(initialData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedMemberNumber, setGeneratedMemberNumber] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const currentStepIndex = STEPS.findIndex(s => s.key === currentStep);
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100;

  const updateField = (field: keyof RegistrationData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const selectRegion = (region: typeof REGIONS[0]) => {
    setFormData(prev => ({
      ...prev,
      region_id: region.id,
      region_name: region.name,
      region_code: region.code,
    }));
  };

  const validateStep = (): boolean => {
    switch (currentStep) {
      case 'region':
        if (!formData.region_id) {
          Alert.alert('Required', 'Please select your region');
          return false;
        }
        return true;
      case 'personal':
        if (!formData.first_name || !formData.last_name || !formData.email || !formData.phone) {
          Alert.alert('Required', 'Please fill in all required fields');
          return false;
        }
        if (!formData.email.includes('@')) {
          Alert.alert('Invalid', 'Please enter a valid email address');
          return false;
        }
        return true;
      case 'membership':
        return true;
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (!validateStep()) return;
    
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].key);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  };

  const prevStep = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].key);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Generate member number
      const year = new Date().getFullYear().toString().slice(-2);
      const sequence = String(Math.floor(Math.random() * 9999) + 1).padStart(5, '0');
      const memberNumber = `SOA-${formData.region_code}-${year}-${sequence}`;
      setGeneratedMemberNumber(memberNumber);
      
      setCurrentStep('complete');
    } catch (error) {
      Alert.alert('Error', 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount: number): string => {
    return `R ${amount.toLocaleString('en-ZA')}`;
  };

  // Step Renderers
  const renderRegionStep = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: theme.text }]}>Select Your Region</Text>
      <Text style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
        Choose the province where you'll be based
      </Text>
      
      <View style={styles.regionGrid}>
        {REGIONS.map(region => (
          <TouchableOpacity
            key={region.id}
            style={[
              styles.regionCard,
              { 
                backgroundColor: theme.card,
                borderColor: formData.region_id === region.id ? theme.primary : theme.border,
                borderWidth: formData.region_id === region.id ? 2 : 1,
              }
            ]}
            onPress={() => selectRegion(region)}
          >
            {formData.region_id === region.id && (
              <View style={[styles.regionCheck, { backgroundColor: theme.primary }]}>
                <Ionicons name="checkmark" size={14} color="#fff" />
              </View>
            )}
            <Text style={[styles.regionCode, { color: theme.primary }]}>{region.code}</Text>
            <Text style={[styles.regionName, { color: theme.text }]}>{region.name}</Text>
            <Text style={[styles.regionMembers, { color: theme.textSecondary }]}>
              {region.members} members
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderPersonalStep = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: theme.text }]}>Personal Information</Text>
      <Text style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
        Tell us about yourself
      </Text>
      
      <View style={styles.formSection}>
        <Text style={[styles.formLabel, { color: theme.text }]}>Full Name *</Text>
        <View style={styles.nameRow}>
          <TextInput
            style={[styles.input, styles.inputHalf, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
            placeholder="First Name"
            placeholderTextColor={theme.textSecondary}
            value={formData.first_name}
            onChangeText={(v) => updateField('first_name', v)}
          />
          <TextInput
            style={[styles.input, styles.inputHalf, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
            placeholder="Last Name"
            placeholderTextColor={theme.textSecondary}
            value={formData.last_name}
            onChangeText={(v) => updateField('last_name', v)}
          />
        </View>
      </View>

      <View style={styles.formSection}>
        <Text style={[styles.formLabel, { color: theme.text }]}>Email Address *</Text>
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

      <View style={styles.formSection}>
        <Text style={[styles.formLabel, { color: theme.text }]}>Phone Number *</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
          placeholder="+27 82 123 4567"
          placeholderTextColor={theme.textSecondary}
          keyboardType="phone-pad"
          value={formData.phone}
          onChangeText={(v) => updateField('phone', v)}
        />
      </View>

      <View style={styles.formSection}>
        <Text style={[styles.formLabel, { color: theme.text }]}>SA ID Number</Text>
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

      <View style={styles.formSection}>
        <Text style={[styles.formLabel, { color: theme.text }]}>Address</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
          placeholder="Street Address"
          placeholderTextColor={theme.textSecondary}
          value={formData.address_line1}
          onChangeText={(v) => updateField('address_line1', v)}
        />
        <View style={[styles.nameRow, { marginTop: 10 }]}>
          <TextInput
            style={[styles.input, styles.inputHalf, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
            placeholder="City"
            placeholderTextColor={theme.textSecondary}
            value={formData.city}
            onChangeText={(v) => updateField('city', v)}
          />
          <TextInput
            style={[styles.input, styles.inputHalf, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
            placeholder="Postal Code"
            placeholderTextColor={theme.textSecondary}
            keyboardType="number-pad"
            value={formData.postal_code}
            onChangeText={(v) => updateField('postal_code', v)}
          />
        </View>
      </View>

      <View style={styles.formSection}>
        <Text style={[styles.formLabel, { color: theme.text }]}>Emergency Contact</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
          placeholder="Contact Name"
          placeholderTextColor={theme.textSecondary}
          value={formData.emergency_contact_name}
          onChangeText={(v) => updateField('emergency_contact_name', v)}
        />
        <TextInput
          style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border, marginTop: 10 }]}
          placeholder="Contact Phone"
          placeholderTextColor={theme.textSecondary}
          keyboardType="phone-pad"
          value={formData.emergency_contact_phone}
          onChangeText={(v) => updateField('emergency_contact_phone', v)}
        />
      </View>
    </View>
  );

  const renderMembershipStep = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: theme.text }]}>Choose Your Membership</Text>
      <Text style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
        Select your role and membership tier
      </Text>
      
      {/* Member Type Selection */}
      <Text style={[styles.sectionLabel, { color: theme.text }]}>I want to join as a:</Text>
      <View style={styles.typeGrid}>
        {MEMBER_TYPES.map(type => (
          <TouchableOpacity
            key={type.type}
            style={[
              styles.typeCard,
              { 
                backgroundColor: formData.member_type === type.type ? theme.primary + '15' : theme.card,
                borderColor: formData.member_type === type.type ? theme.primary : theme.border,
              }
            ]}
            onPress={() => updateField('member_type', type.type)}
          >
            <View style={[styles.typeIcon, { backgroundColor: theme.primary + '20' }]}>
              <Ionicons name={type.icon} size={24} color={theme.primary} />
            </View>
            <Text style={[styles.typeTitle, { color: theme.text }]}>{type.title}</Text>
            <Text style={[styles.typeDesc, { color: theme.textSecondary }]}>{type.description}</Text>
            {formData.member_type === type.type && (
              <View style={[styles.typeCheck, { backgroundColor: theme.primary }]}>
                <Ionicons name="checkmark" size={14} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Membership Tier Selection */}
      <Text style={[styles.sectionLabel, { color: theme.text, marginTop: 24 }]}>Membership Tier:</Text>
      <View style={styles.tierList}>
        {MEMBERSHIP_TIERS.map((tier, index) => (
          <TouchableOpacity
            key={tier.tier}
            style={[
              styles.tierCard,
              { 
                backgroundColor: formData.membership_tier === tier.tier ? theme.primary + '10' : theme.card,
                borderColor: formData.membership_tier === tier.tier ? theme.primary : theme.border,
              }
            ]}
            onPress={() => updateField('membership_tier', tier.tier)}
          >
            {index === 1 && (
              <View style={[styles.popularBadge, { backgroundColor: '#F59E0B' }]}>
                <Text style={styles.popularText}>POPULAR</Text>
              </View>
            )}
            
            <View style={styles.tierHeader}>
              <View>
                <Text style={[styles.tierTitle, { color: theme.text }]}>{tier.title}</Text>
                <Text style={[styles.tierPrice, { color: theme.primary }]}>
                  {formatCurrency(tier.price)}<Text style={styles.tierPeriod}>/year</Text>
                </Text>
              </View>
              <View style={[
                styles.tierRadio,
                { 
                  borderColor: formData.membership_tier === tier.tier ? theme.primary : theme.border,
                  backgroundColor: formData.membership_tier === tier.tier ? theme.primary : 'transparent',
                }
              ]}>
                {formData.membership_tier === tier.tier && (
                  <Ionicons name="checkmark" size={16} color="#fff" />
                )}
              </View>
            </View>
            
            <View style={styles.tierFeatures}>
              {tier.features.map((feature, i) => (
                <View key={i} style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                  <Text style={[styles.featureText, { color: theme.textSecondary }]}>{feature}</Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderPaymentStep = () => {
    const selectedTier = MEMBERSHIP_TIERS.find(t => t.tier === formData.membership_tier);
    
    return (
      <View style={styles.stepContent}>
        <Text style={[styles.stepTitle, { color: theme.text }]}>Review & Pay</Text>
        <Text style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
          Confirm your details and complete payment
        </Text>
        
        {/* Summary Card */}
        <View style={[styles.summaryCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.summaryTitle, { color: theme.text }]}>Registration Summary</Text>
          
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Name</Text>
            <Text style={[styles.summaryValue, { color: theme.text }]}>
              {formData.first_name} {formData.last_name}
            </Text>
          </View>
          
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Region</Text>
            <Text style={[styles.summaryValue, { color: theme.text }]}>{formData.region_name}</Text>
          </View>
          
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Member Type</Text>
            <Text style={[styles.summaryValue, { color: theme.text }]}>
              {MEMBER_TYPE_LABELS[formData.member_type]}
            </Text>
          </View>
          
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Membership</Text>
            <Text style={[styles.summaryValue, { color: theme.text }]}>{selectedTier?.title}</Text>
          </View>
          
          <View style={[styles.summaryDivider, { backgroundColor: theme.border }]} />
          
          <View style={styles.summaryRow}>
            <Text style={[styles.totalLabel, { color: theme.text }]}>Total Amount</Text>
            <Text style={[styles.totalValue, { color: theme.primary }]}>
              {formatCurrency(selectedTier?.price || 0)}
            </Text>
          </View>
        </View>

        {/* Payment Methods */}
        <Text style={[styles.sectionLabel, { color: theme.text }]}>Payment Method</Text>
        <View style={styles.paymentMethods}>
          <TouchableOpacity style={[styles.paymentMethod, { backgroundColor: theme.card, borderColor: theme.primary }]}>
            <Ionicons name="card-outline" size={24} color={theme.primary} />
            <Text style={[styles.paymentMethodText, { color: theme.text }]}>PayFast</Text>
            <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.paymentMethod, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Ionicons name="swap-horizontal-outline" size={24} color={theme.textSecondary} />
            <Text style={[styles.paymentMethodText, { color: theme.text }]}>EFT Transfer</Text>
          </TouchableOpacity>
        </View>

        {/* Terms */}
        <View style={[styles.termsBox, { backgroundColor: theme.surface }]}>
          <Ionicons name="information-circle-outline" size={20} color={theme.textSecondary} />
          <Text style={[styles.termsText, { color: theme.textSecondary }]}>
            By completing registration, you agree to Soil of Africa's Terms of Service and Privacy Policy.
          </Text>
        </View>
      </View>
    );
  };

  const renderCompleteStep = () => (
    <View style={styles.completeContent}>
      <View style={[styles.successCircle, { backgroundColor: '#10B98120' }]}>
        <Ionicons name="checkmark-circle" size={80} color="#10B981" />
      </View>
      
      <Text style={[styles.completeTitle, { color: theme.text }]}>Welcome to Soil of Africa!</Text>
      <Text style={[styles.completeSubtitle, { color: theme.textSecondary }]}>
        Your registration is complete
      </Text>
      
      <View style={[styles.memberNumberCard, { backgroundColor: theme.card }]}>
        <Text style={[styles.memberNumberLabel, { color: theme.textSecondary }]}>Your Member Number</Text>
        <Text style={[styles.memberNumberValue, { color: theme.primary }]}>{generatedMemberNumber}</Text>
      </View>
      
      <View style={styles.nextSteps}>
        <Text style={[styles.nextStepsTitle, { color: theme.text }]}>What's Next?</Text>
        
        <View style={styles.nextStepItem}>
          <View style={[styles.nextStepIcon, { backgroundColor: '#3B82F620' }]}>
            <Ionicons name="mail-outline" size={20} color="#3B82F6" />
          </View>
          <Text style={[styles.nextStepText, { color: theme.textSecondary }]}>
            Check your email for confirmation
          </Text>
        </View>
        
        <View style={styles.nextStepItem}>
          <View style={[styles.nextStepIcon, { backgroundColor: '#8B5CF620' }]}>
            <Ionicons name="card-outline" size={20} color="#8B5CF6" />
          </View>
          <Text style={[styles.nextStepText, { color: theme.textSecondary }]}>
            Your digital ID card is ready
          </Text>
        </View>
        
        <View style={styles.nextStepItem}>
          <View style={[styles.nextStepIcon, { backgroundColor: '#10B98120' }]}>
            <Ionicons name="people-outline" size={20} color="#10B981" />
          </View>
          <Text style={[styles.nextStepText, { color: theme.textSecondary }]}>
            Connect with your regional community
          </Text>
        </View>
      </View>
      
      <TouchableOpacity 
        style={[styles.viewCardButton, { backgroundColor: theme.primary }]}
        onPress={() => router.push('/screens/membership/id-card')}
      >
        <Ionicons name="card" size={20} color="#fff" />
        <Text style={styles.viewCardText}>View My ID Card</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.dashboardButton, { borderColor: theme.primary }]}
        onPress={() => router.push('/screens/membership')}
      >
        <Text style={[styles.dashboardText, { color: theme.primary }]}>Go to Dashboard</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Stack.Screen
        options={{
          title: currentStep === 'complete' ? 'Registration Complete' : 'Join Soil of Africa',
          headerLeft: currentStep === 'complete' ? () => null : undefined,
        }}
      />

      {currentStep !== 'complete' && (
        <>
          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={[styles.progressBg, { backgroundColor: theme.border }]}>
              <View style={[styles.progressFill, { backgroundColor: theme.primary, width: `${progress}%` }]} />
            </View>
            <Text style={[styles.progressText, { color: theme.textSecondary }]}>
              Step {currentStepIndex + 1} of {STEPS.length}
            </Text>
          </View>

          {/* Step Indicators */}
          <View style={styles.stepsIndicator}>
            {STEPS.slice(0, -1).map((step, index) => (
              <View key={step.key} style={styles.stepIndicator}>
                <View style={[
                  styles.stepDot,
                  { 
                    backgroundColor: index <= currentStepIndex ? theme.primary : theme.border,
                  }
                ]}>
                  {index < currentStepIndex ? (
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  ) : (
                    <Ionicons name={step.icon} size={14} color={index === currentStepIndex ? '#fff' : theme.textSecondary} />
                  )}
                </View>
                <Text style={[
                  styles.stepLabel,
                  { color: index <= currentStepIndex ? theme.text : theme.textSecondary }
                ]}>
                  {step.title}
                </Text>
                {index < STEPS.length - 2 && (
                  <View style={[
                    styles.stepLine,
                    { backgroundColor: index < currentStepIndex ? theme.primary : theme.border }
                  ]} />
                )}
              </View>
            ))}
          </View>
        </>
      )}

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.content}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {currentStep === 'region' && renderRegionStep()}
          {currentStep === 'personal' && renderPersonalStep()}
          {currentStep === 'membership' && renderMembershipStep()}
          {currentStep === 'payment' && renderPaymentStep()}
          {currentStep === 'complete' && renderCompleteStep()}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom Navigation */}
      {currentStep !== 'complete' && (
        <View style={[styles.bottomNav, { backgroundColor: theme.card, paddingBottom: insets.bottom + 16 }]}>
          {currentStepIndex > 0 && (
            <TouchableOpacity 
              style={[styles.backButton, { borderColor: theme.border }]}
              onPress={prevStep}
            >
              <Ionicons name="arrow-back" size={20} color={theme.text} />
              <Text style={[styles.backText, { color: theme.text }]}>Back</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity 
            style={[
              styles.nextButton, 
              { backgroundColor: theme.primary },
              currentStepIndex === 0 && { flex: 1 }
            ]}
            onPress={currentStep === 'payment' ? handleSubmit : nextStep}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.nextText}>
                  {currentStep === 'payment' ? 'Complete Registration' : 'Continue'}
                </Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </>
            )}
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
  
  // Progress
  progressContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  progressBg: {
    height: 4,
    borderRadius: 2,
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    marginTop: 6,
    textAlign: 'right',
  },
  
  // Steps Indicator
  stepsIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  stepIndicator: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: {
    fontSize: 10,
    marginLeft: 4,
    display: 'none', // Hidden on small screens
  },
  stepLine: {
    width: 40,
    height: 2,
    marginHorizontal: 8,
  },
  
  // Step Content
  stepContent: {
    padding: 16,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 14,
    marginBottom: 24,
  },
  
  // Region Grid
  regionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  regionCard: {
    width: (SCREEN_WIDTH - 42) / 3,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    position: 'relative',
  },
  regionCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  regionCode: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  regionName: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  regionMembers: {
    fontSize: 9,
    marginTop: 4,
  },
  
  // Form
  formSection: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    borderWidth: 1,
  },
  nameRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inputHalf: {
    flex: 1,
  },
  
  // Member Type
  sectionLabel: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 14,
  },
  typeGrid: {
    gap: 12,
  },
  typeCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    position: 'relative',
  },
  typeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  typeTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  typeDesc: {
    fontSize: 13,
    marginTop: 4,
  },
  typeCheck: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Tier
  tierList: {
    gap: 12,
  },
  tierCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    position: 'relative',
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  popularText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  tierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  tierTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  tierPrice: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 4,
  },
  tierPeriod: {
    fontSize: 14,
    fontWeight: '500',
  },
  tierRadio: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierFeatures: {
    gap: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 13,
  },
  
  // Payment
  summaryCard: {
    padding: 16,
    borderRadius: 14,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  summaryDivider: {
    height: 1,
    marginVertical: 10,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  paymentMethods: {
    gap: 10,
    marginBottom: 20,
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    gap: 12,
  },
  paymentMethodText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  termsBox: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 12,
    gap: 10,
  },
  termsText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  
  // Complete
  completeContent: {
    padding: 24,
    alignItems: 'center',
  },
  successCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  completeTitle: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  completeSubtitle: {
    fontSize: 15,
    marginTop: 8,
    textAlign: 'center',
  },
  memberNumberCard: {
    padding: 20,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 24,
    width: '100%',
  },
  memberNumberLabel: {
    fontSize: 13,
    marginBottom: 6,
  },
  memberNumberValue: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 1,
  },
  nextSteps: {
    width: '100%',
    marginTop: 24,
  },
  nextStepsTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 14,
  },
  nextStepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  nextStepIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextStepText: {
    flex: 1,
    fontSize: 14,
  },
  viewCardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    gap: 10,
    marginTop: 24,
    width: '100%',
  },
  viewCardText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  dashboardButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    borderWidth: 2,
    marginTop: 12,
    width: '100%',
    alignItems: 'center',
  },
  dashboardText: {
    fontSize: 15,
    fontWeight: '600',
  },
  
  // Bottom Nav
  bottomNav: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  backText: {
    fontSize: 15,
    fontWeight: '600',
  },
  nextButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  nextText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
