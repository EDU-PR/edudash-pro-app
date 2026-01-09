/**
 * Aftercare Activities Screen
 * 
 * Browse and manage educational activities for aftercare students.
 * Activities are age-appropriate (3-12 years) and include games, videos, quizzes.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

interface Activity {
  id: string;
  title: string;
  description: string | null;
  activity_type: 'interactive' | 'video' | 'quiz' | 'drawing' | 'reading' | 'game';
  content: Record<string, any>;
  estimated_minutes: number;
  lesson_id: string;
  lesson?: {
    title: string;
    subject: string;
    age_group: string;
  };
  order_index: number;
  is_required: boolean;
}

const activityTypeConfig = {
  interactive: { label: 'Interactive', icon: 'hand-left', color: '#8B5CF6' },
  video: { label: 'Video', icon: 'play-circle', color: '#EF4444' },
  quiz: { label: 'Quiz', icon: 'help-circle', color: '#10B981' },
  drawing: { label: 'Drawing', icon: 'brush', color: '#F59E0B' },
  reading: { label: 'Reading', icon: 'book', color: '#3B82F6' },
  game: { label: 'Game', icon: 'game-controller', color: '#EC4899' },
};

const ageGroups = [
  { id: 'all', label: 'All Ages' },
  { id: '3-4', label: '3-4 years' },
  { id: '4-5', label: '4-5 years' },
  { id: '5-6', label: '5-6 years' },
  { id: '3-6', label: '3-6 years' },
];

const subjects = [
  { id: 'all', label: 'All Subjects' },
  { id: 'mathematics', label: 'Mathematics' },
  { id: 'literacy', label: 'Literacy' },
  { id: 'science', label: 'Science' },
  { id: 'art', label: 'Art' },
  { id: 'music', label: 'Music' },
  { id: 'physical', label: 'Physical' },
  { id: 'general', label: 'General' },
];

export default function AftercareActivitiesScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  
  const organizationId = profile?.organization_id || profile?.preschool_id;
  const isTeacher = profile?.role === 'teacher' || profile?.role === 'principal';
  
  const fetchActivities = useCallback(async () => {
    if (!organizationId) return;
    
    try {
      const supabase = assertSupabase();
      
      const { data, error } = await supabase
        .from('lesson_activities')
        .select(`
          *,
          lesson:lessons(title, subject, age_group)
        `)
        .eq('preschool_id', organizationId)
        .order('order_index');
      
      if (error && error.code !== '42P01') {
        console.error('[AftercareActivities] Error:', error);
        throw error;
      }
      
      setActivities(data || []);
    } catch (err) {
      console.error('[AftercareActivities] Fetch error:', err);
      Alert.alert('Error', 'Failed to load activities');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [organizationId]);
  
  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);
  
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchActivities();
  }, [fetchActivities]);
  
  const filteredActivities = activities.filter(activity => {
    const matchesSearch = !searchQuery || 
      activity.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      activity.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = selectedType === 'all' || activity.activity_type === selectedType;
    
    const matchesAgeGroup = selectedAgeGroup === 'all' || 
      activity.lesson?.age_group === selectedAgeGroup;
    
    const matchesSubject = selectedSubject === 'all' || 
      activity.lesson?.subject === selectedSubject;
    
    return matchesSearch && matchesType && matchesAgeGroup && matchesSubject;
  });
  
  const handleActivityPress = (activity: Activity) => {
    // Navigate to activity player
    router.push({
      pathname: '/screens/interactive-lesson-player',
      params: { activityId: activity.id },
    });
  };
  
  const handleAssignActivity = (activity: Activity) => {
    router.push({
      pathname: '/screens/assign-lesson',
      params: { lessonId: activity.lesson_id },
    });
  };
  
  const renderActivity = ({ item }: { item: Activity }) => {
    const config = activityTypeConfig[item.activity_type];
    
    return (
      <TouchableOpacity
        style={styles.activityCard}
        onPress={() => handleActivityPress(item)}
        activeOpacity={0.8}
      >
        <View style={[styles.activityIcon, { backgroundColor: config.color + '20' }]}>
          <Ionicons name={config.icon as any} size={32} color={config.color} />
        </View>
        
        <View style={styles.activityContent}>
          <Text style={styles.activityTitle} numberOfLines={2}>{item.title}</Text>
          
          <View style={styles.activityMeta}>
            <View style={[styles.typeBadge, { backgroundColor: config.color + '20' }]}>
              <Text style={[styles.typeBadgeText, { color: config.color }]}>
                {config.label}
              </Text>
            </View>
            
            <View style={styles.durationContainer}>
              <Ionicons name="time-outline" size={12} color={theme.textSecondary} />
              <Text style={styles.durationText}>{item.estimated_minutes} min</Text>
            </View>
          </View>
          
          {item.lesson && (
            <Text style={styles.lessonInfo} numberOfLines={1}>
              {item.lesson.subject} • Ages {item.lesson.age_group}
            </Text>
          )}
        </View>
        
        {isTeacher && (
          <TouchableOpacity
            style={styles.assignButton}
            onPress={(e) => {
              e.stopPropagation();
              handleAssignActivity(item);
            }}
          >
            <Ionicons name="paper-plane" size={16} color="#fff" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };
  
  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.loadingText}>Loading activities...</Text>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header */}
      <LinearGradient
        colors={['#EC4899', '#DB2777']}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Learning Activities</Text>
            <Text style={styles.headerSubtitle}>{activities.length} activities available</Text>
          </View>
          {isTeacher && (
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => router.push('/screens/create-lesson')}
            >
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
        
        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="rgba(255,255,255,0.6)" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search activities..."
            placeholderTextColor="rgba(255,255,255,0.6)"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </LinearGradient>
      
      {/* Filters */}
      <View style={styles.filtersContainer}>
        {/* Activity Types */}
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[{ id: 'all', label: 'All', icon: 'apps', color: theme.primary }, ...Object.entries(activityTypeConfig).map(([id, config]) => ({ id, ...config }))]}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterChip,
                selectedType === item.id && { backgroundColor: item.color || theme.primary }
              ]}
              onPress={() => setSelectedType(item.id)}
            >
              <Ionicons 
                name={(item as any).icon as any} 
                size={16} 
                color={selectedType === item.id ? '#fff' : theme.textSecondary} 
              />
              <Text style={[
                styles.filterChipText,
                selectedType === item.id && { color: '#fff' }
              ]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.filterList}
        />
      </View>
      
      {/* Activities Grid */}
      <FlatList
        data={filteredActivities}
        keyExtractor={item => item.id}
        renderItem={renderActivity}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="game-controller-outline" size={64} color={theme.textSecondary} />
            <Text style={styles.emptyTitle}>No Activities Found</Text>
            <Text style={styles.emptyText}>
              {searchQuery || selectedType !== 'all' 
                ? 'Try adjusting your filters'
                : 'Create lessons to add activities'}
            </Text>
            {isTeacher && (
              <TouchableOpacity
                style={styles.createActivityButton}
                onPress={() => router.push('/screens/create-lesson')}
              >
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={styles.createActivityButtonText}>Create Lesson</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: theme.textSecondary,
    fontSize: 16,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 8,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  createButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    paddingHorizontal: 14,
    marginTop: 16,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: '#fff',
  },
  filtersContainer: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  filterList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.card,
    marginRight: 8,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.textSecondary,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  activityCard: {
    width: CARD_WIDTH,
    backgroundColor: theme.card,
    borderRadius: 16,
    overflow: 'hidden',
    padding: 12,
  },
  activityIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 8,
  },
  activityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  durationText: {
    fontSize: 11,
    color: theme.textSecondary,
  },
  lessonInfo: {
    fontSize: 11,
    color: theme.textSecondary,
  },
  assignButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EC4899',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.text,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  createActivityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EC4899',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 24,
  },
  createActivityButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
