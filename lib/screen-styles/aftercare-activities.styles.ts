import { StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
export const CARD_WIDTH = (width - 48) / 2;

export interface Activity {
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

export const activityTypeConfig = {
  interactive: { label: 'Interactive', icon: 'hand-left', color: '#8B5CF6' },
  video: { label: 'Video', icon: 'play-circle', color: '#EF4444' },
  quiz: { label: 'Quiz', icon: 'help-circle', color: '#10B981' },
  drawing: { label: 'Drawing', icon: 'brush', color: '#F59E0B' },
  reading: { label: 'Reading', icon: 'book', color: '#3B82F6' },
  game: { label: 'Game', icon: 'game-controller', color: '#EC4899' },
};

export const ageGroups = [
  { id: 'all', label: 'All Ages' },
  { id: '3-4', label: '3-4 years' },
  { id: '4-5', label: '4-5 years' },
  { id: '5-6', label: '5-6 years' },
  { id: '3-6', label: '3-6 years' },
];

export const subjects = [
  { id: 'all', label: 'All Subjects' },
  { id: 'mathematics', label: 'Mathematics' },
  { id: 'literacy', label: 'Literacy' },
  { id: 'science', label: 'Science' },
  { id: 'art', label: 'Art' },
  { id: 'music', label: 'Music' },
  { id: 'physical', label: 'Physical' },
  { id: 'general', label: 'General' },
];

export function createStyles(theme: any) {
  return StyleSheet.create({
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
}
