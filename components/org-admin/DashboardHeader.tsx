import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useOrganization } from '@/hooks/useOrganization';
import { useAuth } from '@/contexts/AuthContext';

interface DashboardHeaderProps {
  theme: any;
}

export function DashboardHeader({ theme }: DashboardHeaderProps) {
  const { profile } = useAuth();
  const { data: organization } = useOrganization();

  const orgName = organization?.name || (profile as any)?.organization_name || 'Organization';
  const orgSlug = organization?.slug || null;

  return (
    <View style={createStyles(theme).header}>
      <View>
        <Text style={createStyles(theme).orgName}>{orgName}</Text>
        {orgSlug && (
          <Text style={createStyles(theme).orgSlug}>@{orgSlug}</Text>
        )}
      </View>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  orgName: {
    color: theme.text,
    fontSize: 18,
    fontWeight: '700',
  },
  orgSlug: {
    color: theme.textSecondary,
    fontSize: 14,
    marginTop: 2,
  },
});

