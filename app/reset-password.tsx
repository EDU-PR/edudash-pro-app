/**
 * Reset Password Route Handler
 * 
 * This is a root-level route handler for the deep link:
 * edudashpro://reset-password
 * 
 * It handles the PKCE flow from Supabase password recovery emails.
 * After Supabase redirects here with the session established,
 * this route renders the actual reset password UI.
 */
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { assertSupabase } from '@/lib/supabase';
import ResetPasswordScreen from './(auth)/reset-password';

export default function ResetPasswordRoute() {
  const params = useLocalSearchParams();
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    const checkAndSetupSession = async () => {
      try {
        const supabase = assertSupabase();
        
        // Check for PKCE code parameter (from web redirect)
        const code = params.code as string | undefined;
        const token_hash = params.token_hash as string | undefined;
        const token = params.token as string | undefined;
        const type = params.type as string | undefined;
        
        console.log('[ResetPasswordRoute] Checking session with params:', { 
          hasCode: !!code,
          hasTokenHash: !!token_hash,
          hasToken: !!token,
          type 
        });

        // Handle PKCE code exchange if present
        if (code) {
          console.log('[ResetPasswordRoute] Processing PKCE code exchange...');
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          
          if (exchangeError) {
            console.error('[ResetPasswordRoute] Code exchange failed:', exchangeError);
            setHasSession(false);
            setChecking(false);
            return;
          }

          if (data.session) {
            console.log('[ResetPasswordRoute] PKCE code exchanged successfully');
            setHasSession(true);
            setChecking(false);
            return;
          }
        }

        // Handle token_hash (legacy flow)
        if (token_hash && type === 'recovery') {
          console.log('[ResetPasswordRoute] Processing token_hash verification...');
          const { data, error: verifyError } = await supabase.auth.verifyOtp({
            token_hash,
            type: 'recovery',
          });

          if (verifyError) {
            console.error('[ResetPasswordRoute] Token verification failed:', verifyError);
            setHasSession(false);
            setChecking(false);
            return;
          }

          if (data.session) {
            console.log('[ResetPasswordRoute] Token verified successfully');
            setHasSession(true);
            setChecking(false);
            return;
          }
        }

        // Handle PKCE token parameter
        if (token && type === 'recovery') {
          console.log('[ResetPasswordRoute] Processing PKCE token...');
          const { data, error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: 'recovery',
          });

          if (verifyError) {
            console.error('[ResetPasswordRoute] PKCE token verification failed:', verifyError);
            setHasSession(false);
            setChecking(false);
            return;
          }

          if (data.session) {
            console.log('[ResetPasswordRoute] PKCE token verified successfully');
            setHasSession(true);
            setChecking(false);
            return;
          }
        }
        
        // Fallback: Check for existing session (PKCE flow may have already set it)
        const { data: { session }, error } = await supabase.auth.getSession();
        
        console.log('[ResetPasswordRoute] Session check:', { 
          hasSession: !!session, 
          userId: session?.user?.id,
          error: error?.message 
        });

        if (session && session.user) {
          // We have a valid session from the PKCE flow
          setHasSession(true);
        } else {
          // No session - the link might be expired or user needs to request new one
          console.log('[ResetPasswordRoute] No valid session found');
          setHasSession(false);
        }
      } catch (e) {
        console.error('[ResetPasswordRoute] Error:', e);
        setHasSession(false);
      } finally {
        setChecking(false);
      }
    };

    // Small delay to ensure Supabase has processed the redirect
    setTimeout(checkAndSetupSession, 500);
  }, [params]);

  // Show loading while checking session
  if (checking) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#00f5ff" />
        <Text style={styles.text}>Verifying reset link...</Text>
      </View>
    );
  }

  // Render the actual reset password screen
  // It will handle both valid and invalid session states
  return <ResetPasswordScreen />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0a0f',
    gap: 16,
  },
  text: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
  },
});
