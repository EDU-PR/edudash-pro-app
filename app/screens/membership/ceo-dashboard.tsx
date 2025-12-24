/**
 * CEO Dashboard - Executive Overview & Strategic Management
 * High-level organizational metrics and strategic controls
 * Refactored to use modular components from @/components/membership/dashboard
 */
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Dimensions,
  RefreshControl,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { MobileNavDrawer } from '@/components/navigation/MobileNavDrawer';
import { assertSupabase } from '@/lib/supabase';
import { useOrganizationBranding } from '@/contexts/OrganizationBrandingContext';
import {
  ExecutiveSummaryCard,
  StrategicPriorities,
  RegionalPerformanceList,
  DashboardBackground,
  DashboardWallpaperSettings,
  MOCK_EXECUTIVE_STATS,
  MOCK_REGIONAL_PERFORMANCE,
  MOCK_STRATEGIC_PRIORITIES,
  MOCK_EXECUTIVE_ACTIONS,
  type DashboardSettings,
} from '@/components/membership/dashboard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Alias for backward compatibility
const EXECUTIVE_STATS = MOCK_EXECUTIVE_STATS;
const EXECUTIVE_ACTIONS = MOCK_EXECUTIVE_ACTIONS;

export default function CEODashboard() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { refetch: refetchBranding } = useOrganizationBranding();
  const [refreshing, setRefreshing] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showWallpaperSettings, setShowWallpaperSettings] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [dashboardSettings, setDashboardSettings] = useState<DashboardSettings>({});

  useEffect(() => {
    fetchOrganizationSettings();
  }, []);

  const fetchOrganizationSettings = async () => {
    try {
      const supabase = assertSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      console.log('[CEODashboard] User:', user?.id);
      if (!user) return;

      // Get user's organization
      const { data: member, error: memberError } = await supabase
        .from('organization_members')
        .select('organization_id, organizations(id, dashboard_settings)')
        .eq('user_id', user.id)
        .single();

      console.log('[CEODashboard] Member query result:', { member, memberError });

      if (member?.organization_id) {
        console.log('[CEODashboard] Setting organization ID:', member.organization_id);
        setOrganizationId(member.organization_id);
        const org = member.organizations as any;
        if (org?.dashboard_settings) {
          console.log('[CEODashboard] Dashboard settings from org:', org.dashboard_settings);
          setDashboardSettings(org.dashboard_settings);
        }
      } else {
        console.log('[CEODashboard] No organization found for user');
      }
    } catch (error) {
      console.error('[CEODashboard] Error fetching organization settings:', error);
    }
  };

  const handleSettingsSaved = (newSettings: DashboardSettings) => {
    setDashboardSettings(newSettings);
    setShowWallpaperSettings(false);
    // Refetch branding context so other screens get the update immediately
    refetchBranding();
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrganizationSettings();
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const formatCurrency = (amount: number) => {
    return `R ${(amount / 1000).toFixed(0)}K`;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#EF4444';
      case 'medium': return '#F59E0B';
      case 'low': return '#10B981';
      default: return '#6B7280';
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Mobile Navigation Drawer */}
      <MobileNavDrawer 
        isOpen={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)} 
      />
      
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
      
      {/* Custom Header */}
      <View style={[styles.customHeader, { backgroundColor: theme.background }]}>
        <View style={styles.headerLeftSection}>
          <TouchableOpacity 
            style={styles.hamburgerButton}
            onPress={() => setIsDrawerOpen(true)}
          >
            <Ionicons name="menu" size={26} color={theme.text} />
          </TouchableOpacity>
          <View style={styles.headerLeft}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>CEO Dashboard</Text>
            <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>Executive Overview</Text>
          </View>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => setShowWallpaperSettings(true)}
          >
            <Ionicons name="color-palette-outline" size={22} color={theme.primary} />
          </TouchableOpacity>
          <View style={styles.ceoBadge}>
            <Text style={styles.ceoBadgeText}>CEO</Text>
          </View>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => router.push('/screens/notifications')}
          >
            <Ionicons name="notifications-outline" size={24} color={theme.primary} />
            <View style={[styles.notificationBadge, { backgroundColor: '#EF4444' }]}>
              <Text style={styles.notificationCount}>5</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => Alert.alert('Coming Soon', 'Email integration will be available in a future update.')}
          >
            <Ionicons name="mail-outline" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      <DashboardBackground settings={dashboardSettings}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
          }
        >
          {/* Custom Greeting */}
          {dashboardSettings.custom_greeting && (
            <View style={[styles.greetingContainer, { backgroundColor: theme.card + 'E6' }]}>
              <Text style={[styles.greetingText, { color: theme.text }]}>
                {dashboardSettings.custom_greeting}
              </Text>
            </View>
          )}

          {/* Executive Summary Card */}
          <ExecutiveSummaryCard stats={EXECUTIVE_STATS} />

          {/* Executive Actions */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Executive Actions</Text>
            <View style={styles.actionsGrid}>
              {EXECUTIVE_ACTIONS.map((action) => (
                <TouchableOpacity
                  key={action.id}
                  style={[styles.actionCard, { backgroundColor: theme.card }]}
                  onPress={() => router.push(action.route as any)}
                >
                  <View style={[styles.actionIcon, { backgroundColor: action.color + '15' }]}>
                    <Ionicons name={action.icon as any} size={24} color={action.color} />
                  </View>
                  <Text style={[styles.actionLabel, { color: theme.text }]}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Strategic Priorities */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Strategic Priorities</Text>
              <TouchableOpacity>
                <Text style={[styles.seeAll, { color: theme.primary }]}>Manage</Text>
              </TouchableOpacity>
            </View>
            <StrategicPriorities 
              priorities={MOCK_STRATEGIC_PRIORITIES}
              theme={theme}
            />
          </View>

          {/* Regional Performance Overview */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Regional Performance</Text>
              <TouchableOpacity>
                <Text style={[styles.seeAll, { color: theme.primary }]}>View All</Text>
              </TouchableOpacity>
            </View>
            <RegionalPerformanceList 
              regions={MOCK_REGIONAL_PERFORMANCE}
              theme={theme}
            />
          </View>

          {/* Key Decisions & Approvals */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Pending Approvals</Text>
              <View style={[styles.urgentBadge, { backgroundColor: '#EF4444' }]}>
                <Text style={styles.urgentText}>{EXECUTIVE_STATS.pendingApprovals}</Text>
              </View>
            </View>
            
            <Card padding={0} margin={0}>
              {[
                { 
                  icon: 'briefcase', 
                  color: '#3B82F6', 
                  title: 'Regional Manager Applications', 
                  description: '8 candidates awaiting review',
                  urgent: true,
                },
                { 
                  icon: 'document-text', 
                  color: '#F59E0B', 
                  title: 'Budget Proposals', 
                  description: '3 regional budgets for Q1 2026',
                  urgent: false,
                },
                { 
                  icon: 'ribbon', 
                  color: '#8B5CF6', 
                  title: 'Strategic Initiatives', 
                  description: '5 new proposals from regional teams',
                  urgent: false,
                },
                { 
                  icon: 'cash', 
                  color: '#10B981', 
                  title: 'Financial Authorizations', 
                  description: '7 expenditure requests > R50K',
                  urgent: true,
                },
              ].map((item, index) => (
                <View key={index}>
                  <TouchableOpacity style={styles.approvalItem}>
                    <View style={[styles.approvalIcon, { backgroundColor: item.color + '15' }]}>
                      <Ionicons name={item.icon as any} size={20} color={item.color} />
                    </View>
                    <View style={styles.approvalInfo}>
                      <View style={styles.approvalTitleRow}>
                        <Text style={[styles.approvalTitle, { color: theme.text }]}>{item.title}</Text>
                        {item.urgent && (
                          <View style={styles.urgentIndicator}>
                            <Ionicons name="alert-circle" size={14} color="#EF4444" />
                          </View>
                        )}
                      </View>
                      <Text style={[styles.approvalDescription, { color: theme.textSecondary }]}>
                        {item.description}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                  </TouchableOpacity>
                  {index < 3 && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
                </View>
              ))}
            </Card>
          </View>

          {/* System Health & Alerts */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>System Health</Text>
            
            <View style={styles.healthGrid}>
              <Card padding={16} margin={0} style={styles.healthCard}>
                <View style={[styles.healthIconContainer, { backgroundColor: '#10B98115' }]}>
                  <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                </View>
                <Text style={[styles.healthCardValue, { color: '#10B981' }]}>Excellent</Text>
                <Text style={[styles.healthCardLabel, { color: theme.textSecondary }]}>
                  Platform Status
                </Text>
              </Card>
              
              <Card padding={16} margin={0} style={styles.healthCard}>
                <View style={[styles.healthIconContainer, { backgroundColor: '#3B82F615' }]}>
                  <Ionicons name="shield-checkmark" size={24} color="#3B82F6" />
                </View>
                <Text style={[styles.healthCardValue, { color: '#3B82F6' }]}>Secure</Text>
                <Text style={[styles.healthCardLabel, { color: theme.textSecondary }]}>
                  Data Protection
                </Text>
              </Card>
              
              <Card padding={16} margin={0} style={styles.healthCard}>
                <View style={[styles.healthIconContainer, { backgroundColor: '#F59E0B15' }]}>
                  <Ionicons name="people" size={24} color="#F59E0B" />
                </View>
                <Text style={[styles.healthCardValue, { color: '#F59E0B' }]}>
                  {EXECUTIVE_STATS.activeRegions}/{EXECUTIVE_STATS.activeRegions}
                </Text>
                <Text style={[styles.healthCardLabel, { color: theme.textSecondary }]}>
                  Active Regions
                </Text>
              </Card>
            </View>
          </View>
        </ScrollView>
      </DashboardBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Custom Header
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  headerLeftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  hamburgerButton: {
    padding: 4,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  ceoBadge: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  ceoBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  headerButton: {
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notificationCount: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  content: {
    padding: 16,
  },
  greetingContainer: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  greetingText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Section
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Actions Grid
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: (SCREEN_WIDTH - 44) / 3,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Approvals
  approvalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  approvalIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approvalInfo: {
    flex: 1,
  },
  approvalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  approvalTitle: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  urgentIndicator: {},
  approvalDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  urgentBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  urgentText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },

  // Health Cards
  healthGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  healthCard: {
    flex: 1,
    borderRadius: 16,
    alignItems: 'center',
  },
  healthIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  healthCardValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  healthCardLabel: {
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },

  // Divider
  divider: {
    height: 1,
    marginHorizontal: 16,
  },
});
