/**
 * Regional Managers Screen
 * Display and manage regional managers - REAL DATA from Supabase
 */
import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardWallpaperBackground, PROVINCE_COLORS } from '@/components/membership/dashboard';
import { useOrganizationStats, type RegionWithStats } from '@/hooks/membership/useOrganizationStats';

// Province code to color mapping
const CODE_COLORS: Record<string, string> = {
  GP: '#3B82F6',
  WC: '#10B981',
  KZN: '#F59E0B',
  EC: '#EF4444',
  MP: '#8B5CF6',
  LP: '#EC4899',
  FS: '#06B6D4',
  NW: '#84CC16',
  NC: '#F97316',
};

export default function RegionalManagersScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  
  // Get member type to filter for youth president
  const memberType = (profile as any)?.organization_membership?.member_type;
  const isYouthPresident = memberType === 'youth_president' || memberType === 'youth_secretary';
  
  // Real data from Supabase - filter for youth structure if youth president
  const { regions, loading, error, refetch } = useOrganizationStats({ 
    memberType: isYouthPresident ? memberType : undefined 
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const getColorForRegion = (region: RegionWithStats) => {
    // Try province_code first, then code
    const code = region.province_code || region.code;
    return CODE_COLORS[code] || PROVINCE_COLORS[region.name]?.primary || '#6B7280';
  };

  const activeManagers = regions.filter(r => r.manager_id).length;
  const vacantPositions = regions.filter(r => !r.manager_id && r.is_active).length;

  // Loading state
  if (loading && regions.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading regions...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const renderManagerCard = (region: RegionWithStats) => {
    const color = getColorForRegion(region);
    const isVacant = !region.manager_id;
    
    return (
      <TouchableOpacity 
        key={region.id}
        style={[styles.managerCard, { backgroundColor: theme.card }]}
        onPress={() => {
          if (!isVacant) {
            router.push(`/screens/membership/member-detail?id=${region.manager_id}`);
          } else {
            Alert.alert(
              'Vacant Position',
              `The ${region.name} region needs a Regional Manager. Would you like to appoint someone?`,
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'View Members', onPress: () => router.push(`/screens/membership/members?region=${region.id}`) },
              ]
            );
          }
        }}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.provinceBadge, { backgroundColor: color + '20' }]}>
            <Text style={[styles.provinceCode, { color }]}>
              {region.province_code || region.code}
            </Text>
          </View>
          <View style={[
            styles.statusBadge, 
            { backgroundColor: isVacant ? '#EF444420' : '#10B98120' }
          ]}>
            <View style={[
              styles.statusDot, 
              { backgroundColor: isVacant ? '#EF4444' : '#10B981' }
            ]} />
            <Text style={[
              styles.statusText, 
              { color: isVacant ? '#EF4444' : '#10B981' }
            ]}>
              {isVacant ? 'Vacant' : 'Active'}
            </Text>
          </View>
        </View>

        <Text style={[styles.provinceName, { color: theme.text }]}>{region.name}</Text>
        
        {!isVacant ? (
          <>
            <View style={styles.managerInfo}>
              <View style={[styles.avatar, { backgroundColor: color + '30' }]}>
                <Text style={[styles.avatarText, { color }]}>
                  {region.manager_name?.split(' ').map(n => n[0]).join('') || '??'}
                </Text>
              </View>
              <View style={styles.managerDetails}>
                <Text style={[styles.managerName, { color: theme.text }]}>
                  {region.manager_name || 'Unknown Manager'}
                </Text>
                <Text style={[styles.managerEmail, { color: theme.textSecondary }]}>
                  {region.manager_email || 'No email'}
                </Text>
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Ionicons name="people-outline" size={16} color={theme.textSecondary} />
                <Text style={[styles.statValue, { color: theme.text }]}>{region.member_count}</Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Members</Text>
              </View>
              <View style={styles.stat}>
                <Ionicons name="time-outline" size={16} color={theme.textSecondary} />
                <Text style={[styles.statValue, { color: theme.text }]}>{region.pending_count}</Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Pending</Text>
              </View>
              <View style={styles.stat}>
                <Ionicons name="trending-up-outline" size={16} color={theme.textSecondary} />
                <Text style={[styles.statValue, { color: theme.text }]}>
                  {region.growth_percent > 0 ? '+' : ''}{Math.round(region.growth_percent)}%
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Growth</Text>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.vacantContent}>
            <Ionicons name="person-add-outline" size={40} color={theme.textSecondary} />
            <Text style={[styles.vacantText, { color: theme.textSecondary }]}>
              Position Open
            </Text>
            <Text style={[styles.vacantSubtext, { color: theme.textSecondary }]}>
              {region.member_count} members • {region.pending_count} pending
            </Text>
            <TouchableOpacity 
              style={[styles.recruitButton, { backgroundColor: color }]}
              onPress={() => router.push(`/screens/membership/members?region=${region.id}`)}
            >
              <Text style={styles.recruitButtonText}>View Region Members</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <DashboardWallpaperBackground>
        {/* Custom Header */}
        <View style={[styles.customHeader, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <View style={styles.headerLeft}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>
              {isYouthPresident ? 'Youth Regional and Branches' : 'Regions'}
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
              {activeManagers} active • {vacantPositions} vacant
            </Text>
          </View>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => Alert.alert('Coming Soon', 'Invite link generation will be available soon.')}
          >
            <Ionicons name="share-outline" size={24} color={theme.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
          }
        >
          {/* Summary Card */}
          <LinearGradient
            colors={['#3B82F6', '#1D4ED8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.summaryCard}
          >
            <Text style={styles.summaryTitle}>
              {isYouthPresident ? 'Youth Regional Leadership' : 'Regional Leadership'}
            </Text>
            <View style={styles.summaryStats}>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryValue}>{activeManagers}</Text>
                <Text style={styles.summaryLabel}>Active Managers</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryStat}>
                <Text style={[styles.summaryValue, { color: '#FCD34D' }]}>{vacantPositions}</Text>
                <Text style={styles.summaryLabel}>Vacant Positions</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryStat}>
                <Text style={styles.summaryValue}>{regions.length}</Text>
                <Text style={styles.summaryLabel}>Total Regions</Text>
              </View>
            </View>
          </LinearGradient>

          {/* Region Cards */}
          {regions.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: theme.card }]}>
              <Ionicons name="map-outline" size={48} color={theme.textSecondary} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No Regions Configured</Text>
              <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>
                Contact support to set up your organization's regional structure.
              </Text>
            </View>
          ) : (
            <View style={styles.managersGrid}>
              {regions.map(renderManagerCard)}
            </View>
          )}
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
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  // Custom Header
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  backButton: {
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
  headerButton: {
    padding: 4,
  },
  content: {
    padding: 16,
  },
  summaryCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryStat: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
  },
  summaryLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  managersGrid: {
    gap: 16,
  },
  managerCard: {
    borderRadius: 16,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  provinceBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  provinceCode: {
    fontSize: 14,
    fontWeight: '700',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  provinceName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  managerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
  },
  managerDetails: {
    flex: 1,
  },
  managerName: {
    fontSize: 16,
    fontWeight: '600',
  },
  managerEmail: {
    fontSize: 13,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  stat: {
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 10,
  },
  vacantContent: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  vacantText: {
    fontSize: 16,
    fontWeight: '600',
  },
  vacantSubtext: {
    fontSize: 12,
  },
  recruitButton: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  recruitButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 16,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
});
