/**
 * Membership Settings Screen
 * Organization settings for national_admin (CEO) role
 */
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { useOrganizationBranding } from '@/contexts/OrganizationBrandingContext';
import { 
  DashboardWallpaperBackground,
  DashboardWallpaperSettings,
  type DashboardSettings,
} from '@/components/membership/dashboard';

interface SettingItem {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  onPress?: () => void;
  badge?: string;
}

export default function MembershipSettingsScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { settings: brandingSettings, refetch: refetchBranding } = useOrganizationBranding();
  
  const [refreshing, setRefreshing] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState<string>('');
  const [dashboardSettings, setDashboardSettings] = useState<DashboardSettings>({});
  const [showWallpaperSettings, setShowWallpaperSettings] = useState(false);

  useEffect(() => {
    fetchOrganizationData();
  }, []);

  const fetchOrganizationData = async () => {
    try {
      const supabase = assertSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      const { data: membership } = await supabase
        .from('organization_members')
        .select('organization_id, organizations(id, name, dashboard_settings)')
        .eq('user_id', user.id)
        .eq('role', 'national_admin')
        .single();

      if (membership?.organization_id) {
        setOrganizationId(membership.organization_id);
        const org = membership.organizations as any;
        if (org) {
          setOrganizationName(org.name || '');
          if (org.dashboard_settings) {
            setDashboardSettings(org.dashboard_settings);
          }
        }
      }
    } catch (error) {
      console.error('[MembershipSettings] Error fetching organization:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrganizationData();
    setRefreshing(false);
  };

  const handleSettingsSaved = (newSettings: DashboardSettings) => {
    setDashboardSettings(newSettings);
    refetchBranding();
  };

  const organizationSettings: SettingItem[] = [
    {
      id: 'branding',
      title: 'Dashboard Branding',
      description: 'Wallpaper, logo, and appearance',
      icon: 'image-outline',
      iconColor: '#8B5CF6',
      onPress: () => setShowWallpaperSettings(true),
    },
    {
      id: 'org-profile',
      title: 'Organization Profile',
      description: 'Name, contact, and details',
      icon: 'business-outline',
      iconColor: '#3B82F6',
      onPress: () => {},
    },
    {
      id: 'regions',
      title: 'Regions & Branches',
      description: 'Manage regional structure',
      icon: 'map-outline',
      iconColor: '#10B981',
      onPress: () => router.push('/screens/membership/regional-managers'),
    },
  ];

  const memberSettings: SettingItem[] = [
    {
      id: 'member-types',
      title: 'Member Types',
      description: 'Configure membership categories',
      icon: 'people-outline',
      iconColor: '#F59E0B',
      onPress: () => {},
    },
    {
      id: 'tiers',
      title: 'Membership Tiers',
      description: 'Standard, Premium, VIP pricing',
      icon: 'ribbon-outline',
      iconColor: '#EC4899',
      onPress: () => {},
    },
    {
      id: 'id-cards',
      title: 'ID Card Templates',
      description: 'Customize member ID cards',
      icon: 'card-outline',
      iconColor: '#06B6D4',
      onPress: () => {},
    },
  ];

  const systemSettings: SettingItem[] = [
    {
      id: 'notifications',
      title: 'Notifications',
      description: 'Email and push settings',
      icon: 'notifications-outline',
      iconColor: '#EF4444',
      onPress: () => {},
    },
    {
      id: 'integrations',
      title: 'Integrations',
      description: 'Email, SMS, payment providers',
      icon: 'git-branch-outline',
      iconColor: '#6366F1',
      onPress: () => {},
    },
    {
      id: 'billing',
      title: 'Billing & Payments',
      description: 'Payment gateway settings',
      icon: 'wallet-outline',
      iconColor: '#22C55E',
      onPress: () => {},
    },
  ];

  const renderSettingItem = (item: SettingItem) => (
    <TouchableOpacity
      key={item.id}
      style={[styles.settingItem, { backgroundColor: theme.card, borderColor: theme.border }]}
      onPress={item.onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.settingIcon, { backgroundColor: item.iconColor + '15' }]}>
        <Ionicons name={item.icon} size={22} color={item.iconColor} />
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, { color: theme.text }]}>{item.title}</Text>
        <Text style={[styles.settingDescription, { color: theme.textSecondary }]}>
          {item.description}
        </Text>
      </View>
      {item.badge && (
        <View style={[styles.badge, { backgroundColor: theme.primary }]}>
          <Text style={styles.badgeText}>{item.badge}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
    </TouchableOpacity>
  );

  const renderSection = (title: string, items: SettingItem[]) => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      <View style={styles.sectionContent}>
        {items.map(renderSettingItem)}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Custom Header */}
      <View style={[styles.customHeader, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Settings</Text>
          {organizationName && (
            <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
              {organizationName}
            </Text>
          )}
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Wallpaper Settings Modal */}
      {organizationId && (
        <DashboardWallpaperSettings
          organizationId={organizationId}
          currentSettings={dashboardSettings}
          theme={theme}
          onSettingsUpdate={handleSettingsSaved}
          visible={showWallpaperSettings}
          onClose={() => setShowWallpaperSettings(false)}
          showTriggerButton={false}
        />
      )}

      <DashboardWallpaperBackground>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.primary}
            />
          }
        >
          {renderSection('Organization', organizationSettings)}
          {renderSection('Membership', memberSettings)}
          {renderSection('System', systemSettings)}
          
          {/* App Info */}
          <View style={styles.appInfo}>
            <Text style={[styles.appVersion, { color: theme.textSecondary }]}>
              EduDash Pro Membership v1.0.0
            </Text>
          </View>
        </ScrollView>
      </DashboardWallpaperBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  headerSpacer: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    marginLeft: 4,
  },
  sectionContent: {
    gap: 8,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  settingDescription: {
    fontSize: 13,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  appInfo: {
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
  },
  appVersion: {
    fontSize: 12,
  },
});
