/**
 * Principal Dashboard - Welcome Section
 * 
 * The welcome header card with school name, greeting, and tier badge.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import TierBadge from '@/components/ui/TierBadge';

const { width } = Dimensions.get('window');
const isTablet = width > 768;
const isSmallScreen = width < 380;

interface PrincipalWelcomeSectionProps {
  userName?: string;
  tier: string;
  subscriptionReady: boolean;
}

export const PrincipalWelcomeSection: React.FC<PrincipalWelcomeSectionProps> = ({
  userName,
  tier,
  subscriptionReady,
}) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = createStyles(theme);

  const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return t('dashboard.good_morning', { defaultValue: 'Good morning' });
    if (hour < 18) return t('dashboard.good_afternoon', { defaultValue: 'Good afternoon' });
    return t('dashboard.good_evening', { defaultValue: 'Good evening' });
  };

  return (
    <View style={styles.welcomeCard}>
      <View style={styles.welcomeContent}>
        <View style={styles.titleRow}>
          <View style={styles.titleLeft}>
            <Text style={styles.headerIcon}>🏫</Text>
            <Text style={styles.welcomeTitle}>{t('dashboard.school_overview', { defaultValue: 'School Overview' })}</Text>
          </View>
          <View style={styles.titleRight}>
            {/* Tier Badge */}
            {subscriptionReady && (
              <TierBadge size="md" showManageButton />
            )}
          </View>
        </View>
        <Text style={styles.welcomeGreeting}>
          {getGreeting()}, {userName || t('roles.principal', { defaultValue: 'Principal' })}!
        </Text>
        <Text style={styles.welcomeSubtitle}>
          {t('dashboard.welcome_subtitle', { defaultValue: 'Welcome to your dashboard' })}
        </Text>
        
        {/* Upgrade prompt for free tier */}
        {tier === 'free' && subscriptionReady && (
          <View style={styles.upgradePrompt}>
            <View style={styles.upgradePromptContent}>
              <Ionicons name="diamond" size={16} color="#FFD700" />
              <Text style={styles.upgradePromptText}>{t('dashboard.unlock_features')}</Text>
            </View>
            <TouchableOpacity
              style={styles.upgradePromptButton}
              onPress={() => router.push('/screens/subscription-upgrade-post')}
            >
              <Text style={styles.upgradePromptButtonText}>{t('common.upgrade')}</Text>
              <Ionicons name="arrow-forward" size={12} color={theme.primary} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  welcomeCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: isSmallScreen ? 12 : 16,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  welcomeContent: {
    padding: isSmallScreen ? 12 : 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    width: '100%',
  },
  titleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  titleRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  welcomeTitle: {
    fontSize: isSmallScreen ? 18 : 20,
    fontWeight: '700',
    color: theme.text,
  },
  welcomeGreeting: {
    fontSize: isSmallScreen ? 16 : 18,
    fontWeight: '600',
    color: theme.text,
    marginTop: 8,
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: isSmallScreen ? 14 : 16,
    color: theme.textSecondary,
  },
  webLayoutToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: theme.primaryLight,
    borderWidth: 1,
    borderColor: theme.primary,
  },
  webLayoutToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.primary,
  },
  upgradePrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.surface,
  },
  upgradePromptContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  upgradePromptText: {
    fontSize: isSmallScreen ? 12 : 14,
    color: theme.textSecondary,
    flex: 1,
  },
  upgradePromptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: theme.surface,
    gap: 4,
  },
  upgradePromptButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.primary,
  },
});

export default PrincipalWelcomeSection;
