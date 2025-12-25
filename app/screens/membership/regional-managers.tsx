/**
 * Regional Managers Screen
 * Manage and overview of all regional managers
 */
import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  RefreshControl,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { DashboardWallpaperBackground } from '@/components/membership/dashboard';

// Province color mapping
const PROVINCE_COLORS: Record<string, string> = {
  GP: '#3B82F6', // Gauteng - Blue
  WC: '#10B981', // Western Cape - Green
  KZN: '#F59E0B', // KwaZulu-Natal - Amber
  EC: '#EF4444', // Eastern Cape - Red
  MP: '#8B5CF6', // Mpumalanga - Purple
  LP: '#EC4899', // Limpopo - Pink
  FS: '#06B6D4', // Free State - Cyan
  NW: '#84CC16', // North West - Lime
  NC: '#F97316', // Northern Cape - Orange
};

interface RegionalManager {
  id: string;
  name: string;
  email: string;
  phone: string;
  province: string;
  provinceCode: string;
  photo?: string;
  membersCount: number;
  branchesCount: number;
  status: 'active' | 'pending' | 'vacant';
  joinedDate?: string;
  performance: number;
}

const REGIONAL_MANAGERS: RegionalManager[] = [
  { 
    id: '1', 
    name: 'Hloriso Dipatse', 
    email: 'hloriso@soilofafrica.org', 
    phone: '+27 82 345 6789',
    province: 'Gauteng', 
    provinceCode: 'GP',
    membersCount: 892, 
    branchesCount: 12,
    status: 'active',
    joinedDate: '2024-03-15',
    performance: 92,
  },
  { 
    id: '2', 
    name: 'Vacant Position', 
    email: '', 
    phone: '',
    province: 'Western Cape', 
    provinceCode: 'WC',
    membersCount: 567, 
    branchesCount: 8,
    status: 'vacant',
    performance: 0,
  },
  { 
    id: '3', 
    name: 'Vacant Position', 
    email: '', 
    phone: '',
    province: 'KwaZulu-Natal', 
    provinceCode: 'KZN',
    membersCount: 445, 
    branchesCount: 6,
    status: 'vacant',
    performance: 0,
  },
  { 
    id: '4', 
    name: 'Vacant Position', 
    email: '', 
    phone: '',
    province: 'Eastern Cape', 
    provinceCode: 'EC',
    membersCount: 312, 
    branchesCount: 5,
    status: 'vacant',
    performance: 0,
  },
  { 
    id: '5', 
    name: 'Vacant Position', 
    email: '', 
    phone: '',
    province: 'Mpumalanga', 
    provinceCode: 'MP',
    membersCount: 234, 
    branchesCount: 4,
    status: 'vacant',
    performance: 0,
  },
  { 
    id: '6', 
    name: 'Vacant Position', 
    email: '', 
    phone: '',
    province: 'Limpopo', 
    provinceCode: 'LP',
    membersCount: 198, 
    branchesCount: 3,
    status: 'vacant',
    performance: 0,
  },
  { 
    id: '7', 
    name: 'Vacant Position', 
    email: '', 
    phone: '',
    province: 'Free State', 
    provinceCode: 'FS',
    membersCount: 156, 
    branchesCount: 3,
    status: 'vacant',
    performance: 0,
  },
  { 
    id: '8', 
    name: 'Vacant Position', 
    email: '', 
    phone: '',
    province: 'North West', 
    provinceCode: 'NW',
    membersCount: 123, 
    branchesCount: 2,
    status: 'vacant',
    performance: 0,
  },
  { 
    id: '9', 
    name: 'Vacant Position', 
    email: '', 
    phone: '',
    province: 'Northern Cape', 
    provinceCode: 'NC',
    membersCount: 89, 
    branchesCount: 2,
    status: 'vacant',
    performance: 0,
  },
];

export default function RegionalManagersScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const activeManagers = REGIONAL_MANAGERS.filter(m => m.status === 'active').length;
  const vacantPositions = REGIONAL_MANAGERS.filter(m => m.status === 'vacant').length;

  const renderManagerCard = (manager: RegionalManager) => {
    const color = PROVINCE_COLORS[manager.provinceCode] || '#6B7280';
    
    return (
      <TouchableOpacity 
        key={manager.id}
        style={[styles.managerCard, { backgroundColor: theme.card }]}
        onPress={() => manager.status !== 'vacant' && router.push(`/screens/membership/member-detail?id=${manager.id}`)}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.provinceBadge, { backgroundColor: color + '20' }]}>
            <Text style={[styles.provinceCode, { color }]}>{manager.provinceCode}</Text>
          </View>
          <View style={[
            styles.statusBadge, 
            { backgroundColor: manager.status === 'active' ? '#10B98120' : '#EF444420' }
          ]}>
            <View style={[
              styles.statusDot, 
              { backgroundColor: manager.status === 'active' ? '#10B981' : '#EF4444' }
            ]} />
            <Text style={[
              styles.statusText, 
              { color: manager.status === 'active' ? '#10B981' : '#EF4444' }
            ]}>
              {manager.status === 'active' ? 'Active' : 'Vacant'}
            </Text>
          </View>
        </View>

        <Text style={[styles.provinceName, { color: theme.text }]}>{manager.province}</Text>
        
        {manager.status === 'active' ? (
          <>
            <View style={styles.managerInfo}>
              <View style={[styles.avatar, { backgroundColor: color + '30' }]}>
                <Text style={[styles.avatarText, { color }]}>
                  {manager.name.split(' ').map(n => n[0]).join('')}
                </Text>
              </View>
              <View style={styles.managerDetails}>
                <Text style={[styles.managerName, { color: theme.text }]}>{manager.name}</Text>
                <Text style={[styles.managerEmail, { color: theme.textSecondary }]}>{manager.email}</Text>
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Ionicons name="people-outline" size={16} color={theme.textSecondary} />
                <Text style={[styles.statValue, { color: theme.text }]}>{manager.membersCount}</Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Members</Text>
              </View>
              <View style={styles.stat}>
                <Ionicons name="business-outline" size={16} color={theme.textSecondary} />
                <Text style={[styles.statValue, { color: theme.text }]}>{manager.branchesCount}</Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Branches</Text>
              </View>
              <View style={styles.stat}>
                <Ionicons name="trending-up-outline" size={16} color={theme.textSecondary} />
                <Text style={[styles.statValue, { color: theme.text }]}>{manager.performance}%</Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Performance</Text>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.vacantContent}>
            <Ionicons name="person-add-outline" size={40} color={theme.textSecondary} />
            <Text style={[styles.vacantText, { color: theme.textSecondary }]}>
              Position Open
            </Text>
            <TouchableOpacity style={[styles.recruitButton, { backgroundColor: color }]}>
              <Text style={styles.recruitButtonText}>Recruit Manager</Text>
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
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Regions</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            {activeManagers} active • {vacantPositions} vacant
          </Text>
        </View>
        <TouchableOpacity style={styles.headerButton}>
          <Ionicons name="add-circle-outline" size={24} color={theme.primary} />
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
          <Text style={styles.summaryTitle}>Regional Leadership</Text>
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
              <Text style={styles.summaryValue}>9</Text>
              <Text style={styles.summaryLabel}>Provinces</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Manager Cards */}
        <View style={styles.managersGrid}>
          {REGIONAL_MANAGERS.map(renderManagerCard)}
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
  // Custom Header
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
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
    color: '#FFFFFF',
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
    fontWeight: '700',
    color: '#FFFFFF',
  },
  summaryLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  managersGrid: {
    gap: 12,
  },
  managerCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
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
    marginBottom: 12,
  },
  managerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
  },
  managerDetails: {
    flex: 1,
  },
  managerName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  managerEmail: {
    fontSize: 13,
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
    fontSize: 11,
  },
  vacantContent: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  vacantText: {
    fontSize: 14,
  },
  recruitButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 8,
  },
  recruitButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
