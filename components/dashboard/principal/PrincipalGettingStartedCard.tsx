/**
 * Principal Getting Started
 *
 * Guided onboarding embedded directly in the dashboard.
 * Shown only when the school looks "new" (missing core setup).
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';

import { useTheme } from '@/contexts/ThemeContext';
import type { SchoolStats } from '@/hooks/usePrincipalHub';

const { width } = Dimensions.get('window');
const isTablet = width > 768;
const isSmallScreen = width < 380;

export interface PrincipalGettingStartedCardProps {
  stats?: SchoolStats | null;
}

export const PrincipalGettingStartedCard: React.FC<PrincipalGettingStartedCardProps> = ({ stats }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const students = stats?.students?.total ?? 0;
  const teachers = stats?.staff?.total ?? 0;
  const classes = stats?.classes?.total ?? 0;

  const steps = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      subtitle: string;
      done: boolean;
      icon: React.ComponentProps<typeof Ionicons>['name'];
      route: string;
      cta: string;
    }> = [
      {
        id: 'teachers',
        title: t('onboarding.invite_teachers', { defaultValue: 'Invite teachers' }),
        subtitle: t('onboarding.invite_teachers_sub', { defaultValue: 'Send an invite link. They can sign in on their phone.' }),
        done: teachers > 0,
        icon: 'people',
        route: '/screens/teacher-management',
        cta: t('common.open', { defaultValue: 'Open' }),
      },
      {
        id: 'classes',
        title: t('onboarding.create_classes', { defaultValue: 'Create classes' }),
        subtitle: t('onboarding.create_classes_sub', { defaultValue: 'Group learners into classes so attendance and lessons work.' }),
        done: classes > 0,
        icon: 'library',
        route: '/screens/class-teacher-management',
        cta: t('common.open', { defaultValue: 'Open' }),
      },
      {
        id: 'students',
        title: t('onboarding.add_students', { defaultValue: 'Add students' }),
        subtitle: t('onboarding.add_students_sub', { defaultValue: 'Add learners so parents can link and fees can be tracked.' }),
        done: students > 0,
        icon: 'school',
        route: '/screens/student-management',
        cta: t('common.open', { defaultValue: 'Open' }),
      },
      {
        id: 'fees',
        title: t('onboarding.set_fees', { defaultValue: 'Set fees (optional)' }),
        subtitle: t('onboarding.set_fees_sub', { defaultValue: 'Set fee rules so reminders and payment tracking work.' }),
        done: true,
        icon: 'cash',
        route: '/screens/finance-control-center?tab=overview',
        cta: t('common.open', { defaultValue: 'Open' }),
      },
    ];

    // Prioritize undone steps first.
    return items.sort((a, b) => Number(a.done) - Number(b.done));
  }, [classes, students, t, teachers]);

  const shouldShow = students === 0 || teachers === 0 || classes === 0;
  if (!shouldShow) return null;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.iconBadge}>
            <Ionicons name="sparkles" size={18} color={theme.primary} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>{t('onboarding.get_started', { defaultValue: 'Get started' })}</Text>
            <Text style={styles.subtitle} numberOfLines={2}>
              {t('onboarding.get_started_sub', { defaultValue: 'Do these 3 steps once. After that the dashboard will fill itself.' })}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.steps}>
        {steps.map((step) => (
          <TouchableOpacity
            key={step.id}
            style={[styles.stepRow, step.done && styles.stepRowDone]}
            onPress={() => router.push(step.route as any)}
            activeOpacity={0.85}
          >
            <View style={[styles.stepIcon, { backgroundColor: step.done ? `${theme.success}1A` : `${theme.primary}12` }]}>
              <Ionicons
                name={step.done ? 'checkmark' : step.icon}
                size={18}
                color={step.done ? (theme.success || '#10B981') : theme.primary}
              />
            </View>
            <View style={styles.stepText}>
              <Text style={styles.stepTitle} numberOfLines={1}>
                {step.title}
              </Text>
              <Text style={styles.stepSubtitle} numberOfLines={2}>
                {step.subtitle}
              </Text>
            </View>
            <View style={styles.stepCta}>
              <Text style={styles.ctaText}>{step.cta}</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.textTertiary || theme.textSecondary} />
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    card: {
      marginTop: 10,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.cardBackground || theme.surface,
      padding: isSmallScreen ? 12 : 14,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: 10,
    },
    iconBadge: {
      width: 34,
      height: 34,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: `${theme.primary}12`,
    },
    headerText: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      fontSize: isTablet ? 18 : 16,
      fontWeight: '800',
      color: theme.text,
    },
    subtitle: {
      marginTop: 2,
      fontSize: 12,
      color: theme.textSecondary,
      lineHeight: 16,
    },
    steps: {
      gap: 10,
    },
    stepRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: `${theme.background}00`,
    },
    stepRowDone: {
      opacity: 0.85,
    },
    stepIcon: {
      width: 34,
      height: 34,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    stepText: {
      flex: 1,
      minWidth: 0,
    },
    stepTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 2,
    },
    stepSubtitle: {
      fontSize: 12,
      color: theme.textSecondary,
      lineHeight: 16,
    },
    stepCta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginLeft: 10,
    },
    ctaText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.primary,
    },
  });

export default PrincipalGettingStartedCard;
