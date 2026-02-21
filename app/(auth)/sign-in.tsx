// Sign-in screen — slimmed to comply with WARP.md (≤500 lines excl. StyleSheet)
// Heavy logic extracted to:
//   hooks/auth/useSignInHandlers.ts
//   features/auth/sign-in.styles.ts

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, ScrollView, KeyboardAvoidingView, RefreshControl, Keyboard } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useTheme } from "@/contexts/ThemeContext";
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { storage } from '@/lib/storage';
import { secureStore } from '@/lib/secure-store';
import { LinearGradient } from 'expo-linear-gradient';
import { marketingTokens } from '@/components/marketing/tokens';
import { GlassCard } from '@/components/marketing/GlassCard';
import { GradientButton } from '@/components/marketing/GradientButton';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'expo-router';
import { BiometricAuthService } from '@/services/BiometricAuthService';
import { EnhancedBiometricAuth } from '@/services/EnhancedBiometricAuth';
import { AlertModal, useAlertModal } from '@/components/ui/AlertModal';
import { logger } from '@/lib/logger';
import EduDashSpinner from '@/components/ui/EduDashSpinner';
import { createSignInStyles } from '@/features/auth/sign-in.styles';
import { useSignInHandlers } from '@/hooks/auth/useSignInHandlers';

export default function SignIn() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, loading: authLoading, profileLoading } = useAuth();
  const searchParams = useLocalSearchParams<{
    email?: string;
    switch?: string;
    verified?: string;
    emailVerified?: string;
    password_reset?: string;
    emailChanged?: string;
    emailVerificationFailed?: string;
    emailChangeFailed?: string;
    fresh?: string;
    signedOut?: string;
    skipBiometric?: string;
    addAccount?: string;
  }>();

  // Prefill email from URL (e.g. "Use password" from ProfileSwitcher: ?switch=1&email=...)
  const emailFromParams =
    typeof searchParams.email === 'string'
      ? searchParams.email
      : Array.isArray(searchParams.email)
        ? searchParams.email[0]
        : '';
  const [email, setEmail] = useState(() => emailFromParams || '');
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricAttempted, setBiometricAttempted] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const { showAlert, alertProps } = useAlertModal();
  const mountTimeRef = useRef(Date.now());

  const styles = useMemo(() => createSignInStyles(theme, insets), [theme, insets]);

  // ── Handlers hook ─────────────────────────
  const { handleSignIn, handleGoogleSignIn, stopLoadingState, isMountedRef } = useSignInHandlers({
    state: { email, password, rememberMe, loading },
    setLoading,
    setGoogleLoading,
    emailInputRef,
    passwordInputRef,
    showAlert,
    t,
  });

  // ── Safety net: clear loading once auth resolves ──
  useEffect(() => {
    if (loading && user && !profileLoading) {
      const elapsed = Date.now() - mountTimeRef.current;
      if (elapsed > 3000) {
        logger.debug('SignIn', 'Auth resolved, clearing loading');
        stopLoadingState();
      }
    }
  }, [loading, user, profileLoading, stopLoadingState]);

  // ── Pull-to-refresh ───────────────────────
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const { clearAllNavigationLocks } = await import('@/lib/routeAfterLogin');
      clearAllNavigationLocks();
      const { resetSignOutState } = await import('@/lib/authActions');
      resetSignOutState();
      setSuccessMessage(null);
      await new Promise((r) => setTimeout(r, 500));
    } catch { /* noop */ }
    setRefreshing(false);
  }, []);

  // ── Mount / unmount ───────────────────────
  useEffect(() => {
    (async () => {
      try {
        const { clearAllNavigationLocks } = await import('@/lib/routeAfterLogin');
        clearAllNavigationLocks();
        const { resetSignOutState, clearAccountSwitchPending } = await import('@/lib/authActions');
        resetSignOutState();
        clearAccountSwitchPending();
      } catch { /* noop */ }
    })();
  }, []);

  // ── Web back-nav guard ────────────────────
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const w = globalThis as any;
    const onPop = () => router.replace('/(auth)/sign-in');
    w?.addEventListener?.('popstate', onPop);
    return () => w?.removeEventListener?.('popstate', onPop);
  }, []);

  // ── Prefill email from deep link / account switch ("Use password") ──────────
  useEffect(() => {
    const raw = searchParams.email;
    const emailParam = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : '';
    if (emailParam && email !== emailParam) setEmail(emailParam);
  }, [searchParams.email]);

  // ── Verification / success messages ───────
  useEffect(() => {
    if (searchParams.verified === 'true' || searchParams.emailVerified === 'true') {
      setSuccessMessage(t('auth.email_verified', { defaultValue: 'Email verified successfully! You can now sign in.' }));
      setTimeout(() => setSuccessMessage(null), 5000);
    }
    if (searchParams.password_reset === 'success') {
      setSuccessMessage(t('auth.password_reset_success', { defaultValue: 'Password reset successfully! You can now sign in with your new password.' }));
      setTimeout(() => setSuccessMessage(null), 5000);
    }
    if (searchParams.emailChanged === 'true' || searchParams.emailChanged === '1') {
      setSuccessMessage(t('auth.email_changed_success', { defaultValue: 'Email updated successfully. Please sign in with your new email.' }));
      setTimeout(() => setSuccessMessage(null), 6000);
    }
    if (searchParams.emailVerificationFailed === 'true') {
      showAlert({ title: 'Verification Failed', message: 'Email verification failed. Please try signing in again.', type: 'error', buttons: [{ text: 'OK', style: 'default' }] });
    }
    if (searchParams.emailChangeFailed === 'true') {
      showAlert({ title: 'Error', message: 'We could not confirm your email change. Please try again from Account Settings.', type: 'error', buttons: [{ text: 'OK', style: 'default' }] });
    }
  }, [searchParams, t]);

  // ── Biometric auto sign-in ────────────────
  useEffect(() => {
    const attempt = async () => {
      if (Platform.OS === 'web' || biometricAttempted) return;
      setBiometricAttempted(true);
      if (searchParams?.fresh === '1' || searchParams?.signedOut === '1' || searchParams?.skipBiometric === '1' || searchParams?.switch === '1' || searchParams?.addAccount === '1') return;

      try {
        const skipUntilRaw = await storage.getItem('auth_skip_biometrics_until');
        if (skipUntilRaw && Date.now() < Number(skipUntilRaw)) return;
      } catch { /* noop */ }

      const isEnabled = await BiometricAuthService.isBiometricEnabled();
      if (!isEnabled) return;
      const caps = await BiometricAuthService.checkCapabilities();
      if (!caps.isAvailable || !caps.isEnrolled) return;

      setBiometricLoading(true);
      try {
        const result = await EnhancedBiometricAuth.authenticateWithBiometric();
        // Biometric auth can succeed while session restoration fails (expired/rotated refresh token).
        if (result.sessionRestored === false) {
          showAlert({
            title: t('auth.session_expired_title', { defaultValue: 'Session Expired' }),
            message: result.error || t('auth.biometric_restore_failed', { defaultValue: 'Please sign in with your email and password.' }),
            type: 'warning',
            buttons: [{ text: 'OK', style: 'default' }],
          });
        }
      } catch { /* silent */ }
      setBiometricLoading(false);
    };
    const timer = setTimeout(attempt, 500);
    return () => clearTimeout(timer);
  }, [searchParams]);

  // ── Load saved credentials ────────────────
  useEffect(() => {
    (async () => {
      try {
        const saved = await storage.getItem('rememberMe');
        const savedEmail = await storage.getItem('savedEmail');
        if (saved === 'true' && savedEmail) {
          setEmail(savedEmail);
          setRememberMe(true);
          const key = `password_${savedEmail.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
          const pw = await secureStore.getItem(key);
          if (pw) setPassword(pw);
        }
      } catch { /* noop */ }
    })();
  }, []);

  // ── Render ────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <LinearGradient colors={marketingTokens.gradients.background} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
      <Stack.Screen options={{ headerShown: false }} />

      {Platform.OS === 'web' && (
        <View style={styles.homeButtonContainer}>
          <Link href="/" asChild>
            <TouchableOpacity style={styles.homeButton} activeOpacity={0.7}>
              <Ionicons name="home-outline" size={20} color={marketingTokens.colors.accent.cyan400} />
              <Text style={styles.homeButtonText}>{t('auth.go_to_home', { defaultValue: 'Go to Home' })}</Text>
            </TouchableOpacity>
          </Link>
        </View>
      )}

      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? Math.max(insets.top, 12) : 0}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} colors={[theme.primary]} progressBackgroundColor={theme.surface} />}
        >
          <View style={styles.content}>
            <View style={styles.logoContainer}>
              <View style={styles.logoCircle}>
                <Ionicons name="school" size={32} color={theme.primary} />
              </View>
              <Text style={styles.logoText}>{t('app.fullName', { defaultValue: 'EduDash Pro' })}</Text>
              <Text style={styles.logoSubtext}>{t('app.tagline', { defaultValue: 'Empowering Education Through AI' })}</Text>
            </View>

            <GlassCard style={styles.card}>
              <View style={styles.header}>
                <Text style={styles.title}>{t('auth.sign_in.welcome_back', { defaultValue: 'Welcome Back' })}</Text>
                <Text style={styles.subtitle}>{t('auth.sign_in.sign_in_to_account', { defaultValue: 'Sign in to your account' })}</Text>
                {biometricLoading && (
                  <View style={styles.biometricLoadingContainer}>
                    <EduDashSpinner size="small" color={theme.primary} />
                    <Text style={styles.biometricLoadingText}>{t('auth.sign_in.authenticating_biometric', { defaultValue: 'Authenticating with biometrics...' })}</Text>
                  </View>
                )}
              </View>

              {successMessage && (
                <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.4)', borderRadius: 10, padding: 12, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 16 }}>✓</Text>
                  <Text style={{ color: '#6ee7b7', fontSize: 14, flex: 1, fontWeight: '500' }}>{successMessage}</Text>
                </View>
              )}

              <View style={styles.form}>
                <TextInput ref={emailInputRef} style={styles.input} placeholder={t('auth.email', { defaultValue: 'Email' })} placeholderTextColor={theme.inputPlaceholder} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} returnKeyType="next" onSubmitEditing={() => passwordInputRef.current?.focus()} blurOnSubmit={false} />

                <View style={styles.passwordContainer}>
                  <TextInput ref={passwordInputRef} style={[styles.input, styles.passwordInput]} placeholder={t('auth.password', { defaultValue: 'Password' })} placeholderTextColor={theme.inputPlaceholder} value={password} onChangeText={setPassword} secureTextEntry={!showPassword} autoCapitalize="none" autoCorrect={false} returnKeyType="go" onSubmitEditing={handleSignIn} />
                  <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword(!showPassword)} activeOpacity={0.7}>
                    <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={22} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>

                <View style={styles.rememberForgotContainer}>
                  <TouchableOpacity style={styles.rememberMeContainer} onPress={() => setRememberMe(!rememberMe)} activeOpacity={0.7}>
                    <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                      {rememberMe && <Ionicons name="checkmark" size={14} color={theme.onPrimary} />}
                    </View>
                    <Text style={styles.rememberMeText}>{t('auth.remember_me', { defaultValue: 'Remember me' })}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')} activeOpacity={0.7}>
                    <Text style={styles.forgotPasswordText}>{t('auth.forgot_password.title', { defaultValue: 'Forgot Password?' })}</Text>
                  </TouchableOpacity>
                </View>

                <GradientButton label={loading ? t('auth.sign_in.signing_in', { defaultValue: 'Signing In...' }) : t('auth.sign_in.cta', { defaultValue: 'Sign In' })} onPress={handleSignIn} variant="indigo" size="lg" loading={loading} disabled={loading} />

                <View style={styles.dividerContainer}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>{t('auth.or', { defaultValue: 'or' })}</Text>
                  <View style={styles.dividerLine} />
                </View>

                <TouchableOpacity style={styles.googleButton} onPress={handleGoogleSignIn} disabled={googleLoading || loading} activeOpacity={0.7}>
                  {googleLoading ? <EduDashSpinner color="#fff" size="small" /> : (
                    <>
                      <Ionicons name="logo-google" size={20} color="#fff" />
                      <Text style={styles.googleButtonText}>{t('auth.continue_with_google', { defaultValue: 'Continue with Google' })}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

            </GlassCard>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {loading && (
        <View style={[styles.signInLoadingBanner, { bottom: Math.max(insets.bottom, 16) }]}>
          <EduDashSpinner size="small" color={theme.primary} />
          <Text style={styles.signInLoadingText}>{t('auth.sign_in.loading_banner', { defaultValue: 'Signing you in... Please wait' })}</Text>
        </View>
      )}

      <AlertModal {...alertProps} />
    </SafeAreaView>
  );
}
