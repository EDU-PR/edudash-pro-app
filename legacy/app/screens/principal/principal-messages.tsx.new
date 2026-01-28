// Principal Messages Screen - Refactored for WARP.md compliance

import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useMessages } from '@/hooks/principal/useMessages';
import {
  RecipientSelector,
  MessageComposer,
  MessageHistoryList,
  RecipientStats,
  QuickActions,
  type RecipientType,
  RECIPIENT_OPTIONS,
  getRecipientCount,
} from '@/components/principal/messages';

export default function PrincipalMessagesScreen() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const organizationId = (profile as any)?.organization_id || (profile as any)?.preschool_id;

  const {
    classes,
    messageHistory,
    recipientCounts,
    loadingCounts,
    refreshing,
    sending,
    onRefresh,
    sendMessage,
  } = useMessages({ organizationId });

  const [recipientType, setRecipientType] = useState<RecipientType>('all_parents');
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const selectedOption = RECIPIENT_OPTIONS.find(o => o.id === recipientType);
  const recipientCount = getRecipientCount(recipientType, recipientCounts, selectedClass);

  const handleSend = async () => {
    const success = await sendMessage(recipientType, selectedClass, subject, message);
    if (success) {
      setSubject('');
      setMessage('');
      setSelectedClass(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader 
        title="Communication Hub" 
        subtitle="Announcements, messages, and calls"
      />

      <ScrollView 
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        {!organizationId ? (
          <View style={styles.card}>
            <Ionicons name="alert-circle" size={48} color="#F59E0B" style={{ alignSelf: 'center' }} />
            <Text style={[styles.cardTitle, { textAlign: 'center', marginTop: 12 }]}>
              Not Connected to School
            </Text>
            <Text style={[styles.cardText, { textAlign: 'center' }]}>
              Your account is not linked to a school. Please contact support.
            </Text>
          </View>
        ) : (
          <>
            <QuickActions />

            <RecipientStats counts={recipientCounts} loading={loadingCounts} />

            <RecipientSelector
              recipientType={recipientType}
              selectedClass={selectedClass}
              classes={classes}
              onRecipientChange={setRecipientType}
              onClassChange={setSelectedClass}
            />

            <MessageComposer
              subject={subject}
              message={message}
              recipientCount={recipientCount}
              recipientLabel={selectedOption?.label.toLowerCase() || 'recipients'}
              sending={sending}
              onSubjectChange={setSubject}
              onMessageChange={setMessage}
              onSend={handleSend}
            />

            <MessageHistoryList messages={messageHistory} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme?.background || '#0b1220',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: theme?.card || '#111827',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme?.border || '#1f2937',
    marginBottom: 16,
  },
  cardTitle: {
    color: theme?.text || '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  cardText: {
    color: theme?.textSecondary || '#9CA3AF',
    fontSize: 14,
    lineHeight: 20,
  },
});
