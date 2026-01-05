'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import Link from 'next/link';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.edudashpro';
const APP_STORE_URL = 'https://apps.apple.com/app/edudash-pro/id6478437234';
const APP_SCHEME = 'edudashpro';

interface ExecutiveInviteData {
  organizationName: string;
  regionName: string;
  position: string;
  inviterName?: string;
}

export default function ExecutiveInvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-green-900 to-green-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-400 mx-auto"></div>
          <p className="text-white mt-4">Loading...</p>
        </div>
      </div>
    }>
      <ExecutiveInviteContent />
    </Suspense>
  );
}

function ExecutiveInviteContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get('code') || '';
  
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop');
  const [attemptedOpen, setAttemptedOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [inviteData, setInviteData] = useState<ExecutiveInviteData | null>(null);

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setPlatform('ios');
    } else if (/android/.test(ua)) {
      setPlatform('android');
    }
    validateInvite();
  }, []);

  useEffect(() => {
    if (code && !loading && (platform === 'android' || platform === 'ios') && !attemptedOpen) {
      const timer = setTimeout(() => openInApp(), 300);
      return () => clearTimeout(timer);
    }
  }, [code, loading, platform, attemptedOpen]);

  async function validateInvite() {
    if (!code) {
      setLoading(false);
      return;
    }

    try {
      const supabase = getSupabase();
      
      const { data: joinRequest } = await supabase
        .from('join_requests')
        .select(`
          id,
          invite_code,
          requested_role,
          organization_id,
          region_id,
          message,
          invited_by,
          organizations (name),
          organization_regions (name)
        `)
        .eq('invite_code', code.toUpperCase())
        .eq('status', 'pending')
        .is('user_id', null)
        .maybeSingle();

      if (joinRequest) {
        const org = joinRequest.organizations as any;
        const region = joinRequest.organization_regions as any;
        
        // Fetch inviter profile separately (FK is to auth.users, not profiles)
        let inviterName: string | undefined;
        if (joinRequest.invited_by) {
          const { data: inviterProfile } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('id', joinRequest.invited_by)
            .maybeSingle();
          if (inviterProfile) {
            inviterName = `${inviterProfile.first_name || ''} ${inviterProfile.last_name || ''}`.trim() || undefined;
          }
        }
        
        let position = joinRequest.requested_role || 'Executive Member';
        if (joinRequest.message) {
          const match = joinRequest.message.match(/^(.+?)\s*invite/i);
          if (match) position = match[1].trim();
        }

        setInviteData({
          organizationName: org?.name || 'Soil of Africa',
          regionName: region?.name || '',
          position,
          inviterName,
        });
      } else {
        setInviteData({
          organizationName: 'Soil of Africa',
          regionName: '',
          position: 'Executive Member',
        });
      }
    } catch (err) {
      console.error('Error validating invite:', err);
      setInviteData({
        organizationName: 'Soil of Africa',
        regionName: '',
        position: 'Executive Member',
      });
    } finally {
      setLoading(false);
    }
  }

  const openInApp = () => {
    setAttemptedOpen(true);
    const deepLink = `${APP_SCHEME}://invite/executive?code=${encodeURIComponent(code)}`;
    window.location.href = deepLink;
  };

  const getStoreUrl = () => platform === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;
  const getStoreName = () => platform === 'ios' ? 'App Store' : 'Google Play';

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-900 to-green-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-400 mx-auto"></div>
          <p className="text-white mt-4">Loading...</p>
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
          {inviteData?.inviterName && (
            <p className="text-gray-600">
              <span className="font-semibold">{inviteData.inviterName}</span> has nominated you
            </p>
          )}
        </div>

        <div className="bg-gradient-to-r from-yellow-50 to-green-50 rounded-xl p-4 mb-6 border border-yellow-200">
          <div className="text-center mb-3">
            <p className="text-sm text-gray-600 mb-1">Position</p>
            <h2 className="font-bold text-green-800 text-xl">{inviteData?.position}</h2>
          </div>
          <hr className="my-3 border-yellow-200" />
          <h3 className="font-semibold text-green-800">{inviteData?.organizationName}</h3>
          {inviteData?.regionName && (
            <p className="text-green-600 text-sm">{inviteData.regionName}</p>
          )}
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-yellow-800">
            <strong>Invite Code:</strong> {code?.toUpperCase() || 'N/A'}
          </p>
          <p className="text-xs text-yellow-600 mt-1">
            This code will be used automatically when you open the app
          </p>
        </div>

        {(platform === 'android' || platform === 'ios') && (
          <div className="space-y-3 mb-4">
            <button
              onClick={openInApp}
              className="block w-full bg-gradient-to-r from-green-600 to-green-700 text-white py-4 px-6 rounded-xl font-semibold text-center hover:from-green-700 hover:to-green-800 transition shadow-lg"
            >
              Open in App
            </button>
            
            {attemptedOpen && (
              <p className="text-center text-gray-500 text-sm">
                App didn&apos;t open?{' '}
                <a 
                  href={getStoreUrl()} 
                  className="text-green-600 hover:underline font-medium"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Download from {getStoreName()}
                </a>
              </p>
            )}
          </div>
        )}

        <div className="space-y-3">
          {platform === 'desktop' ? (
            <>
              <p className="text-center text-gray-600 text-sm mb-3">
                Download the app to accept your appointment:
              </p>
              <div className="flex gap-3">
                <a
                  href={PLAY_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-black text-white py-3 px-4 rounded-lg font-semibold text-center hover:bg-gray-800 transition text-sm"
                >
                  Google Play
                </a>
                <a
                  href={APP_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-black text-white py-3 px-4 rounded-lg font-semibold text-center hover:bg-gray-800 transition text-sm"
                >
                  App Store
                </a>
              </div>
            </>
          ) : (
            <a
              href={getStoreUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-gray-100 text-gray-700 py-3 px-6 rounded-lg font-semibold text-center hover:bg-gray-200 transition"
            >
              Download from {getStoreName()}
            </a>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200">
          <p className="text-center text-gray-500 text-xs">
            After installing the app, use invite code <strong>{code?.toUpperCase()}</strong> to complete registration
          </p>
        </div>
      </div>
    </div>
  );
}
