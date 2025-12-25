'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Header, Footer } from '@/components';
import { FadeIn, SlideIn, ScaleIn, StaggerChildren } from '@/components/animations';
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
  Building2,
  Heart,
} from 'lucide-react';

// Organization info returned from database
interface OrganizationInfo {
  id: string;
  code: string;
  organization_id: string;
  organization_name: string;
  region_id: string;
  region_name: string;
  region_code: string;
  allowed_member_types: string[];
  member_count: number;
}

// All available member types with their display info
const memberTypeConfig: Record<string, { label: string; icon: any; description: string }> = {
  learner: { label: 'Learner', icon: User, description: 'New to SOA, eager to learn' },
  volunteer: { label: 'Volunteer', icon: Heart, description: 'Contribute your time' },
  facilitator: { label: 'Facilitator', icon: Users, description: 'Guide and teach learners' },
  mentor: { label: 'Mentor', icon: Shield, description: 'Senior leadership' },
  staff: { label: 'Staff', icon: Building2, description: 'SOA employee' },
  executive: { label: 'Executive', icon: Shield, description: 'Leadership team' },
};

type MemberType = 'learner' | 'volunteer' | 'facilitator' | 'mentor' | 'staff' | 'executive';

interface FormData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  member_type: MemberType;
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
      const supabase = getSupabase();
      
      // Query the region_invite_codes table
      const { data: inviteData, error: inviteError } = await supabase
        .from('region_invite_codes')
        .select(`
          id,
          code,
          organization_id,
          region_id,
          allowed_member_types,
          is_active,
          organizations:organization_id (
            id,
            name
          ),
          organization_regions:region_id (
            id,
            name,
            code
          )
        `)
        .eq('code', inviteCode.toUpperCase())
        .eq('is_active', true)
        .single();

      if (inviteError || !inviteData) {
        setCodeError('Invalid invite code. Please check and try again.');
        return;
      }

      // Get member count for this region
      const { count: memberCount } = await supabase
        .from('organization_members')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', inviteData.organization_id)
        .eq('region_id', inviteData.region_id);

      const org = inviteData.organizations as any;
      const region = inviteData.organization_regions as any;

      setOrgInfo({
        id: inviteData.id,
        code: inviteData.code,
        organization_id: inviteData.organization_id,
        organization_name: org?.name || 'Soil of Africa',
        region_id: inviteData.region_id,
        region_name: region?.name || 'Unknown Region',
        region_code: region?.code || 'XX',
        allowed_member_types: inviteData.allowed_member_types || ['learner', 'facilitator', 'mentor'],
        member_count: memberCount || 0,
      });
    } catch (error: any) {
      console.error('Code verification error:', error);
      if (error.message?.includes('Supabase URL')) {
        setCodeError('Service temporarily unavailable. Please try again later.');
      } else {
        setCodeError('Failed to verify code. Please try again.');
      }
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
      
      // Check for duplicate email in this organization
      const { data: existingEmail } = await supabase
        .from('organization_members')
        .select('id')
        .eq('organization_id', orgInfo?.organization_id)
        .eq('email', formData.email.toLowerCase())
        .single();

      if (existingEmail) {
        setFormError('This email is already registered. Please use a different email or contact your regional manager.');
        setIsSubmitting(false);
        return;
      }
      
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

      // 3. Create membership record with proper UUIDs
      const { error: memberError } = await supabase.from('organization_members').insert({
        user_id: authData.user?.id,
        organization_id: orgInfo?.organization_id,
        region_id: orgInfo?.region_id,
        member_number: generatedMemberNumber,
        member_type: formData.member_type,
        membership_tier: 'standard',
        membership_status: 'pending',
        seat_status: 'active',
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email.toLowerCase(),
        phone: formData.phone,
        join_date: new Date().toISOString().split('T')[0],
        notes: `Joined via invite code: ${inviteCode.toUpperCase()}`,
      });

      if (memberError) throw memberError;

      // 4. Increment the usage count on the invite code
      await supabase.rpc('increment_invite_code_usage', { code_id: orgInfo?.id });

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
            <ScaleIn>
              <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
                <motion.div 
                  className="w-20 h-20 bg-soa-light rounded-full flex items-center justify-center mx-auto mb-6"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                >
                  <CheckCircle2 className="w-10 h-10 text-soa-primary" />
                </motion.div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Welcome to {orgInfo?.region_name} Region!
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
            </ScaleIn>
          ) : (
            <>
              {/* Header */}
              <div className="text-center mb-8">
                <ScaleIn>
                  <div className="w-20 h-20 bg-gradient-to-br from-soa-primary to-soa-secondary rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Ticket className="w-10 h-10 text-white" />
                  </div>
                </ScaleIn>
                <FadeIn delay={0.1}>
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">Join with Invite Code</h1>
                </FadeIn>
                <SlideIn direction="up" delay={0.2}>
                  <p className="text-gray-500">
                    Enter the invite code you received from your regional manager
                  </p>
                </SlideIn>
              </div>

              {/* Code Input (if not verified) */}
              {!orgInfo && (
                <SlideIn direction="up" delay={0.3}>
                  <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
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

                  {/* Help text */}
                  <div className="mt-6 p-4 bg-gray-50 rounded-xl">
                    <p className="text-sm text-gray-600">
                      Don't have an invite code? Contact your regional manager or{' '}
                      <Link href="/register" className="text-soa-primary hover:underline">
                        register directly
                      </Link>
                      .
                    </p>
                  </div>
                  </div>
                </SlideIn>
              )}

              {/* Verified Organization + Form */}
              {orgInfo && (
                <motion.div 
                  className="space-y-6"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                >
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
                        <h3 className="text-lg font-bold text-gray-900">{orgInfo.organization_name}</h3>
                        <p className="text-soa-primary font-medium">{orgInfo.region_name} Region</p>
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
                          {orgInfo.allowed_member_types.map((type) => {
                            const config = memberTypeConfig[type];
                            if (!config) return null;
                            const Icon = config.icon;
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
                                  {config.label}
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
                          Join {orgInfo.region_name} Region
                          <ArrowRight className="w-5 h-5" />
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
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
