/**
 * Filter controls for AI Quota school list
 * @module components/super-admin/ai-quotas/QuotaFiltersBar
 */

import React from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import type { QuotaFilters } from './types';
import { getPlanFilterLabel, getStatusFilterLabel } from './utils';

interface QuotaFiltersBarProps {
  filters: QuotaFilters;
  onFiltersChange: (filters: QuotaFilters) => void;
}

const PLAN_OPTIONS = ['all', 'free', 'basic', 'pro', 'enterprise'] as const;
const STATUS_OPTIONS = ['all', 'normal', 'over_limit', 'suspended'] as const;

export function QuotaFiltersBar({ filters, onFiltersChange }: QuotaFiltersBarProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.filtersContainer}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search schools..."
        placeholderTextColor={theme.textTertiary}
        value={filters.search}
        onChangeText={(text) => onFiltersChange({ ...filters, search: text })}
      />
      
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterTabs}>
        {PLAN_OPTIONS.map((plan) => (
          <TouchableOpacity
            key={plan}
            style={[styles.filterTab, filters.plan === plan && styles.filterTabActive]}
            onPress={() => onFiltersChange({ ...filters, plan })}
          >
            <Text style={[styles.filterTabText, filters.plan === plan && styles.filterTabTextActive]}>
              {getPlanFilterLabel(plan)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterTabs}>
        {STATUS_OPTIONS.map((status) => (
          <TouchableOpacity
            key={status}
            style={[styles.filterTab, filters.status === status && styles.filterTabActive]}
            onPress={() => onFiltersChange({ ...filters, status })}
          >
            <Text style={[styles.filterTabText, filters.status === status && styles.filterTabTextActive]}>
              {getStatusFilterLabel(status)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  filtersContainer: {
    backgroundColor: '#1f2937',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  searchInput: {
    backgroundColor: '#374151',
    color: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
    fontSize: 16,
  },
  filterTabs: {
    marginBottom: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#374151',
    marginRight: 8,
  },
  filterTabActive: {
    backgroundColor: '#00f5ff',
  },
  filterTabText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '500',
  },
  filterTabTextActive: {
    color: '#0b1220',
  },
});
