/**
 * RegistrationFilters Component
 * 
 * Search box and status filter tabs for registration list.
 * Extracted from principal-registrations.tsx per WARP.md file size standards.
 */

import React from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { StatusFilter } from '@/hooks/useRegistrations';

interface RegistrationFiltersProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (filter: StatusFilter) => void;
  pendingCount: number;
}

const STATUS_FILTERS: StatusFilter[] = ['all', 'pending', 'approved', 'rejected'];

export const RegistrationFilters: React.FC<RegistrationFiltersProps> = ({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  pendingCount,
}) => {
  const { theme } = useTheme();
  const colors = theme;

  return (
    <View style={[styles.filterContainer, { backgroundColor: colors.surface }]}>
      <View style={[styles.searchBox, { backgroundColor: colors.background }]}>
        <Ionicons name="search" size={20} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search by name, email, phone..."
          placeholderTextColor={colors.textSecondary}
          value={searchTerm}
          onChangeText={onSearchChange}
        />
        {searchTerm.length > 0 && (
          <TouchableOpacity onPress={() => onSearchChange('')}>
            <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
      
      {/* Status Filter Tabs */}
      <View style={styles.filterTabs}>
        {STATUS_FILTERS.map((status) => (
          <TouchableOpacity
            key={status}
            style={[
              styles.filterTab,
              statusFilter === status && { backgroundColor: colors.primary },
            ]}
            onPress={() => onStatusFilterChange(status)}
          >
            <Text style={[
              styles.filterTabText,
              { color: statusFilter === status ? '#fff' : colors.textSecondary },
            ]}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
              {status === 'pending' && pendingCount > 0 && ` (${pendingCount})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  filterContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
  },
  filterTabs: {
    flexDirection: 'row',
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

export default RegistrationFilters;
