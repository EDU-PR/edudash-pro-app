'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

interface ExecutiveInviteData {
  organizationName: string;
  regionName: string;
  position: string;
  inviterName?: string;
}

export default function ExecutiveInvitePage() {
  const searchParams = useSearchParams();
  const code = searchParams.get('code');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteData, setInviteData] = useState<ExecutiveInviteData | null>(null);

  useEffect(() => {
    async function validateInvite() {
      if (!code) {
        setError('No invite code provided');
        setLoading(false);
        return;
      }

      try {
        const supabase = createClient();
        
        // Query join_requests for executive invites
        const { data: joinRequest, error: joinError } = await supabase
          .from('join_requests')
          .select(`
            id,
            invite_code,
            requested_role,
            organization_id,
            region_id,
            status,
            invited_by,
            message,
            organizations (name),
            organization_regions (name),
            profiles!join_requests_invited_by_fkey (first_name, last_name)
          `)
          .eq('invite_code', code.toUpperCase())
          .eq('status', 'pending')
          .is('user_id', null)
          .single();

        if (joinError || !joinRequest) {
          setError('Invalid or expired invite code');
          setLoading(false);
          return;
        }

        const org = joinRequest.organizations as any;
        const region = joinRequest.organization_regions as any;
        const inviter = joinRequest.profiles as any;
        
        // Extract position from message or role
        let position = joinRequest.requested_role || 'Executive Member';
        if (joinRequest.message) {
          // Try to extract position from message like "Youth Secretary invite"
          const match = joinRequest.message.match(/^(.+?)\s*invite/i);
          if (match) {
            position = match[1].trim();
          }
        }

        setInviteData({
          organizationName: org?.name || 'Soil of Africa',
          regionName: region?.name || '',
          position: position,
          inviterName: inviter ? `${inviter.first_name} ${inviter.last_name}`.trim() : undefined,
        });
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
          <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Executive Appointment</h1>
          {inviteData.inviterName && (
            <p className="text-gray-600">
              <span className="font-semibold">{inviteData.inviterName}</span> has nominated you
            </p>
          )}
        </div>

        <div className="bg-gradient-to-r from-yellow-50 to-green-50 rounded-xl p-4 mb-6 border border-yellow-200">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-1">Position</p>
            <h2 className="font-bold text-green-800 text-xl">{inviteData.position}</h2>
          </div>
          <hr className="my-3 border-yellow-200" />
          <h3 className="font-semibold text-green-800">{inviteData.organizationName}</h3>
          {inviteData.regionName && (
            <p className="text-green-600 text-sm">{inviteData.regionName}</p>
          )}
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-yellow-800">
            <strong>Invite Code:</strong> {code?.toUpperCase()}
          </p>
          <p className="text-xs text-yellow-600 mt-1">
            Use this code to complete your registration
          </p>
        </div>

        <div className="space-y-3">
          <Link
            href={`/register?code=${encodeURIComponent(code || '')}&type=executive`}
            className="block w-full bg-gradient-to-r from-green-600 to-green-700 text-white py-4 px-6 rounded-xl font-semibold text-center hover:from-green-700 hover:to-green-800 transition shadow-lg"
          >
            Accept Appointment
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
