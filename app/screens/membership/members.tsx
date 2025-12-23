/**
 * Members List Screen
 * Searchable, filterable list of all organization members
 */
import React, { useState, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  TextInput,
  RefreshControl,
  Image,
  Dimensions,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { 
  OrganizationMember, 
  MEMBER_TYPE_LABELS, 
  STATUS_COLORS,
  MEMBERSHIP_TIER_LABELS 
} from '@/components/membership/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Mock data
const MOCK_MEMBERS: OrganizationMember[] = [
  {
    id: '1',
    organization_id: 'org1',
    region_id: 'reg1',
    member_number: 'SOA-GP-24-00001',
    member_type: 'learner',
    first_name: 'Thabo',
    last_name: 'Mokoena',
    email: 'thabo.mokoena@email.com',
    phone: '+27 82 123 4567',
    membership_tier: 'premium',
    membership_status: 'active',
    joined_date: '2024-01-15',
    expiry_date: '2025-12-31',
    photo_url: null,
    province: 'Gauteng',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    region: { id: 'reg1', organization_id: 'org1', name: 'Gauteng', code: 'GP', is_active: true, created_at: '' },
  },
  {
    id: '2',
    organization_id: 'org1',
    region_id: 'reg2',
    member_number: 'SOA-WC-24-00015',
    member_type: 'facilitator',
    first_name: 'Sarah',
    last_name: 'Johnson',
    email: 'sarah.j@email.com',
    phone: '+27 83 456 7890',
    membership_tier: 'vip',
    membership_status: 'active',
    joined_date: '2023-06-01',
    expiry_date: '2025-06-01',
    photo_url: null,
    province: 'Western Cape',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    region: { id: 'reg2', organization_id: 'org1', name: 'Western Cape', code: 'WC', is_active: true, created_at: '' },
  },
  {
    id: '3',
    organization_id: 'org1',
    region_id: 'reg1',
    member_number: 'SOA-GP-24-00089',
    member_type: 'mentor',
    first_name: 'James',
    last_name: 'Ndlovu',
    email: 'james.n@email.com',
    phone: '+27 84 567 8901',
    membership_tier: 'standard',
    membership_status: 'pending',
    joined_date: '2024-12-01',
    photo_url: null,
    province: 'Gauteng',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    region: { id: 'reg1', organization_id: 'org1', name: 'Gauteng', code: 'GP', is_active: true, created_at: '' },
  },
  {
    id: '4',
    organization_id: 'org1',
    region_id: 'reg3',
    member_number: 'SOA-KZN-23-00234',
    member_type: 'regional_manager',
    first_name: 'Nomvula',
    last_name: 'Dlamini',
    email: 'nomvula.d@soilofafrica.org',
    phone: '+27 85 678 9012',
    membership_tier: 'vip',
    membership_status: 'active',
    joined_date: '2022-03-15',
    expiry_date: '2026-03-15',
    photo_url: null,
    province: 'KwaZulu-Natal',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    region: { id: 'reg3', organization_id: 'org1', name: 'KwaZulu-Natal', code: 'KZN', is_active: true, created_at: '' },
  },
  {
    id: '5',
    organization_id: 'org1',
    region_id: 'reg1',
    member_number: 'SOA-GP-24-00156',
    member_type: 'learner',
    first_name: 'Lindiwe',
    last_name: 'Sithole',
    email: 'lindiwe.s@email.com',
    phone: '+27 86 789 0123',
    membership_tier: 'standard',
    membership_status: 'expired',
    joined_date: '2023-01-15',
    expiry_date: '2024-01-15',
    photo_url: null,
    province: 'Gauteng',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    region: { id: 'reg1', organization_id: 'org1', name: 'Gauteng', code: 'GP', is_active: true, created_at: '' },
  },
];

type FilterType = 'all' | 'active' | 'pending' | 'expired';
type SortType = 'name' | 'date' | 'region';

export default function MembersListScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortType>('name');
  const [refreshing, setRefreshing] = useState(false);

  const filteredMembers = useMemo(() => {
    let result = [...MOCK_MEMBERS];
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(m => 
        m.first_name.toLowerCase().includes(query) ||
        m.last_name.toLowerCase().includes(query) ||
        m.member_number.toLowerCase().includes(query) ||
        m.email?.toLowerCase().includes(query)
      );
    }
    
    // Apply status filter
    if (activeFilter !== 'all') {
      result = result.filter(m => m.membership_status === activeFilter);
    }
    
    // Apply sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
        case 'date':
          return new Date(b.joined_date).getTime() - new Date(a.joined_date).getTime();
        case 'region':
          return (a.region?.name || '').localeCompare(b.region?.name || '');
        default:
          return 0;
      }
    });
    
    return result;
  }, [searchQuery, activeFilter, sortBy]);

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const renderMemberItem = ({ item }: { item: OrganizationMember }) => {
    const statusColor = STATUS_COLORS[item.membership_status] || STATUS_COLORS.pending;
    const initials = `${item.first_name[0]}${item.last_name[0]}`.toUpperCase();
    
    return (
      <TouchableOpacity 
        style={[styles.memberCard, { backgroundColor: theme.card }]}
        onPress={() => router.push(`/screens/membership/member-detail?id=${item.id}`)}
      >
        <View style={styles.memberLeft}>
          {item.photo_url ? (
            <Image source={{ uri: item.photo_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: theme.primary + '20' }]}>
              <Text style={[styles.avatarText, { color: theme.primary }]}>{initials}</Text>
            </View>
          )}
          
          <View style={styles.memberInfo}>
            <View style={styles.nameRow}>
              <Text style={[styles.memberName, { color: theme.text }]}>
                {item.first_name} {item.last_name}
              </Text>
              {item.membership_tier === 'vip' && (
                <View style={[styles.vipBadge, { backgroundColor: '#F59E0B' }]}>
                  <Ionicons name="star" size={10} color="#fff" />
                </View>
              )}
            </View>
            <Text style={[styles.memberNumber, { color: theme.textSecondary }]}>
              {item.member_number}
            </Text>
            <View style={styles.memberMeta}>
              <View style={[styles.typeBadge, { backgroundColor: theme.primary + '15' }]}>
                <Text style={[styles.typeText, { color: theme.primary }]}>
                  {MEMBER_TYPE_LABELS[item.member_type]}
                </Text>
              </View>
              {item.region && (
                <Text style={[styles.regionText, { color: theme.textSecondary }]}>
                  {item.region.name}
                </Text>
              )}
            </View>
          </View>
        </View>
        
        <View style={styles.memberRight}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
        </View>
      </TouchableOpacity>
    );
  };

  const FilterButton = ({ filter, label }: { filter: FilterType; label: string }) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        { 
          backgroundColor: activeFilter === filter ? theme.primary : theme.surface,
          borderColor: activeFilter === filter ? theme.primary : theme.border,
        }
      ]}
      onPress={() => setActiveFilter(filter)}
    >
      <Text style={[
        styles.filterButtonText,
        { color: activeFilter === filter ? '#fff' : theme.text }
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Stack.Screen
        options={{
          title: 'Members',
          headerRight: () => (
            <View style={styles.headerButtons}>
              <TouchableOpacity 
                style={styles.headerButton}
                onPress={() => router.push('/screens/membership/add-member')}
              >
                <Ionicons name="person-add-outline" size={24} color={theme.primary} />
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="search-outline" size={20} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search by name, ID, or email..."
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <ScrollableFilters>
          <FilterButton filter="all" label="All" />
          <FilterButton filter="active" label="Active" />
          <FilterButton filter="pending" label="Pending" />
          <FilterButton filter="expired" label="Expired" />
        </ScrollableFilters>
        
        <TouchableOpacity style={[styles.sortButton, { borderColor: theme.border }]}>
          <Ionicons name="swap-vertical-outline" size={18} color={theme.text} />
        </TouchableOpacity>
      </View>

      {/* Results Count */}
      <View style={styles.resultsHeader}>
        <Text style={[styles.resultsCount, { color: theme.textSecondary }]}>
          {filteredMembers.length} member{filteredMembers.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Members List */}
      <FlatList
        data={filteredMembers}
        renderItem={renderMemberItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color={theme.textSecondary} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No members found</Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              Try adjusting your search or filters
            </Text>
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity 
        style={[styles.fab, { backgroundColor: theme.primary }]}
        onPress={() => router.push('/screens/membership/add-member')}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// Helper component for horizontal scroll filters
function ScrollableFilters({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.scrollableFilters}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
    marginRight: 16,
  },
  headerButton: {},
  
  // Search
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  
  // Filters
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
  },
  scrollableFilters: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sortButton: {
    width: 40,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Results
  resultsHeader: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  resultsCount: {
    fontSize: 13,
  },
  
  // List
  listContent: {
    paddingHorizontal: 16,
  },
  
  // Member Card
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
  },
  memberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
  },
  memberInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
  },
  vipBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberNumber: {
    fontSize: 12,
    marginTop: 2,
  },
  memberMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  regionText: {
    fontSize: 11,
  },
  memberRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  
  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  
  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
});
