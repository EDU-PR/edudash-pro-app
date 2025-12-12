import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useOrgAdminMetrics } from '@/hooks/useOrgAdminMetrics';

interface QuickActionsGridProps {
  theme: any;
}

export function QuickActionsGrid({ theme }: QuickActionsGridProps) {
  const { data: metrics } = useOrgAdminMetrics();

  const actions = [
    {
      label: 'Programs',
      route: '/screens/org-admin/programs',
      badge: metrics?.totalPrograms,
      icon: 'school-outline',
    },
    {
      label: 'Cohorts',
      route: '/screens/org-admin/cohorts',
      badge: metrics?.totalCohorts,
      icon: 'people-outline',
    },
    {
      label: 'Instructors',
      route: '/screens/org-admin/instructors',
      badge: metrics?.totalInstructors,
      icon: 'person-outline',
    },
    {
      label: 'Enrollments',
      route: '/screens/org-admin/enrollments',
      badge: metrics?.totalEnrollments,
      icon: 'list-outline',
    },
    {
      label: 'Certifications',
      route: '/screens/org-admin/certifications',
      badge: metrics?.totalCertifications,
      icon: 'ribbon-outline',
    },
    {
      label: 'Placements',
      route: '/screens/org-admin/placements',
      badge: metrics?.totalPlacements,
      icon: 'business-outline',
    },
    {
      label: 'Invoices',
      route: '/screens/org-admin/invoices',
      icon: 'document-text-outline',
    },
    {
      label: 'Settings',
      route: '/screens/org-admin/settings',
      icon: 'settings-outline',
    },
  ];

  return (
    <View style={createStyles(theme).container}>
      <Text style={createStyles(theme).title}>Quick Actions</Text>
      <View style={createStyles(theme).grid}>
        {actions.map((action, index) => (
          <ActionButton
            key={index}
            label={action.label}
            route={action.route}
            badge={action.badge}
            theme={theme}
          />
        ))}
      </View>
    </View>
  );
}

function ActionButton({
  label,
  route,
  badge,
  theme,
}: {
  label: string;
  route: string;
  badge?: number;
  theme: any;
}) {
  const styles = createStyles(theme);

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={() => router.push(route as any)}
      activeOpacity={0.7}
    >
      <Text style={styles.buttonText}>{label}</Text>
      {badge !== undefined && badge > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    gap: 12,
  },
  title: {
    color: theme.text,
    fontSize: 18,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  button: {
    flexBasis: '48%',
    backgroundColor: theme.card,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    minHeight: 70,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  buttonText: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: theme.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
});

