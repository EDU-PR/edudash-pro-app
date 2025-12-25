/**
 * Organization Dashboard - Regional Manager View
 * Regional command center for provincial/regional management
 * 
 * Refactored to use modular components from regional-dashboard folder
 */
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { assertSupabase } from '@/lib/supabase';
import { DashboardWallpaperBackground } from '@/components/membership/dashboard';

// Modular components
import {
  RegionalHero,
  ActionCardsGrid,
  BranchListItems,
  TaskItemList,
  LegacyActivityList,
  QuickStatsRow,
  PROVINCE_COLORS,
  MOCK_REGIONAL_STATS,
  REGIONAL_ACTIONS,
  type QuickStat,
  type TaskItem,
  type LegacyActivityItem,
} from '@/components/membership/regional-dashboard';

// Mock Data - Simple branches for list view
const BRANCHES = [
  { id: '1', name: 'Johannesburg Central', members: 234, status: 'active', manager: 'Sarah Molefe' },
  { id: '2', name: 'Pretoria East', members: 189, status: 'active', manager: 'John Sithole' },
  { id: '3', name: 'Soweto', members: 156, status: 'active', manager: 'Grace Dlamini' },
  { id: '4', name: 'Centurion', members: 143, status: 'active', manager: 'Thabo Khumalo' },
  { id: '5', name: 'Sandton', members: 128, status: 'active', manager: 'Nomvula Nkosi' },
];

const TASKS: TaskItem[] = [
  { task: 'Review 7 membership applications', icon: 'document-text', color: '#3B82F6', urgent: true },
  { task: 'Print 12 ID cards for collection', icon: 'card', color: '#F59E0B', urgent: true },
  { task: 'Schedule branch manager meeting', icon: 'people', color: '#8B5CF6', urgent: false },
  { task: 'Submit monthly report to national', icon: 'bar-chart', color: '#10B981', urgent: false },
];

const ACTIVITIES: LegacyActivityItem[] = [
  { icon: 'person-add', color: '#10B981', title: 'New member approved', subtitle: 'Thabo Mokoena - Johannesburg Central', time: '10 min ago' },
  { icon: 'card', color: '#3B82F6', title: 'ID card printed', subtitle: 'Sarah Nkosi - Pretoria East', time: '25 min ago' },
  { icon: 'calendar', color: '#F59E0B', title: 'Event registered', subtitle: 'Workshop attendance confirmed', time: '1 hour ago' },
];

export default function OrganizationDashboard() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [regionName, setRegionName] = useState<string>('Gauteng');
  const [regionColor, setRegionColor] = useState<string>('#3B82F6');
  const [regionCode, setRegionCode] = useState<string>('GP');

  useEffect(() => {
    checkUserRole();
  }, []);

  const checkUserRole = async () => {
    try {
      const supabase = assertSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/landing');
        return;
      }

      // Check organization_members for role and region
      const { data: member } = await supabase
        .from('organization_members')
        .select('role, member_type, province, region_id, organization_regions(name, code)')
        .eq('user_id', user.id)
        .single();

      if (member) {
        setUserRole(member.role);
        
        // If CEO/national_admin, redirect to CEO dashboard
        if (member.role === 'national_admin' || member.member_type === 'ceo') {
          router.replace('/screens/membership/ceo-dashboard');
          return;
        }

        // Set region info from database
        if (member.province) {
          const provinceConfig = PROVINCE_COLORS[member.province] || PROVINCE_COLORS['Gauteng'];
          setRegionName(provinceConfig.name);
          setRegionColor(provinceConfig.primary);
          setRegionCode(provinceConfig.code);
        } else if (member.organization_regions) {
          const region = member.organization_regions as any;
          const provinceConfig = PROVINCE_COLORS[region.name] || PROVINCE_COLORS['Gauteng'];
          setRegionName(region.name);
          setRegionColor(provinceConfig.primary);
          setRegionCode(region.code || provinceConfig.code);
        }
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error checking user role:', error);
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await checkUserRole();
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const formatCurrency = (amount: number) => `R ${(amount / 1000).toFixed(0)}K`;

  // Quick stats configuration
  const quickStats: QuickStat[] = [
    { id: 'revenue', icon: 'cash', value: formatCurrency(MOCK_REGIONAL_STATS.regionRevenue), label: 'Revenue', color: '#3B82F6' },
    { id: 'growth', icon: 'trending-up', value: `+${MOCK_REGIONAL_STATS.regionGrowth}%`, label: 'Growth', color: '#10B981', valueColor: '#10B981' },
    { id: 'cards', icon: 'card', value: String(MOCK_REGIONAL_STATS.idCardsIssued), label: 'ID Cards', color: '#8B5CF6' },
  ];

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Stack.Screen
        options={{
          title: 'Regional Dashboard',
          headerLargeTitle: true,
          headerRight: () => (
            <View style={styles.headerButtons}>
              <View style={[styles.regionBadgeHeader, { backgroundColor: regionColor }]}>
                <Text style={styles.regionBadgeText}>RM - {regionCode}</Text>
              </View>
              <TouchableOpacity style={styles.headerButton}>
                <Ionicons name="notifications-outline" size={24} color={theme.primary} />
                <View style={[styles.notificationBadge, { backgroundColor: '#EF4444' }]}>
                  <Text style={styles.notificationCount}>{MOCK_REGIONAL_STATS.pendingApplications}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerButton}>
                <Ionicons name="search-outline" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      <DashboardWallpaperBackground>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
          }
        >
        {/* Region Header Card */}
        <RegionalHero
          regionName={regionName}
          regionCode={regionCode}
          regionColor={regionColor}
          stats={MOCK_REGIONAL_STATS}
        />

        {/* Urgent Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Action Required</Text>
          <ActionCardsGrid actions={REGIONAL_ACTIONS} theme={theme} />
        </View>

        {/* Today's Tasks */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Today's Tasks</Text>
          <TaskItemList tasks={TASKS} theme={theme} />
        </View>

        {/* Branch Performance */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Branch Performance</Text>
            <TouchableOpacity>
              <Text style={[styles.seeAll, { color: theme.primary }]}>View All</Text>
            </TouchableOpacity>
          </View>
          <BranchListItems branches={BRANCHES} theme={theme} maxItems={5} />
        </View>

        {/* Quick Stats Row */}
        <View style={styles.section}>
          <QuickStatsRow stats={quickStats} theme={theme} />
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Activity</Text>
            <TouchableOpacity>
              <Text style={[styles.seeAll, { color: theme.primary }]}>View All</Text>
            </TouchableOpacity>
          </View>
          <LegacyActivityList activities={ACTIVITIES} theme={theme} />
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
    marginRight: 16,
    alignItems: 'center',
  },
  regionBadgeHeader: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  regionBadgeText: {
    color: '#fff',
    fontSize: 11,
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
});
