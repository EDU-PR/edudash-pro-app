/**
 * Next-gen auth landing: Sign In | Sign Up choice (+ optional biometric quick access).
 * Unauthenticated users see this first; Sign In → sign-in, Sign Up → role-selection.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { marketingTokens } from '@/components/marketing/tokens';
import { GlassCard } from '@/components/marketing/GlassCard';
import { GradientButton } from '@/components/marketing/GradientButton';
import { BiometricAuthService } from '@/services/BiometricAuthService';
import { EnhancedBiometricAuth } from '@/services/EnhancedBiometricAuth';
import { getBiometricAccounts } from '@/services/biometricStorage';
import { AlertModal, useAlertModal } from '@/components/ui/AlertModal';
import EduDashSpinner from '@/components/ui/EduDashSpinner';

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { showAlert, alertProps } = useAlertModal();

  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricAttempted, setBiometricAttempted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (Platform.OS === 'web') return;
      try {
        const caps = await BiometricAuthService.checkCapabilities();
        const accounts = await getBiometricAccounts();
        if (!cancelled && caps.isAvailable && caps.isEnrolled && accounts.length > 0) {
          setBiometricAvailable(true);
        }
      } catch {
        if (!cancelled) setBiometricAvailable(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSignIn = useCallback(() => {
    router.push('/(auth)/sign-in');
  }, []);

  const handleSignUp = useCallback(() => {
    router.push('/(auth)/role-selection' as any);
  }, []);

  const handleBiometric = useCallback(async () => {
    if (Platform.OS === 'web' || biometricLoading || biometricAttempted) return;
    setBiometricAttempted(true);
    setBiometricLoading(true);
    try {
      const result = await EnhancedBiometricAuth.authenticateWithBiometric();
      if (result.sessionRestored === false) {
        showAlert({
          title: t('auth.session_expired_title', { defaultValue: 'Session Expired' }),
          message: result.error || t('auth.biometric_restore_failed', { defaultValue: 'Please sign in with your email and password.' }),
          type: 'warning',
          buttons: [{ text: t('common.ok', { defaultValue: 'OK' }), style: 'default' }],
        });
      }
    } catch {
      // User cancelled or error; stay on welcome
    } finally {
      setBiometricLoading(false);
    }
  }, [biometricLoading, biometricAttempted, showAlert, t]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <LinearGradient
        colors={marketingTokens.gradients.background}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <View style={styles.logoCircle}>
            <Ionicons name="school" size={40} color={marketingTokens.colors.accent.cyan400} />
          </View>
          <Text style={styles.brandName}>
            {t('app.fullName', { defaultValue: 'EduDash Pro' })}
          </Text>
          <Text style={styles.tagline}>
            {t('app.tagline', { defaultValue: 'Empowering Education Through AI' })}
          </Text>
        </View>

        <GlassCard style={styles.card}>
          <Text style={styles.cardTitle}>
            {t('auth.welcome.title')}
          </Text>
          <Text style={styles.cardSubtitle}>
            {t('auth.welcome.subtitle')}
          </Text>

          {biometricLoading && (
            <View style={styles.biometricLoadingRow}>
              <EduDashSpinner size="small" color={marketingTokens.colors.accent.cyan400} />
              <Text style={styles.biometricLoadingText}>
                {t('auth.sign_in.authenticating_biometric')}
              </Text>
            </View>
          )}

          <View style={styles.buttons}>
            <GradientButton
              label={t('auth.sign_in.cta')}
              onPress={handleSignIn}
              variant="indigo"
              size="lg"
              disabled={biometricLoading}
              style={styles.primaryBtn}
              accessibilityLabel={t('auth.sign_in.cta')}
            />
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={handleSignUp}
              disabled={biometricLoading}
              activeOpacity={0.8}
              accessibilityLabel={t('auth.sign_up')}
            >
              <Ionicons name="person-add-outline" size={20} color={marketingTokens.colors.accent.cyan400} />
              <Text style={styles.secondaryBtnText}>{t('auth.sign_up')}</Text>
            </TouchableOpacity>
          </View>

          {biometricAvailable && !biometricLoading && (
            <>
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>{t('auth.or')}</Text>
                <View style={styles.dividerLine} />
              </View>
              <TouchableOpacity
                style={styles.biometricBtn}
                onPress={handleBiometric}
                activeOpacity={0.8}
                accessibilityLabel={t('auth.welcome.quick_access')}
              >
                <Ionicons name="finger-print" size={24} color={marketingTokens.colors.accent.cyan400} />
                <Text style={styles.biometricBtnText}>
                  {t('auth.welcome.quick_access')}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </GlassCard>
      </ScrollView>

      <AlertModal {...alertProps} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    minHeight: Platform.OS === 'web' ? '100%' : undefined,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: marketingTokens.colors.bg.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: marketingTokens.colors.stroke.medium,
  },
  brandName: {
    fontSize: 28,
    fontWeight: '800',
    color: marketingTokens.colors.fg.primary,
    marginBottom: 6,
  },
  tagline: {
    fontSize: 14,
    color: marketingTokens.colors.fg.secondary,
    fontWeight: '500',
    textAlign: 'center',
  },
  card: {
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: marketingTokens.colors.fg.primary,
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 15,
    color: marketingTokens.colors.fg.secondary,
    marginBottom: 24,
  },
  biometricLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },
  biometricLoadingText: {
    fontSize: 14,
    color: marketingTokens.colors.fg.secondary,
  },
  buttons: {
    gap: 14,
  },
  primaryBtn: {
    width: '100%',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: marketingTokens.radii.md,
    borderWidth: 2,
    borderColor: marketingTokens.colors.accent.cyan400,
    backgroundColor: 'transparent',
  },
  secondaryBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: marketingTokens.colors.accent.cyan400,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: marketingTokens.colors.stroke.soft,
  },
  dividerText: {
    paddingHorizontal: 12,
    fontSize: 13,
    color: marketingTokens.colors.fg.tertiary,
  },
  biometricBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: marketingTokens.radii.md,
    borderWidth: 1,
    borderColor: marketingTokens.colors.stroke.medium,
    backgroundColor: marketingTokens.colors.overlay.soft,
  },
  biometricBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: marketingTokens.colors.accent.cyan400,
  },
});
