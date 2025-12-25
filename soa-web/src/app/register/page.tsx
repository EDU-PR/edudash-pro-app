'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Header, Footer } from '@/components';
import { getSupabase } from '@/lib/supabase';
import {
  Leaf,
  ArrowRight,
  ArrowLeft,
  MapPin,
  User,
  CreditCard,
  CheckCircle2,
  Mail,
  Phone,
  Calendar,
  Building2,
  Users,
  Shield,
  AlertCircle,
  Loader2,
  Download,
  ExternalLink,
} from 'lucide-react';

// South African Regions
const regions = [
  { code: 'GP', name: 'Gauteng', description: 'Johannesburg, Pretoria' },
  { code: 'WC', name: 'Western Cape', description: 'Cape Town, Stellenbosch' },
  { code: 'KZN', name: 'KwaZulu-Natal', description: 'Durban, Pietermaritzburg' },
  { code: 'EC', name: 'Eastern Cape', description: 'Port Elizabeth, East London' },
  { code: 'LP', name: 'Limpopo', description: 'Polokwane, Tzaneen' },
  { code: 'MP', name: 'Mpumalanga', description: 'Nelspruit, Witbank' },
  { code: 'NW', name: 'North West', description: 'Rustenburg, Mahikeng' },
  { code: 'FS', name: 'Free State', description: 'Bloemfontein, Welkom' },
  { code: 'NC', name: 'Northern Cape', description: 'Kimberley, Upington' },
];

// Member Types
const memberTypes = [
  {
    id: 'learner',
    name: 'Learner',
    description: 'New to SOA, eager to learn and grow',
    icon: User,
  },
  {
    id: 'facilitator',
    name: 'Facilitator',
    description: 'Experienced member who guides learners',
    icon: Users,
  },
  {
    id: 'mentor',
    name: 'Mentor',
    description: 'Senior member providing leadership',
    icon: Shield,
  },
];

// Membership Tiers
const tiers = [
  {
    id: 'community',
    name: 'Community',
    price: 20,
    description: 'Join the movement and stay connected',
    features: ['Digital ID Card', 'Community Updates', 'Event Notifications', 'Basic Resources'],
  },
  {
    id: 'active',
    name: 'Active Member',
    price: 350,
    description: 'Full access to programs and resources',
    features: ['All Community +', 'Skills Programs', 'Chapter Participation', 'Workshop Priority'],
    popular: true,
  },
  {
    id: 'vip',
    name: 'VIP',
    price: 600,
    description: 'For coordinators and chapter leaders',
    features: ['All Active +', 'Leadership Training', 'VIP Events', 'Mentorship Programs'],
  },
];

type Step = 'region' | 'personal' | 'membership' | 'payment' | 'complete';

interface FormData {
  // Region
  region_code: string;
  // Personal
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  id_number: string;
  date_of_birth: string;
  address: string;
  city: string;
  // Emergency Contact
  emergency_name: string;
  emergency_phone: string;
  emergency_relationship: string;
  // Membership
  member_type: string;
  membership_tier: string;
  // Payment
  payment_method: string;
}

function RegisterPageContent() {
  const searchParams = useSearchParams();
  const preselectedTier = searchParams.get('tier') || '';

  const [step, setStep] = useState<Step>('region');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [memberNumber, setMemberNumber] = useState('');

  const [formData, setFormData] = useState<FormData>({
    region_code: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    id_number: '',
    date_of_birth: '',
    address: '',
    city: '',
    emergency_name: '',
    emergency_phone: '',
    emergency_relationship: '',
    member_type: 'learner',
    membership_tier: preselectedTier || 'standard',
    payment_method: 'card',
  });

  const updateField = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError('');
  };

  const steps: Step[] = ['region', 'personal', 'membership', 'payment', 'complete'];
  const currentStepIndex = steps.indexOf(step);

  const validateStep = (): boolean => {
    switch (step) {
      case 'region':
        if (!formData.region_code) {
          setError('Please select your region');
          return false;
        }
        break;
      case 'personal':
        if (!formData.first_name || !formData.last_name) {
          setError('Please enter your full name');
          return false;
        }
        if (!formData.email || !formData.email.includes('@')) {
          setError('Please enter a valid email address');
          return false;
        }
        if (!formData.phone) {
          setError('Please enter your phone number');
          return false;
        }
        break;
      case 'membership':
        if (!formData.member_type) {
          setError('Please select a member type');
          return false;
        }
        if (!formData.membership_tier) {
          setError('Please select a membership tier');
          return false;
        }
        break;
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep()) {
      const nextIndex = currentStepIndex + 1;
      if (nextIndex < steps.length) {
        setStep(steps[nextIndex]);
      }
    }
  };

  const prevStep = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setStep(steps[prevIndex]);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;

    setIsSubmitting(true);
    setError('');

    try {
      const supabase = getSupabase();
      
      // 1. Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: Math.random().toString(36).slice(-12) + 'Aa1!', // Temporary password
        options: {
          data: {
            first_name: formData.first_name,
            last_name: formData.last_name,
            phone: formData.phone,
          },
        },
      });

      if (authError) throw authError;

      // 2. Generate member number
      const year = new Date().getFullYear().toString().slice(-2);
      const sequence = String(Math.floor(Math.random() * 99999) + 1).padStart(5, '0');
      const generatedMemberNumber = `SOA-${formData.region_code}-${year}-${sequence}`;

      // 3. Create membership record
      const { error: memberError } = await supabase.from('organization_members').insert({
        user_id: authData.user?.id,
        organization_id: 'soil-of-africa', // This should be the actual org ID
        region_id: formData.region_code, // This should be the actual region ID
        member_number: generatedMemberNumber,
        member_type: formData.member_type,
        membership_tier: formData.membership_tier,
        status: 'pending',
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        phone: formData.phone,
        id_number: formData.id_number,
        date_of_birth: formData.date_of_birth || null,
        address: formData.address,
        city: formData.city,
        emergency_contact_name: formData.emergency_name,
        emergency_contact_phone: formData.emergency_phone,
        emergency_contact_relationship: formData.emergency_relationship,
        joined_at: new Date().toISOString(),
      });

      if (memberError) throw memberError;

      // 4. Create invoice
      const selectedTier = tiers.find((t) => t.id === formData.membership_tier);
      if (selectedTier) {
        await supabase.from('member_invoices').insert({
          member_id: authData.user?.id,
          amount: selectedTier.price,
          description: `${selectedTier.name} Membership - Annual`,
          status: 'pending',
          due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });
      }

      setMemberNumber(generatedMemberNumber);
      setStep('complete');
    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedRegion = regions.find((r) => r.code === formData.region_code);
  const selectedTier = tiers.find((t) => t.id === formData.membership_tier);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="pt-24 pb-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Progress Header */}
          {step !== 'complete' && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h1 className="text-2xl font-bold text-gray-900">Join Soil of Africa</h1>
                <span className="text-sm text-gray-500">
                  Step {currentStepIndex + 1} of {steps.length - 1}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="flex gap-2">
                {steps.slice(0, -1).map((s, i) => (
                  <div
                    key={s}
                    className={`h-2 flex-1 rounded-full transition-colors ${
                      i <= currentStepIndex ? 'bg-soa-primary' : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Step Content */}
          <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
            {/* Step 1: Region Selection */}
            {step === 'region' && (
              <div className="animate-fade-in">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-soa-light rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <MapPin className="w-8 h-8 text-soa-primary" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-2">Select Your Region</h2>
                  <p className="text-gray-500">Choose the province you're located in</p>
                </div>

                <div className="grid sm:grid-cols-3 gap-3">
                  {regions.map((region) => (
                    <button
                      key={region.code}
                      type="button"
                      onClick={() => updateField('region_code', region.code)}
                      className={`p-4 rounded-xl border-2 text-left transition ${
                        formData.region_code === region.code
                          ? 'border-soa-primary bg-soa-light'
                          : 'border-gray-200 hover:border-soa-primary/50'
                      }`}
                    >
                      <p className="font-semibold text-gray-900">{region.name}</p>
                      <p className="text-xs text-gray-500 mt-1">{region.description}</p>
                      {formData.region_code === region.code && (
                        <CheckCircle2 className="w-5 h-5 text-soa-primary mt-2" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Personal Information */}
            {step === 'personal' && (
              <div className="animate-fade-in">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-soa-light rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <User className="w-8 h-8 text-soa-primary" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-2">Personal Information</h2>
                  <p className="text-gray-500">Tell us about yourself</p>
                </div>

                <div className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        First Name *
                      </label>
                      <input
                        type="text"
                        value={formData.first_name}
                        onChange={(e) => updateField('first_name', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-soa-primary focus:border-transparent"
                        placeholder="John"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Last Name *
                      </label>
                      <input
                        type="text"
                        value={formData.last_name}
                        onChange={(e) => updateField('last_name', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-soa-primary focus:border-transparent"
                        placeholder="Doe"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address *
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => updateField('email', e.target.value)}
                        className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-soa-primary focus:border-transparent"
                        placeholder="john@example.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number *
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => updateField('phone', e.target.value)}
                        className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-soa-primary focus:border-transparent"
                        placeholder="+27 82 123 4567"
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        ID Number
                      </label>
                      <input
                        type="text"
                        value={formData.id_number}
                        onChange={(e) => updateField('id_number', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-soa-primary focus:border-transparent"
                        placeholder="8501015800088"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Date of Birth
                      </label>
                      <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="date"
                          value={formData.date_of_birth}
                          onChange={(e) => updateField('date_of_birth', e.target.value)}
                          className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-soa-primary focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Street Address
                      </label>
                      <input
                        type="text"
                        value={formData.address}
                        onChange={(e) => updateField('address', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-soa-primary focus:border-transparent"
                        placeholder="123 Main Street"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                      <input
                        type="text"
                        value={formData.city}
                        onChange={(e) => updateField('city', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-soa-primary focus:border-transparent"
                        placeholder="Johannesburg"
                      />
                    </div>
                  </div>

                  {/* Emergency Contact */}
                  <div className="pt-4 border-t border-gray-100">
                    <h3 className="font-medium text-gray-900 mb-3">Emergency Contact</h3>
                    <div className="grid sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                        <input
                          type="text"
                          value={formData.emergency_name}
                          onChange={(e) => updateField('emergency_name', e.target.value)}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-soa-primary focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Phone
                        </label>
                        <input
                          type="tel"
                          value={formData.emergency_phone}
                          onChange={(e) => updateField('emergency_phone', e.target.value)}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-soa-primary focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Relationship
                        </label>
                        <input
                          type="text"
                          value={formData.emergency_relationship}
                          onChange={(e) => updateField('emergency_relationship', e.target.value)}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-soa-primary focus:border-transparent"
                          placeholder="Parent, Spouse, etc."
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Membership Selection */}
            {step === 'membership' && (
              <div className="animate-fade-in">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-soa-light rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Building2 className="w-8 h-8 text-soa-primary" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-2">Choose Membership</h2>
                  <p className="text-gray-500">Select your member type and tier</p>
                </div>

                {/* Member Type */}
                <div className="mb-8">
                  <h3 className="font-medium text-gray-900 mb-3">I want to join as a:</h3>
                  <div className="grid sm:grid-cols-3 gap-3">
                    {memberTypes.map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => updateField('member_type', type.id)}
                        className={`p-4 rounded-xl border-2 text-left transition ${
                          formData.member_type === type.id
                            ? 'border-soa-primary bg-soa-light'
                            : 'border-gray-200 hover:border-soa-primary/50'
                        }`}
                      >
                        <type.icon
                          className={`w-6 h-6 mb-2 ${
                            formData.member_type === type.id ? 'text-soa-primary' : 'text-gray-400'
                          }`}
                        />
                        <p className="font-semibold text-gray-900">{type.name}</p>
                        <p className="text-xs text-gray-500 mt-1">{type.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Membership Tier */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">Membership Tier:</h3>
                  <div className="space-y-3">
                    {tiers.map((tier) => (
                      <button
                        key={tier.id}
                        type="button"
                        onClick={() => updateField('membership_tier', tier.id)}
                        className={`w-full p-4 rounded-xl border-2 text-left transition relative ${
                          formData.membership_tier === tier.id
                            ? 'border-soa-primary bg-soa-light'
                            : 'border-gray-200 hover:border-soa-primary/50'
                        }`}
                      >
                        {tier.popular && (
                          <span className="absolute top-2 right-2 bg-soa-primary text-white text-xs px-2 py-1 rounded-full">
                            Popular
                          </span>
                        )}
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-gray-900">{tier.name}</p>
                            <p className="text-sm text-gray-500">{tier.description}</p>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {tier.features.map((f, i) => (
                                <span
                                  key={i}
                                  className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded"
                                >
                                  {f}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-soa-primary">
                              R{tier.price.toLocaleString()}
                            </p>
                            <p className="text-xs text-gray-500">/year</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Payment */}
            {step === 'payment' && (
              <div className="animate-fade-in">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-soa-light rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <CreditCard className="w-8 h-8 text-soa-primary" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-2">Complete Registration</h2>
                  <p className="text-gray-500">Review and confirm your membership</p>
                </div>

                {/* Order Summary */}
                <div className="bg-gray-50 rounded-xl p-6 mb-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Order Summary</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Region</span>
                      <span className="font-medium">{selectedRegion?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Member Type</span>
                      <span className="font-medium capitalize">{formData.member_type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Membership Tier</span>
                      <span className="font-medium">{selectedTier?.name}</span>
                    </div>
                    <div className="border-t border-gray-200 pt-3 flex justify-between text-lg">
                      <span className="font-semibold">Total</span>
                      <span className="font-bold text-soa-primary">
                        R{selectedTier?.price.toLocaleString()}/year
                      </span>
                    </div>
                  </div>
                </div>

                {/* Payment Method */}
                <div className="mb-6">
                  <h3 className="font-medium text-gray-900 mb-3">Payment Method</h3>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => updateField('payment_method', 'card')}
                      className={`p-4 rounded-xl border-2 text-left transition ${
                        formData.payment_method === 'card'
                          ? 'border-soa-primary bg-soa-light'
                          : 'border-gray-200 hover:border-soa-primary/50'
                      }`}
                    >
                      <CreditCard className="w-6 h-6 text-soa-primary mb-2" />
                      <p className="font-semibold">Card Payment</p>
                      <p className="text-xs text-gray-500">Via PayFast</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => updateField('payment_method', 'eft')}
                      className={`p-4 rounded-xl border-2 text-left transition ${
                        formData.payment_method === 'eft'
                          ? 'border-soa-primary bg-soa-light'
                          : 'border-gray-200 hover:border-soa-primary/50'
                      }`}
                    >
                      <Building2 className="w-6 h-6 text-soa-primary mb-2" />
                      <p className="font-semibold">Bank EFT</p>
                      <p className="text-xs text-gray-500">Manual transfer</p>
                    </button>
                  </div>
                </div>

                {/* Terms */}
                <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600">
                  <p>
                    By completing registration, you agree to Soil of Africa's Terms of Service and
                    Privacy Policy. Your membership will be activated once payment is confirmed.
                  </p>
                </div>
              </div>
            )}

            {/* Step 5: Complete */}
            {step === 'complete' && (
              <div className="animate-fade-in text-center py-8">
                <div className="w-20 h-20 bg-soa-light rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-10 h-10 text-soa-primary" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Soil of Africa!</h2>
                <p className="text-gray-600 mb-6">
                  Your registration is complete. Your membership is pending payment confirmation.
                </p>

                {/* Member Number */}
                <div className="bg-soa-light rounded-xl p-6 mb-8 max-w-sm mx-auto">
                  <p className="text-sm text-soa-dark mb-2">Your Member Number</p>
                  <p className="text-2xl font-bold text-soa-primary font-mono">{memberNumber}</p>
                </div>

                {/* What's Next */}
                <div className="bg-gray-50 rounded-xl p-6 text-left max-w-md mx-auto mb-8">
                  <h3 className="font-semibold text-gray-900 mb-4">What's Next?</h3>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-soa-primary text-white rounded-full flex items-center justify-center text-sm font-bold shrink-0">
                        1
                      </div>
                      <span className="text-gray-600">Check your email for confirmation</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-soa-primary text-white rounded-full flex items-center justify-center text-sm font-bold shrink-0">
                        2
                      </div>
                      <span className="text-gray-600">Complete payment to activate membership</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-soa-primary text-white rounded-full flex items-center justify-center text-sm font-bold shrink-0">
                        3
                      </div>
                      <span className="text-gray-600">
                        Download the EduDash Pro app to access your ID card
                      </span>
                    </li>
                  </ul>
                </div>

                {/* Download App CTA */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <a
                    href={process.env.NEXT_PUBLIC_PLAY_STORE_URL || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition"
                  >
                    <Download className="w-5 h-5" />
                    Get the App
                  </a>
                  <Link
                    href="/"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 text-gray-700 border border-gray-200 rounded-xl font-medium hover:bg-gray-50 transition"
                  >
                    Back to Home
                  </Link>
                </div>

                {/* EduDash Pro Link */}
                <p className="mt-8 text-sm text-gray-500">
                  Manage your membership on{' '}
                  <a
                    href="https://edudashpro.org.za"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-edudash-primary hover:underline inline-flex items-center gap-1"
                  >
                    EduDash Pro
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </p>
              </div>
            )}

            {/* Navigation Buttons */}
            {step !== 'complete' && (
              <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
                <button
                  type="button"
                  onClick={prevStep}
                  disabled={currentStepIndex === 0}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition ${
                    currentStepIndex === 0
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>

                {step === 'payment' ? (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-soa-primary to-soa-secondary text-white rounded-xl font-semibold hover:opacity-90 transition disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        Complete Registration
                        <CheckCircle2 className="w-5 h-5" />
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={nextStep}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-soa-primary text-white rounded-xl font-semibold hover:bg-soa-dark transition"
                  >
                    Continue
                    <ArrowRight className="w-5 h-5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Have a code? */}
          {step !== 'complete' && (
            <p className="text-center mt-6 text-gray-500">
              Have an invite code?{' '}
              <Link href="/join" className="text-soa-primary hover:underline font-medium">
                Join with code
              </Link>
            </p>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

// Loading fallback for Suspense
function RegisterPageLoading() {
  return (
    <div className="min-h-screen bg-soa-cream flex items-center justify-center">
      <div className="animate-pulse text-soa-primary">Loading...</div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<RegisterPageLoading />}>
      <RegisterPageContent />
    </Suspense>
  );
}
