import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { AssignmentsCard } from '@/components/dashboard/cards/AssignmentsCard';
import { GradesCard } from '@/components/dashboard/cards/GradesCard';
import { ScheduleCard } from '@/components/dashboard/cards/ScheduleCard';
import { AnnouncementsCard } from '@/components/dashboard/cards/AnnouncementsCard';
import InlineUpgradeBanner from '@/components/ui/InlineUpgradeBanner';
import { AIQuotaDisplay } from '@/components/ui/AIQuotaDisplay';

export default function StudentDashboard() {
  const { user, profile, profileLoading, loading } = useAuth();
  const { theme } = useTheme();
  const { tier } = useSubscription();
  const { t } = useTranslation();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  
  // Guard against React StrictMode double-invoke in development
  const navigationAttempted = useRef(false);

  // Handle both organization_id (new RBAC) and preschool_id (legacy) fields
  const orgId = profile?.organization_id || (profile as any)?.preschool_id;
  
  // Wait for auth and profile to finish loading before making routing decisions
  const isStillLoading = loading || profileLoading;

  // CONSOLIDATED NAVIGATION EFFECT: Single source of truth for all routing decisions
  useEffect(() => {
    // Skip if still loading data
    if (isStillLoading) return;
    
    // Guard against double navigation (React StrictMode in dev)
    if (navigationAttempted.current) return;
    
    // Decision 1: No user -> sign in
    if (!user) {
      navigationAttempted.current = true;
      try { 
        router.replace('/(auth)/sign-in'); 
      } catch (e) {
        try { router.replace('/sign-in'); } catch { /* Intentional: non-fatal */ }
      }
      return;
    }
    
    // Decision 2: User exists but no organization -> allow standalone access
    // Students can use the dashboard without an organization and join later
    // No redirect needed - dashboard will show join prompt
    
    // Decision 3: All good, stay on dashboard (no navigation needed)
  }, [isStillLoading, user, orgId, profile]);

  // Show loading state while auth/profile is loading
  if (isStillLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        <Stack.Screen options={{ title: t('student.dashboard_title', { defaultValue: 'Student Dashboard' }) }} />
        <View style={styles.empty}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>{t('dashboard.loading_profile', { defaultValue: 'Loading your profile...' })}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show join prompt if no organization
  const showJoinPrompt = !orgId;
  
  // Get student name (handle both first_name and full name)
  const studentName = profile?.first_name || profile?.full_name?.split(' ')[0] || 'Student';
  const shouldShowUpgrade = tier === 'free' || !tier;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <Stack.Screen 
        options={{ 
          headerShown: true, // Explicitly show header
          title: t('student.dashboard_title', { defaultValue: 'Student Dashboard' }),
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          headerTitleStyle: { color: theme.text, fontWeight: '600' },
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginRight: 8 }}>
              <TouchableOpacity
                onPress={() => router.push('/screens/settings')}
                style={{ padding: 4 }}
              >
                <Ionicons name="settings-outline" size={24} color={theme.text} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push('/screens/account')}
                style={{ padding: 4 }}
              >
                <Ionicons name="person-circle-outline" size={28} color={theme.text} />
              </TouchableOpacity>
            </View>
          ),
        }} 
      />
      <ScrollView 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <Text style={styles.greeting}>
            {t('student.welcome_back', { 
              defaultValue: 'Welcome back, {{name}}',
              name: studentName
            })}
          </Text>
          <Text style={styles.subheading}>
            {t('student.continue_learning', { defaultValue: 'Continue your learning journey' })}
          </Text>
        </View>

        {/* AI Quota Display */}
        <AIQuotaDisplay 
          serviceType="homework_help"
          compact={true}
          showUpgradePrompt={true}
          containerStyle={styles.quotaDisplay}
        />

        {/* Upgrade Banner */}
        {shouldShowUpgrade && (
          <InlineUpgradeBanner
            title={t('student.upgrade_title', { defaultValue: 'Unlock Premium Features' })}
            description={t('student.upgrade_description', { defaultValue: 'Get unlimited AI homework help, advanced analytics, and more' })}
            screen="student_dashboard"
            feature="premium_student_features"
            icon="diamond-outline"
            variant="compact"
          />
        )}

        {/* Join Organization Prompt */}
        {showJoinPrompt && (
          <View style={[styles.infoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Ionicons name="school-outline" size={24} color={theme.primary} />
            <View style={styles.infoContent}>
              <Text style={[styles.infoTitle, { color: theme.text }]}>
                {t('student.join_organization', { defaultValue: 'Join an Organization' })}
              </Text>
              <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                {t('student.join_prompt', { defaultValue: 'Join your school or organization to access assignments, grades, and more.' })}
              </Text>
              <TouchableOpacity 
                style={[styles.joinButton, { backgroundColor: theme.primary }]}
                onPress={() => router.push('/register')}
              >
                <Text style={styles.joinButtonText}>
                  {t('student.join_now', { defaultValue: 'Join Now' })}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Dashboard Cards */}
        <View style={styles.cardsContainer}>
          <AnnouncementsCard />
          <ScheduleCard />
          <AssignmentsCard />
          <GradesCard />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: theme?.background || '#0b1220' 
  },
  content: { 
    padding: 16,
    paddingBottom: 32,
  },
  welcomeSection: {
    marginBottom: 24,
  },
  greeting: { 
    color: theme?.text || '#fff', 
    fontSize: 28, 
    fontWeight: '800', 
    marginBottom: 8 
  },
  subheading: { 
    color: theme?.textSecondary || '#9CA3AF',
    fontSize: 16,
    lineHeight: 22,
  },
  empty: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  loadingText: { 
    color: theme?.text || '#E5E7EB', 
    fontSize: 16,
    marginTop: 12,
  },
  infoCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    gap: 16,
  },
  infoContent: {
    flex: 1,
    gap: 8,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
  joinButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  cardsContainer: {
    gap: 16,
  },
  quotaDisplay: {
    marginBottom: 16,
  },
});
