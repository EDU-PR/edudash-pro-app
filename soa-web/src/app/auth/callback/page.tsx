'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your email...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const supabase = getSupabase();
        
        // Get the code from URL (Supabase PKCE flow)
        const code = searchParams.get('code');
        const flow = searchParams.get('flow');
        const errorDescription = searchParams.get('error_description');

        if (errorDescription) {
          setStatus('error');
          setMessage(errorDescription);
          return;
        }

        if (code) {
          // Exchange code for session
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          
          if (error) {
            console.error('Auth callback error:', error);
            setStatus('error');
            setMessage(error.message || 'Failed to verify email. Please try again.');
            return;
          }
        }

        // Success!
        setStatus('success');
        setMessage('Email verified successfully! You can now sign in to the Soil of Africa app.');
        
        // Redirect to home or sign-in page after a delay
        setTimeout(() => {
          router.push('/');
        }, 3000);
        
      } catch (error) {
        console.error('Auth callback error:', error);
        setStatus('error');
        setMessage('An unexpected error occurred. Please try again.');
      }
    };

    handleCallback();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-soa-dark to-black flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center">
        {status === 'loading' && (
          <>
            <div className="w-16 h-16 border-4 border-soa-gold border-t-transparent rounded-full animate-spin mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-white mb-2">Verifying Email</h1>
            <p className="text-gray-300">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Email Verified! 🎉</h1>
            <p className="text-gray-300 mb-6">{message}</p>
            <p className="text-sm text-gray-400">Redirecting you to the home page...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Verification Failed</h1>
            <p className="text-gray-300 mb-6">{message}</p>
            <button
              onClick={() => router.push('/')}
              className="bg-soa-gold text-black font-semibold py-2 px-6 rounded-lg hover:bg-soa-gold/90 transition-colors"
            >
              Go to Home
            </button>
          </>
        )}
      </div>
    </div>
  );
}
