/**
 * Birthday Chart Component
 * 
 * Displays all students' birthdays organized by month in a visual chart format.
 * Accessible to parents, teachers, and principals for at-a-glance birthday viewing.
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import type { StudentBirthday } from '@/services/BirthdayPlannerService';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTH_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD',
  '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9', '#F8B500', '#58D68D'
];

interface BirthdayChartProps {
  birthdays: StudentBirthday[];
  loading?: boolean;
  showHeader?: boolean;
  compact?: boolean;
  onStudentPress?: (studentId: string) => void;
}

interface MonthData {
  month: number;
  name: string;
  birthdays: StudentBirthday[];
  color: string;
}

export function BirthdayChart({
  birthdays,
  loading = false,
  showHeader = true,
  compact = false,
  onStudentPress,
}: BirthdayChartProps) {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  // Group birthdays by month
  const monthlyData: MonthData[] = useMemo(() => {
    const grouped: Map<number, StudentBirthday[]> = new Map();
    
    // Initialize all months
    for (let i = 0; i < 12; i++) {
      grouped.set(i, []);
    }
    
    // Group birthdays by birth month
    birthdays.forEach(birthday => {
      const dob = new Date(birthday.dateOfBirth);
      const month = dob.getMonth();
      const existing = grouped.get(month) || [];
      existing.push(birthday);
      grouped.set(month, existing);
    });
    
    // Sort birthdays within each month by day
    return MONTHS.map((name, index) => {
      const monthBirthdays = grouped.get(index) || [];
      monthBirthdays.sort((a, b) => {
        const dayA = new Date(a.dateOfBirth).getDate();
        const dayB = new Date(b.dateOfBirth).getDate();
        return dayA - dayB;
      });
      
      return {
        month: index,
        name,
        birthdays: monthBirthdays,
        color: MONTH_COLORS[index],
      };
    });
  }, [birthdays]);

  // Current month for highlighting
  const currentMonth = new Date().getMonth();
  const currentDay = new Date().getDate();

  // Get today's birthdays
  const todaysBirthdays = useMemo(() => {
    return birthdays.filter(b => {
      const dob = new Date(b.dateOfBirth);
      return dob.getMonth() === currentMonth && dob.getDate() === currentDay;
    });
  }, [birthdays, currentMonth, currentDay]);

  const handleStudentPress = (studentId: string) => {
    if (onStudentPress) {
      onStudentPress(studentId);
    } else {
      router.push(`/screens/student-detail?id=${studentId}`);
    }
  };

  const styles = createStyles(theme, isDark, compact);

  if (loading) {
    return (
      <View style={styles.container}>
        {showHeader && (
          <View style={styles.header}>
            <Text style={styles.title}>🎂 Birthday Chart</Text>
          </View>
        )}
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading birthdays...</Text>
        </View>
      </View>
    );
  }

  const totalBirthdays = birthdays.length;

  return (
    <View style={styles.container}>
      {showHeader && (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>🎂 Birthday Chart</Text>
            <Text style={styles.subtitle}>
              {totalBirthdays} {totalBirthdays === 1 ? 'student' : 'students'}
            </Text>
          </View>
          {todaysBirthdays.length > 0 && (
            <View style={styles.todayBadge}>
              <Text style={styles.todayBadgeText}>
                🎉 {todaysBirthdays.length} today!
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Today's Birthdays Banner */}
      {todaysBirthdays.length > 0 && (
        <View style={styles.todayBanner}>
          <Text style={styles.todayBannerEmoji}>🎉</Text>
          <View style={styles.todayBannerContent}>
            <Text style={styles.todayBannerTitle}>Today's Birthdays!</Text>
            <Text style={styles.todayBannerNames}>
              {todaysBirthdays.map(b => b.firstName).join(', ')}
            </Text>
          </View>
        </View>
      )}

      {/* Month Grid */}
      <ScrollView 
        horizontal={compact}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={compact ? styles.monthGridHorizontal : undefined}
      >
        <View style={compact ? styles.monthRowCompact : styles.monthGrid}>
          {monthlyData.map((monthData) => {
            const isCurrentMonth = monthData.month === currentMonth;
            const isSelected = selectedMonth === monthData.month;
            const hasNoData = monthData.birthdays.length === 0;
            
            return (
              <TouchableOpacity
                key={monthData.month}
                style={[
                  styles.monthCard,
                  isCurrentMonth && styles.monthCardCurrent,
                  isSelected && styles.monthCardSelected,
                  hasNoData && styles.monthCardEmpty,
                  { borderColor: monthData.color },
                ]}
                onPress={() => setSelectedMonth(isSelected ? null : monthData.month)}
                activeOpacity={0.7}
              >
                <View style={[styles.monthHeader, { backgroundColor: monthData.color + '20' }]}>
                  <Text style={[styles.monthName, { color: monthData.color }]}>
                    {compact ? monthData.name.slice(0, 3) : monthData.name}
                  </Text>
                  <View style={[styles.countBadge, { backgroundColor: monthData.color }]}>
                    <Text style={styles.countText}>
                      {monthData.birthdays.length}
                    </Text>
                  </View>
                </View>
                
                {!compact && (
                  <View style={styles.monthContent}>
                    {monthData.birthdays.length === 0 ? (
                      <Text style={styles.noDataText}>No birthdays</Text>
                    ) : (
                      <View style={styles.avatarRow}>
                        {monthData.birthdays.slice(0, 4).map((birthday, index) => (
                          <View key={birthday.id} style={[styles.avatarWrapper, { zIndex: 4 - index }]}>
                            {birthday.photoUrl ? (
                              <Image source={{ uri: birthday.photoUrl }} style={styles.miniAvatar} />
                            ) : (
                              <View style={[styles.miniAvatar, styles.miniAvatarPlaceholder, { backgroundColor: monthData.color + '30' }]}>
                                <Text style={[styles.miniAvatarText, { color: monthData.color }]}>
                                  {birthday.firstName.charAt(0)}
                                </Text>
                              </View>
                            )}
                          </View>
                        ))}
                        {monthData.birthdays.length > 4 && (
                          <View style={[styles.moreCount, { backgroundColor: monthData.color }]}>
                            <Text style={styles.moreCountText}>+{monthData.birthdays.length - 4}</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Expanded Month Detail */}
      {selectedMonth !== null && (
        <View style={styles.detailSection}>
          <View style={styles.detailHeader}>
            <Text style={styles.detailTitle}>
              {MONTHS[selectedMonth]} Birthdays
            </Text>
            <TouchableOpacity onPress={() => setSelectedMonth(null)}>
              <Ionicons name="close-circle" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
          
          {monthlyData[selectedMonth].birthdays.length === 0 ? (
            <View style={styles.emptyDetail}>
              <Text style={styles.emptyDetailText}>No birthdays in {MONTHS[selectedMonth]}</Text>
            </View>
          ) : (
            <ScrollView style={styles.detailList} nestedScrollEnabled>
              {monthlyData[selectedMonth].birthdays.map((birthday) => {
                const dob = new Date(birthday.dateOfBirth);
                const day = dob.getDate();
                const isToday = dob.getMonth() === currentMonth && day === currentDay;
                
                return (
                  <TouchableOpacity
                    key={birthday.id}
                    style={[styles.birthdayRow, isToday && styles.birthdayRowToday]}
                    onPress={() => handleStudentPress(birthday.studentId)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.dateCircle}>
                      <Text style={styles.dateText}>{day}</Text>
                    </View>
                    
                    {birthday.photoUrl ? (
                      <Image source={{ uri: birthday.photoUrl }} style={styles.studentAvatar} />
                    ) : (
                      <View style={[styles.studentAvatar, styles.avatarPlaceholder]}>
                        <Text style={styles.avatarText}>{birthday.firstName.charAt(0)}</Text>
                      </View>
                    )}
                    
                    <View style={styles.studentInfo}>
                      <Text style={styles.studentName}>
                        {birthday.firstName} {birthday.lastName}
                        {isToday && ' 🎉'}
                      </Text>
                      <Text style={styles.studentClass}>
                        {birthday.className || 'No Class'} • Turning {birthday.age}
                      </Text>
                    </View>
                    
                    <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
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
    marginBottom: 16,
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
  },
  subtitle: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 2,
  },
  todayBadge: {
    backgroundColor: '#FFD700' + '30',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  todayBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FF6B00',
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  todayBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD700' + '20',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FFD700',
  },
  todayBannerEmoji: {
    fontSize: 28,
    marginRight: 12,
  },
  todayBannerContent: {
    flex: 1,
  },
  todayBannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.text,
  },
  todayBannerNames: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 2,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  monthGridHorizontal: {
    paddingVertical: 4,
  },
  monthRowCompact: {
    flexDirection: 'row',
    gap: 8,
  },
  monthCard: {
    width: compact ? 70 : '48%',
    backgroundColor: theme.background,
    borderRadius: 12,
    marginBottom: compact ? 0 : 8,
    borderWidth: 2,
    overflow: 'hidden',
  },
  monthCardCurrent: {
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  monthCardSelected: {
    borderWidth: 3,
  },
  monthCardEmpty: {
    opacity: 0.6,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: compact ? 8 : 12,
    paddingVertical: compact ? 6 : 8,
  },
  monthName: {
    fontSize: compact ? 12 : 14,
    fontWeight: '600',
  },
  countBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  monthContent: {
    padding: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  noDataText: {
    fontSize: 11,
    color: theme.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    marginLeft: -8,
  },
  miniAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: theme.card,
  },
  miniAvatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniAvatarText: {
    fontSize: 11,
    fontWeight: '600',
  },
  moreCount: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -8,
  },
  moreCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  detailSection: {
    marginTop: 16,
    backgroundColor: theme.background,
    borderRadius: 12,
    padding: 12,
    maxHeight: 300,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
  },
  emptyDetail: {
    padding: 24,
    alignItems: 'center',
  },
  emptyDetailText: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  detailList: {
    maxHeight: 220,
  },
  birthdayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  birthdayRowToday: {
    backgroundColor: '#FFD700' + '15',
    marginHorizontal: -12,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  dateCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.primary,
  },
  studentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  avatarPlaceholder: {
    backgroundColor: theme.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.primary,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.text,
  },
  studentClass: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 2,
  },
});

export default BirthdayChart;
