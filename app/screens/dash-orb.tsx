import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import DashOrb from '@/components/dash-orb';
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
      <View style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="small" color={theme.primary} />
      </View>
    );
  }

  if (locked) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <DashOrb
          autoOpen
          hideButton
          position="bottom-right"
          size={64}
          locked={locked}
          lockedTitle="Dash Orb Locked"
          lockedMessage={isStudent ? 'Ask your school to upgrade for full Dash Orb access.' : 'Upgrade to Parent Plus to unlock the Dash Orb.'}
          lockedCtaLabel="Upgrade"
          onUpgradePress={() => router.push('/screens/subscription-setup')}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <DashTutorVoiceChat />
    </View>
  );
}
