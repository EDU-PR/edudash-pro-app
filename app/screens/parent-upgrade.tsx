/**
 * Parent Upgrade/Pricing Screen
 * 
 * Shows subscription tiers and allows parents to upgrade their plan.
 * Uses PayFast integration for South African payments.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SubPageHeader } from '@/components/SubPageHeader';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { assertSupabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import EduDashSpinner from '@/components/ui/EduDashSpinner';
import { useAlertModal } from '@/components/ui/AlertModal';

interface Tier {
  id: string;
  name: string;
  price: number;
  promoPrice: number;
  icon: string;
  color: string;
  gradient: [string, string];
  popular?: boolean;
  features: string[];
}

const TIERS: Tier[] = [
  {
    id: 'parent_starter',
    name: 'Starter',
    price: 99,
    promoPrice: 49.50,
    icon: 'flash',
    color: '#10b981',
    gradient: ['#10b981', '#059669'],
    features: [
      '30 AI-generated exams per month',
      '100 AI explanations',
      '200 chat messages per day',
      'CAPS-aligned content',
      'All subjects and grades',
      'PDF export',
      'Email support',
      'Interactive robotics (2 free modules)',
    ],
  },
  {
    id: 'parent_plus',
    name: 'Plus',
    price: 199,
    promoPrice: 99.50,
    icon: 'crown',
    color: '#7c3aed',
    gradient: ['#7c3aed', '#6d28d9'],
    popular: true,
    features: [
      '100 AI-generated exams per month',
      '500 AI explanations',
      '1000 chat messages per day',
      'Priority AI processing',
      'Advanced analytics',
      'Personalized learning paths',
      'All robotics modules unlocked',
      'All 37 DBE textbooks',
      'AI diagram generation',
      'Priority email support',
    ],
  },
];

export default function ParentUpgradeScreen() {
  const { theme } = useTheme();
  const { user, profile } = useAuth();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlertModal();
  const [loading, setLoading] = useState(false);
  const [currentTier, setCurrentTier] = useState('free');
  const styles = createStyles(theme, insets.bottom);

  useEffect(() => {
    if ((profile as any)?.subscription_tier) {
      setCurrentTier((profile as any).subscription_tier);
    }
  }, [profile]);

  const handleUpgrade = async (tier: Tier) => {
    if (!user?.id) {
      showAlert({ title: 'Sign In Required', message: 'Please sign in to upgrade.', type: 'info' });
      return;
    }

    setLoading(true);
    try {
      const supabase = assertSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const { data, error } = await supabase.functions.invoke('payfast-create-payment', {
        body: {
          user_id: user.id,
          tier: tier.id,
          amount: tier.promoPrice,
          email: user.email,
        },
      });

      if (error || !data?.payment_url) {
        throw new Error(error?.message || 'Failed to create payment');
      }

      await Linking.openURL(data.payment_url);
    } catch (err: any) {
      showAlert({
        title: 'Upgrade Error',
        message: err.message || 'Failed to process upgrade. Please try again.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SubPageHeader title={t('parent.upgrade', { defaultValue: 'Upgrade Your Plan' })} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.headerSection}>
          <Text style={styles.pageTitle}>Get more AI-powered features</Text>
          <Text style={styles.pageSubtitle}>Help your child excel with premium tools</Text>
        </View>

        {/* Tier Cards */}
        {TIERS.map((tier) => {
          const isCurrent = currentTier === tier.id;
          return (
            <View key={tier.id} style={[styles.tierCard, tier.popular && styles.tierCardPopular]}>
              {tier.popular && (
                <LinearGradient
                  colors={tier.gradient}
                  style={styles.popularBadge}
                >
                  <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
                </LinearGradient>
              )}

              <View style={styles.tierHeader}>
                <View style={[styles.tierIconContainer, { backgroundColor: `${tier.color}20` }]}>
                  <Ionicons name={tier.icon as any} size={24} color={tier.color} />
                </View>
                <Text style={styles.tierName}>{tier.name}</Text>
              </View>

              <View style={styles.priceRow}>
                <Text style={styles.promoPrice}>R{tier.promoPrice.toFixed(2)}</Text>
                <Text style={styles.originalPrice}>R{tier.price}</Text>
              </View>
              <Text style={styles.pricePeriod}>
                per month · <Text style={{ color: '#10b981', fontWeight: '700' }}>50% OFF</Text> for 6 months
              </Text>
              <Text style={styles.promoNote}>Early Bird Special</Text>

              <View style={styles.featuresList}>
                {tier.features.map((feat, i) => (
                  <View key={i} style={styles.featureRow}>
                    <Ionicons name="checkmark" size={18} color={tier.color} />
                    <Text style={styles.featureText}>{feat}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.upgradeButton, isCurrent && styles.upgradeButtonDisabled]}
                disabled={loading || isCurrent}
                onPress={() => handleUpgrade(tier)}
              >
                <LinearGradient
                  colors={isCurrent ? [theme.elevated, theme.elevated] : tier.gradient}
                  style={styles.upgradeButtonGradient}
                >
                  {loading ? (
                    <EduDashSpinner size="small" color="#fff" />
                  ) : (
                    <Text style={[styles.upgradeButtonText, isCurrent && { color: theme.textSecondary }]}>
                      {isCurrent ? 'Current Plan' : 'Upgrade Now'}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          );
        })}

        {/* FAQ */}
        <View style={styles.faqCard}>
          <Text style={styles.faqTitle}>Frequently Asked Questions</Text>

          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>How do I upgrade?</Text>
            <Text style={styles.faqAnswer}>
              Tap &quot;Upgrade Now&quot; on your desired plan. You&apos;ll be redirected to PayFast for secure payment.
            </Text>
          </View>
          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>What happens when I reach my limit?</Text>
            <Text style={styles.faqAnswer}>
              You&apos;ll receive a warning. Once exceeded, upgrade to continue using AI features.
            </Text>
          </View>
          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>Can I cancel anytime?</Text>
            <Text style={styles.faqAnswer}>
              Yes! Cancel anytime. Your plan stays active until the end of your billing period.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: any, bottomInset: number) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    scrollContent: { paddingHorizontal: 16, paddingBottom: bottomInset + 40, gap: 16 },
    headerSection: { alignItems: 'center', marginTop: 16, marginBottom: 8 },
    pageTitle: { fontSize: 22, fontWeight: '700', color: theme.text, textAlign: 'center' },
    pageSubtitle: { fontSize: 15, color: theme.textSecondary, marginTop: 4, textAlign: 'center' },
    tierCard: {
      backgroundColor: theme.surface, borderRadius: 18, padding: 20,
      borderWidth: 1, borderColor: theme.border, position: 'relative',
    },
    tierCardPopular: {
      borderColor: '#7c3aed', borderWidth: 2,
      shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15, shadowRadius: 12, elevation: 6,
    },
    popularBadge: {
      position: 'absolute', top: -12, alignSelf: 'center',
      paddingHorizontal: 14, paddingVertical: 4, borderRadius: 10,
    },
    popularBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
    tierHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16, marginTop: 4 },
    tierIconContainer: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    tierName: { fontSize: 22, fontWeight: '700', color: theme.text },
    priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
    promoPrice: { fontSize: 36, fontWeight: '700', color: theme.text },
    originalPrice: { fontSize: 18, fontWeight: '500', color: theme.textSecondary, textDecorationLine: 'line-through' },
    pricePeriod: { fontSize: 13, color: theme.textSecondary, marginTop: 4 },
    promoNote: { fontSize: 11, color: theme.textSecondary, marginTop: 2 },
    featuresList: { marginTop: 20, gap: 10 },
    featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    featureText: { fontSize: 14, color: theme.text, flex: 1 },
    upgradeButton: { marginTop: 20, borderRadius: 14, overflow: 'hidden' },
    upgradeButtonDisabled: { opacity: 0.5 },
    upgradeButtonGradient: { paddingVertical: 14, alignItems: 'center', borderRadius: 14 },
    upgradeButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    faqCard: {
      backgroundColor: theme.surface, borderRadius: 16, padding: 20,
      borderWidth: 1, borderColor: theme.border, gap: 16,
    },
    faqTitle: { fontSize: 18, fontWeight: '700', color: theme.text },
    faqItem: { gap: 4 },
    faqQuestion: { fontSize: 15, fontWeight: '600', color: theme.text },
    faqAnswer: { fontSize: 13, color: theme.textSecondary, lineHeight: 20 },
  });
