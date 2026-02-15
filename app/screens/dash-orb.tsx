import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { CosmicOrb } from '@/components/dash-orb/CosmicOrb';
import DashTutorVoiceChat from '@/components/ai/DashTutorVoiceChat';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { router } from 'expo-router';

export default function DashOrbScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const { tier } = useSubscription();
  const normalizedRole = String(profile?.role || '').toLowerCase();
  const isTutorRole = ['parent', 'student', 'learner'].includes(normalizedRole);
  const tierLower = String(tier || 'free').toLowerCase();
  const isStudent = ['student', 'learner'].includes(normalizedRole);
  const isDashOrbUnlocked = isStudent || [
    'parent_plus',
    'premium',
    'pro',
    'enterprise',
    'starter',
    'basic',
    'school_starter',
    'school_basic',
    'school_premium',
    'school_pro',
    'school_enterprise',
  ].includes(tierLower);
  const locked = isTutorRole && !isDashOrbUnlocked;

  useEffect(() => {
    if (!isTutorRole) {
      router.replace('/screens/dash-voice?mode=orb');
    }
  }, [isTutorRole]);

  if (!isTutorRole) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="small" color={theme.primary} />
      </View>
    );
  }

  if (locked) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <CosmicOrb size={120} isProcessing={false} isSpeaking={false} />
        <Text style={[styles.lockedTitle, { color: theme.text }]}>Dash Orb Locked</Text>
        <Text style={[styles.lockedMessage, { color: theme.textSecondary }]}>
          {isStudent
            ? 'Ask your school to upgrade for full Dash Orb access.'
            : 'Upgrade to Parent Plus to unlock the Dash Orb.'}
        </Text>
        <TouchableOpacity
          style={[styles.upgradeBtn, { backgroundColor: theme.primary }]}
          onPress={() => router.push('/screens/subscription-setup')}
        >
          <Text style={styles.upgradeBtnText}>Upgrade</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <DashTutorVoiceChat />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  lockedTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 16,
  },
  lockedMessage: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  upgradeBtn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  upgradeBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
