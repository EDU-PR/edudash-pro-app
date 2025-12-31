/**
 * CEO Dashboard - Executive Overview & Strategic Management
 * Connected to real Supabase data - NO MOCK DATA
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
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { MobileNavDrawer } from '@/components/navigation/MobileNavDrawer';
import { useOrganizationBranding } from '@/contexts/OrganizationBrandingContext';
import { useOrganizationStats, type RegionWithStats } from '@/hooks/membership/useOrganizationStats';
import {
  DashboardBackground,
  DashboardWallpaperSettings,
  type DashboardSettings,
  PROVINCE_COLORS,
} from '@/components/membership/dashboard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Executive Actions - static navigation items
const EXECUTIVE_ACTIONS = [
  { id: 'broadcast', icon: 'megaphone', label: 'Broadcast', route: '/screens/membership/broadcast', color: '#EF4444' },
  { id: 'members', icon: 'people', label: 'Members', route: '/screens/membership/members', color: '#3B82F6' },
  { id: 'regional', icon: 'map', label: 'Regions', route: '/screens/membership/regional-managers', color: '#10B981' },
  { id: 'documents', icon: 'folder-open', label: 'Documents', route: '/screens/membership/documents', color: '#6366F1' },
  { id: 'events', icon: 'calendar', label: 'Events', route: '/screens/membership/events', color: '#F59E0B' },
  { id: 'settings', icon: 'settings', label: 'Settings', route: '/screens/membership/settings', color: '#8B5CF6' },
];

export default function CEODashboard() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { refetch: refetchBranding } = useOrganizationBranding();
  
  // Real data from Supabase
  const { 
    stats, 
    regions, 
    pendingMembers, 
    loading, 
    error, 
    refetch,
    organizationId,
    organizationName,
  } = useOrganizationStats();
  
  const [refreshing, setRefreshing] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showWallpaperSettings, setShowWallpaperSettings] = useState(false);
  const [dashboardSettings, setDashboardSettings] = useState<DashboardSettings>({});

  const handleSettingsSaved = (newSettings: DashboardSettings) => {
    setDashboardSettings(newSettings);
    setShowWallpaperSettings(false);
    refetchBranding();
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const getProvinceColor = (provinceName: string) => {
    return PROVINCE_COLORS[provinceName]?.primary || '#6B7280';
  };

  // Loading state
  if (loading && !stats) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading dashboard...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error && !stats) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.error || '#EF4444'} />
          <Text style={[styles.errorText, { color: theme.text }]}>{error}</Text>
          <TouchableOpacity style={[styles.retryButton, { backgroundColor: theme.primary }]} onPress={refetch}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

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
            <Text style={[styles.headerTitle, { color: theme.text }]}>President</Text>
            <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
              {organizationName || 'Executive Overview'}
            </Text>
          </View>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => setShowWallpaperSettings(true)}
          >
            <Ionicons name="color-palette-outline" size={22} color={theme.primary} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => router.push('/screens/notifications')}
          >
            <Ionicons name="notifications-outline" size={24} color={theme.primary} />
            {(stats?.pendingApprovals || 0) > 0 && (
              <View style={[styles.notificationBadge, { backgroundColor: '#EF4444' }]}>
                <Text style={styles.notificationCount}>{stats?.pendingApprovals}</Text>
              </View>
            )}
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

          {/* Executive Summary - REAL DATA */}
          <Card padding={0} margin={0} style={styles.summaryCard}>
            <View style={[styles.summaryHeader, { backgroundColor: '#3B82F6' }]}>
              <Text style={styles.summaryTitle}>Organization Overview</Text>
              <View style={styles.growthBadge}>
                <Ionicons 
                  name={stats?.membershipGrowth && stats.membershipGrowth >= 0 ? 'trending-up' : 'trending-down'} 
                  size={14} 
                  color="#fff" 
                />
                <Text style={styles.growthText}>
                  {stats?.membershipGrowth ? `${stats.membershipGrowth > 0 ? '+' : ''}${stats.membershipGrowth}%` : '0%'}
                </Text>
              </View>
            </View>
            <View style={styles.summaryContent}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, { color: theme.text }]}>
                    {formatNumber(stats?.totalMembers || 0)}
                  </Text>
                  <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Total Members</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, { color: '#10B981' }]}>
                    {formatNumber(stats?.activeMembers || 0)}
                  </Text>
                  <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Active</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, { color: '#F59E0B' }]}>
                    {stats?.pendingApprovals || 0}
                  </Text>
                  <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Pending</Text>
                </View>
              </View>
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, { color: theme.text }]}>
                    {stats?.activeRegions || 0}/{stats?.totalRegions || 0}
                  </Text>
                  <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Regions</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, { color: '#3B82F6' }]}>
                    {stats?.regionalManagersAssigned || 0}
                  </Text>
                  <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Managers</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, { color: '#EF4444' }]}>
                    {stats?.regionalManagersVacant || 0}
                  </Text>
                  <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Vacant</Text>
                </View>
              </View>
            </View>
          </Card>

          {/* Executive Actions */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick Actions</Text>
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

          {/* Regional Performance - REAL DATA */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Regional Performance</Text>
              <TouchableOpacity onPress={() => router.push('/screens/membership/regional-managers')}>
                <Text style={[styles.seeAll, { color: theme.primary }]}>View All</Text>
              </TouchableOpacity>
            </View>
            
            {regions.length === 0 ? (
              <Card padding={20} margin={0}>
                <View style={styles.emptyState}>
                  <Ionicons name="map-outline" size={40} color={theme.textSecondary} />
                  <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>
                    No regions configured yet
                  </Text>
                </View>
              </Card>
            ) : (
              <Card padding={0} margin={0}>
                {regions.slice(0, 5).map((region, index) => (
                  <View key={region.id}>
                    <TouchableOpacity 
                      style={styles.regionItem}
                      onPress={() => router.push(`/screens/membership/region-detail?id=${region.id}`)}
                    >
                      <View style={[styles.regionBadge, { backgroundColor: getProvinceColor(region.name) + '20' }]}>
                        <Text style={[styles.regionCode, { color: getProvinceColor(region.name) }]}>
                          {region.code || region.province_code || 'XX'}
                        </Text>
                      </View>
                      <View style={styles.regionInfo}>
                        <Text style={[styles.regionName, { color: theme.text }]}>{region.name}</Text>
                        <Text style={[styles.regionManager, { color: theme.textSecondary }]}>
                          {region.manager_name || '⚠️ No Manager Assigned'}
                        </Text>
                      </View>
                      <View style={styles.regionStats}>
                        <Text style={[styles.regionMemberCount, { color: theme.text }]}>
                          {region.member_count}
                        </Text>
                        <Text style={[styles.regionMemberLabel, { color: theme.textSecondary }]}>members</Text>
                      </View>
                      {region.pending_count > 0 && (
                        <View style={[styles.pendingBadge, { backgroundColor: '#F59E0B' }]}>
                          <Text style={styles.pendingCount}>{region.pending_count}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                    {index < Math.min(regions.length - 1, 4) && (
                      <View style={[styles.divider, { backgroundColor: theme.border }]} />
                    )}
                  </View>
                ))}
              </Card>
            )}
          </View>

          {/* Pending Approvals - REAL DATA */}
          {pendingMembers.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Pending Approvals</Text>
                <View style={[styles.urgentBadge, { backgroundColor: '#EF4444' }]}>
                  <Text style={styles.urgentText}>{pendingMembers.length}</Text>
                </View>
              </View>
              
              <Card padding={0} margin={0}>
                {pendingMembers.slice(0, 5).map((member, index) => (
                  <View key={member.id}>
                    <TouchableOpacity 
                      style={styles.approvalItem}
                      onPress={() => router.push(`/screens/membership/member-detail?id=${member.id}`)}
                    >
                      <View style={[styles.approvalIcon, { backgroundColor: '#F59E0B15' }]}>
                        <Ionicons name="person-outline" size={20} color="#F59E0B" />
                      </View>
                      <View style={styles.approvalInfo}>
                        <Text style={[styles.approvalTitle, { color: theme.text }]}>
                          {member.first_name} {member.last_name}
                        </Text>
                        <Text style={[styles.approvalDescription, { color: theme.textSecondary }]}>
                          {member.member_type} • {member.region_name}
                        </Text>
                      </View>
                      <TouchableOpacity 
                        style={[styles.approveButton, { backgroundColor: '#10B981' }]}
                        onPress={() => Alert.alert('Approve', `Approve ${member.first_name}?`)}
                      >
                        <Ionicons name="checkmark" size={16} color="#fff" />
                      </TouchableOpacity>
                    </TouchableOpacity>
                    {index < Math.min(pendingMembers.length - 1, 4) && (
                      <View style={[styles.divider, { backgroundColor: theme.border }]} />
                    )}
                  </View>
                ))}
                {pendingMembers.length > 5 && (
                  <TouchableOpacity 
                    style={styles.viewMoreButton}
                    onPress={() => router.push('/screens/membership/approvals')}
                  >
                    <Text style={[styles.viewMoreText, { color: theme.primary }]}>
                      View all {pendingMembers.length} pending approvals
                    </Text>
                  </TouchableOpacity>
                )}
              </Card>
            </View>
          )}

          {/* System Status */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>System Status</Text>
            <View style={styles.healthGrid}>
              <Card padding={16} margin={0} style={styles.healthCard}>
                <View style={[styles.healthIconContainer, { backgroundColor: '#10B98115' }]}>
                  <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                </View>
                <Text style={[styles.healthCardValue, { color: '#10B981' }]}>Online</Text>
                <Text style={[styles.healthCardLabel, { color: theme.textSecondary }]}>
                  Platform Status
                </Text>
              </Card>
              
              <Card padding={16} margin={0} style={styles.healthCard}>
                <View style={[styles.healthIconContainer, { backgroundColor: '#3B82F615' }]}>
                  <Ionicons name="people" size={24} color="#3B82F6" />
                </View>
                <Text style={[styles.healthCardValue, { color: '#3B82F6' }]}>
                  +{stats?.newMembersThisMonth || 0}
                </Text>
                <Text style={[styles.healthCardLabel, { color: theme.textSecondary }]}>
                  New This Month
                </Text>
              </Card>
              
              <Card padding={16} margin={0} style={styles.healthCard}>
                <View style={[styles.healthIconContainer, { backgroundColor: '#F59E0B15' }]}>
                  <Ionicons name="map" size={24} color="#F59E0B" />
                </View>
                <Text style={[styles.healthCardValue, { color: '#F59E0B' }]}>
                  {stats?.activeRegions || 0}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
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

  // Summary Card
  summaryCard: {
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  summaryTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  growthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  growthText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  summaryContent: {
    padding: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  summaryLabel: {
    fontSize: 11,
    marginTop: 4,
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

  // Region Items
  regionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  regionBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  regionCode: {
    fontSize: 14,
    fontWeight: '700',
  },
  regionInfo: {
    flex: 1,
  },
  regionName: {
    fontSize: 15,
    fontWeight: '600',
  },
  regionManager: {
    fontSize: 12,
    marginTop: 2,
  },
  regionStats: {
    alignItems: 'flex-end',
  },
  regionMemberCount: {
    fontSize: 18,
    fontWeight: '700',
  },
  regionMemberLabel: {
    fontSize: 10,
  },
  pendingBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  pendingCount: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    gap: 8,
  },
  emptyStateText: {
    fontSize: 14,
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
  approvalTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  approvalDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  approveButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
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
  viewMoreButton: {
    padding: 16,
    alignItems: 'center',
  },
  viewMoreText: {
    fontSize: 14,
    fontWeight: '600',
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
