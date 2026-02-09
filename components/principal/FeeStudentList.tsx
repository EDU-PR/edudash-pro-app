/**
 * FeeStudentList — search, filter chips, and student cards
 * for the fee overview screen.
 */

import React from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { StudentWithFees, FilterType } from '@/hooks/fee-overview';

interface Props {
  students: StudentWithFees[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filter: FilterType;
  setFilter: (f: FilterType) => void;
  isFullyPaid: (s: StudentWithFees) => boolean;
  formatCurrency: (amount: number) => string;
  onStudentPress: (id: string) => void;
  theme: any;
  styles: any;
}

export function FeeStudentList({
  students, searchQuery, setSearchQuery,
  filter, setFilter, isFullyPaid, formatCurrency,
  onStudentPress, theme, styles,
}: Props) {
  return (
    <>
      {/* Search and Filter */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={theme.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search students..."
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

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {(['all', 'outstanding', 'overdue', 'paid'] as FilterType[]).map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, filter === f && styles.filterChipActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
                {f === 'all' ? 'All Students' : f === 'outstanding' ? 'Outstanding' : f === 'overdue' ? 'Overdue' : 'Fully Paid'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Students List */}
      <View style={styles.studentsSection}>
        <Text style={styles.sectionTitle}>Students ({students.length})</Text>

        {students.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color={theme.textSecondary} />
            <Text style={styles.emptyTitle}>No Students Found</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery ? 'Try a different search term' : 'No students match the current filter'}
            </Text>
          </View>
        ) : (
          students.map(student => (
            <TouchableOpacity
              key={student.id}
              style={styles.studentCard}
              onPress={() => onStudentPress(student.id)}
              activeOpacity={0.7}
            >
              <View style={styles.studentHeader}>
                <View style={styles.studentAvatar}>
                  <Text style={styles.avatarText}>
                    {student.first_name.charAt(0)}{student.last_name.charAt(0)}
                  </Text>
                </View>
                <View style={styles.studentInfo}>
                  <Text style={styles.studentName}>{student.first_name} {student.last_name}</Text>
                  <Text style={styles.studentMeta}>
                    {student.class_name || 'No Class'}
                    {student.parent_name && ` \u2022 ${student.parent_name}`}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
              </View>

              <View style={styles.feeRow}>
                {student.fees.outstanding > 0 && (
                  <View style={[styles.feeBadge, { backgroundColor: theme.error + '15' }]}>
                    <Text style={[styles.feeBadgeText, { color: theme.error }]}>
                      {formatCurrency(student.fees.outstanding)} due
                    </Text>
                  </View>
                )}
                {student.fees.overdue_count > 0 && (
                  <View style={[styles.feeBadge, { backgroundColor: theme.warning + '15' }]}>
                    <Ionicons name="alert-circle" size={12} color={theme.warning} />
                    <Text style={[styles.feeBadgeText, { color: theme.warning }]}>
                      {student.fees.overdue_count} overdue
                    </Text>
                  </View>
                )}
                {isFullyPaid(student) && (
                  <View style={[styles.feeBadge, { backgroundColor: theme.success + '15' }]}>
                    <Ionicons name="checkmark-circle" size={12} color={theme.success} />
                    <Text style={[styles.feeBadgeText, { color: theme.success }]}>Up to date</Text>
                  </View>
                )}
                {student.fees.waived > 0 && (
                  <View style={[styles.feeBadge, { backgroundColor: '#6B728015' }]}>
                    <Text style={[styles.feeBadgeText, { color: '#6B7280' }]}>
                      {formatCurrency(student.fees.waived)} waived
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    </>
  );
}
