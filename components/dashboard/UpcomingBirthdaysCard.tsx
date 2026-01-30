/**
 * Upcoming Birthdays Card Component
 * 
 * Displays upcoming student birthdays for teachers and principals.
 * Shows today's birthdays prominently, plus upcoming week/month.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import type { StudentBirthday, UpcomingBirthdaysResponse } from '@/services/BirthdayPlannerService';

interface UpcomingBirthdaysCardProps {
  birthdays: UpcomingBirthdaysResponse | null;
  loading?: boolean;
  showHeader?: boolean;
  maxItems?: number;
  onViewAll?: () => void;
  compact?: boolean;
  onStudentPress?: (studentId: string) => void;
  studentTapBehavior?: 'profile' | 'info' | 'none';
}

export function UpcomingBirthdaysCard({
  birthdays,
  loading = false,
  showHeader = true,
  maxItems = 5,
  onViewAll,
  compact = false,
  onStudentPress,
  studentTapBehavior = 'profile',
}: UpcomingBirthdaysCardProps) {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const styles = createStyles(theme, isDark, compact);

  // Get all upcoming birthdays sorted
  const allBirthdays = [
    ...(birthdays?.today || []),
    ...(birthdays?.thisWeek || []),
    ...(birthdays?.thisMonth || []),
  ].slice(0, maxItems);

  const todayCount = birthdays?.today?.length || 0;
  const totalCount = allBirthdays.length;

  if (loading) {
    return (
      <View style={styles.container}>
        {showHeader && (
          <View style={styles.header}>
            <Text style={styles.title}>🎂 Birthdays</Text>
          </View>
        )}
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading birthdays...</Text>
        </View>
      </View>
    );
  }

  if (totalCount === 0) {
    return (
      <View style={styles.container}>
        {showHeader && (
          <View style={styles.header}>
            <Text style={styles.title}>🎂 Birthdays</Text>
          </View>
        )}
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No upcoming birthdays</Text>
        </View>
      </View>
    );
  }

  const formatDaysUntil = (days: number): string => {
    if (days === 0) return 'Today! 🎉';
    if (days === 1) return 'Tomorrow';
    if (days <= 7) return `In ${days} days`;
    return `${Math.ceil(days / 7)} weeks`;
  };

  const renderBirthdayItem = (birthday: StudentBirthday, index: number) => {
    const isToday = birthday.daysUntil === 0;
    const isTapDisabled = studentTapBehavior === 'none';
    
    return (
      <TouchableOpacity
        key={birthday.id}
        style={[
          styles.birthdayItem,
          isToday && styles.birthdayItemToday,
          index < allBirthdays.length - 1 && styles.birthdayItemBorder,
        ]}
        onPress={() => {
          if (studentTapBehavior === 'none') return;
          if (onStudentPress) {
            onStudentPress(birthday.studentId);
            return;
          }
          router.push(`/screens/student-detail?id=${birthday.studentId}`);
        }}
        disabled={isTapDisabled}
        activeOpacity={0.7}
      >
        <View style={styles.avatarContainer}>
          {birthday.photoUrl ? (
            <Image source={{ uri: birthday.photoUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>
                {birthday.firstName.charAt(0)}
              </Text>
            </View>
          )}
          {isToday && (
            <View style={styles.todayBadge}>
              <Text style={styles.todayBadgeText}>🎂</Text>
            </View>
          )}
        </View>
        
        <View style={styles.birthdayInfo}>
          <Text style={styles.studentName} numberOfLines={1}>
            {birthday.firstName} {birthday.lastName}
          </Text>
          <Text style={styles.classInfo}>
            {birthday.className || 'Class'} • Turning {birthday.age}
          </Text>
        </View>
        
        <View style={styles.daysContainer}>
          <Text style={[
            styles.daysText,
            isToday && styles.daysTextToday
          ]}>
            {formatDaysUntil(birthday.daysUntil)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {showHeader && (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>🎂 Birthdays</Text>
            {todayCount > 0 && (
              <View style={styles.todayCountBadge}>
                <Text style={styles.todayCountText}>{todayCount} today!</Text>
              </View>
            )}
          </View>
          {onViewAll && totalCount > maxItems && (
            <TouchableOpacity onPress={onViewAll}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Today's Birthdays Banner */}
      {todayCount > 0 && !compact && (
        <View style={styles.todayBanner}>
          <Text style={styles.todayBannerEmoji}>🎉</Text>
          <Text style={styles.todayBannerText}>
            {todayCount === 1
              ? `${birthdays?.today[0].firstName} has a birthday today!`
              : `${todayCount} students have birthdays today!`}
          </Text>
        </View>
      )}

      {/* Birthday List */}
      <View style={styles.listContainer}>
        {allBirthdays.map((birthday, index) => renderBirthdayItem(birthday, index))}
      </View>

      {/* View More */}
      {onViewAll && totalCount > maxItems && (
        <TouchableOpacity style={styles.viewMoreButton} onPress={onViewAll}>
          <Text style={styles.viewMoreText}>
            +{(birthdays?.thisMonth?.length || 0) - maxItems + (birthdays?.today?.length || 0) + (birthdays?.thisWeek?.length || 0)} more birthdays
          </Text>
          <Ionicons name="chevron-forward" size={16} color={theme.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const createStyles = (theme: any, isDark: boolean, compact: boolean) => StyleSheet.create({
  container: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: compact ? 12 : 16,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: compact ? 16 : 18,
    fontWeight: '700',
    color: theme.text,
  },
  todayCountBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  todayCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.primary,
  },
  
  // Loading & Empty
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  
  // Today Banner
  todayBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  todayBannerEmoji: {
    fontSize: 24,
  },
  todayBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#B45309',
  },
  
  // List
  listContainer: {
    gap: 0,
  },
  birthdayItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: compact ? 8 : 12,
  },
  birthdayItemToday: {
    backgroundColor: '#FEF3C7',
    marginHorizontal: -12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginVertical: 4,
  },
  birthdayItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  
  // Avatar
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: compact ? 36 : 44,
    height: compact ? 36 : 44,
    borderRadius: compact ? 18 : 22,
  },
  avatarPlaceholder: {
    backgroundColor: theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: compact ? 14 : 16,
    fontWeight: '600',
  },
  todayBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 2,
  },
  todayBadgeText: {
    fontSize: 12,
  },
  
  // Info
  birthdayInfo: {
    flex: 1,
    marginLeft: 12,
  },
  studentName: {
    fontSize: compact ? 14 : 15,
    fontWeight: '600',
    color: theme.text,
  },
  classInfo: {
    fontSize: compact ? 12 : 13,
    color: theme.textSecondary,
    marginTop: 2,
  },
  
  // Days
  daysContainer: {
    marginLeft: 8,
  },
  daysText: {
    fontSize: compact ? 12 : 13,
    fontWeight: '500',
    color: theme.textSecondary,
  },
  daysTextToday: {
    color: '#B45309',
    fontWeight: '700',
  },
  
  // View More
  viewMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 12,
    gap: 4,
  },
  viewMoreText: {
    fontSize: 14,
    color: theme.primary,
    fontWeight: '500',
  },
});

export default UpcomingBirthdaysCard;
