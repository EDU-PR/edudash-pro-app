import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { assertSupabase } from '@/lib/supabase';

export default function AuthCallback() {
  const handled = useRef(false);
  const [message, setMessage] = useState('Finalizing sign-in…');

  async function handleCallback(urlStr?: string | null) {
    if (handled.current) return;
    handled.current = true;

    try {
      setMessage('Processing authentication...');
      
      if (!urlStr) {
        // Try to get URL from window location on web
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          urlStr = window.location.href;
        } else {
          throw new Error('No URL provided');
        }
      }

      console.log('[AuthCallback] Processing URL:', urlStr);

      const supabase = await assertSupabase();

      // Case 1: OAuth callback (hash fragment with tokens)
      if (urlStr.includes('#access_token') || urlStr.includes('access_token=')) {
        setMessage('Validating OAuth session...');
        
        // Try hash fragment first
        let access_token: string | null = null;
        let refresh_token: string | null = null;
        
        if (urlStr.includes('#')) {
          const hash = urlStr.slice(urlStr.indexOf('#') + 1);
          const params = new URLSearchParams(hash);
          access_token = params.get('access_token');
          refresh_token = params.get('refresh_token');
        }
        
        // Also try query params
        if (!access_token) {
          try {
            const url = new URL(urlStr);
            access_token = url.searchParams.get('access_token');
            refresh_token = url.searchParams.get('refresh_token');
          } catch {
            // URL parsing failed, try manual extraction
            const match = urlStr.match(/access_token=([^&]+)/);
            if (match) access_token = match[1];
            const refreshMatch = urlStr.match(/refresh_token=([^&]+)/);
            if (refreshMatch) refresh_token = refreshMatch[1];
          }
        }

        if (access_token) {
          const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token: refresh_token || '',
          });

          if (error) throw error;

          setMessage('Sign-in successful! Redirecting...');
          console.log('[AuthCallback] OAuth sign-in successful');
          
          // Small delay for better UX
          setTimeout(() => {
            router.replace('/profiles-gate');
          }, 500);
          
          return;
        }
      }

      // Case 2: Magic link / Email verification (query params with token_hash or token for PKCE)
      if (urlStr.includes('token_hash=') || urlStr.includes('token_hash%3D') || 
          urlStr.includes('token=') || urlStr.includes('token%3D') ||
          urlStr.includes('code=') || urlStr.includes('code%3D')) {
        setMessage('Verifying magic link...');
        
        let token_hash: string | null = null;
        let token: string | null = null;
        let code: string | null = null;
        let typeParam: string | null = null;
        
        try {
          // Handle both edudashpro:// scheme and https:// URLs
          const url = new URL(urlStr.replace('edudashpro://', 'https://app.edudashpro.org.za/'));
          token_hash = url.searchParams.get('token_hash');
          token = url.searchParams.get('token');
          code = url.searchParams.get('code');
          typeParam = url.searchParams.get('type');
        } catch {
          // Manual extraction for malformed URLs
          const hashMatch = urlStr.match(/token_hash=([^&]+)/);
          if (hashMatch) token_hash = decodeURIComponent(hashMatch[1]);
          const tokenMatch = urlStr.match(/token=([^&]+)/);
          if (tokenMatch) token = decodeURIComponent(tokenMatch[1]);
          const codeMatch = urlStr.match(/code=([^&]+)/);
          if (codeMatch) code = decodeURIComponent(codeMatch[1]);
          const typeMatch = urlStr.match(/type=([^&]+)/);
          if (typeMatch) typeParam = decodeURIComponent(typeMatch[1]);
        }

        console.log('[AuthCallback] Magic link params:', { 
          token_hash: token_hash?.slice(0, 20) + '...', 
          token: token?.slice(0, 20) + '...',
          code: code ? 'present' : 'null',
          type: typeParam 
        });

        // Valid OTP types for Supabase
        type OtpType = 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change' | 'email';
        const validTypes: OtpType[] = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'];
        const type: OtpType = validTypes.includes(typeParam as OtpType) ? (typeParam as OtpType) : 'magiclink';

        // Handle PKCE flow with code parameter
        if (code) {
          console.log('[AuthCallback] Processing PKCE code exchange...');
          
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);

          if (error) {
            console.error('[AuthCallback] Code exchange failed:', error);
            throw error;
          }

          console.log('[AuthCallback] Code exchanged successfully, session:', data.session ? 'exists' : 'null');

          if (!data.session) {
            throw new Error('Authentication succeeded but no session was created. Please try again.');
          }

          setMessage('Sign-in successful! Redirecting...');
          console.log('[AuthCallback] PKCE magic link successful, user:', data.session.user.email);
          
          // Give AuthContext time to process the SIGNED_IN event
          setTimeout(() => {
            if (type === 'recovery') {
              router.replace('/(auth)/reset-password');
            } else {
              router.replace('/profiles-gate');
            }
          }, 800);
          
          return;
        }

        // Handle token_hash (legacy flow)
        if (token_hash) {
          console.log('[AuthCallback] Verifying OTP with type:', type);
          
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash,
            type,
          });

          if (error) {
            console.error('[AuthCallback] OTP verification failed:', error);
            throw error;
          }

          console.log('[AuthCallback] OTP verified successfully, session:', data.session ? 'exists' : 'null');
          
          // If verifyOtp returned a session, set it explicitly
          if (data.session) {
            console.log('[AuthCallback] Setting session from verifyOtp response');
            const { error: setSessionError } = await supabase.auth.setSession({
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
            });
            
            if (setSessionError) {
              console.error('[AuthCallback] Failed to set session:', setSessionError);
              throw setSessionError;
            }
            console.log('[AuthCallback] Session set successfully');
          }
          
          // Wait a moment for the auth state change to propagate
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // Double-check session is set
          const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
          console.log('[AuthCallback] Current session after verify:', sessionData.session ? 'exists' : 'null');

          if (!sessionData.session) {
            throw new Error('Authentication succeeded but no session was created. Please try again.');
          }

          setMessage('Sign-in successful! Redirecting...');
          console.log('[AuthCallback] Magic link verification successful, user:', sessionData.session.user.email);
          
          // Give AuthContext time to process the SIGNED_IN event
          setTimeout(() => {
            if (type === 'recovery') {
              router.replace('/(auth)/reset-password');
            } else {
              router.replace('/profiles-gate');
            }
          }, 800);
          
          return;
        }

        // Handle PKCE token parameter (if present but no code)
        if (token && typeParam === 'magiclink') {
          console.log('[AuthCallback] Processing PKCE token for magic link...');
          // For PKCE tokens, we need to verify them differently
          // Try using verifyOtp with the token
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: 'magiclink',
          });

          if (error) {
            console.error('[AuthCallback] PKCE token verification failed:', error);
            // If verifyOtp fails, the token might need different handling
            // Redirect to sign-in with error
            throw new Error('Magic link verification failed. Please request a new link.');
          }

          if (data.session) {
            console.log('[AuthCallback] PKCE token verified, session created');
            setMessage('Sign-in successful! Redirecting...');
            
            setTimeout(() => {
              router.replace('/profiles-gate');
            }, 800);
            
            return;
          }
        }
      }

      // Case 3: Error in callback
      if (urlStr.includes('error=')) {
        let error: string | null = null;
        let error_description: string | null = null;
        
        try {
          const url = new URL(urlStr.replace('edudashpro://', 'https://app.edudashpro.org.za/'));
          error = url.searchParams.get('error');
          error_description = url.searchParams.get('error_description');
        } catch {
          const errorMatch = urlStr.match(/error=([^&]+)/);
          if (errorMatch) error = decodeURIComponent(errorMatch[1]);
        }
        
        console.error('[AuthCallback] OAuth error:', error, error_description);
        throw new Error(error_description || error || 'Authentication failed');
      }

      // No recognized callback pattern
      console.warn('[AuthCallback] Unrecognized callback pattern, URL:', urlStr);
      setMessage('Could not process authentication. Redirecting to sign-in...');
      setTimeout(() => {
        router.replace('/(auth)/sign-in');
      }, 2000);

    } catch (e: any) {
      console.error('[AuthCallback] Error:', e);
      setMessage(e?.message || 'Authentication failed. Please try again.');
      
      // Redirect to sign-in after error
      setTimeout(() => {
        router.replace('/(auth)/sign-in');
      }, 3000);
    }
  }

  useEffect(() => {
    // Get initial URL
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleCallback(url);
      } else if (Platform.OS === 'web' && typeof window !== 'undefined') {
        // On web, check window.location
        handleCallback(window.location.href);
      }
    });

    // Listen for deep link events
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleCallback(url);
    });

    return () => subscription.remove();
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#00f5ff" />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0b1220',
    gap: 16,
    padding: 24,
  },
  text: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
  },
});

