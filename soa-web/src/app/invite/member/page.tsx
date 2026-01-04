'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

export default function MemberInvitePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = searchParams.get('code');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteData, setInviteData] = useState<{
    organizationName: string;
    regionName: string;
    inviterName?: string;
  } | null>(null);

  useEffect(() => {
    async function validateInvite() {
      if (!code) {
        setError('No invite code provided');
        setLoading(false);
        return;
      }

      try {
        const supabase = createClient();
        
        // First try join_requests table (youth member invites)
        const { data: joinRequest, error: joinError } = await supabase
          .from('join_requests')
          .select(`
            id,
            invite_code,
            requested_role,
            organization_id,
            status,
            invited_by,
            organizations (name),
            profiles!join_requests_invited_by_fkey (first_name, last_name)
          `)
          .eq('invite_code', code.toUpperCase())
          .eq('status', 'pending')
          .is('user_id', null)
          .single();

        if (joinRequest && !joinError) {
          const org = joinRequest.organizations as any;
          const inviter = joinRequest.profiles as any;
          
          setInviteData({
            organizationName: org?.name || 'Soil of Africa',
            regionName: '',
            inviterName: inviter ? `${inviter.first_name} ${inviter.last_name}`.trim() : undefined,
          });
          setLoading(false);
          return;
        }

        // Try region_invite_codes table
        const { data: regionInvite, error: regionError } = await supabase
          .from('region_invite_codes')
          .select(`
            id,
            code,
            organization_id,
            region_id,
            organizations (name),
            organization_regions (name)
          `)
          .eq('code', code.toUpperCase())
          .eq('is_active', true)
          .single();

        if (regionInvite && !regionError) {
          const org = regionInvite.organizations as any;
          const region = regionInvite.organization_regions as any;
          
          setInviteData({
            organizationName: org?.name || 'Soil of Africa',
            regionName: region?.name || '',
          });
          setLoading(false);
          return;
        }

        setError('Invalid or expired invite code');
      } catch (err) {
        console.error('Error validating invite:', err);
        setError('Failed to validate invite code');
      } finally {
        setLoading(false);
      }
    }

    validateInvite();
  }, [code]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-900 to-green-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-400 mx-auto"></div>
          <p className="text-white mt-4">Validating invite code...</p>
        </div>
      </div>
    );
  }

  if (error || !inviteData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-900 to-green-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Invite</h1>
          <p className="text-gray-600 mb-6">{error || 'This invite code is invalid or has expired.'}</p>
          <div className="space-y-3">
            <Link
              href="/join"
              className="block w-full bg-green-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-green-700 transition"
            >
              Enter Code Manually
            </Link>
            <Link
              href="/register"
              className="block w-full bg-gray-100 text-gray-700 py-3 px-6 rounded-lg font-semibold hover:bg-gray-200 transition"
            >
              Register New Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-900 to-green-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">You&apos;re Invited!</h1>
          {inviteData.inviterName && (
            <p className="text-gray-600">
              <span className="font-semibold">{inviteData.inviterName}</span> has invited you to join
            </p>
          )}
        </div>

        <div className="bg-green-50 rounded-xl p-4 mb-6">
          <h2 className="font-bold text-green-800 text-lg">{inviteData.organizationName}</h2>
          {inviteData.regionName && (
            <p className="text-green-600">{inviteData.regionName}</p>
          )}
          <p className="text-sm text-green-700 mt-2">Youth Wing Membership</p>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-yellow-800">
            <strong>Invite Code:</strong> {code?.toUpperCase()}
          </p>
          <p className="text-xs text-yellow-600 mt-1">
            Keep this code handy during registration
          </p>
        </div>

        <div className="space-y-3">
          <Link
            href={`/register?code=${encodeURIComponent(code || '')}&type=youth_member`}
            className="block w-full bg-green-600 text-white py-4 px-6 rounded-xl font-semibold text-center hover:bg-green-700 transition shadow-lg"
          >
            Accept Invite & Register
          </Link>
          
          <Link
            href="/download"
            className="block w-full bg-gray-100 text-gray-700 py-3 px-6 rounded-lg font-semibold text-center hover:bg-gray-200 transition"
          >
            Download Mobile App Instead
          </Link>
        </div>

        <p className="text-center text-gray-500 text-sm mt-6">
          Already have an account?{' '}
          <Link href="/join" className="text-green-600 hover:underline font-medium">
            Sign in with code
          </Link>
        </p>
      </div>
    </div>
  );
}
