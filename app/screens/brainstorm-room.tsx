import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import DashOrb from '@/components/dash-orb';

export default function BrainstormRoomScreen() {
  const { theme } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ padding: 16 }}>
        <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>Brainstorm Room</Text>
        <Text style={{ color: theme.textSecondary, marginTop: 4 }}>
          Co-create ECD themes, routines, and lesson ideas with Dash.
        </Text>
      </View>
      <DashOrb autoOpen hideButton position="bottom-right" size={64} />
    </View>
  );
}
