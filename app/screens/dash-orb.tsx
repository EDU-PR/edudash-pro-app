import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import DashOrb from '@/components/dash-orb';
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
  const isDashOrbUnlocked = [
    'parent_plus',
    'premium',
    'pro',
    'enterprise',
    'school_premium',
    'school_pro',
    'school_enterprise',
  ].includes(tierLower);
  const locked = isTutorRole && !isDashOrbUnlocked;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <DashOrb
        autoOpen
        hideButton
        position="bottom-right"
        size={64}
        locked={locked}
        lockedTitle="Dash Orb Locked"
        lockedMessage="Upgrade to Parent Plus to unlock the Dash Orb."
        lockedCtaLabel="Upgrade"
        onUpgradePress={() => router.push('/screens/subscription-setup')}
      />
    </View>
  );
}
