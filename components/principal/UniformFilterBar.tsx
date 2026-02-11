import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { UniformRegisterFilter } from '@/hooks/useUniformRegister';

interface Props {
  filter: UniformRegisterFilter;
  setFilter: React.Dispatch<React.SetStateAction<UniformRegisterFilter>>;
}

const STATUS_OPTIONS: { value: UniformRegisterFilter['status']; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'paid', label: '✅ Paid' },
  { value: 'partial', label: '⏳ Partial' },
  { value: 'unpaid', label: '❌ Unpaid' },
];

const FORM_OPTIONS: { value: UniformRegisterFilter['filledOut']; label: string }[] = [
  { value: 'all', label: 'All Forms' },
  { value: 'yes', label: '📝 Filled' },
  { value: 'no', label: '📋 Pending' },
];

export default function UniformFilterBar({ filter, setFilter }: Props) {
  return (
    <View style={styles.wrapper}>
      {/* Search */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={18} color="#9ca3af" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search student or parent…"
          placeholderTextColor="#9ca3af"
          value={filter.searchQuery}
          onChangeText={(text) => setFilter((p) => ({ ...p, searchQuery: text }))}
        />
        {filter.searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setFilter((p) => ({ ...p, searchQuery: '' }))}>
            <Ionicons name="close-circle" size={18} color="#9ca3af" />
          </TouchableOpacity>
        )}
      </View>

      {/* Status chips */}
      <View style={styles.chipRow}>
        {STATUS_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.chip, filter.status === opt.value && styles.chipActive]}
            onPress={() => setFilter((p) => ({ ...p, status: opt.value }))}
          >
            <Text style={[styles.chipText, filter.status === opt.value && styles.chipTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Form filled chips */}
      <View style={styles.chipRow}>
        {FORM_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.chip, filter.filledOut === opt.value && styles.chipActive]}
            onPress={() => setFilter((p) => ({ ...p, filledOut: opt.value }))}
          >
            <Text style={[styles.chipText, filter.filledOut === opt.value && styles.chipTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 12, gap: 8 },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  searchInput: { flex: 1, fontSize: 14, color: '#111' },
  chipRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb',
  },
  chipActive: { backgroundColor: '#1e40af', borderColor: '#1e40af' },
  chipText: { fontSize: 12, color: '#374151', fontWeight: '500' },
  chipTextActive: { color: '#fff' },
});
