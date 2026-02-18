/**
 * Members List Screen
 * Searchable, filterable list of all organization members
 * Connected to Supabase organization_members table
 */
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, TextInput, RefreshControl, Image } from 'react-native';
import { FlashList } from '@shopify/flash-list';
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
import { createStyles, FilterType, SortType } from '@/lib/screen-styles/membership/members.styles';

import EduDashSpinner from '@/components/ui/EduDashSpinner';

export default function MembersListScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
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
          <EduDashSpinner size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading members...</Text>
        </View>
      )}

      {/* Members List */}
      {!loading && !error && (
        <FlashList
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
          estimatedItemSize={72}
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

  // Helper component for horizontal scroll filters
  function ScrollableFilters({ children }: { children: React.ReactNode }) {
    return (
      <View style={styles.scrollableFilters}>
        {children}
      </View>
    );
  }
}
