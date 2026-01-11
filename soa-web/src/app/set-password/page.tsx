'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getSupabase } from '@/lib/supabase';
import { Header, Footer } from '@/components';
import { FadeIn } from '@/components/animations';
import {
  Eye,
  EyeOff,
  Lock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
} from 'lucide-react';

function SetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Verify the session on mount
  useEffect(() => {
    const verifySession = async () => {
      try {
        const supabase = getSupabase();
        
        // Check if there's a code in URL (from email link)
        const code = searchParams.get('code');
        
        if (code) {
          // Exchange the code for a session
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          
          if (error) {
            console.error('[SetPassword] Code exchange error:', error);
            setError('This password reset link has expired or is invalid. Please request a new one.');
            setVerifying(false);
            return;
          }
          
          if (data.session?.user) {
            setUserEmail(data.session.user.email || null);
          }
        } else {
          // Check for existing session
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (error || !session) {
            setError('Invalid or expired reset link. Please request a new password reset.');
            setVerifying(false);
            return;
          }
          
          setUserEmail(session.user?.email || null);
        }
        
        setVerifying(false);
      } catch (err) {
        console.error('[SetPassword] Session verification error:', err);
        setError('An error occurred. Please try again or request a new password reset.');
        setVerifying(false);
      }
    };

    verifySession();
  }, [searchParams]);

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    if (!/[A-Z]/.test(pwd)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(pwd)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/[0-9]/.test(pwd)) {
      return 'Password must contain at least one number';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password strength
    const validationError = validatePassword(password);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const supabase = getSupabase();
      
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        throw updateError;
      }

      setSuccess(true);
      
      // Redirect to home page after 3 seconds
      setTimeout(() => {
        router.push('/');
      }, 3000);
    } catch (err: any) {
      console.error('[SetPassword] Update error:', err);
      setError(err.message || 'Failed to set password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while verifying
  if (verifying) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-soa-dark to-black flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center">
          <Loader2 className="w-16 h-16 text-soa-gold mx-auto mb-6 animate-spin" />
          <h1 className="text-2xl font-bold text-white mb-2">Verifying Link</h1>
          <p className="text-gray-300">Please wait while we verify your reset link...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error && !password) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-soa-dark to-black flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-white mb-2">Link Expired</h1>
          <p className="text-gray-300 mb-6">{error}</p>
          <Link
            href="/contact"
            className="inline-block bg-soa-gold text-black font-semibold py-2 px-6 rounded-lg hover:bg-soa-gold/90 transition-colors"
          >
            Contact Support
          </Link>
        </div>
      </div>
    );
  }

  // Show success state
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-soa-dark to-black flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center">
          <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-white mb-2">Password Set! 🎉</h1>
          <p className="text-gray-300 mb-4">
            Your password has been set successfully. You can now sign in to the Soil of Africa app.
          </p>
          <p className="text-sm text-gray-400 mb-6">Redirecting to home page...</p>
          <Link
            href="/download"
            className="inline-block bg-soa-gold text-black font-semibold py-3 px-8 rounded-lg hover:bg-soa-gold/90 transition-colors"
          >
            Download the App
          </Link>
        </div>
      </div>
    );
  }

  // Show password form
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="pt-24 pb-20">
        <div className="max-w-md mx-auto px-4 sm:px-6">
          <FadeIn>
            <div className="bg-white rounded-2xl shadow-sm p-8">
              {/* Header */}
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-soa-light rounded-full flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-8 h-8 text-soa-primary" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Set Your Password</h1>
                <p className="text-gray-600">
                  Create a secure password for your Soil of Africa account
                </p>
                {userEmail && (
                  <p className="text-sm text-soa-primary mt-2">
                    {userEmail}
                  </p>
                )}
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Password Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-soa-primary focus:border-soa-primary pr-12"
                      placeholder="Enter your password"
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm Password
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-soa-primary focus:border-soa-primary"
                    placeholder="Confirm your password"
                    required
                    minLength={8}
                  />
                </div>

                {/* Password Requirements */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Password must contain:</p>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li className={password.length >= 8 ? 'text-green-600' : ''}>
                      • At least 8 characters
                    </li>
                    <li className={/[A-Z]/.test(password) ? 'text-green-600' : ''}>
                      • One uppercase letter
                    </li>
                    <li className={/[a-z]/.test(password) ? 'text-green-600' : ''}>
                      • One lowercase letter
                    </li>
                    <li className={/[0-9]/.test(password) ? 'text-green-600' : ''}>
                      • One number
                    </li>
                  </ul>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-soa-primary text-white font-semibold rounded-xl hover:bg-soa-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Setting Password...
                    </>
                  ) : (
                    'Set Password'
                  )}
                </button>
              </form>
            </div>
          </FadeIn>
        </div>
      </main>

      <Footer />
    </div>
  );
}

// Loading fallback
function SetPasswordLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-soa-dark to-black flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center">
        <Loader2 className="w-16 h-16 text-soa-gold mx-auto mb-6 animate-spin" />
        <h1 className="text-2xl font-bold text-white mb-2">Loading...</h1>
        <p className="text-gray-300">Please wait...</p>
      </div>
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={<SetPasswordLoading />}>
      <SetPasswordContent />
    </Suspense>
  );
}
