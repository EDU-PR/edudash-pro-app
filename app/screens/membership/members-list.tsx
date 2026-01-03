/**
 * Youth Members List Screen
 * Displays youth members for the Youth President dashboard
 * Filterable by status, searchable, with detail navigation
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { DashboardWallpaperBackground } from '@/components/membership/dashboard';
import { OrganizationMember, STATUS_COLORS, MEMBER_TYPE_LABELS } from '@/components/membership/types';
import { useYouthMembers } from '@/hooks/membership/useYouthMembers';
import { styles } from './members-list.styles';

type FilterType = 'all' | 'active' | 'pending' | 'suspended';

const FILTERS: { key: FilterType; label: string; icon: string }[] = [
  { key: 'all', label: 'All', icon: 'people' },
  { key: 'active', label: 'Active', icon: 'checkmark-circle' },
  { key: 'pending', label: 'Pending', icon: 'time' },
  { key: 'suspended', label: 'Suspended', icon: 'pause-circle' },
];

export default function YouthMembersListScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { members, isLoading, isRefreshing, error, stats, refetch } = useYouthMembers({
    searchQuery: debouncedSearch,
    statusFilter: activeFilter,
  });

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
            <Text style={[styles.memberName, { color: theme.text }]}>
              {item.first_name} {item.last_name}
            </Text>
            <Text style={[styles.memberNumber, { color: theme.textSecondary }]}>
              {item.member_number || 'No member #'}
            </Text>
            <View style={styles.memberMeta}>
              <View style={[styles.typeBadge, { backgroundColor: '#10B981' + '20' }]}>
                <Text style={[styles.typeText, { color: '#10B981' }]}>
                  {MEMBER_TYPE_LABELS[item.member_type] || item.member_type}
                </Text>
              </View>
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

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="people-outline" size={64} color={theme.textSecondary} />
      <Text style={[styles.emptyTitle, { color: theme.text }]}>No Youth Members Found</Text>
      <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
        {searchQuery ? 'Try adjusting your search query' : 'Youth members will appear here once registered'}
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading youth members...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <DashboardWallpaperBackground>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.card }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Youth Members</Text>
            <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
              {stats.total} total • {stats.active} active
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: '#10B981' }]}
            onPress={() => router.push('/screens/membership/add-member')}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={[styles.searchContainer, { backgroundColor: theme.card }]}>
          <Ionicons name="search" size={20} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search by name, email, or member #"
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

        {/* Filters */}
        <View style={styles.filtersContainer}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={FILTERS}
            keyExtractor={(item) => item.key}
            contentContainerStyle={styles.filtersList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: activeFilter === item.key ? '#10B981' : theme.card,
                    borderColor: activeFilter === item.key ? '#10B981' : theme.border,
                  },
                ]}
                onPress={() => setActiveFilter(item.key)}
              >
                <Ionicons
                  name={item.icon as any}
                  size={16}
                  color={activeFilter === item.key ? '#fff' : theme.textSecondary}
                />
                <Text style={[styles.filterText, { color: activeFilter === item.key ? '#fff' : theme.text }]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>

        {/* Error Banner */}
        {error && (
          <View style={[styles.errorBanner, { backgroundColor: theme.error + '20' }]}>
            <Ionicons name="alert-circle" size={20} color={theme.error} />
            <Text style={[styles.errorText, { color: theme.error }]}>{error.message}</Text>
          </View>
        )}

        {/* Members List */}
        <FlatList
          data={members}
          keyExtractor={(item) => item.id}
          renderItem={renderMemberItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyList}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={refetch} colors={['#10B981']} tintColor="#10B981" />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      </SafeAreaView>
    </DashboardWallpaperBackground>
  );
}
