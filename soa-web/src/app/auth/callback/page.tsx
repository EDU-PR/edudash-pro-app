'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';

function AuthCallbackContent() {
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
        const type = searchParams.get('type');
        const flow = searchParams.get('flow');
        const errorDescription = searchParams.get('error_description');

        if (errorDescription) {
          setStatus('error');
          setMessage(errorDescription);
          return;
        }

        // Check if this is a password reset flow
        if (type === 'password-reset' || type === 'recovery') {
          // Redirect to set-password page with the code
          if (code) {
            router.replace(`/set-password?code=${code}`);
          } else {
            router.replace('/set-password');
          }
          return;
        }

        // Check if this is an email confirmation from the OLD registration flow
        // (where users needed to set password after email confirmation)
        // Keep this for backwards compatibility with users who registered before the change
        if (type === 'email-confirmation') {
          if (code) {
            // Exchange code for session first
            const { data, error } = await supabase.auth.exchangeCodeForSession(code);
            
            if (error) {
              console.error('Auth callback error:', error);
              setStatus('error');
              setMessage(error.message || 'Failed to verify email. Please try again.');
              return;
            }
            
            // Redirect to set-password page to let user set their password
            router.replace('/set-password');
          } else {
            router.replace('/set-password');
          }
          return;
        }

        // Handle NEW signup flow - user already set password during registration
        // Just verify email and show success message
        if (type === 'signup') {
          if (code) {
            // Exchange code for session
            const { data, error } = await supabase.auth.exchangeCodeForSession(code);
            
            if (error) {
              console.error('Auth callback error:', error);
              setStatus('error');
              setMessage(error.message || 'Failed to verify email. Please try again.');
              return;
            }
            
            // Email verified! User can now sign in with their password
            setStatus('success');
            setMessage('Your email has been verified! You can now sign in with your email and password.');
            
            // Sign out the temporary session created by exchangeCodeForSession
            // so user can properly sign in through the login page
            await supabase.auth.signOut();
            
            // Redirect to sign-in page after a delay
            setTimeout(() => {
              router.push('/signin');
            }, 3000);
          } else {
            // No code provided, just show success and redirect to sign-in
            setStatus('success');
            setMessage('Your email has been verified! You can now sign in.');
            setTimeout(() => {
              router.push('/signin');
            }, 3000);
          }
          return;
        }

        if (code) {
          // Exchange code for session
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          
          if (error) {
            console.error('Auth callback error:', error);
            setStatus('error');
            setMessage(error.message || 'Failed to verify email. Please try again.');
            return;
          }

          // Check if this is actually a recovery/password reset based on session
          // Supabase may not pass type param, but session will indicate recovery
          if (data.session?.user?.recovery_sent_at) {
            router.replace('/set-password');
            return;
          }
        }

        // Success - this is email verification
        // Sign out any session and redirect to sign-in for a clean login experience
        await supabase.auth.signOut();
        setStatus('success');
        setMessage('Email verified successfully! You can now sign in to the Soil of Africa platform.');
        
        // Redirect to sign-in page after a delay (not home page)
        setTimeout(() => {
          router.push('/signin');
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
            <p className="text-sm text-gray-400">Redirecting you to sign in...</p>
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

// Loading fallback for Suspense
function AuthCallbackLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-soa-dark to-black flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center">
        <div className="w-16 h-16 border-4 border-soa-gold border-t-transparent rounded-full animate-spin mx-auto mb-6" />
        <h1 className="text-2xl font-bold text-white mb-2">Loading...</h1>
        <p className="text-gray-300">Please wait...</p>
      </div>
    </div>
  );
}

// Wrap in Suspense for useSearchParams
export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<AuthCallbackLoading />}>
      <AuthCallbackContent />
    </Suspense>
  );
}
