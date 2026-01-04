'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

interface AdminInviteData {
  email: string;
  organizationName: string;
  role: string;
  inviterName?: string;
}

export default function AdminInvitePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteData, setInviteData] = useState<AdminInviteData | null>(null);

  useEffect(() => {
    async function validateInvite() {
      if (!token) {
        setError('No invite token provided');
        setLoading(false);
        return;
      }

      try {
        const supabase = createClient();
        
        // Query invitations table for admin invites
        const { data: invitation, error: inviteError } = await supabase
          .from('invitations')
          .select(`
            id,
            email,
            role,
            organization_id,
            invite_token,
            status,
            expires_at,
            invited_by,
            organizations (name),
            profiles!invitations_invited_by_fkey (first_name, last_name)
          `)
          .eq('invite_token', token)
          .eq('status', 'pending')
          .gt('expires_at', new Date().toISOString())
          .single();

        if (inviteError || !invitation) {
          setError('Invalid or expired invite token');
          setLoading(false);
          return;
        }

        const org = invitation.organizations as any;
        const inviter = invitation.profiles as any;
        
        setInviteData({
          email: invitation.email,
          organizationName: org?.name || 'Soil of Africa',
          role: invitation.role,
          inviterName: inviter ? `${inviter.first_name} ${inviter.last_name}`.trim() : undefined,
        });
      } catch (err) {
        console.error('Error validating invite:', err);
        setError('Failed to validate invite token');
      } finally {
        setLoading(false);
      }
    }

    validateInvite();
  }, [token]);

  const getRoleDisplayName = (role: string) => {
    const roleNames: Record<string, string> = {
      'admin': 'Administrator',
      'principal': 'Principal',
      'teacher': 'Teacher',
      'parent': 'Parent',
      'youth_president': 'Youth President',
      'youth_secretary': 'Youth Secretary',
      'youth_treasurer': 'Youth Treasurer',
      'youth_member': 'Youth Member',
    };
    return roleNames[role] || role;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-900 to-green-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-400 mx-auto"></div>
          <p className="text-white mt-4">Validating invite...</p>
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
          <p className="text-gray-600 mb-6">{error || 'This invite link is invalid or has expired.'}</p>
          <div className="space-y-3">
            <Link
              href="/register"
              className="block w-full bg-green-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-green-700 transition"
            >
              Register New Account
            </Link>
            <Link
              href="/"
              className="block w-full bg-gray-100 text-gray-700 py-3 px-6 rounded-lg font-semibold hover:bg-gray-200 transition"
            >
              Go to Homepage
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
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Admin Invitation</h1>
          {inviteData.inviterName && (
            <p className="text-gray-600">
              <span className="font-semibold">{inviteData.inviterName}</span> has invited you
            </p>
          )}
        </div>

        <div className="bg-blue-50 rounded-xl p-4 mb-6 border border-blue-200">
          <div className="text-center mb-3">
            <p className="text-sm text-gray-600 mb-1">Role</p>
            <h2 className="font-bold text-blue-800 text-xl">{getRoleDisplayName(inviteData.role)}</h2>
          </div>
          <hr className="my-3 border-blue-200" />
          <h3 className="font-semibold text-green-800">{inviteData.organizationName}</h3>
          <p className="text-sm text-gray-600 mt-1">{inviteData.email}</p>
        </div>

        <div className="space-y-3">
          <Link
            href={`/register?token=${encodeURIComponent(token || '')}&email=${encodeURIComponent(inviteData.email)}`}
            className="block w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-4 px-6 rounded-xl font-semibold text-center hover:from-blue-700 hover:to-blue-800 transition shadow-lg"
          >
            Accept Invitation
          </Link>
          
          <Link
            href="/download"
            className="block w-full bg-gray-100 text-gray-700 py-3 px-6 rounded-lg font-semibold text-center hover:bg-gray-200 transition"
          >
            Download Mobile App
          </Link>
        </div>

        <p className="text-center text-gray-500 text-sm mt-6">
          By accepting, you agree to our{' '}
          <Link href="/about" className="text-green-600 hover:underline">
            Terms of Service
          </Link>
        </p>
      </div>
    </div>
  );
}
