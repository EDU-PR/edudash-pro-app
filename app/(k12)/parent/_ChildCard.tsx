/**
 * K-12 Parent Dashboard Child Card Component
 * 
 * Displays a child card with name, grade, avatar, and stats.
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { track } from '@/lib/analytics';
import { styles } from './_dashboard.styles';

export interface Child {
  id: string;
  name: string;
  grade: string;
  avatar: string;
  avgGrade: string;
  attendance: number;
  pendingAssignments: number;
  color: string;
  dateOfBirth?: string;
  classId?: string;
  className?: string;
}

interface ChildCardProps {
  child: Child;
  colors: any;
}

export const ChildCard: React.FC<ChildCardProps> = ({ child, colors }) => (
  <TouchableOpacity 
    style={[styles.childCard, { backgroundColor: colors.surface }]}
    activeOpacity={0.7}
    onPress={() => {
      track('k12.parent.child_card_tap', { childId: child.id });
      // TODO: Navigate to child detail when route exists
      // router.push(`/(k12)/parent/children/${child.id}` as any);
    }}
  >
    <View style={styles.childCardHeader}>
      <LinearGradient
        colors={[child.color, child.color + 'CC']}
        style={styles.childAvatar}
      >
        <Text style={styles.childAvatarText}>{child.avatar}</Text>
      </LinearGradient>
      <View style={styles.childInfo}>
        <Text style={[styles.childName, { color: colors.text }]}>{child.name}</Text>
        <Text style={[styles.childGrade, { color: colors.textSecondary }]}>{child.grade}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    </View>
    <View style={styles.childStats}>
      <View style={styles.childStat}>
        <Text style={[styles.childStatValue, { color: '#F59E0B' }]}>{child.avgGrade}</Text>
        <Text style={[styles.childStatLabel, { color: colors.textSecondary }]}>Average</Text>
      </View>
      <View style={[styles.childStatDivider, { backgroundColor: colors.border }]} />
      <View style={styles.childStat}>
        <Text style={[styles.childStatValue, { color: '#10B981' }]}>{child.attendance}%</Text>
        <Text style={[styles.childStatLabel, { color: colors.textSecondary }]}>Attendance</Text>
      </View>
      <View style={[styles.childStatDivider, { backgroundColor: colors.border }]} />
      <View style={styles.childStat}>
        <Text style={[styles.childStatValue, { color: '#3B82F6' }]}>{child.pendingAssignments}</Text>
        <Text style={[styles.childStatLabel, { color: colors.textSecondary }]}>Pending</Text>
      </View>
    </View>
  </TouchableOpacity>
);
