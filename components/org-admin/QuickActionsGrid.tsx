import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useOrgAdminMetrics } from '@/hooks/useOrgAdminMetrics';

interface QuickActionsGridProps {
  theme: any;
}

export function QuickActionsGrid({ theme }: QuickActionsGridProps) {
  const { data: metrics } = useOrgAdminMetrics();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const actions = [
    {
      label: 'Programs',
      route: '/screens/org-admin/programs',
      badge: metrics?.totalPrograms,
      icon: 'school-outline' as keyof typeof Ionicons.glyphMap,
    },
    {
      label: 'Cohorts',
      route: '/screens/org-admin/cohorts',
      badge: metrics?.totalCohorts,
      icon: 'people-outline' as keyof typeof Ionicons.glyphMap,
    },
    {
      label: 'Instructors',
      route: '/screens/org-admin/instructors',
      badge: metrics?.totalInstructors,
      icon: 'person-outline' as keyof typeof Ionicons.glyphMap,
    },
    {
      label: 'Enrollments',
      route: '/screens/org-admin/enrollments',
      badge: metrics?.totalEnrollments,
      icon: 'list-outline' as keyof typeof Ionicons.glyphMap,
    },
    {
      label: 'Certifications',
      route: '/screens/org-admin/certifications',
      badge: metrics?.totalCertifications,
      icon: 'ribbon-outline' as keyof typeof Ionicons.glyphMap,
    },
    {
      label: 'Placements',
      route: '/screens/org-admin/placements',
      badge: metrics?.totalPlacements,
      icon: 'business-outline' as keyof typeof Ionicons.glyphMap,
    },
    {
      label: 'Invoices',
      route: '/screens/org-admin/invoices',
      icon: 'document-text-outline' as keyof typeof Ionicons.glyphMap,
    },
    {
      label: 'Settings',
      route: '/screens/org-admin/settings',
      icon: 'settings-outline' as keyof typeof Ionicons.glyphMap,
    },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Quick Actions</Text>
      <View style={styles.grid}>
        {actions.map((action) => (
          <TouchableOpacity
            key={action.label}
            style={styles.button}
            onPress={() => router.push(action.route as any)}
            activeOpacity={0.7}
          >
            <View style={styles.buttonIconWrap}>
              <Ionicons name={action.icon} size={22} color={theme.primary} />
            </View>
            <Text style={styles.buttonText}>{action.label}</Text>
            {action.badge !== undefined && action.badge > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{action.badge}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    gap: 12,
  },
  title: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '800',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  button: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: theme.surface,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    minHeight: 80,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    gap: 6,
  },
  buttonIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.primary + '14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: theme.text,
    fontSize: 13,
    fontWeight: '700',
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

