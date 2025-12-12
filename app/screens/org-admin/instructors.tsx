import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { TeamInviteModal } from '@/components/org-admin/TeamInviteModal';

export default function InstructorsScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Stack.Screen 
        options={{ 
          title: 'Instructors',
          headerStyle: { backgroundColor: theme.background },
          headerTitleStyle: { color: theme.text },
          headerTintColor: theme.primary,
        }} 
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Team Management</Text>
          <Text style={styles.subtitle}>
            Invite instructors and manage your teaching team
          </Text>
        </View>

        <View style={styles.actionCard}>
          <Ionicons name="person-add-outline" size={32} color={theme.primary} />
          <Text style={styles.cardTitle}>Invite Instructor</Text>
          <Text style={styles.cardText}>
            Send an invitation to a new instructor to join your organization
          </Text>
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: theme.primary }]}
            onPress={() => setInviteModalVisible(true)}
          >
            <Text style={styles.buttonText}>Invite Instructor</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionCard}>
          <Ionicons name="people-outline" size={32} color={theme.primary} />
          <Text style={styles.cardTitle}>Invite Manager</Text>
          <Text style={styles.cardText}>
            Add a management team member to help administer your organization
          </Text>
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: theme.primary }]}
            onPress={() => {
              // TODO: Show manager invite modal
            }}
          >
            <Text style={styles.buttonText}>Invite Manager</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <TeamInviteModal
        visible={inviteModalVisible}
        onClose={() => setInviteModalVisible(false)}
        theme={theme}
        role="instructor"
      />
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: theme.background 
  },
  content: { 
    padding: 16, 
    gap: 16,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 8,
  },
  title: {
    color: theme.text,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtitle: {
    color: theme.textSecondary,
    fontSize: 14,
  },
  actionCard: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 12,
    alignItems: 'center',
  },
  cardTitle: {
    color: theme.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  cardText: {
    color: theme.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 10,
    marginTop: 8,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});

