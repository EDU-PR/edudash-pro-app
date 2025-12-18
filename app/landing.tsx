import React, { useEffect, useMemo, useState } from 'react';
import { View, ActivityIndicator, Text, Platform, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { assertSupabase } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';

// Central landing handler for deep links
// Supports flows:
// - Email confirmation: .../landing?type=email&token_hash=XYZ or .../landing?flow=email-confirm&token_hash=XYZ
// - Parent invite: .../landing?flow=invite-parent&code=ABCD1234
// - Generic: If opened inside the app, route to appropriate screen
export default function LandingHandler() {
  const params = useLocalSearchParams<any>();
  const [status, setStatus] = useState<'loading'|'ready'|'error'|'done'>('loading');
  const [message, setMessage] = useState<string>('');
  const [openAppPath, setOpenAppPath] = useState<string>('/');
  const { t } = useTranslation();

  const isWeb = Platform.OS === 'web';
  const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.edudashpro';

  const query = useMemo(() => {
    const q: Record<string, string> = {};
    // Normalize incoming params (expo-router passes them as strings | string[])
    Object.entries(params || {}).forEach(([k, v]) => {
      if (Array.isArray(v)) q[k] = String(v[0]);
      else if (v != null) q[k] = String(v);
    });
    return q;
  }, [params]);

  // Attempt to open the native app via custom scheme with fallback to Play Store on web
  const tryOpenApp = (pathAndQuery: string) => {
    if (!isWeb) return; // Native environment already inside app
    // IMPORTANT: Use triple-slash so Android doesn't treat the first segment as hostname.
    // Example: `edudashpro:///screens/payments/return?...`
    const schemeUrl = `edudashpro:///${pathAndQuery.replace(/^\//, '')}`;

    let didHide = false;
    const visibilityHandler = () => {
      if (document.hidden) didHide = true;
    };
    document.addEventListener('visibilitychange', visibilityHandler);

    // Immediate redirect via location.replace (more reliable than href on mobile)
    window.location.replace(schemeUrl);

    // After a short delay, if we are still visible, keep the page in a "ready" state.
    // NOTE: On Android, an "Open with" chooser may not immediately hide the page,
    // so we should avoid falsely claiming the app isn't installed.
    setTimeout(() => {
      document.removeEventListener('visibilitychange', visibilityHandler);
      if (!didHide) {
        setStatus('ready');
        setMessage(
          t('landing.open_prompt', {
            defaultValue: 'If prompted, choose EduDash Pro to open. If nothing happens, you can install the app from Google Play.',
          })
        );
      }
    }, 6000);
  };

  useEffect(() => {
    const run = async () => {
      try {
        const flow = (query.flow || query.type || '').toLowerCase();
        // Default target for the "Open app" CTA (can be overridden by flows below)
        setOpenAppPath(query.token_hash ? '(auth)/sign-in?emailVerified=true' : '/');

        // EMAIL CONFIRMATION: verify via token_hash if provided
        const tokenHash = query.token_hash || query.token || '';
        if ((flow === 'email-confirm' || query.type === 'email') && tokenHash) {
          setMessage(t('landing.verifying_email', { defaultValue: 'Verifying your email...' }));
          try {
            const { data, error } = await assertSupabase().auth.verifyOtp({ token_hash: tokenHash, type: 'email' });
            if (error) throw error;
            
            setMessage(t('landing.email_verified', { defaultValue: 'Email verified! Redirecting to sign in...' }));
            setStatus('done');
            
            // On native, route to sign-in
            if (!isWeb) {
              // Sign out user first so they need to sign in with verified credentials
              await assertSupabase().auth.signOut();
              // Small delay to show success message
              setTimeout(() => {
                router.replace('/(auth)/sign-in' as any);
              }, 1500);
              return;
            }
            
            // On web/PWA, sign out and redirect to sign-in page
            await assertSupabase().auth.signOut();
            setTimeout(() => {
              window.location.href = '/sign-in?verified=true';
            }, 1000);
            return;
          } catch (e: any) {
            setStatus('error');
            setMessage(e?.message || t('landing.email_verification_failed', { defaultValue: 'Email verification failed.' }));
            // Still try to open the app so the user can continue there
            if (isWeb) {
              setTimeout(() => {
                setOpenAppPath('(auth)/sign-in?emailVerificationFailed=true');
                tryOpenApp('(auth)/sign-in?emailVerificationFailed=true');
              }, 2000);
            }
            return;
          }
        }

        // PARENT INVITE: code param
        const inviteCode = query.code || query.invitationCode || '';
        if (flow === 'invite-parent' && inviteCode) {
          // Inside native app: navigate directly to parent registration with code
          if (!isWeb) {
            router.replace(`/screens/parent-registration?invitationCode=${encodeURIComponent(inviteCode)}` as any);
            return;
          }
          // On web: attempt to open app with deep link to parent registration
setMessage(t('invite.opening_parent_registration', { defaultValue: 'Opening the app for parent registration...' }));
          setStatus('ready');
          const path = `/screens/parent-registration?invitationCode=${encodeURIComponent(inviteCode)}`;
          setOpenAppPath(path);
          tryOpenApp(path);
          return;
        }

        // STUDENT/MEMBER INVITE
        if ((flow === 'invite-student' || flow === 'invite-member') && inviteCode) {
          if (!isWeb) {
            router.replace(`/screens/student-join-by-code?code=${encodeURIComponent(inviteCode)}` as any);
            return;
          }
setMessage(t('invite.opening_join_by_code', { defaultValue: 'Opening the app to join by code...' }));
          setStatus('ready');
          const path = `/screens/student-join-by-code?code=${encodeURIComponent(inviteCode)}`;
          setOpenAppPath(path);
          tryOpenApp(path);
          return;
        }

        // PAYMENT RETURN/CANCEL
        if (flow === 'payment-return' || flow === 'payment-cancel') {
          const paymentPath = flow === 'payment-return' ? 'return' : 'cancel';
          // Build query string from all params except 'flow'
          const paymentParams = new URLSearchParams();
          Object.entries(query).forEach(([k, v]) => {
            if (k !== 'flow') paymentParams.set(k, v);
          });
          const queryString = paymentParams.toString() ? `?${paymentParams.toString()}` : '';
          const path = `/screens/payments/${paymentPath}${queryString}`;
          
          if (!isWeb) {
            // Inside app: route to payment return screen with all params
            router.replace(path as any);
            return;
          }
          // On web: try to open app with deep link
          setMessage(t('payment.redirecting', { defaultValue: 'Redirecting to app...' }));
          setStatus('ready');
          setOpenAppPath(path);
          tryOpenApp(path);
          return;
        }

        // Default: if native, go home; if web, show minimal UI and attempt to open app root
        if (!isWeb) {
          router.replace('/');
          return;
        }
setMessage(t('invite.opening_app', { defaultValue: 'Opening the app...' }));
        setStatus('ready');
        setOpenAppPath('/');
        tryOpenApp('/');
      } catch (e: any) {
        setStatus('error');
setMessage(e?.message || t('common.unexpected_error', { defaultValue: 'Something went wrong.' }));
      }
    };
    run();
     
  }, [query.token_hash, query.type, query.flow, query.code, query.invitationCode]);

  if (!isWeb) {
    // On native, we keep a tiny loader, navigation happens above
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0a0f' }}>
        <ActivityIndicator color="#00f5ff" />
      </View>
    );
  }

  // Minimal web UI (fallback) for when app isn't installed
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, backgroundColor: '#0a0a0f' }}>
      {status === 'loading' || status === 'done' ? (
        <ActivityIndicator size="large" color="#00f5ff" />
      ) : null}
      
      {!!message && (
        <Text style={{ color: '#ffffff', textAlign: 'center', fontSize: 16, marginBottom: 8 }}>
          {message}
        </Text>
      )}
      
      {status === 'done' && (
        <Text style={{ color: '#22c55e', textAlign: 'center', fontSize: 14, marginTop: 8 }}>
          ✓ {t('landing.opening_app_automatically', { defaultValue: 'Opening app automatically...' })}
        </Text>
      )}
      
      {(status === 'ready' || status === 'error') && (
        <>
          <TouchableOpacity 
            onPress={() => {
              tryOpenApp(openAppPath);
            }} 
            style={{ backgroundColor: '#00f5ff', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, marginTop: 8 }}
          >
            <Text style={{ color: '#000', fontWeight: '800', fontSize: 16 }}>
              {t('invite.open_app_cta', { defaultValue: 'Open EduDash Pro App' })}
            </Text>
          </TouchableOpacity>
          
          <View style={{ marginTop: 24, alignItems: 'center' }}>
            <Text style={{ color: '#9CA3AF', fontSize: 14, marginBottom: 8 }}>
              {t('landing.app_not_installed_yet', { defaultValue: "Don't have the app yet?" })}
            </Text>
            <TouchableOpacity onPress={() => Linking.openURL(playStoreUrl)}>
              <Text style={{ color: '#00f5ff', textDecorationLine: 'underline', fontSize: 14, fontWeight: '600' }}>
                {t('invite.install_google_play', { defaultValue: 'Install from Google Play' })}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}
