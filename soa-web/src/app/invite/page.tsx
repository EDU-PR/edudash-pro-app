'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
// No supabase needed - just redirects

export default function InviteIndexPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = searchParams.get('code');
  const type = searchParams.get('type');
  const token = searchParams.get('token');

  useEffect(() => {
    // Redirect based on invite type
    if (type === 'executive' || type === 'admin') {
      router.replace(`/invite/executive?code=${encodeURIComponent(code || '')}`);
    } else if (type === 'member' || type === 'youth_member') {
      router.replace(`/invite/member?code=${encodeURIComponent(code || '')}`);
    } else if (token) {
      // Admin invites with token
      router.replace(`/invite/admin?token=${encodeURIComponent(token)}`);
    } else if (code) {
      // Default to member invite if code provided
      router.replace(`/invite/member?code=${encodeURIComponent(code)}`);
    } else {
      // No code or type, go to join page
      router.replace('/join');
    }
  }, [code, type, token, router]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-900 to-green-800 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-400 mx-auto"></div>
        <p className="text-white mt-4">Redirecting...</p>
      </div>
    </div>
  );
}
