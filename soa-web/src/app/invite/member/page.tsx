'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import Link from 'next/link';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.edudashpro';
const APP_STORE_URL = 'https://apps.apple.com/app/edudash-pro/id6478437234';
const APP_SCHEME = 'edudashpro';

export default function MemberInvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-green-900 to-green-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-400 mx-auto"></div>
          <p className="text-white mt-4">Loading...</p>
        </div>
      </div>
    }>
      <MemberInviteContent />
    </Suspense>
  );
}

function MemberInviteContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get('code') || '';
  
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop');
  const [attemptedOpen, setAttemptedOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [inviteData, setInviteData] = useState<{
    organizationName: string;
    regionName: string;
    inviterName?: string;
  } | null>(null);

  useEffect(() => {
    // Detect platform
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setPlatform('ios');
    } else if (/android/.test(ua)) {
      setPlatform('android');
    }
    
    validateInvite();
  }, []);

  // Auto-attempt to open app on mobile after validation
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
      
      // First try join_requests table (youth member invites)
      const { data: joinRequest } = await supabase
        .from('join_requests')
        .select(`
          id,
          invite_code,
          organization_id,
          invited_by,
          organizations (name),
          profiles!join_requests_invited_by_fkey (first_name, last_name)
        `)
        .eq('invite_code', code.toUpperCase())
        .eq('status', 'pending')
        .is('user_id', null)
        .single();

      if (joinRequest) {
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
      const { data: regionInvite } = await supabase
        .from('region_invite_codes')
        .select(`
          id,
          code,
          organizations (name),
          organization_regions (name)
        `)
        .eq('code', code.toUpperCase())
        .eq('is_active', true)
        .single();

      if (regionInvite) {
        const org = regionInvite.organizations as any;
        const region = regionInvite.organization_regions as any;
        
        setInviteData({
          organizationName: org?.name || 'Soil of Africa',
          regionName: region?.name || '',
        });
        setLoading(false);
        return;
      }

      // Code not found but still show page - let user try in app
      setInviteData({
        organizationName: 'Soil of Africa',
        regionName: '',
      });
    } catch (err) {
      console.error('Error validating invite:', err);
      setInviteData({
        organizationName: 'Soil of Africa',
        regionName: '',
      });
    } finally {
      setLoading(false);
    }
  }

  const openInApp = () => {
    setAttemptedOpen(true);
    const deepLink = `${APP_SCHEME}://invite/member?code=${encodeURIComponent(code)}`;
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
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">You&apos;re Invited!</h1>
          {inviteData?.inviterName && (
            <p className="text-gray-600">
              <span className="font-semibold">{inviteData.inviterName}</span> has invited you to join
            </p>
          )}
        </div>

        <div className="bg-green-50 rounded-xl p-4 mb-6">
          <h2 className="font-bold text-green-800 text-lg">{inviteData?.organizationName || 'Soil of Africa'}</h2>
          {inviteData?.regionName && (
            <p className="text-green-600">{inviteData.regionName}</p>
          )}
          <p className="text-sm text-green-700 mt-2">Youth Wing Membership</p>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-yellow-800">
            <strong>Invite Code:</strong> {code?.toUpperCase() || 'N/A'}
          </p>
          <p className="text-xs text-yellow-600 mt-1">
            This code will be used automatically when you open the app
          </p>
        </div>

        {/* Mobile: Open in App button */}
        {(platform === 'android' || platform === 'ios') && (
          <div className="space-y-3 mb-4">
            <button
              onClick={openInApp}
              className="block w-full bg-green-600 text-white py-4 px-6 rounded-xl font-semibold text-center hover:bg-green-700 transition shadow-lg"
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

        {/* Download buttons */}
        <div className="space-y-3">
          {platform === 'desktop' ? (
            <>
              <p className="text-center text-gray-600 text-sm mb-3">
                Download the app to accept your invitation:
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
