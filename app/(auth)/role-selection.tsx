import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

interface RoleOption {
  id: string;
  title: string;
  description: string;
  icon: string;
  route: string;
  gradient: string[];
}

const ROLE_OPTIONS: RoleOption[] = [
  {
    id: 'learner',
    title: 'Learner / Student',
    description: 'Join programs, track progress, submit assignments',
    icon: 'person-outline',
    route: '/screens/learner-registration',
    gradient: ['#667eea', '#764ba2'],
  },
  {
    id: 'parent',
    title: 'Parent',
    description: 'Monitor your children\'s progress and communicate with teachers',
    icon: 'people-outline',
    route: '/screens/parent-registration',
    gradient: ['#f093fb', '#f5576c'],
  },
  {
    id: 'teacher',
    title: 'Teacher',
    description: 'Manage classes, create lessons, and track student progress',
    icon: 'school-outline',
    route: '/screens/teacher-registration',
    gradient: ['#4facfe', '#00f2fe'],
  },
];

const ORGANIZATION_OPTIONS: RoleOption[] = [
  {
    id: 'school',
    title: 'Register a School',
    description: 'K-12 schools, preschools, and educational institutions',
    icon: 'business-outline',
    route: '/screens/principal-onboarding',
    gradient: ['#43e97b', '#38f9d7'],
  },
  {
    id: 'organization',
    title: 'Onboard an Organization',
    description: 'Training centers, skills development, tertiary education',
    icon: 'library-outline',
    route: '/screens/org-onboarding',
    gradient: ['#fa709a', '#fee140'],
  },
];

export default function RoleSelectionScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = createStyles(theme);

  const handleRoleSelect = (route: string) => {
    router.push(route as any);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <Stack.Screen
        options={{
          title: 'Choose Your Role',
          headerStyle: { backgroundColor: theme.background },
          headerTitleStyle: { color: theme.text },
          headerTintColor: theme.primary,
          headerShown: true,
          headerBackTitleVisible: false,
        }}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Who are you signing up as?</Text>
          <Text style={styles.subtitle}>
            Select the option that best describes you
          </Text>
        </View>

        {/* Individual Roles */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Individual Accounts</Text>
          {ROLE_OPTIONS.map((role) => (
            <TouchableOpacity
              key={role.id}
              style={[styles.roleCard, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => handleRoleSelect(role.route)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, { backgroundColor: theme.primary + '15' }]}>
                <Ionicons name={role.icon as any} size={32} color={theme.primary} />
              </View>
              <View style={styles.roleContent}>
                <Text style={[styles.roleTitle, { color: theme.text }]}>{role.title}</Text>
                <Text style={[styles.roleDescription, { color: theme.textSecondary }]}>
                  {role.description}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Organization Roles */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Organizations</Text>
          {ORGANIZATION_OPTIONS.map((role) => (
            <TouchableOpacity
              key={role.id}
              style={[styles.roleCard, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => handleRoleSelect(role.route)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, { backgroundColor: theme.primary + '15' }]}>
                <Ionicons name={role.icon as any} size={32} color={theme.primary} />
              </View>
              <View style={styles.roleContent}>
                <Text style={[styles.roleTitle, { color: theme.text }]}>{role.title}</Text>
                <Text style={[styles.roleDescription, { color: theme.textSecondary }]}>
                  {role.description}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Back to Sign In */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={20} color={theme.primary} />
          <Text style={[styles.backButtonText, { color: theme.primary }]}>
            Back to Sign In
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  content: {
    padding: 20,
    gap: 32,
    paddingBottom: 40,
  },
  header: {
    gap: 8,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 4,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    gap: 16,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleContent: {
    flex: 1,
    gap: 4,
  },
  roleTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  roleDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
    marginTop: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});


