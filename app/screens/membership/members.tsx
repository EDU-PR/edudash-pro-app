/**
 * Members List Screen
 * Searchable, filterable list of all organization members
 * Connected to Supabase organization_members table
 */
import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { useMembersList } from '@/hooks/membership/useMembersList';
import { DashboardWallpaperBackground } from '@/components/membership/dashboard';
import { 
  OrganizationMember, 
  MEMBER_TYPE_LABELS, 
  STATUS_COLORS,
  MEMBERSHIP_TIER_LABELS 
} from '@/components/membership/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type FilterType = 'all' | 'active' | 'pending' | 'expired';
type SortType = 'name' | 'date' | 'region';

export default function MembersListScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortType>('name');

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch members from database
  const { 
    members, 
    loading, 
    error, 
    totalCount, 
    refetch 
  } = useMembersList({
    searchQuery: debouncedSearch,
    statusFilter: activeFilter,
    sortBy,
  });

  // Handle refresh
  const onRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  // Local filtering and sorting (for immediate UI updates before API responds)
  const displayMembers = useMemo(() => {
    let result = [...members];
    
    // Apply additional client-side sorting if needed
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
  }, [members, sortBy]);

  const renderMemberItem = ({ item }: { item: OrganizationMember }) => {
    const statusColor = STATUS_COLORS[item.membership_status] || STATUS_COLORS.pending;
    const initials = `${item.first_name?.[0] || '?'}${item.last_name?.[0] || ''}`.toUpperCase();
    
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
                  {MEMBER_TYPE_LABELS[item.member_type] || item.member_type}
                </Text>
              </View>
              {item.region && (
                <Text style={[styles.regionText, { color: theme.textSecondary }]}>
                  {item.region.name}
                </Text>
              )}
              {!item.region && item.province && (
                <Text style={[styles.regionText, { color: theme.textSecondary }]}>
                  {item.province}
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
      <DashboardWallpaperBackground>
        {/* Custom Header */}
        <View style={[styles.customHeader, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Members</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            {loading ? 'Loading...' : `${totalCount} member${totalCount !== 1 ? 's' : ''}`}
          </Text>
        </View>
        <TouchableOpacity 
          style={styles.headerButton}
          onPress={() => router.push('/screens/membership/add-member')}
        >
          <Ionicons name="person-add-outline" size={24} color={theme.primary} />
        </TouchableOpacity>
      </View>

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
        
        <TouchableOpacity 
          style={[styles.sortButton, { borderColor: theme.border }]}
          onPress={() => {
            // Cycle through sort options
            const sortOptions: SortType[] = ['name', 'date', 'region'];
            const currentIndex = sortOptions.indexOf(sortBy);
            setSortBy(sortOptions[(currentIndex + 1) % sortOptions.length]);
          }}
        >
          <Ionicons name="swap-vertical-outline" size={18} color={theme.text} />
        </TouchableOpacity>
      </View>

      {/* Results Count */}
      <View style={styles.resultsHeader}>
        <Text style={[styles.resultsCount, { color: theme.textSecondary }]}>
          {displayMembers.length} member{displayMembers.length !== 1 ? 's' : ''} • Sorted by {sortBy}
        </Text>
      </View>

      {/* Error State */}
      {error && !loading && (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
          <TouchableOpacity 
            style={[styles.retryButton, { backgroundColor: theme.primary }]}
            onPress={refetch}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Loading State */}
      {loading && members.length === 0 && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading members...</Text>
        </View>
      )}

      {/* Members List */}
      {!loading && !error && (
        <FlatList
          data={displayMembers}
          renderItem={renderMemberItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 80 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={theme.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={64} color={theme.textSecondary} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No members found</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                {searchQuery || activeFilter !== 'all' 
                  ? 'Try adjusting your search or filters'
                  : 'Add your first member to get started'}
              </Text>
            </View>
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity 
        style={[styles.fab, { backgroundColor: theme.primary }]}
        onPress={() => router.push('/screens/membership/add-member')}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
      </DashboardWallpaperBackground>
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
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    padding: 4,
  },
  
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
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  
  // Loading State
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  loadingText: {
    fontSize: 14,
    marginTop: 12,
  },
  
  // Error State
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
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
