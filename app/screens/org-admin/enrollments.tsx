import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { EnrollmentInviteModal } from '@/components/org-admin/EnrollmentInviteModal';

export default function EnrollmentsScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Stack.Screen 
        options={{ 
          title: 'Enrollments',
          headerStyle: { backgroundColor: theme.background },
          headerTitleStyle: { color: theme.text },
          headerTintColor: theme.primary,
        }} 
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Learner Enrollment</Text>
          <Text style={styles.subtitle}>
            Invite learners to enroll in programs, learnerships, or courses
          </Text>
        </View>

        <View style={styles.actionCard}>
          <Ionicons name="mail-outline" size={32} color={theme.primary} />
          <Text style={styles.cardTitle}>Invite Learners</Text>
          <Text style={styles.cardText}>
            Send enrollment invitations to students/learners. They'll receive an email with instructions to join a specific program or learnership.
          </Text>
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: theme.primary }]}
            onPress={() => setInviteModalVisible(true)}
          >
            <Ionicons name="person-add" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.buttonText}>Send Enrollment Invites</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={24} color={theme.info} />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>How it works</Text>
            <Text style={styles.infoText}>
              • Select a program or learnership{'\n'}
              • Enter learner email addresses{'\n'}
              • Learners receive an email invitation{'\n'}
              • They can sign up and are automatically enrolled
            </Text>
          </View>
        </View>
      </ScrollView>

      <EnrollmentInviteModal
        visible={inviteModalVisible}
        onClose={() => setInviteModalVisible(false)}
        theme={theme}
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
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 10,
    marginTop: 8,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 12,
  },
  infoContent: {
    flex: 1,
    gap: 4,
  },
  infoTitle: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '700',
  },
  infoText: {
    color: theme.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
});

