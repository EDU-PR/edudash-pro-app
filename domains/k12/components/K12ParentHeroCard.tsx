/**
 * K12ParentHeroCard
 *
 * Top-of-dashboard card showing active child info, grade badge, attendance %,
 * and pending tasks. Includes a horizontal child switcher (pill tabs).
 */

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Pill } from '@/components/nextgen/Pill';
import type { ThemeColors } from '@/contexts/ThemeContext';
import type { Child } from '@/domains/k12/components/K12ParentChildCard';
import type { DashboardSummary } from '@/domains/k12/hooks/useK12ParentDashboard';
import { styles } from './K12ParentDashboard.styles';

interface K12ParentHeroCardProps {
  children: Child[];
  activeChildIndex: number;
  onSwitchChild: (index: number) => void;
  dashboardSummary: DashboardSummary;
  tierBadgeLabel: string;
  theme: ThemeColors;
}

export function K12ParentHeroCard({
  children: childrenList,
  activeChildIndex,
  onSwitchChild,
  dashboardSummary,
  tierBadgeLabel,
  theme,
}: K12ParentHeroCardProps) {
  const { t } = useTranslation();
  const activeChild = childrenList.length > 0
    ? childrenList[Math.min(activeChildIndex, childrenList.length - 1)]
    : null;

  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)']}
      style={styles.heroSummaryCard}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      {/* Child Switcher Pills */}
      {childrenList.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.childSwitcherRow}
        >
          {childrenList.map((child, idx) => (
            <TouchableOpacity
              key={child.id}
              onPress={() => onSwitchChild(idx)}
              style={[
                styles.childPill,
                idx === activeChildIndex && styles.childPillActive,
              ]}
            >
              <Text
                style={[
                  styles.childPillText,
                  idx === activeChildIndex && styles.childPillTextActive,
                ]}
              >
                {child.name.split(' ')[0]}
                {idx === activeChildIndex ? ' ✓' : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Hero Title Row */}
      <View style={styles.heroSummaryTopRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.heroSummaryTitle, { color: theme.text }]}>
            {dashboardSummary.activeChildName
              ? `${dashboardSummary.activeChildName}'s Dashboard`
              : t('dashboard.parentDashboard', { defaultValue: 'Parent Dashboard' })}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <LinearGradient
              colors={['#3C8E62', '#2E7D59']}
              style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, gap: 6 }}
            >
              <Ionicons name="school" size={12} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>
                {dashboardSummary.activeChildGrade || 'Grade'}
              </Text>
            </LinearGradient>
            {dashboardSummary.activeChildClassName && (
              <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                {dashboardSummary.activeChildClassName}
              </Text>
            )}
            {activeChild?.avatarUrl ? (
              <Image
                source={{ uri: activeChild.avatarUrl }}
                style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' }}
                onError={() => undefined}
              />
            ) : null}
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Pill tone="accent" compact label={tierBadgeLabel} />
        </View>
      </View>

      {/* Stats Row */}
      <View style={styles.heroSummaryStatsRow}>
        <View style={styles.heroSummaryStat}>
          <Text style={[styles.heroSummaryValue, { color: theme.text }]}>
            {dashboardSummary.activeChildAvgGrade || '--'}
          </Text>
          <Text style={[styles.heroSummaryLabel, { color: theme.textSecondary }]}>
            {t('dashboard.parent.k12.avg_grade', { defaultValue: 'Avg Grade' })}
          </Text>
        </View>
        <View style={styles.heroStatDivider} />
        <View style={styles.heroSummaryStat}>
          <Text style={[styles.heroSummaryValue, { color: '#3C8E62' }]}>
            {dashboardSummary.activeChildAttendance}%
          </Text>
          <Text style={[styles.heroSummaryLabel, { color: theme.textSecondary }]}>
            {t('dashboard.parent.nav.attendance', { defaultValue: 'Attendance' })}
          </Text>
        </View>
        <View style={styles.heroStatDivider} />
        <View style={styles.heroSummaryStat}>
          <Text style={[styles.heroSummaryValue, { color: theme.text }]}>
            {dashboardSummary.activeChildPendingTasks}
          </Text>
          <Text style={[styles.heroSummaryLabel, { color: theme.textSecondary }]}>
            {t('teacher.pending', { defaultValue: 'Pending' })}
          </Text>
        </View>
      </View>
    </LinearGradient>
  );
}
