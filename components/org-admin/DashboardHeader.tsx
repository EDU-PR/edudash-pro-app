import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useOrganization } from '@/hooks/useOrganization';
import { useAuth } from '@/contexts/AuthContext';

interface DashboardHeaderProps {
  theme: any;
}

export function DashboardHeader({ theme }: DashboardHeaderProps) {
  const { profile } = useAuth();
  const { data: organization, isLoading } = useOrganization();

  const orgName = organization?.name || (profile as any)?.organization_name || 'Organization';
  const orgSlug = organization?.slug || null;

  if (isLoading) {
    return (
      <View style={createStyles(theme).header}>
        <View style={createStyles(theme).loadingPlaceholder}>
          <View style={[createStyles(theme).skeleton, { backgroundColor: theme.card }]} />
          <View style={[createStyles(theme).skeletonSmall, { backgroundColor: theme.card }]} />
        </View>
      </View>
    );
  }

  return (
    <View style={createStyles(theme).header}>
      <View style={createStyles(theme).headerContent}>
        <View style={createStyles(theme).orgIconContainer}>
          <Text style={createStyles(theme).orgIcon}>🏢</Text>
        </View>
        <View style={createStyles(theme).orgInfo}>
          <Text style={createStyles(theme).orgName} numberOfLines={1}>
            {orgName}
          </Text>
          {orgSlug && (
            <Text style={createStyles(theme).orgSlug} numberOfLines={1}>
              @{orgSlug}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    backgroundColor: theme.card,
    marginHorizontal: -16,
    marginTop: -16,
    paddingTop: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  orgIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: theme.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orgIcon: {
    fontSize: 24,
  },
  orgInfo: {
    flex: 1,
    gap: 2,
  },
  orgName: {
    color: theme.text,
    fontSize: 18,
    fontWeight: '700',
  },
  orgSlug: {
    color: theme.textSecondary,
    fontSize: 13,
  },
  loadingPlaceholder: {
    gap: 8,
  },
  skeleton: {
    height: 20,
    borderRadius: 4,
    width: '60%',
  },
  skeletonSmall: {
    height: 14,
    borderRadius: 4,
    width: '40%',
  },
});

