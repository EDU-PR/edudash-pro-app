import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import DashOrb from '@/components/dash-orb';

export default function DashOrbScreen() {
  const { theme } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <DashOrb autoOpen hideButton position="bottom-right" size={64} />
    </View>
  );
}
