import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import DashConversationsHistory from '@/components/ai/DashConversationsHistory';
import { getDashAIRoleCopy } from '@/lib/ai/dashRoleCopy';

export default function DashConversationsHistoryScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const roleCopy = getDashAIRoleCopy(profile?.role);
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader 
        title={roleCopy.historyTitle}
        subtitle={roleCopy.historySubtitle}
      />
      <DashConversationsHistory />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
