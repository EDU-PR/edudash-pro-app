/**
 * Youth Programs Screen
 * Displays and manages youth programs for the Youth President dashboard
 */
import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, TextInput } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { DashboardWallpaperBackground } from '@/components/membership/dashboard';
import { useYouthPrograms, YouthProgram, STATUS_CONFIG, CATEGORY_ICONS } from '@/hooks/membership/useYouthPrograms';
import { styles } from './programs.styles';

type FilterType = 'all' | 'active' | 'draft' | 'completed';
const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'active', label: 'Active' }, { key: 'draft', label: 'Draft' }, { key: 'completed', label: 'Completed' },
];

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', minimumFractionDigits: 0 }).format(amount);
const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });

export default function YouthProgramsScreen() {
  const { theme } = useTheme();
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { programs, isLoading, isRefreshing, stats, refetch } = useYouthPrograms({ statusFilter: activeFilter, searchQuery });

  const renderProgramItem = ({ item }: { item: YouthProgram }) => {
    const statusConfig = STATUS_CONFIG[item.status];
    const categoryIcon = CATEGORY_ICONS[item.category] || 'folder';

    return (
      <TouchableOpacity style={[styles.programCard, { backgroundColor: theme.card }]}>
        <View style={styles.programHeader}>
          <View style={[styles.categoryIcon, { backgroundColor: '#10B981' + '20' }]}>
            <Ionicons name={categoryIcon as any} size={24} color="#10B981" />
          </View>
          <View style={styles.programHeaderText}>
            <Text style={[styles.programName, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
            <Text style={[styles.programCategory, { color: theme.textSecondary }]}>{item.category}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '20' }]}>
            <Ionicons name={statusConfig.icon as any} size={14} color={statusConfig.color} />
            <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
          </View>
        </View>
        <Text style={[styles.programDescription, { color: theme.textSecondary }]} numberOfLines={2}>{item.description}</Text>
        <View style={styles.programStats}>
          <View style={styles.statItem}>
            <Ionicons name="calendar-outline" size={16} color={theme.textSecondary} />
            <Text style={[styles.statText, { color: theme.textSecondary }]}>{formatDate(item.start_date)}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="people-outline" size={16} color={theme.textSecondary} />
            <Text style={[styles.statText, { color: theme.textSecondary }]}>{item.participants_count} participants</Text>
          </View>
          {item.budget && (
            <View style={styles.statItem}>
              <Ionicons name="cash-outline" size={16} color={theme.textSecondary} />
              <Text style={[styles.statText, { color: theme.textSecondary }]}>{formatCurrency(item.budget)}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="folder-open-outline" size={64} color={theme.textSecondary} />
      <Text style={[styles.emptyTitle, { color: theme.text }]}>No Programs Found</Text>
      <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
        {searchQuery ? 'Try adjusting your search' : 'Create your first youth program'}
      </Text>
      <TouchableOpacity 
        style={[styles.createButton, { backgroundColor: '#10B981' }]}
        onPress={() => router.push('/screens/membership/create-youth-program')}
      >
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={styles.createButtonText}>Create Program</Text>
      </TouchableOpacity>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading programs...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <DashboardWallpaperBackground>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={[styles.header, { backgroundColor: theme.card }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Youth Programs</Text>
            <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>{stats.total} programs • {stats.totalParticipants} participants</Text>
          </View>
          <TouchableOpacity 
            style={[styles.addButton, { backgroundColor: '#10B981' }]}
            onPress={() => router.push('/screens/membership/create-youth-program')}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.statsContainer}>
          <View style={[styles.statCard, { backgroundColor: theme.card }]}>
            <Ionicons name="play-circle" size={24} color="#10B981" />
            <Text style={[styles.statCardValue, { color: theme.text }]}>{stats.active}</Text>
            <Text style={[styles.statCardLabel, { color: theme.textSecondary }]}>Active</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.card }]}>
            <Ionicons name="people" size={24} color="#3B82F6" />
            <Text style={[styles.statCardValue, { color: theme.text }]}>{stats.totalParticipants}</Text>
            <Text style={[styles.statCardLabel, { color: theme.textSecondary }]}>Participants</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.card }]}>
            <Ionicons name="cash" size={24} color="#F59E0B" />
            <Text style={[styles.statCardValue, { color: theme.text }]}>{formatCurrency(stats.totalBudget).replace('ZAR', 'R')}</Text>
            <Text style={[styles.statCardLabel, { color: theme.textSecondary }]}>Budget</Text>
          </View>
        </View>

        <View style={[styles.searchContainer, { backgroundColor: theme.card }]}>
          <Ionicons name="search" size={20} color={theme.textSecondary} />
          <TextInput style={[styles.searchInput, { color: theme.text }]} placeholder="Search programs..." placeholderTextColor={theme.textSecondary} value={searchQuery} onChangeText={setSearchQuery} />
          {searchQuery.length > 0 && <TouchableOpacity onPress={() => setSearchQuery('')}><Ionicons name="close-circle" size={20} color={theme.textSecondary} /></TouchableOpacity>}
        </View>

        <View style={styles.filtersContainer}>
          <FlatList horizontal showsHorizontalScrollIndicator={false} data={FILTERS} keyExtractor={(item) => item.key} contentContainerStyle={styles.filtersList}
            renderItem={({ item }) => (
              <TouchableOpacity style={[styles.filterChip, { backgroundColor: activeFilter === item.key ? '#10B981' : theme.card, borderColor: activeFilter === item.key ? '#10B981' : theme.border }]} onPress={() => setActiveFilter(item.key)}>
                <Text style={[styles.filterText, { color: activeFilter === item.key ? '#fff' : theme.text }]}>{item.label}</Text>
              </TouchableOpacity>
            )}
          />
        </View>

        <FlatList data={programs} keyExtractor={(item) => item.id} renderItem={renderProgramItem} contentContainerStyle={styles.listContent} ListEmptyComponent={renderEmptyList}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refetch} colors={['#10B981']} tintColor="#10B981" />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      </SafeAreaView>
    </DashboardWallpaperBackground>
  );
}
