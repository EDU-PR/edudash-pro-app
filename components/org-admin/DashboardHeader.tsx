import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useOrganization } from '@/hooks/useOrganization';
import { useAuth } from '@/contexts/AuthContext';
import { normalizePersonName } from '@/lib/utils/nameUtils';

interface DashboardHeaderProps {
  theme: any;
}

export function DashboardHeader({ theme }: DashboardHeaderProps) {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const { data: organization, isLoading } = useOrganization();

  const orgName = organization?.name || (profile as any)?.organization_name || t('org_admin.organization', { defaultValue: 'Organization' });

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return t('dashboard.good_morning', { defaultValue: 'Good morning' });
    if (hour < 18) return t('dashboard.good_afternoon', { defaultValue: 'Good afternoon' });
    return t('dashboard.good_evening', { defaultValue: 'Good evening' });
  }, [t]);

  const normalizedName = normalizePersonName({
    first: profile?.first_name || user?.user_metadata?.first_name,
    last: profile?.last_name || user?.user_metadata?.last_name,
    full: profile?.full_name || user?.user_metadata?.full_name,
  });
  const userName = normalizedName.fullName || normalizedName.shortName || t('org_admin.admin', { defaultValue: 'Admin' });

  const styles = useMemo(() => createStyles(theme), [theme]);

  if (isLoading) {
    return (
      <View style={styles.header}>
        <View style={styles.loadingPlaceholder}>
          <View style={[styles.skeleton, { backgroundColor: theme.surface }]} />
          <View style={[styles.skeletonSmall, { backgroundColor: theme.surface }]} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Text style={styles.greeting} numberOfLines={1}>
          {greeting}, {userName}
        </Text>
        <View style={styles.headerMetaRow}>
          <Text style={styles.orgName} numberOfLines={1}>
            {orgName}
          </Text>
        </View>
      </View>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 6,
    marginHorizontal: -16,
    marginTop: -16,
    paddingTop: 16,
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.text,
  },
  headerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  orgName: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.textSecondary,
  },
  loadingPlaceholder: {
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
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

