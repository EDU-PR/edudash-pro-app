/**
 * Principal Reports Screen
 * 
 * Central hub for principals to access all report types:
 * - Financial Reports (fees, payments, revenue)
 * - Student Reports (attendance, performance)
 * - Teacher Reports (classroom analytics)
 * - Registration Reports (enrollment trends)
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ScreenHeader } from '@/components/ui/ScreenHeader';

const { width } = Dimensions.get('window');
const isTablet = width > 768;

interface ReportCategory {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  route: string;
  badge?: number;
}

export default function PrincipalReportsScreen() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const reportCategories: ReportCategory[] = [
    {
      id: 'financial',
      title: 'Financial Reports',
      description: 'Revenue, payments, fees collected, and financial trends',
      icon: 'cash',
      color: '#10B981',
      route: '/screens/financial-reports',
    },
    {
      id: 'registrations',
      title: 'Registration Reports',
      description: 'Enrollment trends, pending registrations, and approval rates',
      icon: 'person-add',
      color: '#6366F1',
      route: '/screens/principal-registrations',
    },
    {
      id: 'students',
      title: 'Student Reports',
      description: 'Student performance, attendance, and progress tracking',
      icon: 'people',
      color: '#8B5CF6',
      route: '/screens/student-management',
    },
    {
      id: 'teachers',
      title: 'Teacher Reports',
      description: 'Classroom analytics and teacher performance',
      icon: 'school',
      color: '#F59E0B',
      route: '/screens/teacher-reports',
    },
    {
      id: 'attendance',
      title: 'Attendance Reports',
      description: 'Daily attendance records and trends',
      icon: 'calendar-outline',
      color: '#EC4899',
      route: '/screens/attendance-reports',
    },
    {
      id: 'payments',
      title: 'Payment Reports',
      description: 'POP uploads, verification status, and payment history',
      icon: 'receipt',
      color: '#06B6D4',
      route: '/screens/pop-review',
    },
  ];

  const handleCategoryPress = (category: ReportCategory) => {
    router.push(category.route as any);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="Reports"
        subtitle={`${profile?.organization_name || 'School'} Analytics`}
      />
      
      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Report Categories</Text>
        
        <View style={styles.grid}>
          {reportCategories.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={styles.card}
              onPress={() => handleCategoryPress(category)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, { backgroundColor: `${category.color}15` }]}>
                <Ionicons name={category.icon as any} size={28} color={category.color} />
              </View>
              <Text style={styles.cardTitle}>{category.title}</Text>
              <Text style={styles.cardDescription} numberOfLines={2}>
                {category.description}
              </Text>
              <View style={styles.cardFooter}>
                <Text style={[styles.viewLink, { color: category.color }]}>View Reports</Text>
                <Ionicons name="chevron-forward" size={16} color={category.color} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Quick Stats Summary */}
        <View style={styles.summarySection}>
          <Text style={styles.sectionTitle}>Quick Summary</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Ionicons name="trending-up" size={20} color="#10B981" />
                <Text style={styles.summaryLabel}>This Month</Text>
                <Text style={styles.summaryValue}>View Trends →</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Ionicons name="download" size={20} color="#6366F1" />
                <Text style={styles.summaryLabel}>Export</Text>
                <Text style={styles.summaryValue}>Coming Soon</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      padding: 16,
      paddingBottom: 32,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 16,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -8,
    },
    card: {
      width: isTablet ? '31%' : '47%',
      backgroundColor: theme.cardBackground,
      borderRadius: 16,
      padding: 16,
      margin: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    iconContainer: {
      width: 52,
      height: 52,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 6,
    },
    cardDescription: {
      fontSize: 12,
      color: theme.textSecondary,
      lineHeight: 18,
      marginBottom: 12,
    },
    cardFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 'auto',
    },
    viewLink: {
      fontSize: 13,
      fontWeight: '600',
    },
    summarySection: {
      marginTop: 24,
    },
    summaryCard: {
      backgroundColor: theme.cardBackground,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.border,
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    summaryItem: {
      flex: 1,
      alignItems: 'center',
    },
    summaryDivider: {
      width: 1,
      height: 50,
      backgroundColor: theme.border,
      marginHorizontal: 16,
    },
    summaryLabel: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 8,
    },
    summaryValue: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      marginTop: 4,
    },
  });
