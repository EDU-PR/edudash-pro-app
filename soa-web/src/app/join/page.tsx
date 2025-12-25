'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { Header, Footer } from '@/components';
import { getSupabase } from '@/lib/supabase';
import {
  Leaf,
  Ticket,
  ArrowRight,
  CheckCircle2,
  Mail,
  Phone,
  User,
  Users,
  Shield,
  Loader2,
  AlertCircle,
  Download,
  ExternalLink,
  MapPin,
  X,
} from 'lucide-react';

// Mock invite code data (in production, this comes from database)
interface OrganizationInfo {
  id: string;
  name: string;
  region: string;
  region_code: string;
  manager_name: string;
  member_count: number;
  default_tier: string;
  allowed_types: ('learner' | 'facilitator' | 'mentor')[];
}

const VALID_CODES: Record<string, OrganizationInfo> = {
  'SOA-GP-2025': {
    id: 'org1',
    name: 'Soil of Africa',
    region: 'Gauteng',
    region_code: 'GP',
    manager_name: 'Nomvula Dlamini',
    member_count: 847,
    default_tier: 'standard',
    allowed_types: ['learner', 'facilitator', 'mentor'],
  },
  'SOA-WC-2025': {
    id: 'org1',
    name: 'Soil of Africa',
    region: 'Western Cape',
    region_code: 'WC',
    manager_name: 'Sarah Johnson',
    member_count: 523,
    default_tier: 'standard',
    allowed_types: ['learner', 'facilitator'],
  },
  'SOA-KZN-2025': {
    id: 'org1',
    name: 'Soil of Africa',
    region: 'KwaZulu-Natal',
    region_code: 'KZN',
    manager_name: 'James Ndlovu',
    member_count: 412,
    default_tier: 'standard',
    allowed_types: ['learner', 'facilitator', 'mentor'],
  },
  'SOA-EC-2025': {
    id: 'org1',
    name: 'Soil of Africa',
    region: 'Eastern Cape',
    region_code: 'EC',
    manager_name: 'Thandi Gcaba',
    member_count: 389,
    default_tier: 'standard',
    allowed_types: ['learner', 'facilitator', 'mentor'],
  },
};

const memberTypeLabels: Record<string, string> = {
  learner: 'Learner',
  facilitator: 'Facilitator',
  mentor: 'Mentor',
};

const memberTypeIcons: Record<string, any> = {
  learner: User,
  facilitator: Users,
  mentor: Shield,
};

interface FormData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  member_type: 'learner' | 'facilitator' | 'mentor';
}

export default function JoinPage() {
  const [inviteCode, setInviteCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orgInfo, setOrgInfo] = useState<OrganizationInfo | null>(null);
  const [codeError, setCodeError] = useState('');
  const [formError, setFormError] = useState('');
  const [memberNumber, setMemberNumber] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    member_type: 'learner',
  });

  const updateField = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value as any }));
    setFormError('');
  };

  const verifyCode = async () => {
    if (inviteCode.length < 5) {
      setCodeError('Please enter a valid invite code');
      return;
    }

    setIsVerifying(true);
    setCodeError('');

    try {
      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 1200));

      // In production, this would be a Supabase query
      const org = VALID_CODES[inviteCode.toUpperCase()];

      if (org) {
        setOrgInfo(org);
      } else {
        setCodeError('Invalid invite code. Please check and try again.');
      }
    } catch (error) {
      setCodeError('Failed to verify code. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const resetCode = () => {
    setOrgInfo(null);
    setInviteCode('');
    setCodeError('');
  };

  const handleSubmit = async () => {
    // Validate
    if (!formData.first_name || !formData.last_name) {
      setFormError('Please enter your full name');
      return;
    }
    if (!formData.email || !formData.email.includes('@')) {
      setFormError('Please enter a valid email address');
      return;
    }
    if (!formData.phone) {
      setFormError('Please enter your phone number');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      const supabase = getSupabase();
      
      // 1. Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: Math.random().toString(36).slice(-12) + 'Aa1!',
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
      const generatedMemberNumber = `SOA-${orgInfo?.region_code}-${year}-${sequence}`;

      // 3. Create membership record
      const { error: memberError } = await supabase.from('organization_members').insert({
        user_id: authData.user?.id,
        organization_id: 'soil-of-africa',
        region_id: orgInfo?.region_code,
        member_number: generatedMemberNumber,
        member_type: formData.member_type,
        membership_tier: orgInfo?.default_tier || 'standard',
        status: 'pending',
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        phone: formData.phone,
        joined_at: new Date().toISOString(),
        invite_code_used: inviteCode.toUpperCase(),
      });

      if (memberError) throw memberError;

      setMemberNumber(generatedMemberNumber);
      setIsComplete(true);
    } catch (err: any) {
      console.error('Join error:', err);
      setFormError(err.message || 'Failed to join. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="pt-24 pb-20">
        <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Success State */}
          {isComplete ? (
            <div className="bg-white rounded-2xl shadow-sm p-8 text-center animate-fade-in">
              <div className="w-20 h-20 bg-soa-light rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-soa-primary" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Welcome to {orgInfo?.region} Region!
              </h2>
              <p className="text-gray-600 mb-6">
                You've successfully joined Soil of Africa. Your membership is pending approval by
                the regional manager.
              </p>

              {/* Member Number */}
              <div className="bg-soa-light rounded-xl p-6 mb-8">
                <p className="text-sm text-soa-dark mb-2">Your Member Number</p>
                <p className="text-2xl font-bold text-soa-primary font-mono">{memberNumber}</p>
              </div>

              {/* What's Next */}
              <div className="bg-gray-50 rounded-xl p-6 text-left mb-8">
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
                    <span className="text-gray-600">
                      Regional manager will review your application
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-soa-primary text-white rounded-full flex items-center justify-center text-sm font-bold shrink-0">
                      3
                    </div>
                    <span className="text-gray-600">Download the app to access your membership</span>
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
          ) : (
            <>
              {/* Header */}
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-gradient-to-br from-soa-primary to-soa-secondary rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Ticket className="w-10 h-10 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Join with Invite Code</h1>
                <p className="text-gray-500">
                  Enter the invite code you received from your regional manager
                </p>
              </div>

              {/* Code Input (if not verified) */}
              {!orgInfo && (
                <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8 animate-fade-in">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Invite Code
                  </label>
                  <div
                    className={`flex items-center gap-3 border-2 rounded-xl px-4 py-3 transition ${
                      codeError
                        ? 'border-red-400 bg-red-50'
                        : 'border-gray-200 focus-within:border-soa-primary'
                    }`}
                  >
                    <Ticket className={`w-5 h-5 ${codeError ? 'text-red-400' : 'text-gray-400'}`} />
                    <input
                      type="text"
                      value={inviteCode}
                      onChange={(e) => {
                        setInviteCode(e.target.value.toUpperCase());
                        setCodeError('');
                      }}
                      placeholder="e.g., SOA-GP-2025"
                      className="flex-1 text-lg font-mono tracking-wider bg-transparent outline-none placeholder:text-gray-300"
                    />
                    {inviteCode && (
                      <button type="button" onClick={() => setInviteCode('')}>
                        <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                      </button>
                    )}
                  </div>

                  {codeError && (
                    <div className="flex items-center gap-2 mt-2 text-red-600 text-sm">
                      <AlertCircle className="w-4 h-4" />
                      <span>{codeError}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={verifyCode}
                    disabled={isVerifying || inviteCode.length < 5}
                    className="w-full mt-6 inline-flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-soa-primary to-soa-secondary text-white rounded-xl font-semibold hover:opacity-90 transition disabled:opacity-50"
                  >
                    {isVerifying ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        Verify Code
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>

                  {/* Example codes hint */}
                  <div className="mt-6 p-4 bg-gray-50 rounded-xl">
                    <p className="text-xs text-gray-500 mb-2">Demo codes for testing:</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.keys(VALID_CODES).map((code) => (
                        <button
                          key={code}
                          type="button"
                          onClick={() => setInviteCode(code)}
                          className="text-xs bg-white border border-gray-200 px-2 py-1 rounded hover:border-soa-primary hover:text-soa-primary transition"
                        >
                          {code}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Verified Organization + Form */}
              {orgInfo && (
                <div className="space-y-6 animate-fade-in">
                  {/* Verified Org Card */}
                  <div className="bg-white rounded-2xl shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-soa-light text-soa-primary rounded-full text-sm font-medium">
                        <CheckCircle2 className="w-4 h-4" />
                        Verified Organization
                      </div>
                      <button
                        type="button"
                        onClick={resetCode}
                        className="text-sm text-soa-primary hover:underline"
                      >
                        Change Code
                      </button>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-soa-light rounded-2xl flex items-center justify-center">
                        <Leaf className="w-8 h-8 text-soa-primary" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">{orgInfo.name}</h3>
                        <p className="text-soa-primary font-medium">{orgInfo.region} Region</p>
                        <p className="text-sm text-gray-500">Manager: {orgInfo.manager_name}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 mt-4 pt-4 border-t border-gray-100 text-sm text-gray-500">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        {orgInfo.member_count} members
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        {orgInfo.region_code}
                      </div>
                    </div>
                  </div>

                  {/* Join Form */}
                  <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
                    <h3 className="text-lg font-bold text-gray-900 mb-6">Your Information</h3>

                    {formError && (
                      <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <span>{formError}</span>
                      </div>
                    )}

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

                      {/* Member Type Selection */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Join as *
                        </label>
                        <div className="grid sm:grid-cols-3 gap-3">
                          {orgInfo.allowed_types.map((type) => {
                            const Icon = memberTypeIcons[type];
                            return (
                              <button
                                key={type}
                                type="button"
                                onClick={() => updateField('member_type', type)}
                                className={`p-3 rounded-xl border-2 text-center transition ${
                                  formData.member_type === type
                                    ? 'border-soa-primary bg-soa-light'
                                    : 'border-gray-200 hover:border-soa-primary/50'
                                }`}
                              >
                                <Icon
                                  className={`w-5 h-5 mx-auto mb-1 ${
                                    formData.member_type === type
                                      ? 'text-soa-primary'
                                      : 'text-gray-400'
                                  }`}
                                />
                                <span
                                  className={`text-sm font-medium ${
                                    formData.member_type === type
                                      ? 'text-soa-primary'
                                      : 'text-gray-700'
                                  }`}
                                >
                                  {memberTypeLabels[type]}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Terms */}
                    <div className="mt-6 p-4 bg-gray-50 rounded-xl text-sm text-gray-600">
                      By joining, you agree to Soil of Africa's Terms of Service and Privacy Policy.
                      Your membership will be reviewed by the regional manager.
                    </div>

                    {/* Submit Button */}
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="w-full mt-6 inline-flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-soa-primary to-soa-secondary text-white rounded-xl font-semibold hover:opacity-90 transition disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Joining...
                        </>
                      ) : (
                        <>
                          Join {orgInfo.region} Region
                          <ArrowRight className="w-5 h-5" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Link to full registration */}
              <p className="text-center mt-8 text-gray-500">
                Don't have an invite code?{' '}
                <Link href="/register" className="text-soa-primary hover:underline font-medium">
                  Register normally
                </Link>
              </p>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
